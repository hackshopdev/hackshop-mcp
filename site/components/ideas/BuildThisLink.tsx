"use client";

import { track } from "@/lib/analytics";

/** "Build this": opens the home planner prefilled with the idea. */
export function BuildThisLink({
  href,
  ideaId,
  answerCount,
  surface,
  className,
  children = "Build this",
}: {
  href: string;
  ideaId: string;
  answerCount: number;
  surface: "list" | "detail" | "top";
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <a
      className={className}
      href={href}
      onClick={() => track("idea_build_clicked", { surface, idea_id: ideaId, answer_count: answerCount })}
    >
      {children}
    </a>
  );
}
