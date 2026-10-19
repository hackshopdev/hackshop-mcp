// Primary navigation, shared by the desktop header and the mobile menu.
// My builds and Sign in follow these links (see ProjectNav).

export interface NavLink {
  href: string;
  label: string;
  /** Don't prefetch: pages that may not exist yet on every deploy. */
  prefetch?: false;
}

export const NAV_LINKS: NavLink[] = [
  { href: "/muse", label: "Build" },
  { href: "/community", label: "Community" },
  { href: "/learn", label: "Learn" },
  { href: "/store", label: "Hardware" },
];

export const MY_BUILDS_LABEL = "My builds";
export const SIGN_IN_LABEL = "Sign in";
