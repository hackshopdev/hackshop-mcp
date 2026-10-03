"use client";

import Link from "next/link";
import { SignInButton, UserButton, useUser } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { clerkEnabled } from "@/lib/auth-config";
import { track } from "@/lib/analytics";
import { importLocalProjects } from "@/lib/projects/store";
import { listLocalProjects, PROJECTS_CHANGED_EVENT } from "@/lib/projects/local";

export function ProjectNav({ className }: { className?: string }) {
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

  return (
    <div className={className} style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <Link href="/projects">
        My builds{count > 0 ? <span aria-label={`${count} builds`}> · {count}</span> : null}
      </Link>
      {clerkEnabled ? <AuthControls /> : null}
    </div>
  );
}

function AuthControls() {
  const { isSignedIn } = useUser();

  if (isSignedIn) {
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
        onClick={() => track("sign_in_clicked", {})}
        style={{
          background: "transparent",
          border: "1px solid var(--border)",
          color: "var(--fg)",
          borderRadius: 6,
          padding: "7px 11px",
          minHeight: 40,
          cursor: "pointer",
        }}
      >
        Sign in
      </button>
    </SignInButton>
  );
}

function ImportPrompt() {
  const [unsynced, setUnsynced] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    setUnsynced(listLocalProjects().filter((project) => !project.synced).length);
  }, []);

  if (done || unsynced === 0) return null;

  return (
    <button
      type="button"
      onClick={async () => {
        await importLocalProjects();
        setDone(true);
      }}
      style={{
        background: "var(--code-bg)",
        color: "var(--fg)",
        border: "1px solid var(--accent)",
        borderRadius: 6,
        padding: "7px 11px",
        minHeight: 40,
        cursor: "pointer",
      }}
    >
      Save {unsynced} local build{unsynced === 1 ? "" : "s"}
    </button>
  );
}
