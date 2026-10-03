import type { Metadata, Viewport } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import { GoogleAnalytics } from "../components/GoogleAnalytics";
import { clerkEnabled } from "../lib/auth-config";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.hackshop.dev"),
  title: "hackshop: give your AI agent a body",
  description:
    "Build a small gadget for your AI agent. Pick a Muse-supported board, get the parts with store links, and start a build with steps your agent can follow.",
  openGraph: {
    title: "hackshop: give your AI agent a body",
    description:
      "Pick a board, get the parts and build steps, or point your agent at hackshop.dev. Starts with Meta's Muse Gadgets.",
    type: "website",
    url: "https://www.hackshop.dev",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Hackshop" }],
  },
  twitter: { card: "summary_large_image", images: ["/opengraph-image"] },
  alternates: { canonical: "/" },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://www.hackshop.dev/#org",
      name: "Hackshop",
      url: "https://www.hackshop.dev",
      description:
        "Helps people and their AI agents build physical gadgets: board picks, parts, build and assembly steps. Starts with Meta's Muse Gadgets.",
      email: "msanchezgrice@gmail.com",
    },
    {
      "@type": "WebSite",
      "@id": "https://www.hackshop.dev/#site",
      url: "https://www.hackshop.dev",
      name: "hackshop",
      description:
        "Give your AI agent a body: pick a board, get the parts and build steps, or point your agent at hackshop.dev.",
      publisher: { "@id": "https://www.hackshop.dev/#org" },
    },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const content = (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {children}
      <GoogleAnalytics />
    </>
  );

  return (
    <html lang="en">
      <body>{clerkEnabled ? <ClerkProvider>{content}</ClerkProvider> : content}</body>
    </html>
  );
}
