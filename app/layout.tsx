import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { normalizeBaseUrl } from "@/lib/url";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(normalizeBaseUrl(process.env.NEXTAUTH_URL)),
  title: {
    default: "Hivesync",
    template: "%s – Hivesync",
  },
  description: "sync your foursquare check-ins to google calendar",
  openGraph: {
    title: "Hivesync",
    description: "sync your foursquare check-ins to google calendar",
    images: [{ url: "/hivesync.png", width: 914, height: 286 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Hivesync",
    description: "sync your foursquare check-ins to google calendar",
    images: ["/hivesync.png"],
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
        {children}
      </body>
    </html>
  );
}
