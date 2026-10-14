"use client";

import { SignInButton } from "@clerk/nextjs";
import Link from "next/link";
import styles from "./discoveries.module.css";

export type DiscoveryAccessState = "sign_in_required" | "reviewer_required" | "auth_unavailable";

export function DiscoveryAccess({ state, signInEnabled }: { state: DiscoveryAccessState; signInEnabled: boolean }) {
  const signedOut = state === "sign_in_required" && signInEnabled;
  return <section className={styles.access} aria-labelledby="discovery-access-title">
    <h2 id="discovery-access-title">{signedOut ? "Sign in to review discoveries" : state === "reviewer_required" ? "Reviewer access required" : "Reviewer access is unavailable"}</h2>
    <p>{signedOut ? "This inbox contains private research drafts and review decisions. Sign in with your approved reviewer account."
      : state === "reviewer_required" ? "Your signed-in account does not have reviewer access. The queue has not been loaded."
        : "Reviewer authentication is not configured or could not be checked. The private queue has not been loaded."}</p>
    {signedOut && <SignInButton mode="modal" forceRedirectUrl="/admin/discoveries"><button className={styles.primaryButton} type="button">Sign in</button></SignInButton>}
    <div><Link href="/reverse-engineering">Browse the public hardware library</Link></div>
  </section>;
}
