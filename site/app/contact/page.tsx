import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { ContactForm } from "./ContactForm";
import styles from "../resources/editorial.module.css";
import { pageMetadata } from "@/lib/page-metadata";
export const metadata = pageMetadata("Contact | Hackshop", "Contact Hackshop with questions, corrections, source updates, or design-partner requests.", "/contact");
export default function Page() { return <main className={styles.page}><SiteHeader /><div className={styles.shell}><article className={styles.legal}><p className={styles.eyebrow}>Trust and transparency</p><h1>Contact</h1><p>Questions, corrections, source updates and design-partner requests are welcome. Send a note here.</p><p>You can also use this form to ask us to delete your account, your saved builds or ideas you posted, or to send you a copy of your data. Add the email you signed in with so we can find it.</p><ContactForm /><p>Last updated October 5, 2026.</p></article></div><SiteFooter /></main>; }
