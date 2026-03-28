import { redirect } from "next/navigation";
import { SetupWizard } from "./setup-wizard";

const REQUIRED_VARS = [
  "NEXTAUTH_SECRET",
  "NEXTAUTH_URL",
  "ALLOWED_GOOGLE_EMAIL",
  "ENCRYPTION_KEY",
  "FOURSQUARE_CLIENT_ID",
  "FOURSQUARE_CLIENT_SECRET",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "CRON_SECRET",
  "DATABASE_URL",
  "DIRECT_URL",
];

export default function SetupPage() {
  const allSet = REQUIRED_VARS.every((v) => !!process.env[v]);
  if (allSet) redirect("/home");

  const appUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null;
  const isVercel = !!process.env.VERCEL_PROJECT_ID;

  return <SetupWizard appUrl={appUrl} isVercel={isVercel} />;
}
