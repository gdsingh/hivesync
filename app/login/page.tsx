import type { Metadata } from "next";
import { SiGithub } from "react-icons/si";
import { LuMapPin } from "react-icons/lu";

export const metadata: Metadata = { title: "Login" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error: errorCode } = await searchParams;

  const errorMessages: Record<string, string> = {
    state_mismatch: "Authentication error — please try again",
    no_code: "Google sign-in was cancelled",
    token_failed: "Failed to complete sign-in — please try again",
    wrong_account: "This instance is already linked to a different Google account",
  };

  const error = errorCode ? errorMessages[errorCode] ?? "Sign-in failed" : null;

  return (
    <div className="relative flex min-h-screen items-center justify-center p-6 sm:p-4">
      <div className="w-full max-w-sm space-y-6 -mt-[10vh]">

        {/* branding */}
        <div className="space-y-3">
          <div className="flex flex-col items-center gap-1.5 text-center -mt-10 mb-7">
            <span className="flex items-center justify-center w-10 h-10 rounded-full bg-[#ffa500]">
              <LuMapPin size={20} color="white" />
            </span>
            <h1 className="text-xl font-semibold tracking-tight">Hive<span className="font-[family-name:var(--font-geist-mono)]">sync</span></h1>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed text-justify">
            Automatically syncs your Foursquare check-ins to Google Calendar — every check-in becomes an event, complete with venue, location, score, stickers, and friends.
          </p>
          <div className="space-y-1.5 text-xs text-muted-foreground/70">
            <p>→ Daily sync via cron, or sync on demand</p>
            <p>→ Dedicated calendar, local timezones</p>
            <p>→ Full history import by year</p>
            <p>→ Stats, stickers, and sync history</p>
          </div>
        </div>

        {/* error */}
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        {/* sign in */}
        <div className="space-y-3">
          <a
            href="/api/auth/google/connect"
            className="flex items-center justify-center gap-2 w-full rounded-md border border-input bg-background px-4 py-2.5 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <GoogleIcon />
            Sign in with Google
          </a>
          <p className="text-xs text-center text-muted-foreground/50">
            You will connect to Foursquare after signing in.
          </p>
        </div>

        <div className="flex justify-center">
          <a
            href="https://github.com/gdsingh/hivesync"
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground/30 hover:text-muted-foreground transition-colors"
          >
            <SiGithub size={13} />
          </a>
        </div>

      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}
