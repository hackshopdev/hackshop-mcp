"use client";

import { useState } from "react";

export function CopyButton({
  text,
  label = "Copy",
  copiedLabel = "Copied",
  className,
  onCopied,
}: {
  text: string;
  label?: string;
  copiedLabel?: string;
  className?: string;
  onCopied?: () => void;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        onCopied?.();
        window.setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? copiedLabel : label}
    </button>
  );
}
