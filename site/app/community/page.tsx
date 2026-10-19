import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { CommunityGallery } from "@/components/community/CommunityContent";
import styles from "@/components/community/community.module.css";
import ui from "@/components/ui.module.css";
import { pageMetadata } from "@/lib/page-metadata";

export const metadata = pageMetadata("Community builds and ideas | Hackshop", "Explore Hackshop team concepts, source-checked recipes and honest build notes. Find your next hardware idea and learn how to contribute.", "/community");

export default function CommunityPage() {
  return <main className={ui.page}><SiteHeader cta={{ href: "/community/new", label: "Share an idea" }} /><div className={styles.shell}><CommunityGallery /><SiteFooter /></div></main>;
}
