import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { LuExternalLink } from "react-icons/lu";
import { sitePath } from "@/lib/site-path";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://gdsingh.github.io/hivesync/"),
  title: {
    default: "Hivesync",
    template: "%s – Hivesync",
  },
  description: "sync your foursquare check-ins to google calendar",
  openGraph: {
    title: "Hivesync",
    description: "sync your foursquare check-ins to google calendar",
    images: [{ url: sitePath("/hivesync.png"), width: 914, height: 286 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Hivesync",
    description: "sync your foursquare check-ins to google calendar",
    images: [sitePath("/hivesync.png")],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="font-sans antialiased bg-background text-foreground">
        <div className="max-w-2xl mx-auto px-4 pt-8">
          <div className="rounded-lg px-4 py-3 text-sm font-bold flex items-center justify-center gap-3" style={{ backgroundColor: "#fff", border: "1px solid #ffa500", color: "#ffa500" }}>
            <span>You&apos;re viewing a static demo of Hivesync with sample data.</span>
            <a href="https://github.com/gdsingh/hivesync" target="_blank" rel="noopener noreferrer" className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold text-white hover:opacity-80 transition-opacity" style={{ backgroundColor: "#ffa500" }}>
              Deploy your own <LuExternalLink size={11} />
            </a>
          </div>
        </div>
        {children}
      </body>
    </html>
  );
}
