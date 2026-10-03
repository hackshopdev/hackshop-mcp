import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import Link from "next/link"; import styles from "../resources/editorial.module.css"; import { pageMetadata } from "@/lib/page-metadata";
export const metadata = pageMetadata("Contact | Hackshop", "Contact Hackshop with questions, corrections, source updates, or design-partner requests.", "/contact");
export default function Page() { return <main className={styles.page}><SiteHeader /><div className={styles.shell}><article className={styles.legal}><p className={styles.eyebrow}>Trust and transparency</p><h1>Contact</h1><p>Questions, corrections, source updates, and design-partner requests are welcome. Email the Hackshop team at msanchezgrice@gmail.com and include Hackshop in the subject line.</p><p>Last reviewed July 13, 2026.</p></article></div><SiteFooter /></main>; }
