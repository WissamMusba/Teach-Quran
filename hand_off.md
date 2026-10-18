# Seven Districts Cricket Academy (TSDCA) — Project Hand-Off Guide

> **Official Storefront & Admin Management System**  
> **Academy Location:** Ajman, United Arab Emirates (UAE)  
> **Currency:** UAE Dirham (`AED`)  
> **Equipment Units:** Grams (`g`)  
> **Production URL:** [https://sdca-cricket-store.vercel.app](https://sdca-cricket-store.vercel.app)  
> **Vercel Project Dashboard:** [https://vercel.com/leatcurt-5270/sdca-cricket-store](https://vercel.com/leatcurt-5270/sdca-cricket-store)

---

## 1. Executive Summary

This repository contains the complete e-commerce platform and administrative back-office for **Seven Districts Cricket Academy (TSDCA)**, based in Ajman, UAE. 

The application is engineered to deliver a high-speed, photographic shopping experience matching premier global cricket retailers (such as *Pro:Direct Cricket*). It supports the academy's complete equipment range—including Grade 1 English Willow bats, match-grade leather balls, protective pads, wicketkeeping gear, helmets, luggage, and coaching equipment.

The store is designed with a **dual-engine architecture**:
1. **Interactive Demo Engine (`DEMO_MODE=true`):** Active in production by default to allow instant previewing, catalog browsing, cart testing, and UI validation without requiring third-party database connections.
2. **Enterprise Production Engine:** Fully prepared for direct connection to **Supabase** (PostgreSQL + RLS + Storage) and **Stripe UAE** (Card Payments & Webhooks).

---

## 2. Technology Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Framework** | **Next.js 15.5+ (App Router)** | Hybrid SSG/SSR, Server Components, Streaming |
| **Language** | **TypeScript 5.x** | End-to-end type safety |
| **Library** | **React 19** | Modern UI rendering and concurrent features |
| **Styling** | **Tailwind CSS 3.4** | Utility-first responsive styling with custom academy palette |
| **Images** | **`next/image` + AVIF/WebP** | Hardware-accelerated responsive images, blur placeholders |
| **Database** | **Supabase (PostgreSQL 15)** | Relational catalog, orders, site settings, and RLS policies |
| **Payments** | **Stripe** | Credit/Debit card checkout (AED) + Webhook reconciliation |
| **Icons** | **Lucide React** | Featherweight accessible icon suite |
| **Hosting** | **Vercel** | Edge Network deployment, Serverless Functions, CI/CD |

---

## 3. Brand Identity & Visual Design

- **Colors:**
  - **Primary Orange:** `#FF6B00` / `#EA580C` (Energy, academy crest, CTA buttons, active accents)
  - **Deep Charcoal / Black:** `#0B0F19` / `#111827` (Elite athletic contrast, badges, dark mode base)
  - **Clean White / Neutral Light:** `#FFFFFF` / `#F8FAFC` (High-contrast light mode background, clear product legibility)
- **Typography:**
  - Headings: `Barlow Condensed` / `Inter` bold athletic style
  - Body & Specs: `Plus Jakarta Sans` / clean sans-serif
- **Theming:** Full Dual-Mode support (Light Mode with crisp white/orange/black contrast + Dark Mode).

---

## 4. Key Features Implemented

### 4.1 Storefront
- **Photographic Hero Slideshow:**
  - 3 high-impact photographic slides highlighting Grade 1 Willow Bats, Match Leather Balls, and Elite Protective Armour.
  - Auto-play with progress indicators, manual chevron navigation, pause-on-hover, and mobile touch swiping.
  - Category shortcut pills for instant navigation.
- **Dynamic Catalog & Filtering:**
  - 16 pre-configured cricket products across 6 core categories.
  - Instant debounced search bar (keyboard shortcut `/` to focus).
  - Multi-criteria filtering by category, brand (Kookaburra, Gray-Nicolls, SS, SG, Masuri), price range, and sort order.
- **Product Details & Technical Specs:**
  - Multi-image product gallery with zoom and thumbnails.
  - Accurate cricket equipment specifications table (Willow grade, weight in grams `g`, profile/sweet spot, handle type).
  - Stock availability badges and direct "Add to Cart" integration.
- **Cart & Seamless Checkout:**
  - Slide-over cart drawer + full `/cart` page with line-item management and delivery fee calculator.
  - Multi-method checkout supporting **Online Card Payment (Stripe)** and **Cash on Delivery (COD)** across all UAE Emirates (Ajman, Dubai, Sharjah, Abu Dhabi, etc.).
  - Free UAE delivery threshold calculation (Orders over 500 AED).
- **Static Information Pages:**
  - Shipping Policy (same-day Ajman delivery, 24-48h UAE delivery), Returns & Warranty, Terms of Service, Privacy Policy, and Contact info.

### 4.2 Administrative Portal (`/admin`)
- **Protected Access:** Server-enforced authentication restricted to academy staff emails (`ADMIN_EMAIL`).
- **Dashboard Overview:** KPI metrics for total sales, active orders, customer count, and low-stock alerts.
- **Inventory Management:** Full CRUD operations for products (image upload, price in AED, weight in grams, stock count, featured flags).
- **Order Processing:** Real-time order pipeline management (`pending` &rarr; `paid` &rarr; `shipped` &rarr; `delivered`), customer contact details, delivery addresses, and tracking number assignment.
- **Site Settings Control:** Dynamic management of announcement bar text, hero banner headline, and promotional banners without touching code.

---

## 5. Security & Performance Highlights

1. **Defense-in-Depth RLS:** Row-Level Security in Supabase restricts order reads to verified admin JWT claims; public catalog is read-only.
2. **HMAC Order Verification:** Order confirmation pages (`/checkout/success`) verify cryptographic tokens signed with `ORDER_TOKEN_SECRET` to prevent ID enumeration.
3. **Hardened HTTP Headers:** Pre-configured in `next.config.mjs`:
   - Strict `Content-Security-Policy` (CSP)
   - `X-Frame-Options: DENY`
   - `X-Content-Type-Options: nosniff`
   - `Referrer-Policy: strict-origin-when-cross-origin`
   - `Permissions-Policy`
4. **Image & Asset Performance:**
   - Next.js AVIF and WebP auto-conversion.
   - Largest Contentful Paint (LCP) priority loading on first hero slide and top product cards.
   - Base64 SVG micro-blur placeholders to prevent Cumulative Layout Shift (CLS).
   - In-memory database query deduplication via `React.cache()`.

---

## 6. Environment Variables Reference

| Variable Name | Required | Default / Example Value | Description |
| :--- | :---: | :--- | :--- |
| `DEMO_MODE` | No | `true` | When `true`, runs the built-in memory store. Set to `false` or delete once Supabase is connected. |
| `NEXT_PUBLIC_SITE_URL` | Yes | `https://sdca-cricket-store.vercel.app` | Canonical site URL for metadata, sitemaps, and redirects. |
| `ADMIN_EMAIL` | Yes | `admin@sevendistricts.ae` | Email address permitted to access the `/admin` portal. |
| `ORDER_TOKEN_SECRET` | Yes | *(32+ char random hex string)* | Secret key used for signing order confirmation URLs. |
| `NEXT_PUBLIC_SUPABASE_URL` | For DB | `https://xyzcompany.supabase.co` | Supabase project API URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | For DB | `eyJhbGci...` | Supabase public anonymous key. |
| `SUPABASE_SERVICE_ROLE_KEY` | For DB | `eyJhbGci...` | Supabase server-side service role key (Never expose to browser). |
| `STRIPE_SECRET_KEY` | For Pay | `sk_live_...` or `sk_test_...` | Stripe secret API key. |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | For Pay | `pk_live_...` or `pk_test_...` | Stripe client publishable key. |
| `STRIPE_WEBHOOK_SECRET` | For Pay | `whsec_...` | Stripe webhook signing secret for `/api/webhooks/stripe`. |

---

## 7. Step-by-Step Go-Live Runbook

Follow these steps to transition the store from Demo Mode to full Live Operations:

### Step 1: Set Up Supabase Database
1. Go to [supabase.com](https://supabase.com) and create a new project (select Middle East / UAE region `me-central-1` or closest location).
2. Navigate to the **SQL Editor** in the Supabase Dashboard.
3. Open [`supabase/schema.sql`](file:///c:/Users/wissa/Downloads/SDCA%20Website/supabase/schema.sql) from this repository, paste the contents into the SQL Editor, and click **Run**.
4. (Optional) Run [`supabase/seed.sql`](file:///c:/Users/wissa/Downloads/SDCA%20Website/supabase/seed.sql) to populate the live database with initial cricket products and academy settings.
5. In **Project Settings &rarr; API**, copy:
   - Project URL
   - `anon` `public` key
   - `service_role` secret key

### Step 2: Configure Stripe for UAE (AED)
1. In your [Stripe Dashboard](https://dashboard.stripe.com), ensure your business entity is configured for UAE (`AED` currency).
2. Retrieve your **Publishable key** and **Secret key** from **Developers &rarr; API keys**.
3. Create a Webhook endpoint pointing to:
   ```
   https://sdca-cricket-store.vercel.app/api/webhooks/stripe
   ```
   - Listen for event: `checkout.session.completed`
   - Copy the generated **Signing secret** (`whsec_...`).

### Step 3: Update Vercel Environment Variables
Run the following commands using the Vercel CLI (or add them via the [Vercel Dashboard](https://vercel.com/leatcurt-5270/sdca-cricket-store/settings/environment-variables)):

```powershell
# Set Supabase Credentials
npx vercel env add NEXT_PUBLIC_SUPABASE_URL production --value "https://your-project.supabase.co" --yes
npx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production --value "your-anon-key" --yes
npx vercel env add SUPABASE_SERVICE_ROLE_KEY production --value "your-service-role-key" --yes

# Set Stripe Keys
npx vercel env add STRIPE_SECRET_KEY production --value "sk_live_..." --yes
npx vercel env add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY production --value "pk_live_..." --yes
npx vercel env add STRIPE_WEBHOOK_SECRET production --value "whsec_..." --yes

# Set Live Mode (Disables in-memory demo fallback)
npx vercel env add DEMO_MODE production --value "false" --force --yes
```

### Step 4: Connect Custom Domain (e.g. `sevendistricts.ae`)
1. In the Vercel Dashboard, go to **Settings &rarr; Domains**.
2. Add your custom domain (e.g., `shop.sevendistricts.ae` or `sevendistricts.ae`).
3. Add the recommended CNAME or A records in your domain registrar (GoDaddy, Cloudflare, etc.).
4. Vercel will automatically provision a free SSL certificate.

---

## 8. Admin Operations Guide

### How to Access the Admin Panel
1. Navigate to: [https://sdca-cricket-store.vercel.app/admin/login](https://sdca-cricket-store.vercel.app/admin/login)
2. Enter the configured academy administrator email (default: `admin@sevendistricts.ae`).
3. Once logged in, the admin bar provides access to:
   - **Products (`/admin/products`):** Update prices, edit weights, add new arrivals, toggle featured status.
   - **Orders (`/admin/orders`):** Review incoming Cash on Delivery and Stripe orders, view customer delivery notes, update shipment status.
   - **Site Settings (`/admin/settings`):** Update the top announcement banner (e.g., academy training camp notifications or holiday delivery times).

---

## 9. Local Development & Maintenance

### Prerequisites
- Node.js 20.x or 22.x
- npm 10.x or newer

### Local Commands
```bash
# Install dependencies
npm install

# Run development server (runs on http://localhost:3000)
npm run dev

# Run production build validation
npm run build

# Start production server locally
npm run start

# Run lint checks
npm run lint
```

> **Note for Windows Users with TLS Inspection / Corporate Proxies:**  
> If Vercel CLI reports `TypeError: fetch failed` or `UNABLE_TO_VERIFY_LEAF_SIGNATURE`, prepend commands with:  
> `$env:NODE_TLS_REJECT_UNAUTHORIZED="0"; npx vercel ...`

---

## 10. Repository Directory Structure

```text
SDCA Website/
├── .env.example              # Template for environment variables
├── .env.local                # Local development variables
├── next.config.mjs           # Next.js configuration (images, CSP headers)
├── package.json              # Project dependencies and npm scripts
├── tailwind.config.ts        # Tailwind CSS design system & custom colors
├── tsconfig.json             # TypeScript compiler settings
│
├── public/                   # Static assets, logos, and placeholders
│
├── src/
│   ├── app/                  # Next.js App Router
│   │   ├── admin/            # Admin portal (login, dashboard, orders, products, settings)
│   │   ├── api/              # API routes (checkout, stripe webhooks, uploads, admin auth)
│   │   ├── cart/             # Dedicated shopping cart page
│   │   ├── checkout/         # Multi-step checkout & success confirmation
│   │   ├── product/[slug]/   # Dynamic product detail pages
│   │   ├── shop/             # Filterable product catalog
│   │   ├── layout.tsx        # Root layout, Navbar, Footer, ThemeProvider
│   │   └── page.tsx          # Storefront homepage with Hero Slideshow
│   │
│   ├── components/
│   │   ├── admin/            # Admin UI components & forms
│   │   └── storefront/       # HeroBanner, ProductCard, CartDrawer, ShopFilter, Navbar, Footer
│   │
│   ├── context/              # CartContext and ThemeContext (state management)
│   └── lib/
│       ├── demoStore.ts      # In-memory storage engine for demo mode
│       ├── mockData.ts       # Initial catalog of 16 cricket products & settings
│       ├── orderToken.ts     # HMAC token generation and verification
│       ├── stripe.ts         # Stripe client initialization
│       ├── supabaseClient.ts # Client-side Supabase client
│       ├── supabaseServer.ts # Server-side Supabase client with React.cache()
│       └── types.ts          # Core TypeScript data contracts
│
└── supabase/
    ├── schema.sql            # Complete database schema for fresh Supabase projects
    ├── security-hardening.sql# RLS policy and defense-in-depth security script
    └── seed.sql              # Initial product catalog and settings SQL seed
```

---

## 11. Support & Hand-Off Sign-Off

- **Development Status:** Complete & Production Deployed.
- **Audit & Performance:** Clean production build with 0 TypeScript/Lint errors, Next.js image optimization, and sub-second edge routing.
- **Support Contact:** Seven Districts Cricket Academy Engineering & Administration Team.
