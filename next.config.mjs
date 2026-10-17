import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseHost = (() => {
  try {
    const raw = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    if (!raw.startsWith('http')) return null;
    return new URL(raw).host;
  } catch {
    return null;
  }
})();

const isDev = process.env.NODE_ENV !== 'production';

const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "img-src 'self' data: blob: https://images.unsplash.com" + (supabaseHost ? ` https://${supabaseHost}` : ''),
  "font-src 'self' https://fonts.gstatic.com data:",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  // Next.js hydration requires inline scripts; tighten with a nonce in a future pass.
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "connect-src 'self'" + (supabaseHost ? ` https://${supabaseHost} wss://${supabaseHost}` : ''),
  "frame-src 'self' https://js.stripe.com",
  "upgrade-insecure-requests",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=(), payment=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: __dirname,
  poweredByHeader: false,
  reactStrictMode: true,
  compress: true,
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 2592000,
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      ...(supabaseHost
        ? [
            {
              protocol: 'https',
              hostname: supabaseHost,
              pathname: '/storage/v1/object/public/**',
            },
          ]
        : []),
    ],
  },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      {
        source: '/:all*(svg|jpg|jpeg|png|webp|avif|ico|woff2)',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ];
  },
};

export default nextConfig;
