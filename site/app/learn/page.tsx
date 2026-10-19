import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { LearnContent } from "@/components/community/CommunityContent";
import styles from "@/components/community/community.module.css";
import ui from "@/components/ui.module.css";
import { pageMetadata } from "@/lib/page-metadata";

export const metadata = pageMetadata("Make your first hardware build | Hackshop", "A five-step hardware-first learning path: choose exact hardware, check risks, verify first success, add one ability and document what really worked.", "/learn");

export default function LearnPage() {
  return <main className={ui.page}><SiteHeader cta={{ href: "/muse", label: "Start a build" }} /><div className={styles.shell}><LearnContent /><SiteFooter /></div></main>;
}
