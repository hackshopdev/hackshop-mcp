export function createClient(...args: unknown[]) {
  const mock = (globalThis as typeof globalThis & {
    __supabaseCreateClientMock?: (...input: unknown[]) => unknown;
  }).__supabaseCreateClientMock;
  if (mock) return mock(...args);
  return {};
}
