// Primary navigation, shared by the desktop header and the mobile menu.
// My builds and Sign in follow these links (see ProjectNav).

export interface NavLink {
  href: string;
  label: string;
  /** Don't prefetch: pages that may not exist yet on every deploy. */
  prefetch?: false;
}

export const NAV_LINKS: NavLink[] = [
  { href: "/muse", label: "Muse gadgets" },
  { href: "/store", label: "Store" },
  { href: "/templates", label: "Templates" },
  { href: "/ideas", label: "Ideas", prefetch: false },
  { href: "/tools", label: "Tools", prefetch: false },
  { href: "/resources", label: "Field guides" },
];

export const MY_BUILDS_LABEL = "My builds";
export const SIGN_IN_LABEL = "Sign in";
