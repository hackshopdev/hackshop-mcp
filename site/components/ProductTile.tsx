"use client";

import { useState } from "react";
import ui from "./ui.module.css";

export function ProductTile({
  deviceId,
  name,
  priority = false,
  hasPhoto = true,
  className,
  alt,
}: {
  deviceId: string;
  name: string;
  priority?: boolean;
  hasPhoto?: boolean;
  className?: string;
  /** Defaults to "<name> board". */
  alt?: string;
}) {
  const [failed, setFailed] = useState(!hasPhoto);
  return (
    <div className={`${ui.tile} ${className ?? ""}`}>
      {failed ? (
        <span className={ui.tilePlaceholder}>{name}</span>
      ) : (
        <img
          src={`/api/img?slug=${encodeURIComponent(deviceId)}`}
          alt={alt ?? `${name} board`}
          width={640}
          height={480}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}
