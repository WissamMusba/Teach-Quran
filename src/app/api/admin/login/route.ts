import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  ADMIN_COOKIE,
  ADMIN_REFRESH_COOKIE,
  ADMIN_COOKIE_MAX_AGE,
  ADMIN_REFRESH_MAX_AGE,
  ADMIN_PASSWORD_SESSION_MAX_AGE,
  adminCookieOptions,
  isSupabaseAuthConfigured,
  isPasswordAdminConfigured,
  isDevBypassAllowed,
  sha256Hex,
  adminPasswordSessionToken,
} from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';

// Simple per-instance rate limiting (best effort — put a WAF/Upstash limiter in
// front of this for production-grade protection).
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;
const attempts = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_ATTEMPTS;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: 'Too many login attempts. Please wait 15 minutes and try again.' },
      { status: 429 }
    );
  }

  let body: { email?: unknown; password?: unknown } | null = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body?.password === 'string' ? body.password : '';

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
  }

  // --- Real authentication against Supabase (server-side) ---
  if (isSupabaseAuthConfigured()) {
    const adminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    if (!adminEmail) {
      return NextResponse.json(
        { error: 'Admin access is not configured. Set the ADMIN_EMAIL environment variable.' },
        { status: 503 }
      );
    }

    // Do not reveal whether it was the email or the password that was wrong.
    if (email !== adminEmail) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

    const sb = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error || !data.session) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
    }

    const response = NextResponse.json({ success: true });
    response.cookies.set(ADMIN_COOKIE, data.session.access_token, adminCookieOptions(ADMIN_COOKIE_MAX_AGE));
    response.cookies.set(
      ADMIN_REFRESH_COOKIE,
      data.session.refresh_token,
      adminCookieOptions(ADMIN_REFRESH_MAX_AGE)
    );
    return response;
  }

  // --- Password-based admin (deployments without Supabase, e.g. DEMO_MODE) ---
  if (isPasswordAdminConfigured()) {
    const configuredEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    if (configuredEmail && email !== configuredEmail) {
      // Do not reveal whether it was the email or the password that was wrong.
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
    }

    // Compare SHA-256 digests instead of the raw strings (constant-length compare).
    const [givenHash, expectedHash] = await Promise.all([
      sha256Hex(password),
      sha256Hex(process.env.ADMIN_PASSWORD || ''),
    ]);
    if (givenHash !== expectedHash) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
    }

    const response = NextResponse.json({ success: true, demo: true });
    response.cookies.set(
      ADMIN_COOKIE,
      await adminPasswordSessionToken(),
      adminCookieOptions(ADMIN_PASSWORD_SESSION_MAX_AGE)
    );
    return response;
  }

  // --- Local demo mode: only ever possible outside production with no Supabase ---
  if (isDevBypassAllowed()) {
    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Demo mode: use any email and a password of 6+ characters.' },
        { status: 401 }
      );
    }
    const response = NextResponse.json({ success: true, demo: true });
    response.cookies.set(ADMIN_COOKIE, 'dev_session', adminCookieOptions(ADMIN_COOKIE_MAX_AGE));
    return response;
  }

  return NextResponse.json(
    {
      error:
        'Admin login is not configured on this server. Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and ADMIN_EMAIL.',
    },
    { status: 503 }
  );
}
