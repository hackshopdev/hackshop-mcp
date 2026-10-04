"use client";

import type { ReactNode } from "react";
import { track } from "@/lib/analytics";

// Outbound shopping link. Tracks which seller and link type got the click
// (metadata only) and opens the seller in a new tab.
export function StoreLinkOut({
  href,
  className,
  title,
  event,
  children,
}: {
  href: string;
  className?: string;
  title?: string;
  event: { kind: string; seller: string; device_id?: string };
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      className={className}
      title={title}
      target="_blank"
      rel="noopener nofollow"
      onClick={() =>
        track("store_link_clicked", {
          kind: event.kind,
          seller: event.seller,
          device_id: event.device_id ?? null,
        })
      }
    >
      {children}
    </a>
  );
}
