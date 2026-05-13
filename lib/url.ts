export function normalizeBaseUrl(value: string | null | undefined, fallback = "http://localhost:3000"): string {
  const raw = value?.trim() || fallback;
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}
