import Link from "next/link";
import { ProjectNav } from "./ProjectNav";
import styles from "./SiteHeader.module.css";

export function SiteHeader() {
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
        <Link className={styles.cta} href="/#start" data-testid="header-start-build">
          Start a build
        </Link>
      </div>
    </header>
  );
}
