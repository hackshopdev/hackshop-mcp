import Link from "next/link";
import styles from "./SiteFooter.module.css";

export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.about}>
          <Link className={styles.brand} href="/">
            <span className={styles.mark} aria-hidden="true" />
            hackshop
          </Link>
          <p>
            Free and open source. Hackshop never buys anything for you: store
            links open the store, and you approve every purchase.
          </p>
        </div>
        <nav className={styles.cols} aria-label="Footer">
          <div>
            <h2>Product</h2>
            <Link href="/#start">Start a build</Link>
            <Link href="/muse">Muse gadgets</Link>
            <Link href="/store">Store</Link>
            <Link href="/templates">Templates</Link>
            <Link href="/projects">My builds</Link>
          </div>
          <div>
            <h2>For agents</h2>
            <Link href="/#use-with-your-agent">MCP connector</Link>
            <a href="https://www.npmjs.com/package/hackshop-mcp">npm package</a>
            <a href="/agents.md">agents.md</a>
            <a href="/llms.txt">llms.txt</a>
          </div>
          <div>
            <h2>About</h2>
            <a href="https://github.com/hackshopdev/hackshop-mcp">GitHub</a>
            <Link href="/resources">Field guides</Link>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
          </div>
        </nav>
      </div>
    </footer>
  );
}
