import Link from "next/link";
import { communityEditorialEntries, communityEditorialEntry } from "@/lib/community/editorial";
import { ConceptDemo, WalkthroughVideo } from "./BuildVideo";
import { StarterPrompt } from "./StarterPrompt";
import styles from "./community.module.css";

export function CommunityGallery() {
  const entries = communityEditorialEntries();
  return (
    <>
      <header className={`${styles.hero} ${styles.galleryHero}`}>
        <div className={styles.heroVisual} aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/builds/muse-desk-orb/concept-poster.webp" alt="" width="1920" height="1080" />
          <span>Team concept / not a physical build</span>
        </div>
        <p className={styles.eyebrow}>Hackshop / Community</p>
        <h1>A place for<br />things you make.</h1>
        <p className={styles.intro}>Ideas, builds and useful lessons. Starting with the team’s concepts, with room for yours.</p>
        <div className={styles.actions}>
          <a className={styles.primaryButton} href="#team-projects">Explore team projects <span aria-hidden="true">↓</span></a>
          <Link className={styles.secondaryButton} href="/community/new">Share an idea</Link>
        </div>
      </header>

      <section className={styles.gallery} id="team-projects" aria-labelledby="projects-title">
        <div className={styles.sectionHeading}>
          <div><p className={styles.eyebrow}>On the workbench</p><h2 id="projects-title">From the Hackshop team</h2></div>
          <p>Source-checked concepts. Not physically built yet.</p>
        </div>
        <div className={styles.projectGrid}>
          {entries.map((entry) => (
            <article className={styles.project} key={entry.slug}>
              <Link className={styles.projectImage} href={`/community/${entry.slug}`} aria-label={`Explore ${entry.title}`}>
                {/* Authored local concept posters, not contributor uploads or physical photos. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={entry.cover.href} alt={entry.cover.alt} width="1920" height="1080" loading="eager" />
                <span>Concept render</span>
              </Link>
              <div className={styles.projectMeta}><span>{entry.maker.label}</span><span>Concept · not built yet</span></div>
              <h3><Link href={`/community/${entry.slug}`}>{entry.title}</Link></h3>
              <p>{entry.summary}</p>
              <Link className={styles.textLink} href={`/community/${entry.slug}`}>Explore the project <span aria-hidden="true">↗</span></Link>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.nextStep} aria-labelledby="contribute-title">
        <div><p className={styles.eyebrow}>Your turn</p><h2 id="contribute-title">A small idea is a good start.</h2><p>The Ideas board is open for text-only posts. Photos, build uploads and agent submissions are not open yet.</p></div>
        <div className={styles.actions}><Link className={styles.primaryButton} href="/ideas">Explore Ideas</Link><Link className={styles.textLink} href="/learn">Make your first build ↗</Link></div>
      </section>
    </>
  );
}

export function CommunityEntryDetail({ slug }: { slug: string }) {
  const entry = communityEditorialEntry(slug);
  if (!entry) return null;
  return (
    <>
      <p className={styles.breadcrumb}><Link href="/community">Community</Link> / Team concepts</p>
      <header className={`${styles.hero} ${styles.detailHero}`}>
        <p className={styles.eyebrow}>{entry.maker.label} / Concept</p>
        <h1>{entry.title}</h1>
        <p className={styles.intro}>{entry.summary}</p>
        <div className={styles.actions}><Link className={styles.primaryButton} href={entry.recipe.href}>Open the full recipe ↗</Link><a className={styles.secondaryButton} href="#watch">See the concept</a></div>
      </header>

      <section className={styles.watchSection} id="watch" aria-labelledby="watch-title">
        <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>Watch / understand</p><h2 id="watch-title">The concept, clearly labeled.</h2></div><p>No finished-build photo or physical demonstration is available for this version.</p></div>
        <ConceptDemo entry={entry} />
        <WalkthroughVideo title={`${entry.title}: build walkthrough`} />
      </section>

      <section className={styles.makeSection} aria-labelledby="make-title">
        <div><p className={styles.eyebrow}>Make / verify</p><h2 id="make-title">One first success. Then the rest.</h2><p>{entry.firstSuccess}</p><small>This is the recipe’s acceptance target, not a reported test result.</small></div>
        <div className={styles.makeLinks}>
          <Link href={entry.recipe.href}><span>01</span><div><strong>Parts, setup and recovery</strong><small>Full recipe {entry.recipe.version}, with checks and known limits</small></div><span aria-hidden="true">↗</span></Link>
          <Link href={entry.modelHref}><span>02</span><div><strong>Inspect the interactive assembly</strong><small>See the intended layout; schematic parts are labeled</small></div><span aria-hidden="true">↗</span></Link>
          <Link href={`/build/${entry.recipe.deviceId}`}><span>03</span><div><strong>Open the build checklist</strong><small>Keep your own progress and actual checks separate</small></div><span aria-hidden="true">↗</span></Link>
        </div>
      </section>

      <section className={styles.factsSection} aria-labelledby="limits-title">
        <div><p className={styles.eyebrow}>What we know</p><h2 id="limits-title">Sources, versions and open questions.</h2><p>Team authorship is not physical verification.</p></div>
        <div>
          <dl className={styles.versionFacts}>
            <div><dt>Recipe</dt><dd>{entry.recipe.version}</dd></div>
            <div><dt>Source review</dt><dd><time dateTime={entry.recipe.reviewedAt}>{entry.recipe.reviewedAt}</time></dd></div>
            <div><dt>Hardware target</dt><dd>{entry.recipe.deviceId}</dd></div>
            <div><dt>Firmware profile</dt><dd>{entry.recipe.boardProfile}</dd></div>
            <div><dt>Reviewed SDK commit</dt><dd><code>{entry.recipe.sdkCommit}</code></dd></div>
          </dl>
          <h3 className={styles.subheading}>Known limitations</h3>
          <ul className={styles.limitations}>{entry.limitations.map((limit) => <li key={limit}>{limit}</li>)}</ul>
          <h3 className={styles.subheading}>Source trail</h3>
          <ul className={styles.sourceLinks}>{entry.sources.map((source) => <li key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.label} ↗</a></li>)}</ul>
        </div>
      </section>
      <section className={styles.nextStep} aria-labelledby="variation-title"><div><p className={styles.eyebrow}>Build your version</p><h2 id="variation-title">A useful variation starts with one change.</h2><p>Use the recipe as a starting point. Keep exact parts, test results and failures in your own notes.</p></div><Link className={styles.primaryButton} href="/learn">Start with the learning path ↗</Link></section>
    </>
  );
}

export function ContributionStart() {
  return (
    <>
      <header className={styles.hero}><p className={styles.eyebrow}>Hackshop / Contribute</p><h1>Start with<br />your idea.</h1><p className={styles.intro}>You can share a text-only idea today. Rich build submissions are the next step, not a feature we’re claiming is live.</p><Link className={styles.primaryButton} href="/ideas/new">Write an idea ↗</Link></header>
      <section className={styles.contributionState} aria-labelledby="upload-state-title"><p className={styles.eyebrow}>Current contribution options</p><h2 id="upload-state-title">Image uploads are not open yet.</h2><p>Photo uploads, public build drafts and agent uploads through MCP are not available here yet. There is no file-upload form on this page.</p><p>The existing Ideas board accepts text-only posts and hardware suggestions. It does not accept images or links.</p><div className={styles.actions}><Link className={styles.primaryButton} href="/ideas/new">Share a text-only idea</Link><Link className={styles.secondaryButton} href="/ideas">See existing ideas</Link></div></section>
      <section className={styles.preparation} aria-labelledby="prepare-title"><p className={styles.eyebrow}>While you build</p><h2 id="prepare-title">Keep the things that help the next maker.</h2><ol><li><strong>Exact parts and versions</strong><span>Record model, board revision, firmware commit and substitutions.</span></li><li><strong>What actually happened</strong><span>Keep checks, failures and unresolved limits—not just the successful command.</span></li><li><strong>Original photos and footage</strong><span>When you have a physical build, show the assembled device and what it does. Keep private tokens and home details out of frame.</span></li></ol><Link className={styles.textLink} href="/learn">Follow the first-build path ↗</Link></section>
    </>
  );
}

const LEARN_STEPS = [
  { title: "Choose one small result.", body: "A calendar glance, one status light, a push-to-talk reply. Start with what you already own, then pick exact hardware—not a device family.", href: "/muse", link: "Find a device and plan" },
  { title: "Read the parts and the risks.", body: "Check the model, revision, power, recovery path and source version. A board with a speaker does not automatically have working speech.", href: "/resources", link: "Open guides and resources" },
  { title: "First success: one real check.", body: "Get one simple result on the actual device. Compare what happened with the recipe’s expected result before adding more.", href: "/templates", link: "Choose a starting recipe" },
  { title: "Add one useful ability.", body: "Only after first success, add the assistant or automation. Keep credentials private and record exactly what changed and what you tested.", href: "/tools", link: "Use the hardware tools" },
  { title: "Keep notes. Share the lesson.", body: "Save exact parts, versions, failures and limits in a secret-free HARDWARE.md. An honest concept is useful; label it separately from a working build.", href: "/community/new", link: "See how to contribute" },
] as const;

export function LearnContent() {
  return (
    <>
      <header className={styles.hero}><p className={styles.eyebrow}>Hackshop / Learn</p><h1>Make one<br />small thing work.</h1><p className={styles.intro}>A practical first-build path. Exact hardware, one checked result, then your next idea.</p><div className={styles.actions}><a className={styles.primaryButton} href="#first-build">Start the five steps ↓</a><a className={styles.secondaryButton} href="#starter-prompt-title">Get the starter prompt</a></div></header>
      <section className={styles.learningPath} id="first-build" aria-labelledby="first-build-title"><div className={styles.sectionHeading}><div><p className={styles.eyebrow}>From idea to first success</p><h2 id="first-build-title">Five steps. No big leap.</h2></div><p>You don’t need a finished product to learn something useful.</p></div><ol>{LEARN_STEPS.map((step, index) => <li key={step.href}><span className={styles.stepNumber}>{String(index + 1).padStart(2, "0")}</span><div><h3>{step.title}</h3><p>{step.body}</p><Link className={styles.textLink} href={step.href}>{step.link} ↗</Link></div></li>)}</ol></section>
      <StarterPrompt />
      <section className={styles.nextStep} aria-labelledby="learn-watch-title"><div><p className={styles.eyebrow}>Watch / understand</p><h2 id="learn-watch-title">See the concept. Know what’s untested.</h2><p>Explore team recipes with short concept animations and interactive assemblies. Real-device walkthroughs have not been filmed yet.</p></div><Link className={styles.primaryButton} href="/community">Explore team projects ↗</Link></section>
    </>
  );
}
