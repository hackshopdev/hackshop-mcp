import Link from "next/link";
import { IdeaForm } from "@/components/ideas/IdeaForm";
import styles from "@/components/ideas/ideas.module.css";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import ui from "@/components/ui.module.css";
import { pageMetadata } from "@/lib/page-metadata";

export const metadata = pageMetadata(
  "Submit an idea · Hackshop",
  "Suggest a gadget your AI agent could live in. Other builders upvote it, and hackshop writes build guides for the top ideas.",
  "/ideas/new",
);

export default function NewIdeaPage() {
  return (
    <main className={ui.page}>
      <SiteHeader />
      <div className={`${ui.shell} ${styles.formWrap}`}>
        <p className={styles.crumbs}>
          <Link href="/ideas">Ideas</Link> / Submit
        </p>
        <section className={styles.hero}>
          <h1>Submit an idea</h1>
          <p>
            Describe a gadget your AI agent could live in. Answer the questions if you know,
            and we&apos;ll suggest a board. People upvote the ideas they want, and hackshop
            writes build guides for the top ones.
          </p>
        </section>
        <IdeaForm />
      </div>
      <SiteFooter />
    </main>
  );
}
