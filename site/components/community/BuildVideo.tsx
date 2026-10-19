"use client";

import { useState } from "react";
import { normalizeVideoUrl } from "@/lib/community/contracts";
import type { CommunityEditorialEntry } from "@/lib/community/editorial";
import styles from "./community.module.css";

export function ConceptDemo({ entry }: { entry: CommunityEditorialEntry }) {
  return (
    <figure className={styles.demo}>
      <video controls playsInline preload="none" poster={entry.demo.posterHref} aria-label={`${entry.title}: concept animation`}>
        <source src={entry.demo.href} type="video/mp4" />
        <a href={entry.demo.href}>Open the concept animation</a>
      </video>
      <figcaption>
        <strong>{Math.round(entry.demo.durationSeconds)}-second concept animation</strong>
        <span>No real hardware is shown. This explains the intended assembly and behavior.</span>
      </figcaption>
    </figure>
  );
}

type WalkthroughProps = {
  videoUrl?: string;
  title: string;
  transcript?: string;
  chapters?: Array<{ seconds: number; title: string }>;
};

export function WalkthroughVideo({ videoUrl, title, transcript, chapters }: WalkthroughProps) {
  const [loaded, setLoaded] = useState(false);
  const video = normalizeVideoUrl(videoUrl);

  if (!video) return (
    <div className={styles.missingMedia}>
      <span className={styles.mediaRole}>Real-device walkthrough</span>
      <h3>Real-device walkthrough not filmed yet</h3>
      <p>We have not physically built this version. The animation is not a substitute for real-device footage.</p>
    </div>
  );

  return (
    <div className={styles.walkthrough}>
      <span className={styles.mediaRole}>Build walkthrough</span>
      {loaded ? (
        <iframe
          className={styles.player}
          src={video.embedHref}
          title={title}
          allow="encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          sandbox="allow-scripts allow-same-origin allow-presentation"
        />
      ) : (
        <div className={styles.playerConsent}>
          <h3>{title}</h3>
          <p>Loading this player connects to YouTube. No third-party player or thumbnail is loaded until you choose it.</p>
          <button className={styles.primaryButton} type="button" onClick={() => setLoaded(true)}>Load YouTube walkthrough</button>
        </div>
      )}
      <a className={styles.textLink} href={video.href} target="_blank" rel="noreferrer">Watch on YouTube ↗</a>
      {chapters?.length ? (
        <ol className={styles.chapters} aria-label="Video chapters">
          {chapters.filter((chapter) => Number.isFinite(chapter.seconds) && chapter.seconds >= 0).map((chapter) => (
            <li key={`${chapter.seconds}-${chapter.title}`}>
              <a href={`${video.href}&t=${Math.floor(chapter.seconds)}s`} target="_blank" rel="noreferrer">
                <time>{Math.floor(chapter.seconds / 60)}:{String(Math.floor(chapter.seconds % 60)).padStart(2, "0")}</time> {chapter.title}
              </a>
            </li>
          ))}
        </ol>
      ) : null}
      {transcript ? <details className={styles.transcript}><summary>Read transcript</summary><p>{transcript}</p></details> : null}
    </div>
  );
}
