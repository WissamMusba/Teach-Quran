# CRICKET STORE — Custom Full-Stack E-Commerce Application

A professional cricket gear e-commerce storefront and single-admin management portal built with **Next.js (App Router, TypeScript)**, **Tailwind CSS**, **Supabase (PostgreSQL & Storage)**, and **Stripe Checkout API**.

> **Pricing Directive**: This platform strictly excludes all discount, coupon, and promotional sale pricing mechanisms. Every product operates on transparent, standard pricing.

> **Audit**: See [`AUDIT_REPORT.md`](AUDIT_REPORT.md) for the full security/usability audit, what was fixed, and the pre-launch checklist (including replacing `[BRACKETED PLACEHOLDERS]` in the legal pages).

---

## 1. Visual Design Tokens

- **Dominant Base**: Near-black (`#050505`, `#0A0A0E`) with layered dark panels (`#0E0E14`, `#121218`).
- **Primary Brand Color**: Cricket Orange (`#FF5500`) for primary buttons, active states, and cart badges.
- **Text**: White / neutral greys for hierarchy on the dark surfaces. Display font for headlines, sans for body.

---

## 2. Architecture & File Structure

```
├── src/
│   ├── middleware.ts                     # Edge guard for /admin and admin APIs (Supabase-verified)
│   ├── app/
│   │   ├── layout.tsx                    # Root metadata (title template, OpenGraph), CartProvider
│   │   ├── robots.ts / sitemap.ts        # SEO: crawl rules + dynamic sitemap
│   │   ├── icon.svg / not-found.tsx      # Favicon + global 404
│   │   ├── (storefront)/
│   │   │   ├── page.tsx                  # Homepage: Hero, Featured Showcase, Category Grid
│   │   │   ├── shop/page.tsx             # Catalog with brand, category, and search filters
│   │   │   ├── product/[slug]/page.tsx   # Details, gallery, variant options + generateMetadata
│   │   │   ├── cart/page.tsx             # Persistent cart (noindex)
│   │   │   ├── checkout/page.tsx         # Address capture, Stripe Card vs COD (noindex)
│   │   │   ├── checkout/success/page.tsx # Order confirmation — HMAC-token gated
│   │   │   ├── privacy | terms | cookies | returns | shipping | contact  # Policy pages
│   │   │   ├── error.tsx / not-found.tsx # Friendly error + 404 states
│   │   │   └── layout.tsx                # Announcement Bar, Navbar, Cart Drawer & Footer
│   │   │
│   │   ├── admin/
│   │   │   ├── login/page.tsx            # Staff sign-in (posts to /api/admin/login)
│   │   │   ├── layout.tsx                # Admin shell — server-verified session
│   │   │   ├── error.tsx                 # Admin error boundary
│   │   │   ├── dashboard/page.tsx        # Revenue, order counts, low stock alerts
│   │   │   ├── products/…                # Product CRUD with image upload
│   │   │   ├── orders/…                  # Order list, detail, status + payment reconciliation
│   │   │   └── settings/page.tsx         # Banner & announcement CMS
│   │   │
│   │   └── api/
│   │       ├── checkout/route.ts         # Server-priced order creation & Stripe session
│   │       ├── webhooks/stripe/route.ts  # Signature-verified, idempotent payment sync
│   │       ├── upload/route.ts           # Admin-guarded, magic-byte-validated image upload
│   │       └── admin/…                   # Login/logout + guarded admin REST endpoints
│   │
│   ├── components/
│   │   ├── storefront/                   # Navbar, Footer, ProductCard, CartDrawer (a11y dialog),
│   │   │                                 # LegalPage, ClearCartOnMount, NotFoundContent
│   │   └── admin/                        # ImageDropzone, OrderStatusSelect, PaymentStatusControl
│   │
│   ├── context/
│   │   └── CartContext.tsx               # Client cart (localStorage) with stock limits
│   │
│   └── lib/
│       ├── types.ts                      # Strict TypeScript types
│       ├── mockData.ts                   # Seed catalog for demo mode
│       ├── site.ts                       # Canonical site URL resolution
│       ├── adminAuth.ts / adminGuard.ts  # HttpOnly staff sessions + server-side guards
│       ├── orderToken.ts                 # HMAC tokens for order confirmation URLs
│       ├── supabaseServer.ts             # Service-role server client (fails closed in prod)
│       └── stripe.ts                     # Stripe Node SDK instance
│
├── supabase/
│   ├── schema.sql                        # Full schema + RLS + storage (fresh installs)
│   ├── security-hardening.sql            # Idempotent migration for existing installs
│   └── seed.sql                          # Initial catalog data
│
└── .env.example                          # Environment variables template
```

---

## 3. Database & Storage Setup (Supabase)

### New project
1. Open your [Supabase Dashboard](https://supabase.com) → **SQL Editor**.
2. Execute the entire contents of [`supabase/schema.sql`](supabase/schema.sql). It creates `products`, `orders`, `order_items`, `site_settings`, `stripe_events`, hardened RLS policies, indexes, and the public `product-media` storage bucket.
3. (Optional) Run [`supabase/seed.sql`](supabase/seed.sql) to populate the initial catalog.

### Existing project (created with an older schema)
1. Run [`supabase/security-hardening.sql`](supabase/security-hardening.sql) once. It is safe to re-run and:
   - removes the old `auth.role() = 'authenticated'` blanket admin policies,
   - removes the storage policies that allowed anyone to upload/delete files,
   - adds the `stripe_events` idempotency ledger and performance indexes.

### Creating the staff account
1. Supabase Dashboard → **Authentication → Users** → add a user (email + password).
2. Grant the admin claim (signed into the JWT by Supabase — cannot be forged by the browser):
   ```sql
   update auth.users
   set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
   where email = 'staff@example.com';
   ```
3. Set `ADMIN_EMAIL` in the environment to that same address.

---

## 4. Environment Variables Configuration

Copy `.env.example` to `.env.local` and fill in real values:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here        # public key (client-safe)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here     # SERVER ONLY — never expose

# Stripe
STRIPE_SECRET_KEY=sk_live_...                            # SERVER ONLY
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Admin
ADMIN_EMAIL=staff@example.com                            # must match the Supabase Auth user
ORDER_TOKEN_SECRET=long-random-string                    # signs order confirmation URLs

# Site
NEXT_PUBLIC_SITE_URL=https://yourstore.com
DEMO_MODE=false                                          # keep false in production
```

**Fail-closed behaviour**: in production (`NODE_ENV=production`, `DEMO_MODE` not `true`), missing Supabase or Stripe credentials mean orders are refused (HTTP 503) — the app never fakes a paid order or serves mock catalogue data to real customers. The in-memory demo store only activates in development or when `DEMO_MODE=true`.

---

## 5. Stripe Webhook

1. Production: create a webhook endpoint for `https://yourstore.com/api/webhooks/stripe` with events:
   `checkout.session.completed`, `checkout.session.expired`, `payment_intent.payment_failed` (as configured in the dashboard).
2. Local development:
   ```bash
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   ```
   and put the printed `whsec_...` into `STRIPE_WEBHOOK_SECRET`.
3. Events are deduplicated via the `stripe_events` table (run the hardening SQL to enable).

---

## 6. Running the Application

```bash
npm install
npm run dev        # development at http://localhost:3000
npm run build      # production build
npm run start      # serve the production build
```

---

## 7. Admin Portal Access

- URL: [http://localhost:3000/admin/login](http://localhost:3000/admin/login)
- Sign in with the Supabase Auth staff account whose email matches `ADMIN_EMAIL`.
- Sessions use HttpOnly `sdca_admin_session` / `sdca_admin_refresh` cookies, verified server-side (and refreshed by `middleware.ts`) on every admin request.
- The portal provides sales revenue, inventory tracking, order progression (`new` → `packed` → `shipped` → `delivered`), COD payment reconciliation, product CRUD with photo upload, and homepage banner customization.

---

## 8. Security Notes

- **All prices and stock are resolved server-side** at checkout; client-supplied prices are ignored.
- **Order confirmation pages** require an HMAC token minted by the checkout server — order IDs alone cannot reveal customer details.
- **Cart is only cleared on the verified confirmation page**, never before payment completes.
- **Admin APIs** are protected by the same server-verified session as the UI, and every route re-checks authorization (`requireAdminApi()`); the edge middleware is only the first layer.
- **Uploads** are limited to 6 files × 5 MB, validated by magic bytes (PNG/JPEG/WEBP), renamed with UUIDs, and stored via the service role.
- **Webhooks** verify the Stripe signature, check the paid amount against the order total, never downgrade an order status, and are idempotent via `stripe_events`.
- **Security headers** (CSP, HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy) are set in `next.config.mjs`.

## 9. Pre-Launch Checklist

1. Replace every `[BRACKETED PLACEHOLDER]` in the legal pages (`/privacy`, `/terms`, `/cookies`, `/returns`, `/shipping`, `/contact`) with real business details (see `AUDIT_REPORT.md` § Follow-ups).
2. Upgrade Next.js off `14.2.35` (unpatched CVEs) to the latest supported 15.x release.
3. Run `supabase/security-hardening.sql` on production.
4. Set all production environment variables (including `ORDER_TOKEN_SECRET`).
5. Consider self-hosting fonts instead of fetching Google Fonts at runtime.
