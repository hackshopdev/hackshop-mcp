import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { DiscoveryAccess, type DiscoveryAccessState } from "@/components/discoveries/DiscoveryAccess";
import { DiscoveryInbox } from "@/components/discoveries/DiscoveryInbox";
import { requireDiscoveryReviewer } from "@/lib/discoveries/auth";
import { clerkEnabled } from "@/lib/auth-config";
import styles from "@/components/discoveries/discoveries.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Discovery inbox | hackshop",
  robots: { index: false, follow: false, nocache: true },
};

export default async function DiscoveryInboxPage() {
  const access = await requireDiscoveryReviewer();
  let state: DiscoveryAccessState | null = null;
  if (access instanceof Response) {
    const body = await access.json().catch(() => ({})) as { error?: string };
    state = body.error === "sign_in_required" ? "sign_in_required"
      : body.error === "reviewer_required" ? "reviewer_required" : "auth_unavailable";
  }
  return <main className={styles.page}>
    <SiteHeader cta={null} />
    <div className={styles.shell}>
      <header className={styles.hero}>
        <div className={styles.privateLabel}>Private reviewer workspace</div>
        <h1>Discovery inbox</h1>
        <p>Review new hardware examples, their exact targets and their sources. Approval records a specific draft for a future data PR; publication and deployment remain separate steps.</p>
      </header>
      {state ? <DiscoveryAccess state={state} signInEnabled={clerkEnabled} /> : <DiscoveryInbox signInEnabled={clerkEnabled} />}
    </div>
  </main>;
}
