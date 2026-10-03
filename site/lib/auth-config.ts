export const clerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

export const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://gcmrtdevzgwvhdzromda.supabase.co";

export const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  "sb_publishable_JZeOeGnpA1e7kw2spY-EmQ_bO-3_GTo";

export const syncEnabled = clerkEnabled;
