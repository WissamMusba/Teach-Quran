# Website Audit & Hardening Report — Cricket Store

**Date:** 17 October 2026
**Scope:** Full audit of the Cricket Store application — security, data layer, legal/compliance, storefront usability & accessibility, SEO, and admin operations — followed by implemented fixes.
**Stack audited:** Next.js 14.2.35 (App Router, TypeScript) · Supabase (PostgreSQL + Storage) · Stripe Checkout · Tailwind CSS

---

## 1. How This Audit Was Conducted

- **Five independent workstreams**: security & authentication; database/RLS/infrastructure; legal & cookie compliance; storefront UX & accessibility; admin/operations.
- **Manual corroboration**: every reported finding was re-verified against the actual source files before fixing.
- **Implementation + verification**: fixes were applied to the codebase and validated with `npx tsc --noEmit` (clean) and a full production `npm run build` (succeeds — all 27 routes compile, middleware bundles, static generation completes).

**Important context:** The audit uncovered that the site was pre-launch, with placeholder Supabase/Stripe credentials. Several fixes therefore focus on guaranteeing that the application **fails closed** (refuses orders, denies access) instead of **failing open** (faking payments, allowing anonymous admin access) once real credentials are added.

---

## 2. Executive Summary

| # | Finding | Severity | Status |
|---|---------|----------|--------|
| 1 | All `/api/admin/*` endpoints were unauthenticated — anyone on the internet could read orders/customer PII, change prices, or delete products via direct HTTP calls | 🔴 Critical | **Fixed** |
| 2 | Admin authentication relied on a plain, client-forgeable `admin_session` cookie value | 🔴 Critical | **Fixed** |
| 3 | Dev login heuristic (`email.includes('admin') || password.length >= 6`) allowed trivially bypassing login | 🔴 Critical | **Fixed** |
| 4 | Checkout trusted client-supplied prices and totals | 🔴 Critical | **Fixed** |
| 5 | Order success page exposed full customer PII to anyone with/guessing an order ID (broken access control / IDOR) | 🔴 Critical | **Fixed** |
| 6 | With missing credentials the app faked paid orders, served mock catalogue data, and "succeeded" — in production too | 🔴 Critical | **Fixed** |
| 7 | Image upload endpoint had no authentication; anyone could write files to storage; stored file type trusted the client | 🔴 Critical | **Fixed** |
| 8 | Supabase RLS granted full read/write on **all** tables to **any authenticated user**; storage allowed any visitor to upload/delete product media | 🔴 Critical | **Fixed** (SQL provided; must be run on the live DB) |
| 9 | Stripe webhook had no idempotency guard, no paid-amount cross-check, and could regress order status | 🟠 High | **Fixed** |
| 10 | Cart was emptied **before** the customer completed payment — abandoning Stripe Checkout destroyed the cart | 🟠 High | **Fixed** |
| 11 | No legal pages at all (privacy/terms/cookies/returns/shipping/contact) for a store taking personal data and payments | 🟠 High | **Fixed** |
| 12 | No security headers (CSP, HSTS, X-Frame-Options, etc.) | 🟠 High | **Fixed** |
| 13 | `.gitignore` only excluded `.env*.local` — a plain `.env` with secrets could be committed | 🟠 High | **Fixed** |
| 14 | Product specifications stored in the DB were never displayed; PDP pre-selected phantom variants (e.g. balls "ordered" with size "Adult / Men") | 🟡 Medium | **Fixed** |
| 15 | Cart drawer lacked dialog semantics (no `role="dialog"`, Esc close, focus management, scroll lock) | 🟡 Medium | **Fixed** |
| 16 | Competitor brand name ("Pro:Direct") leaked into the page title; no sitemap, robots, favicon, 404/error pages, or per-page metadata | 🟡 Medium | **Fixed** |
| 17 | Admin portal links exposed in the public Navbar/MobileBar; admin pages had no per-page guard | 🟡 Medium | **Fixed** |
| 18 | Next.js pinned at `14.2.35` — EOL for security fixes | 🟠 High | **Reported** (upgrade recommended) |

---

## 3. What Was Fixed

### 3.1 Authentication & Access Control

**Before:** `/api/admin/*` routes answered to anyone (the cookie was set client-side after a scriptable login check and was trivially forgeable). Admin pages rendered without a server check.

**After:**
- **Server-verified sessions** (`src/lib/adminAuth.ts`, `src/lib/adminGuard.ts`): the login API (`/api/admin/login`, rate-limited to 10 attempts / 15 min per IP) exchanges credentials with Supabase Auth, requires the account email to match the `ADMIN_EMAIL` allowlist, and stores the session in **HttpOnly `sdca_admin_session`** (+ `sdca_admin_refresh`) cookies. Fails closed if `ADMIN_EMAIL` is not configured.
- **Edge middleware** (`src/middleware.ts`) validates every `/admin/*` page and `/api/admin/*` request (plus `/api/upload`) against Supabase `GET /auth/v1/user`, transparently refreshes expired access tokens, and redirects/401s otherwise. Only login/logout are public.
- **Defence in depth:** every admin API route independently calls `requireAdminApi()`, and every admin page calls `await requireAdminPage()` — middleware is never the only gate.
- **Public exposure removed:** the Admin buttons in the Navbar and mobile bottom bar are gone; only a discreet "Staff Portal" link remains in the footer, and the mobile bar slot now opens Contact.

### 3.2 Checkout, Payments & Webhooks

- **Server-authoritative pricing** (`src/app/api/checkout/route.ts`): each cart line is re-resolved from the database (price, title, active state, stock). Quantities must be integers 1–50; the client's price fields are ignored entirely.
- **Atomic stock reservation for COD** with rollback: if any line fails, previously reserved stock is returned and the orphan order is deleted.
- **No fake payments in production**: without Stripe, card checkout returns HTTP 503 (and deletes the pending order) unless running in explicit `DEMO_MODE`. The in-memory "sandbox card paid" simulator is now development-only.
- **Order confirmation links are HMAC-signed** (`src/lib/orderToken.ts`): the success page verifies `?order_id=…&token=…` before rendering anything; an invalid/absent token shows a "couldn't verify this order" state (with contact link) instead of PII. Success URLs are `noindex`.
- **Cart lifecycle fixed**: the cart is cleared only when the verified confirmation page mounts (`ClearCartOnMount`), never before the Stripe redirect. Abandoned payments keep the cart intact.
- **Stripe webhook rewritten** (`src/app/api/webhooks/stripe/route.ts`): signature verification kept; **idempotency ledger** (`stripe_events` table, degrades gracefully with a warning if the table is missing); cross-checks the paid amount against the order total; never downgrades paid orders; `checkout.session.expired` marks unpaid sessions failed; errors no longer leak internals.
- **Upload endpoint hardened** (`src/app/api/upload/route.ts`): admin-only, max 6 files × 5 MB, real image type detected from **magic bytes** (png/jpeg/webp), filenames replaced with UUIDs, storage served by the server; dev-only data-URL fallback.

### 3.3 Data Layer & Database (Supabase)

- **`supabaseServer.ts` rewritten**: uses the service-role key only (no silent downgrade to the anon key), checked writes, compare-and-swap stock decrement, stock increment and order-delete helpers for rollback, and an explicit **demo/fail-closed** switch (`isDemoMode`) — development or `DEMO_MODE=true` only.
- **`supabase/schema.sql` rewritten** (fresh installs) and **`supabase/security-hardening.sql` added** (idempotent migration for existing databases):
  - Removes the blanket `auth.role() = 'authenticated'` full-access policies and replaces them with a signed `app_metadata.role = "admin"` JWT-claim check (cannot be forged from the browser).
  - Orders and order items are now readable by **no one** except the service role and claimed admins.
  - Storage: removed the insert/delete policies that let any visitor write or delete files — writes now happen exclusively server-side via the service role (public bucket, public URLs unchanged).
  - Adds the `stripe_events` idempotency table, catalogue/order indexes, `updated_at` trigger, and defensive `NOT VALID` check constraints on legacy installs.
- **Admin setup documented**: create the Supabase Auth user, grant the `{"role":"admin"}` app-metadata claim, set `ADMIN_EMAIL`.

### 3.4 Legal, Privacy & Cookies

- **New pages** (dark-themed, consistent, linked from a new **Customer Care** footer column and the checkout consent text):
  - `/privacy` — controller identity, data categories (order details, Stripe-handled payments, support messages), purposes, legal bases, sharing, international transfers, retention, data-subject rights (UAE PDPL / GDPR framing), security, children, changes.
  - `/terms` — eligibility, products/availability, AED pricing & VAT, payment (Stripe/COD), order acceptance, delivery, returns, warranty, liability limits, acceptable use, IP, governing law.
  - `/cookies` — **complete storage inventory** (cart `localStorage`, two staff-only HttpOnly cookies), explicit "no analytics / no ads / no tracking", Stripe-domain cookie note, and why no consent banner is shown today.
  - `/returns` — 14-day window, eligibility/exclusions, faulty/wrong-item protections, process, who pays return shipping, refund timelines (COD refunds by bank transfer).
  - `/shipping` — processing times, free tracked UAE delivery, COD scope, international shipping + customs duties, tracking, failed deliveries, damaged parcels.
  - `/contact` — support channels, hours, order-reference guidance, links to policies.
- **Cookie-consent decision (documented):** the site currently sets only strictly-necessary storage, which is exempt from consent in the UAE/EU frameworks, so no banner is displayed. **The moment analytics or marketing tools are added, a consent banner becomes required** — this is recorded in the Cookie Notice itself.
- **Checkout now requires agreeing to Terms, Returns and Privacy** before the submit button unlocks.

### 3.5 Storefront UX, Accessibility & SEO

- **Product page (`ProductDetailClient.tsx`)**: specifications (stored in the DB but never shown) now render in a labelled `<dl>` block; phantom variant defaults removed (balls/bags no longer carry a bogus "Adult / Men" size; the bat weight default now matches an actual selectable chip — previously it defaulted to a weight that wasn't even offered); quantity controls got aria-labels; a broken `active:scale-98` class fixed.
- **Product cards**: categories with real size/weight/orientation choices (bats, gloves, pads, shoes, helmets) now show **"Choose Options"** and link to the product page instead of silently quick-adding with defaults.
- **Cart drawer**: proper modal-dialog semantics — `role="dialog"`, `aria-modal`, labelled heading, Esc to close, background scroll lock, focus moved into the panel and restored to the trigger on close, Tab contained within the panel, aria-labels on every quantity/remove control, larger tap targets, and the contradictory "shipping calculated at checkout" text replaced with the store's actual free-tracked-delivery offer.
- **Checkout**: every field now has a programmatically associated label + `id`; `autocomplete`/`inputmode` attributes added (name, email, tel, address lines, postal code, country); country list re-ordered with **United Arab Emirates first** (UAE first, Gulf neighbours, then the rest) and +971/emirate placeholders; postal code no longer mandatory (UAE has none); error banner has `role="alert"`; button text shows the amount ("Pay by Card — AED X" / "Place COD Order — AED X"); the redirect fallback that could skip Stripe was removed in favour of always using the server-issued redirect URL.
- **SEO/metadata**: competitor name removed from the title; root layout now defines a title template, OpenGraph, `metadataBase` and theme colour; product pages get `generateMetadata` (title, description, canonical, OG image); shop and all policy pages have metadata + canonicals; `/robots.txt`, dynamic `/sitemap.xml` (all active products + static routes), favicon (`icon.svg`), root & storefront 404 pages, and storefront/admin error boundaries were added; cart, checkout and order pages are `noindex`.
- **Home**: misleading "Explore All N+ Items" counter replaced with "Browse the Full Collection".
- **Mobile**: bottom navigation's Admin slot replaced with Contact; footer adds safe-area bottom padding so the fixed bar no longer covers footer content.

### 3.6 Admin Operations

- **COD payment reconciliation**: the order detail page now has a **"Mark Cash Received"** control (`PaymentStatusControl`, server guard re-checked by the API) with a confirmation prompt and an "undo to pending" path for mis-clicks. Card payments remain automatically reconciled by the webhook.
- Order status update API hardened with status allowlists; settings API hardened with a field allowlist.

### 3.7 Housekeeping

- `.gitignore` now excludes `.env` and all `.env.*` files except `.env.example`; `.env.example` documents every variable including new `ORDER_TOKEN_SECRET` and `DEMO_MODE`.
- Security headers (`next.config.mjs`): CSP (tightened to self + Google Fonts incl./fonts, Unsplash & Supabase images, Stripe frames; inline-script limitation noted below), HSTS (2 years), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`; `X-Powered-By` disabled.
- README fully rewritten (setup, RLS model, staff claim, env vars, webhook setup, security notes, pre-launch checklist).
- Removed the leftover 68 KB subagent artifact `.opencode/PROPOSED_CHANGES.txt`.

---

## 4. Verification

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | ✅ No type errors |
| `npm run build` (production) | ✅ Compiles, lints, 27/27 routes generated, middleware bundled (27.2 kB) |
| Fail-closed log during build with placeholder envs | ✅ `FATAL CONFIG` warning emitted; no fake data used to build storefront pages |
| New routes present in build output | ✅ `/privacy /terms /cookies /returns /shipping /contact /robots.txt /sitemap.xml /icon.svg` + error/404 boundaries |

**What could not be verified locally:** live Supabase/RLS behaviour, live Stripe webhook signing, and the admin login round-trip all require real credentials (`DEMO_MODE=true` exercises the UI paths instead). These are covered by the pre-launch checklist in §6.

---

## 5. Remaining Recommendations (Not Yet Implemented)

### Priority 1 — before going live
1. **Upgrade Next.js off `14.2.35`.** The 14.2 line is at its end for security maintenance; multiple advisories published after this patch level remain unpatched on 14.2.x. Upgrade to the newest supported 15.x release (test the App Router changes), and adopt security patches thereafter.
2. **Run `supabase/security-hardening.sql` on the production database** and confirm `pg_policies` output shows the new policies (the code-side fixes do not repair an existing insecure database).
3. **Set all production environment variables** — especially `ORDER_TOKEN_SECRET` (generate with `openssl rand -hex 32`), `ADMIN_EMAIL`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_WEBHOOK_SECRET`. Keep `DEMO_MODE` unset/false.
4. **Replace every `[BRACKETED PLACEHOLDER]` in the legal pages** and have the policies reviewed (§7 lists them all). Also review the default policy values chosen during this audit (14-day returns, 48 h damage reports, 2–5 day UAE delivery) against how the business actually operates.
5. **End-to-end test with live keys**: one card order (verify webhook marks it paid and stock decrements once), one COD order (verify "Mark Cash Received"), one failed payment (verify order marked failed, stock untouched), one abandoned checkout (verify cart survives).

### Priority 2 — shortly after
6. **Self-host the fonts.** `globals.css` loads Google Fonts at runtime; download Barlow Condensed + Plus Jakarta Sans (or switch to `next/font`) to remove the third-party dependency, the CSP loosening, and the extra DNS/TLS round-trips.
7. **Transactional emails.** Right now customers receive no email confirmation or dispatch notice — everything relies on the confirmation page. Wire Stripe receipts + an email provider (Resend/Postmark) for order confirmation, dispatch, and refunds.
8. **Order tracking.** Add a `tracking_number`/carrier field in admin and show it in a customer-facing order lookup (reusing the signed-token concept).
9. **Refunds from the admin panel.** Add Stripe refund API integration and a `refunded` payment status; today refunds must be made in the Stripe dashboard.
10. **Stock restoration on cancellation/refund.** Add an admin action to return stock to inventory when an order is cancelled after COD reservation.
11. **Rate-limit `/api/checkout`** (the admin login is already rate-limited) — a simple IP-based limiter or WAF rule prevents order-spam and stock-grief.
12. **CSP nonce migration.** The CSP currently allows `'unsafe-inline'` scripts because Next.js hydration uses inline scripts. A nonce-based CSP removes that weakening.
13. **Analytics — only with a consent banner** (see Cookie Notice; the moment tracking is added, ship the banner).

### Priority 3 — nice to have
14. Contact form with server-side delivery (currently display-only details; no form exists so none can silently fail).
15. COD availability check by country (currently COD is offered internationally at checkout though the Shipping page scopes it to the UAE).
16. Low-stock email alerts to staff; CSV export of orders.
17. Product image `alt` text refinement and hero imagery localisation (currently Unsplash hotlinks).

---

## 6. Pre-Launch Checklist

- [ ] Upgrade Next.js to the latest supported release; re-run `npm run build`.
- [ ] Apply `supabase/security-hardening.sql`; create the staff Auth user; grant `app_metadata.role = "admin"`; set `ADMIN_EMAIL`.
- [ ] Configure Stripe production keys + webhook endpoint (`checkout.session.completed`, `checkout.session.expired`, failed-payment events).
- [ ] Set env: `NEXT_PUBLIC_SITE_URL`, `ORDER_TOKEN_SECRET`, Supabase pair, Stripe trio, `ADMIN_EMAIL`; confirm `DEMO_MODE` is not enabled.
- [ ] Fill in and review all legal pages (see §7).
- [ ] Smoke-test: storefront browse → cart → COD order → success page (cart clears once); admin login → order status + "Mark Cash Received"; card order through Stripe test mode (webhook marks paid); tamper the success URL token (must show the verify-failed state); hit `/api/admin/orders/<id>` logged out (must 401); attempt an anonymous upload (must 401).
- [ ] Verify `/robots.txt` and `/sitemap.xml` resolve on the production domain.

---

## 7. Legal Page Placeholders To Replace

Every bracketed token below must be replaced with real business information before launch:

| Placeholder | Meaning | Used in |
|---|---|---|
| `[LEGAL COMPANY NAME]` | Registered entity name | privacy, terms, contact |
| `[REGISTERED ADDRESS]` | Registered/business address | privacy, terms, contact |
| `[TRN]` | Tax Registration Number | privacy, terms, contact |
| `[SUPPORT EMAIL]` | Customer support email | privacy, terms, cookies, returns, shipping, contact, LegalPage footer |
| `[SUPPORT PHONE]` | Customer support phone | contact |
| `[SUPPORT HOURS]` | Support opening hours | contact |
| `[JURISDICTION]` | Governing law & courts | terms |
| `[HOSTING REGION]` | Where data is hosted | privacy |
| `[RETENTION PERIOD]` | Order-record retention | privacy |

Policy values chosen as sensible defaults during this audit — **review before launch**:

- 14-day return window; 48-hour faulty/damaged report window; 2 business days to issue return instructions; 5 business days to inspect; 14 days to issue refunds.
- 1–2 business days processing; free tracked UAE delivery; 2–5 business days UAE transit; COD presented as UAE-wide; international shipping offered via checkout.
- Governing-law and retention placeholders deliberately withheld rather than invented.

---

## 8. File Change Index

**Added:** `src/lib/adminAuth.ts`, `src/lib/adminGuard.ts`, `src/lib/orderToken.ts`, `src/lib/site.ts`, `src/middleware.ts`, `src/app/api/admin/login/route.ts`, `src/app/api/admin/logout/route.ts`, `src/components/admin/PaymentStatusControl.tsx`, `src/components/storefront/ClearCartOnMount.tsx`, `src/components/storefront/LegalPage.tsx`, `src/components/storefront/NotFoundContent.tsx`, `src/app/(storefront)/{privacy,terms,cookies,returns,shipping,contact}/page.tsx`, `src/app/(storefront)/checkout/layout.tsx`, `src/app/(storefront)/cart/layout.tsx`, `src/app/(storefront)/error.tsx`, `src/app/(storefront)/not-found.tsx`, `src/app/not-found.tsx`, `src/app/admin/error.tsx`, `src/app/robots.ts`, `src/app/sitemap.ts`, `src/app/icon.svg`, `supabase/security-hardening.sql`, `AUDIT_REPORT.md`

**Rewritten:** `src/lib/supabaseServer.ts`, `src/app/api/checkout/route.ts`, `src/app/api/webhooks/stripe/route.ts`, `src/app/api/upload/route.ts`, `src/app/api/admin/{products,products/[id],orders/[id],settings}/route.ts`, `src/app/admin/login/page.tsx`, `src/app/admin/layout.tsx`, `src/app/layout.tsx`, `src/components/storefront/{Footer,CartDrawer}.tsx`, `src/app/(storefront)/checkout/success/page.tsx`, `supabase/schema.sql`, `README.md`, `next.config.mjs`, `.gitignore`, `.env.example`

**Edited:** `src/app/(storefront)/checkout/page.tsx`, `src/app/(storefront)/{page,shop/page,product/[slug]/page}.tsx`, `src/components/storefront/{ProductCard,ProductDetailClient,Navbar,MobileBottomBar}.tsx`, the 7 admin pages (server guard added), `src/app/admin/orders/[id]/page.tsx` (payment control)

**Removed:** `.opencode/PROPOSED_CHANGES.txt` (audit working artifact)

---

*All code changes are in the working tree, uncommitted, for review. Run `npm run build` to reproduce the verification results in §4.*
