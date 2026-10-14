import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const cli = fileURLToPath(new URL("../scripts/discoveries/grokbot_webhook.py", import.meta.url));
const requestId = "discovery_20261014_test";
const testEnv = {
  GROKBOT_WEBHOOK_URL: "https://api2.cursor.sh/hooks/test",
  GROKBOT_WEBHOOK_SECRET: "crsr_" + "test-only-credential-".repeat(4),
  GROKBOT_RELAY_URL: "https://relay.example.com",
  GROKBOT_RELAY_READ_SECRET: "test-only-read-secret",
  GROKBOT_CALLBACK_SECRET: "test-only-callback-secret",
};

// Only the HTTP boundary is replaced. Argument parsing, credentials, payload,
// fsync/atomic state writes, duplicate detection and result validation are real.
const harness = String.raw`
import contextlib, importlib.util, io, json, os, pathlib, sys, urllib.error, urllib.request
settings = json.loads(sys.stdin.read())
spec = importlib.util.spec_from_file_location("grok_cli", settings["cli"])
if not pathlib.Path(settings["cli"]).exists():
    missing={"code": 0, "output": {"error": "cli_not_implemented"}}
    print(json.dumps({**missing,"outputs":[missing for _ in settings["commands"]],"calls":[]}))
    sys.exit(0)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
calls = []
responses = iter(settings.get("responses", []))
class Reply:
    def __init__(self, value):
        self.status = value.get("status", 200)
        self.data = value.get("raw", json.dumps(value.get("body", {}))).encode()
    def __enter__(self): return self
    def __exit__(self, *args): pass
    def read(self, size=-1):
        result = self.data if size < 0 else self.data[:size]
        self.data = self.data[len(result):]
        return result
def fake_open(self, request, timeout=None, **kwargs):
    files = list((pathlib.Path(os.environ["GROKBOT_WEBHOOK_STATE_DIR"])/"requests").glob("*.json"))
    metadata = [json.loads(path.read_text()) for path in files]
    calls.append({"url": request.full_url, "method": request.get_method(),
      "timeout": timeout, "payload": json.loads(request.data) if request.data else None,
      "authorization": request.get_header("Authorization"), "metadata": metadata})
    response = next(responses, {"error": "unexpected_network"})
    if response.get("error"):
        raise urllib.error.URLError(response["error"])
    if response.get("status", 200) >= 300:
        raise urllib.error.HTTPError(request.full_url, response["status"], "SECRET_RESPONSE", {}, io.BytesIO(b"SECRET_RESPONSE"))
    return Reply(response)
urllib.request.OpenerDirector.open = fake_open
outputs=[]
for arguments in settings["commands"]:
    sys.argv=[settings["cli"], *arguments]
    sys.stdin=io.StringIO(settings.get("task", "Find public owner-device hardware projects"))
    stdout, stderr=io.StringIO(), io.StringIO()
    with contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
        try: code=module.main()
        except SystemExit as error: code=error.code
    raw=stdout.getvalue()
    try: output=json.loads(raw)
    except ValueError: output={"raw": raw}
    outputs.append({"code":code,"output":output,"stderr":stderr.getvalue()})
print(json.dumps({**outputs[-1],"outputs":outputs,"calls":calls}))
`;

function invoke(options: {
  commands: string[][];
  responses?: Array<Record<string, unknown>>;
  env?: Record<string, string>;
  task?: string;
}) {
  const dir = mkdtempSync(join(tmpdir(), "hackshop-grok-cli-"));
  const env = { ...process.env, ...testEnv, GROKBOT_WEBHOOK_STATE_DIR: dir,
    GROKBOT_CONFIG_PATH: join(dir, "no-real-config.json"), ...options.env };
  const executed = spawnSync("python3", ["-c", harness], {
    env, encoding: "utf8", timeout: 5000, maxBuffer: 3_000_000,
    input: JSON.stringify({ cli, ...options }),
  });
  expect(executed.status, executed.stderr).toBe(0);
  const result = JSON.parse(executed.stdout);
  let metadata: any;
  try { metadata = JSON.parse(readFileSync(join(dir, "requests", `${requestId}.json`), "utf8")); } catch { /* optional on stateless reads */ }
  rmSync(dir, { recursive: true, force: true });
  return { ...result, metadata } as any;
}

const send = ["send", "--request-id", requestId, "--task-stdin", "--wait", "0", "--keep-remote", "--json"];
const status = ["status", "--request-id", requestId, "--remote", "--keep-remote", "--json"];

describe("portable GrokBot webhook CLI", () => {
  it("checks credential presence without network calls or exposing configuration values", () => {
    const ready = invoke({ commands: [["check-config", "--json"]] });
    expect(ready.output).toEqual({ configured: true, webhook_host: "api2.cursor.sh", relay_host: "relay.example.com" });
    expect(ready.calls).toEqual([]);
    const missing = invoke({ commands: [["check-config", "--json"]], env: { GROKBOT_WEBHOOK_SECRET: "" } });
    expect(missing.output).toEqual({ configured: false, error: "missing_credentials" });
    expect(missing.calls).toEqual([]);
  });

  it.each(["crsr_short", "crsr_" + "x".repeat(40) + " with whitespace", "whsec_!!!!", "whsec_YQ=="])("rejects malformed webhook credential %s before reserving an attempt", (credential) => {
    const result = invoke({ commands: [["check-config", "--json"]], env: { GROKBOT_WEBHOOK_SECRET: credential } });
    expect(result.output).toEqual({ configured: false, error: "invalid_webhook_credential" });
    expect(result.calls).toEqual([]);
    expect(result.code).toBe(0);
    expect(result.stderr).toBe("");
  });

  it("persists the explicit receipt before one HTTP200 bridge submission", () => {
    const result = invoke({ commands: [send], responses: [{ body: { success: true, runUuid: "bridge-run-test" } }] });
    expect(result.code).toBe(0);
    expect(result.output).toMatchObject({ request_id: requestId, status: "accepted", http_status: 200, provider_run_id: "bridge-run-test" });
    expect(result.output.result).toBeUndefined();
    expect(result.calls).toHaveLength(1);
    expect(result.calls[0]).toMatchObject({ timeout: 30, method: "POST", url: "https://api2.cursor.sh/hooks/test" });
    expect(result.calls[0].metadata).toContainEqual(expect.objectContaining({ request_id: requestId, status: "sending" }));
    expect(result.calls[0].payload).toMatchObject({ request_id: requestId, callback_url: "https://relay.example.com/api/grok/result", task: "Find public owner-device hardware projects" });
    expect(result.calls[0].payload.callback_token).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(result.output)).not.toContain("test-only");
  });

  it("never resends an explicit ID after transport acceptance becomes unknown", () => {
    const result = invoke({ commands: [send, send], responses: [{ error: "SECRET_TIMEOUT" }] });
    expect(result.outputs[0].output).toMatchObject({ request_id: requestId, status: "send_unknown" });
    expect(result.calls).toHaveLength(1);
    expect(result.output).toMatchObject({ request_id: requestId, status: "send_unknown", replayed: true });
    expect(JSON.stringify(result)).not.toContain("SECRET_TIMEOUT");
  });

  it.each([202, 204])("never turns an HTTP%s acknowledgement into completed research", (http) => {
    const result = invoke({ commands: [send], responses: [{ status: http, body: {} }] });
    expect(result.output.status).toBe(http === 202 ? "accepted" : "send_unknown");
    expect(result.output.result).toBeUndefined();
  });

  it.each([400, 401, 429, 500, 503, 302])("classifies HTTP%s without logging provider bodies or following redirects", (http) => {
    const result = invoke({ commands: [send], responses: [{ status: http }] });
    expect(result.output.status).toBe(http >= 400 && http < 500 ? "failed" : "send_unknown");
    expect(result.calls).toHaveLength(1);
    expect(result.code).toBe(http >= 400 && http < 500 ? 1 : 0);
    expect(result.stderr + JSON.stringify(result.output)).not.toContain("SECRET_RESPONSE");
  });

  it("recovers a completed result on a fresh runner without deleting the relay copy", () => {
    const result = invoke({ commands: [status], responses: [{ body: { request_id: requestId, status: "completed", received_at: "2026-10-14T21:00:00Z", result: { posts: [{ url: "https://x.com/maker/status/2110178596107248127" }] } } }] });
    expect(result.code).toBe(0);
    expect(result.output).toMatchObject({ request_id: requestId, status: "completed", completed_at: "2026-10-14T21:00:00Z" });
    expect(JSON.parse(result.output.result).posts).toHaveLength(1);
    expect(result.calls.map((call: any) => call.method)).toEqual(["GET"]);
  });

  it.each([204, 404])("retains a pending receipt for an empty relay HTTP%s", (http) => {
    const result = invoke({ commands: [status], responses: [{ status: http }] });
    expect(result.output).toMatchObject({ request_id: requestId, status: "pending" });
    expect(result.calls).toHaveLength(1);
  });

  it("rejects a mismatched relay ID rather than ingesting another request", () => {
    const result = invoke({ commands: [status], responses: [{ body: { request_id: "other_request_123", status: "completed", result: "Wrong job" } }] });
    expect(result.code).toBe(1);
    expect(result.output).toMatchObject({ request_id: requestId, error: "relay_request_identity_mismatch" });
    expect(result.output.result).toBeUndefined();
  });

  it("bounds relay bytes before parsing and does not expose oversized content", () => {
    const result = invoke({ commands: [status], responses: [{ raw: "x".repeat(1_000_001) }] });
    expect(result.code).toBe(1);
    expect(result.output.error).toBe("relay_result_too_large");
    expect(JSON.stringify(result.output).length).toBeLessThan(500);
  });

  it.each(["http://api2.cursor.sh/hook", "https://user:password@api2.cursor.sh/hook", "https://api2.cursor.sh:8443/hook", "https://127.0.0.1/hook", "https://[::1]/hook", "https://localhost/hook"])('rejects unsafe configured destination %s before network work', (url) => {
    const result = invoke({ commands: [send], env: { GROKBOT_WEBHOOK_URL: url } });
    expect(result.code).toBe(1);
    expect(result.output.error).toBe("invalid_webhook_url");
    expect(result.calls).toEqual([]);
  });

  it("rejects unsafe wait and ambiguous task sources before submission", () => {
    for (const args of [[...send, "--wait", "46"], [...send, "--task", "second source"]]) {
      const result = invoke({ commands: [args] });
      expect(result.code).toBe(1);
      expect(result.calls).toEqual([]);
    }
  });
});
