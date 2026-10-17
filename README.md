# CRICKET STORE — Custom Full-Stack E-Commerce Application

A professional, high-performance cricket gear e-commerce storefront and single-admin management portal built with **Next.js (App Router, TypeScript)**, **Tailwind CSS**, **Supabase (PostgreSQL & Storage)**, and **Stripe Checkout API**.

> **Pricing Directive**: This platform strictly excludes all discount, coupon, and promotional sale pricing mechanisms. Every product operates on transparent, standard pricing.

---

## 1. Visual Design Tokens

- **Dominant Base**: Clean White (`#FFFFFF`, `#F9FAFB`) for page backgrounds, product cards, and forms.
- **Primary Brand Color**: Electric Cricket Orange (`#EA580C`, `#F97316`) for primary buttons, active filters, and cart badges.
- **Secondary Accent**: Subtle Charcoal / Black (`#0F172A`, `#111827`) used for the top announcement bar, branding badge, and high-contrast typography.

---

## 2. Architecture & File Structure

```
├── src/
│   ├── app/
│   │   ├── (storefront)/
│   │   │   ├── page.tsx                  # Homepage: Hero, Featured Showcase, Category Grid
│   │   │   ├── shop/page.tsx             # Catalog with brand, category, and price filters
│   │   │   ├── product/[slug]/page.tsx   # Details, gallery, variant options, Add to Cart
│   │   │   ├── cart/page.tsx             # Persistent Cart line items & subtotal calculations
│   │   │   ├── checkout/page.tsx         # Address capture, Stripe Card vs COD selection
│   │   │   ├── checkout/success/page.tsx # Order confirmation, itemized invoice & status
│   │   │   └── layout.tsx                # Announcement Bar, Navbar, Cart Drawer & Footer
│   │   │
│   │   ├── admin/
│   │   │   ├── login/page.tsx            # Admin authentication form (Supabase Auth / dev session)
│   │   │   ├── layout.tsx                # Admin Sidebar navigation & auth boundary
│   │   │   ├── dashboard/page.tsx        # Revenue, order counts, low stock alerts, recent orders
│   │   │   ├── products/
│   │   │   │   ├── page.tsx              # Products table with featured/active toggles
│   │   │   │   ├── new/page.tsx          # Create new gear + multi-image upload
│   │   │   │   └── [id]/edit/page.tsx    # Edit price, stock, specs, and photos
│   │   │   ├── orders/
│   │   │   │   ├── page.tsx              # Orders table with status filter & instant updates
│   │   │   │   └── [id]/page.tsx         # Detailed order view & customer address
│   │   │   └── settings/page.tsx         # Manage homepage banner & announcement bar
│   │   │
│   │   └── api/
│   │       ├── checkout/route.ts         # Stripe Checkout session creator & COD order writer
│   │       ├── webhooks/stripe/route.ts  # Webhook to verify Stripe signature & mark orders paid
│   │       ├── upload/route.ts           # Handles multi-image upload to Supabase storage
│   │       └── admin/                    # Admin REST endpoints for products, orders, settings
│   │
│   ├── components/
│   │   ├── storefront/                   # Navbar, AnnouncementBar, HeroBanner, ProductCard, CartDrawer
│   │   └── admin/                        # ImageDropzone, OrderStatusSelect, ProductForm, OrdersTable
│   │
│   ├── context/
│   │   └── CartContext.tsx               # Persistent client cart with stock limits & drawer controls
│   │
│   └── lib/
│       ├── types.ts                      # Strict TypeScript types for products, orders, and CMS
│       ├── mockData.ts                   # Authentic seed catalog (Kookaburra, SG, SS, Gray-Nicolls, MRF)
│       ├── supabaseClient.ts             # Browser Supabase client
│       ├── supabaseServer.ts             # Server Supabase client with fallback resilience
│       └── stripe.ts                     # Stripe Node SDK instance
│
├── supabase/
│   ├── schema.sql                        # PostgreSQL schema, RLS policies, and storage bucket setup
│   └── seed.sql                          # Initial catalog data insertion script
│
└── .env.example                          # Environment variables template
```

---

## 3. Database & Storage Setup (Supabase)

1. Open your [Supabase Dashboard](https://supabase.com).
2. Go to the **SQL Editor** and execute the entire contents of [`supabase/schema.sql`](file:///c:/Users/wissa/Downloads/SDCA%20Website/supabase/schema.sql). This will create:
   - `public.products`
   - `public.orders`
   - `public.order_items`
   - `public.site_settings`
   - Row Level Security (RLS) policies
   - Storage bucket `product-media` with public access
3. (Optional) Run [`supabase/seed.sql`](file:///c:/Users/wissa/Downloads/SDCA%20Website/supabase/seed.sql) to populate initial match-grade bats, leather balls, legguards, gloves, and helmets.

---

## 4. Environment Variables Configuration

Copy `.env.example` to `.env.local` and add your production credentials:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Admin Configuration
ADMIN_EMAIL=admin@cricketstore.com

# Site URL
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

> **Note**: Even before connecting live Supabase and Stripe keys, the application includes a high-fidelity local memory layer and mock payment simulator so all features (storefront, cart, COD/card checkout, admin mutations, image uploads) can be tested and verified immediately.

---

## 5. Running the Application

### Development Server:
```bash
npm run dev
```

### Production Build & Launch:
```bash
npm run build
npm run start
```

The application will be running at [http://localhost:3000](http://localhost:3000).

---

## 6. Admin Portal Access

- URL: [http://localhost:3000/admin/login](http://localhost:3000/admin/login)
- Enter your admin credentials (e.g. `admin@cricketstore.com`).
- The portal provides real-time sales revenue, inventory tracking, order status progression (`new` → `packed` → `shipped` → `delivered`), product CRUD with drag-and-drop photo uploading, and homepage banner customization.
