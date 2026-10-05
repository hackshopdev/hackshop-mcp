"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { NAV_LINKS } from "@/lib/ui/nav";
import { ProjectNav } from "./ProjectNav";
import styles from "./SiteHeader.module.css";

type HeaderCta = { label: string; href: string } | null;
type NavMode = "inline" | "menu";

// useLayoutEffect warns during server rendering; this runs only in the browser.
const useBrowserLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

// One flex row: brand (never shrinks), nav, Start a build. When the nav
// doesn't fit next to the brand and CTA it collapses into a menu button
// that opens a full-width panel. Before hydration a CSS breakpoint decides;
// after it, the row is measured so longer labels (a build count, a signed-in
// avatar) still never overlap the brand.
export function SiteHeaderBar({ cta }: { cta: HeaderCta }) {
  const pathname = usePathname();
  const [mode, setMode] = useState<NavMode | null>(null);
  const [open, setOpen] = useState(false);
  const innerRef = useRef<HTMLDivElement | null>(null);
  const brandRef = useRef<HTMLAnchorElement | null>(null);
  const navRef = useRef<HTMLElement | null>(null);
  const ctaRef = useRef<HTMLAnchorElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useBrowserLayoutEffect(() => {
    const inner = innerRef.current;
    const brand = brandRef.current;
    const nav = navRef.current;
    if (!inner || !brand || !nav) return;
    const measure = () => {
      const style = window.getComputedStyle(inner);
      const gap = Number.parseFloat(style.columnGap) || 0;
      const ctaWidth = ctaRef.current?.offsetWidth ?? 0;
      const gaps = gap * (ctaWidth > 0 ? 2 : 1);
      const available = inner.clientWidth - brand.offsetWidth - ctaWidth - gaps - 8;
      setMode(nav.scrollWidth <= available ? "inline" : "menu");
    };
    measure();
    // When collapsed the nav itself is 0x0, so watch its items too (a build
    // count or a sign-in button changes how much room it needs).
    const observer = new ResizeObserver(measure);
    observer.observe(inner);
    for (const child of Array.from(nav.children)) observer.observe(child);
    if (ctaRef.current) observer.observe(ctaRef.current);
    return () => observer.disconnect();
  }, []);

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  }, []);

  // Close on navigation and when the nav fits again.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);
  useEffect(() => {
    if (mode === "inline") setOpen(false);
  }, [mode]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close(true);
      }
    };
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      close(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    const frame = window.requestAnimationFrame(() => {
      panelRef.current?.querySelector<HTMLElement>("a[href], button:not([disabled])")?.focus();
    });
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
      window.cancelAnimationFrame(frame);
    };
  }, [open, close]);

  return (
    <header className={styles.header} data-site-header>
      <div className={styles.inner} ref={innerRef} data-nav={mode ?? undefined}>
        <Link className={styles.brand} href="/" aria-label="hackshop home" ref={brandRef} data-header-brand>
          <span className={styles.mark} aria-hidden="true" />
          hackshop
        </Link>
        <nav className={styles.nav} aria-label="Primary" ref={navRef} data-header-nav>
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} prefetch={link.prefetch} aria-current={isCurrent(pathname, link.href) ? "page" : undefined}>
              {link.label}
            </Link>
          ))}
          <ProjectNav className={styles.projectNav} />
        </nav>
        {cta ? (
          <Link className={styles.cta} href={cta.href} data-testid="header-start-build" ref={ctaRef}>
            {cta.label}
          </Link>
        ) : null}
        <button
          type="button"
          ref={buttonRef}
          className={styles.menuButton}
          aria-expanded={open}
          aria-controls="site-menu"
          onClick={() => setOpen((value) => !value)}
          data-header-menu-button
        >
          <MenuIcon open={open} />
          <span>Menu</span>
        </button>
      </div>
      <div
        id="site-menu"
        ref={panelRef}
        className={styles.panel}
        hidden={!open}
        data-header-panel
      >
        <nav aria-label="Menu" className={styles.panelNav}>
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              prefetch={false}
              onClick={() => setOpen(false)}
              aria-current={isCurrent(pathname, link.href) ? "page" : undefined}
            >
              {link.label}
            </Link>
          ))}
          <ProjectNav variant="panel" className={styles.panelProjects} onNavigate={() => setOpen(false)} />
        </nav>
      </div>
    </header>
  );
}

function isCurrent(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      {open ? (
        <path d="M4 4l10 10M14 4 4 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      ) : (
        <path d="M3 5h12M3 9h12M3 13h12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      )}
    </svg>
  );
}
