import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import Link from "next/link"; import styles from "../resources/editorial.module.css"; import { pageMetadata } from "@/lib/page-metadata";
export const metadata = pageMetadata("About | Hackshop", "How Hackshop publishes problem-focused guides with sources, assumptions, and limitations.", "/about");
export default function Page() { return <main className={styles.page}><SiteHeader /><div className={styles.shell}><article className={styles.legal}><p className={styles.eyebrow}>Trust and transparency</p><h1>About</h1><p>Hackshop publishes problem-focused guides tied to a real product workflow. We label assumptions, link primary sources, and preserve limitations instead of manufacturing certainty.</p><p>Last reviewed July 13, 2026.</p></article></div><SiteFooter /></main>; }
