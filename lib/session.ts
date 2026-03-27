import crypto from "crypto";

export const COOKIE_NAME = "swarm-session";
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function getSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is not set");
  return secret;
}

// Node.js only — called from route handlers, never from middleware
export function createSessionToken(): string {
  const payload = Buffer.from(
    JSON.stringify({
      authenticated: true,
      exp: Date.now() + SESSION_DURATION_MS,
    })
  ).toString("base64url");

  const sig = crypto
    .createHmac("sha256", getSecret())
    .update(payload)
    .digest("base64url");

  return `${payload}.${sig}`;
}

// Edge-compatible — uses Web Crypto API, works in middleware + Node.js 18+
export async function verifySessionToken(token: string): Promise<boolean> {
  try {
    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) return false;

    const dot = token.lastIndexOf(".");
    if (dot === -1) return false;

    const payload = token.slice(0, dot);
    const sig = token.slice(dot + 1);

    // recompute HMAC-SHA256 using Web Crypto
    const enc = new TextEncoder();
    const key = await globalThis.crypto.subtle.importKey(
      "raw",
      enc.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const sigBytes = await globalThis.crypto.subtle.sign("HMAC", key, enc.encode(payload));

    // encode result as base64url
    const arr = new Uint8Array(sigBytes);
    let binary = "";
    for (let i = 0; i < arr.length; i++) binary += String.fromCharCode(arr[i]);
    const expected = btoa(binary)
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");

    if (sig !== expected) return false;

    // decode payload (JSON is ASCII-safe so atob is fine)
    const padded =
      payload.replace(/-/g, "+").replace(/_/g, "/") +
      "=".repeat((4 - (payload.length % 4)) % 4);
    const data = JSON.parse(atob(padded));
    if (typeof data.exp !== "number" || data.exp < Date.now()) return false;

    return true;
  } catch {
    return false;
  }
}

// Node.js only — used for password comparison in login route.
// Uses keyless SHA-256 so this never throws if NEXTAUTH_SECRET is unset.
export function safeCompare(a: string, b: string): boolean {
  const ha = crypto.createHash("sha256").update(a).digest();
  const hb = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}
