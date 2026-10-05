"use client";

import Link from "next/link";
import { SignInButton, UserButton, useUser } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { clerkEnabled } from "@/lib/auth-config";
import { track } from "@/lib/analytics";
import { importLocalProjects } from "@/lib/projects/store";
import { listLocalProjects, PROJECTS_CHANGED_EVENT } from "@/lib/projects/local";
import { MY_BUILDS_LABEL, SIGN_IN_LABEL } from "@/lib/ui/nav";
import styles from "./SiteHeader.module.css";

type Variant = "inline" | "panel";

// "My builds" (with a count of builds saved in this browser) and Sign in.
// Rendered in the header row and again in the mobile menu panel.
export function ProjectNav({
  className,
  variant = "inline",
  onNavigate,
}: {
  className?: string;
  variant?: Variant;
  onNavigate?: () => void;
}) {
  const count = useLocalProjectCount();

  return (
    <div className={`${variant === "panel" ? styles.projectPanel : styles.projectInline} ${className ?? ""}`}>
      <Link href="/projects" onClick={onNavigate} prefetch={variant === "panel" ? false : undefined}>
        {MY_BUILDS_LABEL}
        {count > 0 ? (
          <span aria-label={`, ${count} saved build${count === 1 ? "" : "s"}`}>&nbsp;· {count}</span>
        ) : null}
      </Link>
      {clerkEnabled ? <AuthControls variant={variant} /> : null}
    </div>
  );
}

function useLocalProjectCount(): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const refresh = () => setCount(listLocalProjects().length);
    refresh();
    window.addEventListener(PROJECTS_CHANGED_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(PROJECTS_CHANGED_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  return count;
}

function AuthControls({ variant }: { variant: Variant }) {
  const { isLoaded, isSignedIn } = useUser();

  if (isLoaded && isSignedIn) {
    return (
      <>
        <ImportPrompt />
        <UserButton />
      </>
    );
  }

  return (
    <SignInButton mode="modal">
      <button
        type="button"
        className={variant === "panel" ? styles.panelSignIn : styles.signIn}
        onClick={() => track("sign_in_clicked", {})}
      >
        {SIGN_IN_LABEL}
      </button>
    </SignInButton>
  );
}

function ImportPrompt() {
  const [unsynced, setUnsynced] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const refresh = () => setUnsynced(listLocalProjects().filter((project) => !project.synced).length);
    refresh();
    window.addEventListener(PROJECTS_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(PROJECTS_CHANGED_EVENT, refresh);
  }, []);

  if (unsynced === 0) return null;

  return (
    <button
      type="button"
      className={styles.importButton}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await importLocalProjects();
        setBusy(false);
      }}
    >
      Save {unsynced} local build{unsynced === 1 ? "" : "s"}
    </button>
  );
}
