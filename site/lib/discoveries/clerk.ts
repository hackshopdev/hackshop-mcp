import "server-only";

type LookupUser = { id: string; emailAddresses: Array<{ emailAddress: string; verification?: { status: string } | null }> };
export function exactVerifiedClerkUserId(email: string, users: LookupUser[]): string {
  const matches = users.filter((user) => user.emailAddresses.some((address) => address.emailAddress.toLowerCase() === email.toLowerCase()));
  if (matches.length > 1) throw new Error("ambiguous_user");
  if (matches.length === 0 || !matches[0].emailAddresses.some((address) =>
    address.emailAddress.toLowerCase() === email.toLowerCase() && address.verification?.status === "verified"))
    throw new Error("clerk_user_not_found");
  return matches[0].id;
}
/** Read-only bootstrap lookup. It does not change or authorize any account. */
export async function lookupClerkUser(email: string): Promise<string> {
  let users: LookupUser[];
  try {
    const { clerkClient } = await import("@clerk/nextjs/server");
    const client = await clerkClient();
    const result = await client.users.getUserList({ emailAddress: [email], limit: 2 });
    users = result.data;
  } catch { throw new Error("clerk_unavailable"); }
  return exactVerifiedClerkUserId(email, users);
}
