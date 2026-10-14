#!/usr/bin/env python3
"""Portable, bounded adaptation of the existing Codex GrokBot webhook CLI.

Source: ~/.codex/skills/grokbot-webhook/scripts/grokbot_webhook.py.
Uses its existing credential names, bearer/signature and callback HMAC protocol.
The webhook's underlying model/search implementation is not verified here.
No model API, website automation, retries, or relay DELETE are implemented.
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import hmac
import ipaddress
import json
import os
import re
import secrets
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

REQUEST_ID_RE = re.compile(r"^[A-Za-z0-9_-]{8,120}$")
MAX_TASK_BYTES = 100_000
MAX_REPLY_BYTES = 1_000_000
SAFE_FIELDS = {"request_id", "status", "created_at", "accepted_at", "completed_at",
               "http_status", "provider_run_id", "error", "result"}


class CliError(Exception):
    """Only fixed, credential-free error codes cross the CLI boundary."""


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise urllib.error.HTTPError(req.full_url, code, "redirect_blocked", headers, fp)


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def read_json(path: Path, maximum: int = 20_000) -> dict:
    with path.open("rb") as handle:
        raw = handle.read(maximum + 1)
    if len(raw) > maximum:
        raise CliError("local_state_too_large")
    try:
        value = json.loads(raw)
    except (ValueError, UnicodeError):
        raise CliError("invalid_local_state") from None
    if not isinstance(value, dict):
        raise CliError("invalid_local_state")
    return value


def setting(env_name: str, config_name: str) -> str:
    value = os.environ.get(env_name, "").strip()
    if value:
        return value
    path = Path(os.environ.get("GROKBOT_CONFIG_PATH", str(Path.home() / ".config/grokbot-webhook/config.json"))).expanduser()
    return str(read_json(path).get(config_name, "")).strip() if path.exists() else ""


def validate_https_url(value: str, label: str, origin_only: bool = False) -> str:
    try:
        url = urllib.parse.urlsplit(value)
        host = (url.hostname or "").lower()
        if (url.scheme != "https" or url.username is not None or url.password is not None
                or url.port is not None or url.fragment or not host or "." not in host
                or re.search(r"(^|\.)(localhost|local|internal|test|invalid)$", host)
                or not re.fullmatch(r"[a-z0-9.-]+", host)
                or host.startswith(".") or host.endswith(".") or ".." in host
                or (origin_only and (url.path not in ("", "/") or url.query))):
            raise ValueError()
        try:
            ipaddress.ip_address(host)
            raise ValueError()
        except ValueError as error:
            if re.fullmatch(r"[0-9.]+", host):
                raise error
        if all(re.fullmatch(r"(?:0x[0-9a-f]+|[0-9]+)", label) for label in host.split(".")):
            raise ValueError()
    except ValueError:
        raise CliError(f"invalid_{label}_url") from None
    return value.rstrip("/")


def credentials() -> tuple[str, str, str, str, str]:
    values = [setting(env, config) for env, config in [
        ("GROKBOT_WEBHOOK_URL", "webhook_url"),
        ("GROKBOT_WEBHOOK_SECRET", "webhook_secret"),
        ("GROKBOT_RELAY_URL", "relay_url"),
        ("GROKBOT_RELAY_READ_SECRET", "relay_read_secret"),
        ("GROKBOT_CALLBACK_SECRET", "relay_callback_secret"),
    ]]
    if not all(values):
        raise CliError("missing_credentials")
    values[0] = validate_https_url(values[0], "webhook")
    values[2] = validate_https_url(values[2], "relay", origin_only=True)
    return tuple(values)


def request_paths(request_id: str) -> tuple[Path, Path]:
    if not REQUEST_ID_RE.fullmatch(request_id):
        raise CliError("invalid_request_id")
    root = Path(os.environ.get("GROKBOT_WEBHOOK_STATE_DIR", str(Path.home() / ".local/share/grokbot-webhook"))).expanduser()
    for directory in (root, root / "requests", root / "responses"):
        directory.mkdir(parents=True, exist_ok=True, mode=0o700)
    return root / "requests" / f"{request_id}.json", root / "responses" / f"{request_id}.md"


def atomic_write(path: Path, content: bytes) -> None:
    temp = path.with_name(f".{path.name}.{secrets.token_hex(4)}.tmp")
    descriptor = os.open(temp, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, "wb") as handle:
        handle.write(content)
        handle.flush()
        os.fsync(handle.fileno())
    os.replace(temp, path)


def write_metadata(path: Path, value: dict) -> None:
    atomic_write(path, json.dumps(value, ensure_ascii=False).encode("utf-8"))


def public_metadata(value: dict) -> dict:
    return {key: child for key, child in value.items() if key in SAFE_FIELDS}


def webhook_headers(body: bytes, secret: str) -> dict[str, str]:
    headers = {"content-type": "application/json", "user-agent": "hackshop-grokbot-cli/1.0"}
    if secret.startswith("crsr_"):
        if len(secret) < 40 or any(character.isspace() for character in secret):
            raise CliError("invalid_webhook_credential")
        return {**headers, "authorization": f"Bearer {secret}"}
    try:
        encoded = secret.removeprefix("whsec_")
        key = base64.b64decode(encoded + "=" * (-len(encoded) % 4), altchars=b"-_", validate=True)
        if len(key) < 8:
            raise ValueError()
    except (ValueError, TypeError):
        raise CliError("invalid_webhook_credential") from None
    message_id = f"msg_{secrets.token_hex(16)}"
    timestamp = str(int(time.time()))
    signature = base64.b64encode(hmac.new(key, message_id.encode() + b"." + timestamp.encode() + b"." + body, hashlib.sha256).digest()).decode("ascii")
    return {**headers, "webhook-id": message_id, "webhook-timestamp": timestamp, "webhook-signature": f"v1,{signature}"}


def open_request(request: urllib.request.Request):
    # Default urllib redirects could forward an Authorization header. Disable
    # every redirect rather than making a second, unreserved network attempt.
    return urllib.request.build_opener(NoRedirect()).open(request, timeout=30)


def read_reply(response, maximum: int, error: str) -> bytes:
    raw = response.read(maximum + 1)
    if len(raw) > maximum:
        raise CliError(error)
    return raw


def status_object(request_id: str, remote_only: bool = False) -> dict:
    request_path, response_path = request_paths(request_id)
    metadata = public_metadata(read_json(request_path)) if request_path.exists() else {"request_id": request_id}
    if not remote_only and response_path.exists() and metadata.get("status") in ("completed", "failed"):
        with response_path.open("rb") as handle:
            raw = handle.read(MAX_REPLY_BYTES + 1)
        if len(raw) > MAX_REPLY_BYTES:
            raise CliError("relay_result_too_large")
        return {**metadata, "result": raw.decode("utf-8")}
    if not remote_only and not request_path.exists():
        return {"request_id": request_id, "status": "not_found"}
    _, _, relay, read_secret, _ = credentials()
    request = urllib.request.Request(f"{relay}/api/result/{request_id}", headers={"accept": "application/json", "authorization": f"Bearer {read_secret}"}, method="GET")
    try:
        with open_request(request) as response:
            if response.status == 204:
                return {**metadata, "status": "pending"}
            raw = read_reply(response, MAX_REPLY_BYTES, "relay_result_too_large")
    except urllib.error.HTTPError as error:
        if error.code == 404:
            return {**metadata, "status": "pending"}
        raise CliError("relay_http_error") from None
    except (urllib.error.URLError, TimeoutError, OSError):
        raise CliError("relay_unavailable") from None
    try:
        remote = json.loads(raw)
    except (ValueError, UnicodeError):
        raise CliError("invalid_relay_response") from None
    if not isinstance(remote, dict):
        raise CliError("invalid_relay_response")
    if remote.get("request_id") != request_id:
        raise CliError("relay_request_identity_mismatch")
    if remote.get("status") not in ("completed", "failed"):
        return {**metadata, "status": "pending"}
    result = remote.get("result", "")
    result = result if isinstance(result, str) else json.dumps(result, ensure_ascii=False)
    if len(result.encode("utf-8")) > MAX_REPLY_BYTES:
        raise CliError("relay_result_too_large")
    completed_at = remote.get("received_at")
    if not isinstance(completed_at, str) or len(completed_at) > 60:
        completed_at = utc_now()
    updated = {**metadata, "status": remote["status"], "completed_at": completed_at}
    atomic_write(response_path, result.encode("utf-8"))
    write_metadata(request_path, updated)
    return {**updated, "result": result}


def cmd_send(args) -> tuple[dict, int]:
    if not 0 <= args.wait <= 45:
        raise CliError("invalid_wait")
    sources = int(args.task is not None) + int(args.task_file is not None) + int(args.task_stdin)
    if sources != 1:
        raise CliError("invalid_task_source")
    if args.task_stdin:
        task = sys.stdin.read(MAX_TASK_BYTES + 1)
    elif args.task_file:
        with Path(args.task_file).expanduser().open("rb") as handle:
            raw = handle.read(MAX_TASK_BYTES + 1)
        task = raw.decode("utf-8")
    else:
        task = args.task
    if not task.strip() or len(task.encode("utf-8")) > MAX_TASK_BYTES:
        raise CliError("invalid_task")
    request_id = args.request_id or f"codex_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}_{secrets.token_hex(4)}"
    request_path, _ = request_paths(request_id)
    if request_path.exists():
        metadata = public_metadata(read_json(request_path))
        if metadata.get("request_id") != request_id:
            raise CliError("local_request_identity_mismatch")
        return {**metadata, "replayed": True}, 0
    webhook, secret, relay, _, callback_secret = credentials()
    callback = hmac.new(callback_secret.encode(), f"grok-result:{request_id}".encode(), hashlib.sha256).hexdigest()
    body = json.dumps({"request_id": request_id, "task": task,
      "callback_url": f"{relay}/api/grok/result", "callback_token": callback,
      "response_contract": {"method": "POST", "content_type": "application/json", "body": {
        "request_id": request_id, "callback_token": "copy callback_token from this request exactly",
        "status": "completed or failed", "result": "complete research result with canonical X post URLs"}}}, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    headers = webhook_headers(body, secret)
    metadata = {"request_id": request_id, "status": "sending", "created_at": utc_now()}
    # O_EXCL closes the concurrent same-ID race; state is durable before POST.
    try:
        descriptor = os.open(request_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    except FileExistsError:
        return {**public_metadata(read_json(request_path)), "replayed": True}, 0
    with os.fdopen(descriptor, "wb") as handle:
        handle.write(json.dumps(metadata).encode())
        handle.flush()
        os.fsync(handle.fileno())
    request = urllib.request.Request(webhook, data=body, headers=headers, method="POST")
    exit_code = 0
    try:
        with open_request(request) as response:
            metadata["http_status"] = response.status
            raw = read_reply(response, 4096, "webhook_ack_too_large")
            try:
                acknowledgement = json.loads(raw)
            except (ValueError, UnicodeError):
                acknowledgement = {}
            accepted = response.status == 202 or (response.status == 200 and isinstance(acknowledgement, dict) and acknowledgement.get("success") is True and isinstance(acknowledgement.get("runUuid"), str) and 0 < len(acknowledgement["runUuid"]) <= 160)
            metadata["status"] = "accepted" if accepted else "send_unknown"
            if accepted:
                metadata["accepted_at"] = utc_now()
                if isinstance(acknowledgement, dict) and isinstance(acknowledgement.get("runUuid"), str) and len(acknowledgement["runUuid"]) <= 160:
                    metadata["provider_run_id"] = acknowledgement["runUuid"]
    except urllib.error.HTTPError as error:
        metadata["http_status"] = error.code
        metadata["status"] = "failed" if 400 <= error.code < 500 else "send_unknown"
        if metadata["status"] == "failed":
            metadata["error"] = "webhook_rejected"
            exit_code = 1
    except (urllib.error.URLError, TimeoutError, OSError, CliError):
        metadata["status"] = "send_unknown"
    write_metadata(request_path, metadata)
    output = public_metadata(metadata)
    deadline = time.monotonic() + args.wait
    while args.wait and time.monotonic() < deadline and metadata["status"] == "accepted":
        output = status_object(request_id)
        if output.get("status") in ("completed", "failed"):
            break
        remaining = deadline - time.monotonic()
        if remaining > 0:
            time.sleep(min(3, remaining))
    return output, exit_code


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    check = commands.add_parser("check-config")
    check.add_argument("--json", action="store_true")
    send = commands.add_parser("send")
    send.add_argument("--request-id")
    send.add_argument("--task")
    send.add_argument("--task-file")
    send.add_argument("--task-stdin", action="store_true")
    send.add_argument("--wait", type=int, default=0)
    send.add_argument("--keep-remote", action="store_true", help="Compatibility flag; remote results are always retained")
    send.add_argument("--json", action="store_true")
    status = commands.add_parser("status")
    status.add_argument("--request-id", required=True)
    status.add_argument("--remote", action="store_true")
    status.add_argument("--keep-remote", action="store_true", help="Compatibility flag; remote results are always retained")
    status.add_argument("--json", action="store_true")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    try:
        if args.command == "check-config":
            try:
                webhook, secret, relay, _, _ = credentials()
                # Reuse send-time auth validation without submitting anything.
                # A malformed key must not consume the parent's daily attempt.
                webhook_headers(b"{}", secret)
                output = {"configured": True, "webhook_host": urllib.parse.urlsplit(webhook).hostname, "relay_host": urllib.parse.urlsplit(relay).hostname}
            except CliError as error:
                output = {"configured": False, "error": str(error)}
            code = 0
        elif args.command == "send":
            output, code = cmd_send(args)
        else:
            output = status_object(args.request_id, args.remote)
            code = 2 if output.get("status") == "not_found" else 0
    except (CliError, OSError, ValueError, UnicodeError) as error:
        output = {"error": str(error) if isinstance(error, CliError) else "local_cli_error"}
        if getattr(args, "request_id", None) and REQUEST_ID_RE.fullmatch(args.request_id):
            output["request_id"] = args.request_id
        code = 1
    print(json.dumps(output, ensure_ascii=False))
    return code


if __name__ == "__main__":
    raise SystemExit(main())
