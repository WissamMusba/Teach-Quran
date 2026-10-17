// Central site URL resolution for metadata, sitemap and robots.
// Order: explicit NEXT_PUBLIC_SITE_URL (recommended for production) →
// Vercel-generated URL → localhost for local development.
export function getSiteUrl(): string {
  const candidates = [
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '',
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      return new URL(candidate).origin;
    } catch {
      // ignore malformed values and fall through
    }
  }

  return 'http://localhost:3000';
}
