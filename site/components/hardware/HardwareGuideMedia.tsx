import { getHardwareGuideMedia } from "@/lib/hardware-media";
import { HardwarePreview } from "./HardwarePreview";
import { CreatorVideo } from "./CreatorVideo";
import styles from "./hardware-media.module.css";

export function HardwareGuideMedia({ slug }: { slug: string }) {
  const media = getHardwareGuideMedia(slug);
  if (!media) return null;
  return (
    <div className={styles.media} id="media">
      <HardwarePreview key={media.slug} preview={media.preview} />
      <section aria-label="Reference photos and screenshots">
        <h2>Reference photos &amp; screenshots</h2>
        <p>These are credited source images, not Hackshop's own finished builds. Read the scope below each image.</p>
        <div className={styles.photos}>
          {media.photos.map((photo) => (
            <figure className={styles.photo} key={photo.src}>
              {/* Locally hosted, reviewed, independently licensed assets; never remote social thumbnails. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <a href={photo.src} aria-label={`Open full image: ${photo.title}`}><img src={photo.src} alt={photo.alt} width={photo.width} height={photo.height} loading="lazy" /></a>
              <figcaption>
                <h3>{photo.title}</h3>
                <p>{photo.scope}</p>
                <p className={styles.credit}><a href={photo.sourceUrl} target="_blank" rel="noreferrer">{photo.creator} · Source</a> · <a href={photo.licenseUrl} target="_blank" rel="noreferrer">{photo.license}</a>. {photo.changes}</p>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>
      <section aria-label="Creator demos and walkthroughs">
        <h2>Creator demos &amp; walkthroughs</h2>
        <p>Short demos are not complete how-tos. Videos stay with their creators through the original platform's player; no clip is copied to Hackshop.</p>
        {media.videos.map((video) => (
          <div className={styles.videoBlock} key={video.url}>
            <h3>{video.title}</h3>
            <p>{video.scope}</p>
            <CreatorVideo key={video.url} video={video} />
          </div>
        ))}
        <p className={styles.disclaimer}><strong>Still missing:</strong> {media.missing}</p>
      </section>
      <p className={styles.reuse}>Reusing an asset? Check its individual license and attribution first. Native video embeds do not grant download or editing rights. <a href="/media/hardware-guides.json">Media manifest for people &amp; agents</a> · <a href="/media/hardware/NOTICE.txt">Copyright notices</a> · <a href="https://github.com/hackshopdev/hackshop-mcp/blob/main/site/lib/hardware-preview.ts">Original MIT-licensed render geometry</a>.</p>
      <hr />
    </div>
  );
}
