"use client";

import { useUser } from "@clerk/nextjs";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { clerkEnabled } from "@/lib/auth-config";

// Sign-in state and the viewer's own votes for every vote button on a page.
// Signed-out viewers never trigger a request to the ideas API.

export type IdeaAuthState = "disabled" | "loading" | "signed-out" | "signed-in";

interface IdeaVotesValue {
  auth: IdeaAuthState;
  voted: ReadonlySet<string>;
  setVoted: (ideaId: string, on: boolean) => void;
}

const EMPTY = new Set<string>();

const IdeaVotesContext = createContext<IdeaVotesValue>({
  auth: "disabled",
  voted: EMPTY,
  setVoted: () => undefined,
});

export function useIdeaVotes(): IdeaVotesValue {
  return useContext(IdeaVotesContext);
}

export function IdeaVotesProvider({ children }: { children: React.ReactNode }) {
  if (!clerkEnabled) {
    return (
      <IdeaVotesContext.Provider value={{ auth: "disabled", voted: EMPTY, setVoted: () => undefined }}>
        {children}
      </IdeaVotesContext.Provider>
    );
  }
  return <ClerkIdeaVotes>{children}</ClerkIdeaVotes>;
}

function ClerkIdeaVotes({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useUser();
  const [voted, setVotedState] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (!isSignedIn) {
      setVotedState(new Set());
      return;
    }
    let cancelled = false;
    fetch("/api/ideas/votes", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { idea_ids?: unknown } | null) => {
        if (cancelled || !data || !Array.isArray(data.idea_ids)) return;
        const ids = data.idea_ids.filter((id): id is string => typeof id === "string");
        setVotedState((current) => new Set([...current, ...ids]));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [isSignedIn]);

  const setVoted = useCallback((ideaId: string, on: boolean) => {
    setVotedState((current) => {
      const next = new Set(current);
      if (on) next.add(ideaId);
      else next.delete(ideaId);
      return next;
    });
  }, []);

  const auth: IdeaAuthState = !isLoaded ? "loading" : isSignedIn ? "signed-in" : "signed-out";
  const value = useMemo(() => ({ auth, voted, setVoted }), [auth, voted, setVoted]);

  return <IdeaVotesContext.Provider value={value}>{children}</IdeaVotesContext.Provider>;
}
