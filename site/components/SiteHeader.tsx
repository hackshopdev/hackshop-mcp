import Link from "next/link";
import { ProjectNav } from "./ProjectNav";
import styles from "./SiteHeader.module.css";

type HeaderCta = { label: string; href: string } | null;

export function SiteHeader({
  cta = { label: "Start a build", href: "/#start" },
}: {
  cta?: HeaderCta;
} = {}) {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link className={styles.brand} href="/" aria-label="hackshop home">
          <span className={styles.mark} aria-hidden="true" />
          hackshop
        </Link>
        <nav className={styles.links} aria-label="Primary">
          <Link href="/muse">Muse gadgets</Link>
          <Link href="/store">Store</Link>
          <Link href="/templates">Templates</Link>
          <Link href="/resources">Field guides</Link>
          <ProjectNav className={styles.projectNav} />
        </nav>
        {cta ? (
          <Link className={styles.cta} href={cta.href} data-testid="header-start-build">
            {cta.label}
          </Link>
        ) : null}
      </div>
    </header>
  );
}
