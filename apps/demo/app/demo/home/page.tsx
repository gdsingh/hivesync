import { Dashboard } from "@/components/dashboard";
import fs from "fs";
import path from "path";

const hemingwayBuf = fs.readFileSync(path.join(process.cwd(), "public/hemingway.jpg"));
const HEMINGWAY_PHOTO = `data:image/jpeg;base64,${hemingwayBuf.toString("base64")}`;

const GOOGLE_BADGE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><circle cx="20" cy="20" r="20" fill="#4285F4"/><text x="20" y="27" text-anchor="middle" font-family="sans-serif" font-size="18" font-weight="bold" fill="white">E</text></svg>`;
const GOOGLE_BADGE_URL = `data:image/svg+xml;base64,${Buffer.from(GOOGLE_BADGE_SVG).toString("base64")}`;

export default async function PreviewHome() {
  return (
    <Dashboard
      foursquareConnected={true}
      foursquareDisplayName="Ernest Hemingway"
      foursquarePhotoUrl={HEMINGWAY_PHOTO}
      googleConnected={true}
      googleEmail="ernest@example.com"
      googlePhotoUrl={GOOGLE_BADGE_URL}
      totalSynced={2847}
      ogMode={false}
      lastSyncedAt={new Date("2026-03-22T14:32:00Z")}
      isPreview={true}
    />
  );
}
