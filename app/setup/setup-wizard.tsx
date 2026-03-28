"use client";

import { useState } from "react";
import { LuMapPin, LuCopy, LuCheck, LuExternalLink } from "react-icons/lu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";

interface Props {
  appUrl: string | null;
  isVercel: boolean;
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="ml-1 text-muted-foreground hover:text-foreground transition-colors"
      title="Copy"
    >
      {copied ? <LuCheck size={13} /> : <LuCopy size={13} />}
    </button>
  );
}

function CallbackUrl({ label, url }: { label: string; url: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="flex items-center gap-1 rounded-md bg-muted px-3 py-2">
        <code className="text-xs break-all flex-1">{url}</code>
        <CopyButton value={url} />
      </div>
    </div>
  );
}

export function SetupWizard({ appUrl, isVercel }: Props) {
  // self-hosted skips step 1 (no vercel token needed)
  const totalSteps = isVercel ? 3 : 2;
  const [step, setStep] = useState(isVercel ? 1 : 2);

  // step 1 (vercel only)
  const [vercelToken, setVercelToken] = useState("");
  const [tokenValidating, setTokenValidating] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);

  // step 2
  const [customDomain, setCustomDomain] = useState("");
  const [databaseUrl, setDatabaseUrl] = useState("");
  const [directUrl, setDirectUrl] = useState("");
  const [foursquareClientId, setFoursquareClientId] = useState("");
  const [foursquareClientSecret, setFoursquareClientSecret] = useState("");
  const [googleClientId, setGoogleClientId] = useState("");
  const [googleClientSecret, setGoogleClientSecret] = useState("");
  const [allowedEmail, setAllowedEmail] = useState("");
  const [googleMapsApiKey, setGoogleMapsApiKey] = useState("");

  // step 3
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [applyDone, setApplyDone] = useState(false);
  const [redeployUrl, setRedeployUrl] = useState<string | null>(null);
  const [envBlock, setEnvBlock] = useState<string | null>(null);
  const [envBlockCopied, setEnvBlockCopied] = useState(false);

  const effectiveUrl = customDomain.trim() || appUrl;
  const foursquareCallback = effectiveUrl ? `${effectiveUrl}/api/auth/foursquare/callback` : null;
  const googleCallback = effectiveUrl ? `${effectiveUrl}/api/auth/google/callback` : null;

  const displayStep = isVercel ? step : step - 1;

  const step2Complete =
    databaseUrl && directUrl && foursquareClientId && foursquareClientSecret &&
    googleClientId && googleClientSecret && allowedEmail;

  async function validateToken() {
    setTokenValidating(true);
    setTokenError(null);
    try {
      const res = await fetch("https://api.vercel.com/v2/user", {
        headers: { Authorization: `Bearer ${vercelToken}` },
      });
      if (res.ok) {
        setStep(2);
      } else {
        setTokenError("invalid token — check it and try again");
      }
    } catch {
      setTokenError("could not reach Vercel — check your connection");
    } finally {
      setTokenValidating(false);
    }
  }

  async function applyConfig() {
    setApplying(true);
    setApplyError(null);

    if (isVercel) {
      try {
        const res = await fetch("/api/setup/apply", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            vercelToken,
            allowedEmail,
            foursquareClientId,
            foursquareClientSecret,
            googleClientId,
            googleClientSecret,
            databaseUrl,
            directUrl,
            ...(customDomain.trim() ? { customDomain: customDomain.trim() } : {}),
            ...(googleMapsApiKey ? { googleMapsApiKey } : {}),
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          setApplyError(data.error ?? "something went wrong");
        } else {
          setApplyDone(true);
          setRedeployUrl(data.redeployUrl ?? null);
        }
      } catch {
        setApplyError("network error — please try again");
      } finally {
        setApplying(false);
      }
    } else {
      try {
        const res = await fetch("/api/setup/apply", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "selfhosted",
            allowedEmail,
            foursquareClientId,
            foursquareClientSecret,
            googleClientId,
            googleClientSecret,
            databaseUrl,
            directUrl,
            appUrl: appUrl ?? "",
            ...(googleMapsApiKey ? { googleMapsApiKey } : {}),
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.envBlock) {
          setApplyError(data.error ?? "something went wrong");
        } else {
          setEnvBlock(data.envBlock);
          setApplyDone(true);
        }
      } catch {
        setApplyError("network error — please try again");
      } finally {
        setApplying(false);
      }
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center p-4 py-12">
      <div className="w-full max-w-lg space-y-6">

        {/* branding */}
        <div className="flex flex-col items-center gap-1.5 text-center mb-2">
          <span className="flex items-center justify-center w-10 h-10 rounded-full bg-[#ffa500]">
            <LuMapPin size={20} color="white" />
          </span>
          <h1 className="text-xl font-semibold tracking-tight">
            Hive<span className="font-[family-name:var(--font-geist-mono)]">sync</span>
          </h1>
          <p className="text-sm text-muted-foreground">Set up your instance</p>
        </div>

        {/* progress */}
        <div className="space-y-1.5">
          <Progress value={(displayStep / totalSteps) * 100} className="h-1" />
          <p className="text-xs text-muted-foreground text-right">Step {displayStep} of {totalSteps}</p>
        </div>

        {/* step 1 — vercel token (vercel only) */}
        {step === 1 && isVercel && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs font-mono">1</Badge>
                <CardTitle className="text-base">Vercel Token</CardTitle>
              </div>
              <CardDescription className="text-xs">
                Create a token at{" "}
                <a
                  href="https://vercel.com/account/tokens"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2"
                >
                  vercel.com/account/tokens
                </a>{" "}
                — this lets the wizard write your env vars automatically.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                type="password"
                placeholder="paste token here"
                value={vercelToken}
                onChange={(e) => { setVercelToken(e.target.value); setTokenError(null); }}
                onKeyDown={(e) => { if (e.key === "Enter" && vercelToken) validateToken(); }}
              />
              {tokenError && (
                <Alert variant="destructive" className="py-2">
                  <AlertDescription className="text-xs">{tokenError}</AlertDescription>
                </Alert>
              )}
              <Button
                className="w-full bg-[#ffa500] hover:bg-[#e69500] text-white"
                onClick={validateToken}
                disabled={!vercelToken || tokenValidating}
              >
                {tokenValidating ? "Validating…" : "Validate & Continue"}
              </Button>
              <div className="pb-8" />
            </CardContent>
          </Card>
        )}

        {/* step 2 — external services */}
        {step === 2 && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs font-mono">{displayStep}</Badge>
                <CardTitle className="text-base">External Services</CardTitle>
              </div>
              <CardDescription className="text-xs">
                Configure your database and OAuth apps. Use the callback URLs below when setting up each service.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">

              {/* custom domain */}
              {isVercel && (
                <div className="space-y-2">
                  <p className="text-xs font-medium">
                    Custom Domain{" "}
                    <span className="text-muted-foreground font-normal">— optional</span>
                  </p>
                  <Input
                    placeholder={appUrl ?? "https://yourdomain.com"}
                    value={customDomain}
                    onChange={(e) => setCustomDomain(e.target.value)}
                    className="text-xs font-mono"
                  />
                  <p className="text-xs text-muted-foreground">
                    If set, used as <code className="text-xs">NEXTAUTH_URL</code> and shown in callback URLs below. Leave blank to use your Vercel deployment URL.
                  </p>
                </div>
              )}

              {/* database */}
              <div className="space-y-2">
                <p className="text-xs font-medium">
                  Database{" "}
                  {isVercel && (
                    <a
                      href="https://vercel.com/dashboard/stores"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5"
                    >
                      Vercel Storage → Neon <LuExternalLink size={10} />
                    </a>
                  )}
                </p>
                {isVercel && (
                  <Alert className="py-2">
                    <AlertDescription className="text-xs text-muted-foreground">
                      Go to <strong>Vercel dashboard → Storage → Create Database → Neon</strong> and attach it to this project.
                      Vercel will set <code className="text-xs">DATABASE_URL</code> and <code className="text-xs">DATABASE_URL_UNPOOLED</code> automatically.
                      Copy <code className="text-xs">DATABASE_URL_UNPOOLED</code> into a new env var called <code className="text-xs">DIRECT_URL</code>,
                      then paste both connection strings below.
                    </AlertDescription>
                  </Alert>
                )}
                <Input
                  placeholder="DATABASE_URL (pooled connection string)"
                  value={databaseUrl}
                  onChange={(e) => setDatabaseUrl(e.target.value)}
                  className="text-xs font-mono"
                />
                <Input
                  placeholder="DIRECT_URL (direct/unpooled connection string)"
                  value={directUrl}
                  onChange={(e) => setDirectUrl(e.target.value)}
                  className="text-xs font-mono"
                />
              </div>

              {/* foursquare */}
              <div className="space-y-2">
                <p className="text-xs font-medium">
                  Foursquare{" "}
                  <a
                    href="https://foursquare.com/developers/apps"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5"
                  >
                    Developer Apps <LuExternalLink size={10} />
                  </a>
                </p>
                {foursquareCallback && (
                  <CallbackUrl label="Redirect URI" url={foursquareCallback} />
                )}
                <Input
                  placeholder="Client ID"
                  value={foursquareClientId}
                  onChange={(e) => setFoursquareClientId(e.target.value)}
                  className="text-xs font-mono"
                />
                <Input
                  type="password"
                  placeholder="Client Secret"
                  value={foursquareClientSecret}
                  onChange={(e) => setFoursquareClientSecret(e.target.value)}
                  className="text-xs font-mono"
                />
              </div>

              {/* google oauth */}
              <div className="space-y-2">
                <p className="text-xs font-medium">
                  Google OAuth{" "}
                  <a
                    href="https://console.cloud.google.com/apis/credentials"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5"
                  >
                    Cloud Console <LuExternalLink size={10} />
                  </a>
                </p>
                {googleCallback && (
                  <CallbackUrl label="Authorized Redirect URI" url={googleCallback} />
                )}
                <Input
                  placeholder="Client ID"
                  value={googleClientId}
                  onChange={(e) => setGoogleClientId(e.target.value)}
                  className="text-xs font-mono"
                />
                <Input
                  type="password"
                  placeholder="Client Secret"
                  value={googleClientSecret}
                  onChange={(e) => setGoogleClientSecret(e.target.value)}
                  className="text-xs font-mono"
                />
              </div>

              {/* email */}
              <div className="space-y-2">
                <p className="text-xs font-medium">Your Google Email</p>
                <Input
                  type="email"
                  placeholder="you@gmail.com"
                  value={allowedEmail}
                  onChange={(e) => setAllowedEmail(e.target.value)}
                  className="text-xs"
                />
                <p className="text-xs text-muted-foreground">Locks this instance to your account.</p>
              </div>

              {/* google maps (optional) */}
              <div className="space-y-2">
                <p className="text-xs font-medium">
                  Google Maps API Key{" "}
                  <span className="text-muted-foreground font-normal">— optional</span>
                </p>
                <Input
                  placeholder="Enables enriched addresses + Maps links"
                  value={googleMapsApiKey}
                  onChange={(e) => setGoogleMapsApiKey(e.target.value)}
                  className="text-xs font-mono"
                />
              </div>

              <div className="flex gap-2 pt-1">
                {isVercel && (
                  <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>
                    Back
                  </Button>
                )}
                <Button
                  className="flex-1 bg-[#ffa500] hover:bg-[#e69500] text-white"
                  onClick={() => setStep(3)}
                  disabled={!step2Complete}
                >
                  Continue
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* step 3 — apply */}
        {step === 3 && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs font-mono">{displayStep}</Badge>
                <CardTitle className="text-base">
                  {isVercel ? "Apply & Deploy" : "Your Environment Variables"}
                </CardTitle>
              </div>
              <CardDescription className="text-xs">
                {isVercel
                  ? "The following will be written to your Vercel project. Secrets are generated automatically."
                  : "Copy these into your .env file. Secrets have been generated automatically."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">

              {!applyDone && (
                <>
                  {isVercel && (
                    <div className="rounded-md bg-muted px-3 py-2.5 space-y-1">
                      {[
                        "NEXTAUTH_SECRET — generated",
                        `NEXTAUTH_URL — ${customDomain.trim() || appUrl || "deployment URL"}`,
                        `ALLOWED_GOOGLE_EMAIL — ${allowedEmail}`,
                        "ENCRYPTION_KEY — generated",
                        `FOURSQUARE_CLIENT_ID — ${foursquareClientId}`,
                        "FOURSQUARE_CLIENT_SECRET — ••••••",
                        `GOOGLE_CLIENT_ID — ${googleClientId}`,
                        "GOOGLE_CLIENT_SECRET — ••••••",
                        "CRON_SECRET — generated",
                        "DATABASE_URL — ••••••",
                        "DIRECT_URL — ••••••",
                        ...(googleMapsApiKey ? ["GOOGLE_MAPS_API_KEY — ••••••"] : []),
                      ].map((line) => (
                        <p key={line} className="text-xs font-mono text-muted-foreground">{line}</p>
                      ))}
                    </div>
                  )}

                  {applyError && (
                    <Alert variant="destructive" className="py-2">
                      <AlertDescription className="text-xs">{applyError}</AlertDescription>
                    </Alert>
                  )}

                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={() => setStep(2)} disabled={applying}>
                      Back
                    </Button>
                    <Button
                      className="flex-1 bg-[#ffa500] hover:bg-[#e69500] text-white"
                      onClick={applyConfig}
                      disabled={applying}
                    >
                      {applying
                        ? (isVercel ? "Applying…" : "Generating…")
                        : (isVercel ? "Apply Configuration" : "Generate")}
                    </Button>
                  </div>
                </>
              )}

              {applyDone && isVercel && (
                <div className="space-y-3">
                  <Alert className="py-3 border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-900">
                    <AlertDescription className="text-xs text-green-800 dark:text-green-400">
                      All {googleMapsApiKey ? "12" : "11"} environment variables written successfully.
                    </AlertDescription>
                  </Alert>
                  {redeployUrl ? (
                    <p className="text-xs text-muted-foreground">
                      Redeploying now — your app will be live in ~1 minute.{" "}
                      <a href={redeployUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 inline-flex items-center gap-0.5">
                        View deployment <LuExternalLink size={10} />
                      </a>
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Redeploy your project in the Vercel dashboard to pick up the new env vars.
                    </p>
                  )}
                </div>
              )}

              {applyDone && !isVercel && envBlock && (
                <div className="space-y-3">
                  <div className="relative rounded-md bg-muted px-4 py-4">
                    <pre className="text-sm font-mono whitespace-pre-wrap break-all text-foreground leading-relaxed">{envBlock}</pre>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(envBlock);
                        setEnvBlockCopied(true);
                        setTimeout(() => setEnvBlockCopied(false), 1500);
                      }}
                      className="absolute top-2 right-2 text-muted-foreground hover:text-foreground transition-colors"
                      title="Copy all"
                    >
                      {envBlockCopied ? <LuCheck size={13} /> : <LuCopy size={13} />}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Paste this into your <code className="text-xs">.env</code> file, then restart your server.
                  </p>
                </div>
              )}

            </CardContent>
          </Card>
        )}

      </div>
    </div>
  );
}
