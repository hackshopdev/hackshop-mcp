"use client";

import { useEffect, useRef, useState } from "react";
import { WalkthroughVideo } from "@/components/community/BuildVideo";
import { normalizeCreatorPost, type CreatorVideoRecord } from "@/lib/hardware-media";
import styles from "./hardware-media.module.css";

type XWidgets = { createTweet: (id: string, container: HTMLElement, options: { dnt: boolean; theme: string; conversation: string; align: string }) => Promise<HTMLElement | undefined> };
let widgetsPromise: Promise<XWidgets> | undefined;

function loadWidgets(): Promise<XWidgets> {
  const x = window as Window & { twttr?: { widgets?: XWidgets } };
  if (x.twttr?.widgets) return Promise.resolve(x.twttr.widgets);
  if (!widgetsPromise) widgetsPromise = new Promise<XWidgets>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://platform.x.com/widgets.js";
    script.async = true;
    const timer = window.setTimeout(() => reject(new Error("X player timed out")), 15000);
    script.onload = () => {
      window.clearTimeout(timer);
      if (x.twttr?.widgets) resolve(x.twttr.widgets);
      else reject(new Error("X player unavailable"));
    };
    script.onerror = () => { window.clearTimeout(timer); reject(new Error("X player blocked")); };
    document.head.appendChild(script);
  }).catch((error) => { widgetsPromise = undefined; throw error; });
  return widgetsPromise;
}

export function CreatorVideo({ video }: { video: CreatorVideoRecord }) {
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState("Loading the original post…");
  const container = useRef<HTMLDivElement>(null);
  const post = normalizeCreatorPost(video.url);
  const postId = post?.id;

  useEffect(() => {
    if (!loaded || !postId || !container.current) return;
    const element = container.current;
    let cancelled = false;
    let timer: number | undefined;
    setStatus("Loading the original post…");
    loadWidgets().then(async (widgets) => {
      if (cancelled) return;
      timer = window.setTimeout(() => { if (!cancelled) setStatus("If the embed is blocked, open the original post below."); }, 15000);
      const result = await widgets.createTweet(postId, element, { dnt: true, theme: "dark", conversation: "none", align: "center" });
      window.clearTimeout(timer);
      if (!cancelled) setStatus(result ? "" : "This post could not be embedded. Open the original post below.");
    }).catch(() => { if (!cancelled) setStatus("The X embed is unavailable or blocked. Open the original post below."); });
    return () => { cancelled = true; window.clearTimeout(timer); element.replaceChildren(); };
  }, [loaded, postId]);

  if (video.provider === "youtube") return <WalkthroughVideo title={video.title} videoUrl={video.url} />;
  if (!post) return null;
  return (
    <div className={styles.creatorVideo}>
      {!loaded ? (
        <div className={styles.consent}>
          <p>The original X post contains the creator's clip. Loading it connects to X, which can receive your IP address and page information. No player, script, or thumbnail is loaded before you choose it.</p>
          <button type="button" onClick={() => setLoaded(true)}>Load original X demo</button>
        </div>
      ) : <p role="status">{status}</p>}
      <div ref={container} />
      <a href={post.href} target="_blank" rel="noreferrer">Open the original post by {video.creator}</a>
    </div>
  );
}
