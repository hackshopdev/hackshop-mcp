import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { ContributionStart } from "@/components/community/CommunityContent";
import styles from "@/components/community/community.module.css";
import ui from "@/components/ui.module.css";
import { pageMetadata } from "@/lib/page-metadata";

export const metadata = { ...pageMetadata("Contribute an idea | Hackshop", "Share a text-only idea on the existing Ideas board. Image uploads and rich community build submissions are not open yet.", "/community/new"), robots: { index: false, follow: true } };

export default function CommunityNewPage() {
  return <main className={ui.page}><SiteHeader cta={null} /><div className={styles.shell}><ContributionStart /><SiteFooter /></div></main>;
}
