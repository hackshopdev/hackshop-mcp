/** Analytics classification only; it never changes access, quotas or tool behavior. */
export function hostedMcpQaAttribution(request: Request): Record<string, string | boolean> {
  const params = new URL(request.url).searchParams;
  const qa = params.get("pb_traffic_type") === "qa" ||
    params.get("utm_source") === "portfolio_brain_qa" || params.get("utm_medium") === "agent_qa" ||
    ["1", "true"].includes(params.get("qa") ?? params.get("internal_qa") ?? "") ||
    request.headers.get("user-agent")?.toLowerCase() === "portfolio-distribution-audit";
  const properties: Record<string, string | boolean> = {
    mcp_qa_attribution_version: "2026-10-27",
    qa_traffic: qa,
  };
  if (!qa) return properties;
  Object.assign(properties, { is_internal: true, pb_traffic_type: "qa" });
  for (const key of ["pb_qa_run", "pb_qa_suite"]) {
    const value = params.get(key);
    if (value && /^[a-z0-9][a-z0-9_-]{0,79}$/i.test(value) && !/^user_/i.test(value)) properties[key] = value;
  }
  const worker = params.get("pb_qa_worker");
  if (worker && ["macbook-pro", "mac-mini", "agent-box", "grok-virtual"].includes(worker)) properties.pb_qa_worker = worker;
  return properties;
}
