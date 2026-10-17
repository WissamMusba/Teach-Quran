// Server-side admin authentication helpers.
//
// IMPORTANT: this module is imported by `src/middleware.ts`, which runs on the
// edge runtime. Do NOT import `next/headers` or any Node-only API here — those
// live in `src/lib/adminGuard.ts` instead.
//
// How the admin session works:
//   * The admin signs in via `POST /api/admin/login`.
//   * When Supabase is configured, that route verifies the password server-side
//     and stores the Supabase access + refresh tokens in HttpOnly cookies.
//   * Every admin page load and every /api/admin/* request re-validates the
//     access token against Supabase and checks the account email against
//     ADMIN_EMAIL. The old client-set `admin_session` cookie is gone.
//   * Off-production only, when Supabase is NOT configured, a demo session
//     (`dev_session`) is allowed so the app can be previewed locally.

export const ADMIN_COOKIE = 'sdca_admin_session';
export const ADMIN_REFRESH_COOKIE = 'sdca_admin_refresh';

export const ADMIN_COOKIE_MAX_AGE = 60 * 60; // 1 hour (Supabase access token)
export const ADMIN_REFRESH_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '');
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export function isSupabaseAuthConfigured(): boolean {
  return Boolean(
    supabaseUrl &&
      supabaseAnonKey &&
      supabaseUrl.startsWith('http') &&
      !supabaseUrl.includes('placeholder') &&
      !supabaseAnonKey.includes('placeholder')
  );
}

/** The demo session is only permitted outside production AND with no Supabase configured. */
export function isDevBypassAllowed(): boolean {
  return process.env.NODE_ENV !== 'production' && !isSupabaseAuthConfigured();
}

export type AdminAuthResult =
  | { ok: true; email: string }
  | { ok: false; reason: 'unauthenticated' | 'not_admin' | 'not_configured' };

/**
 * Validate an admin access token. Safe to call from the edge runtime
 * (middleware) and from Node route handlers alike.
 */
export async function checkAdminAuth(accessToken: string | undefined): Promise<AdminAuthResult> {
  if (isDevBypassAllowed()) {
    return accessToken === 'dev_session'
      ? { ok: true, email: 'dev@localhost' }
      : { ok: false, reason: 'unauthenticated' };
  }

  if (!isSupabaseAuthConfigured()) {
    return { ok: false, reason: 'not_configured' };
  }

  const adminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  if (!adminEmail) {
    // Fail closed: without an allowlist we cannot tell admin from any other user.
    return { ok: false, reason: 'not_configured' };
  }

  if (!accessToken) {
    return { ok: false, reason: 'unauthenticated' };
  }

  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    });
    if (!res.ok) return { ok: false, reason: 'unauthenticated' };

    const user = (await res.json()) as { id?: string; email?: string };
    if (!user?.id) return { ok: false, reason: 'unauthenticated' };
    if ((user.email || '').toLowerCase() !== adminEmail) {
      return { ok: false, reason: 'not_admin' };
    }
    return { ok: true, email: user.email || adminEmail };
  } catch {
    return { ok: false, reason: 'unauthenticated' };
  }
}

/** Exchange a Supabase refresh token for a fresh access token. */
export async function refreshSupabaseSession(
  refreshToken: string
): Promise<{ accessToken: string; refreshToken: string; expiresIn: number } | null> {
  if (!isSupabaseAuthConfigured() || !refreshToken) return null;

  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { apikey: supabaseAnonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
      cache: 'no-store',
    });
    if (!res.ok) return null;

    const data = (await res.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
    };
    if (!data.access_token) return null;

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshToken,
      expiresIn: typeof data.expires_in === 'number' ? data.expires_in : ADMIN_COOKIE_MAX_AGE,
    };
  } catch {
    return null;
  }
}

export function adminCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
  };
}
