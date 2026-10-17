-- ============================================================================
-- Cricket Store — full database schema (fresh installs)
-- ============================================================================
-- Run this once in the Supabase SQL editor for a NEW project.
-- If your project already exists, run `supabase/security-hardening.sql`
-- instead — it applies the same security fixes idempotently.
--
-- Security model
-- --------------
-- * The storefront and admin panel talk to the database exclusively through
--   the Next.js server using the SERVICE ROLE key (which bypasses RLS).
--   The service role key must NEVER be exposed to the browser.
-- * RLS below is defence-in-depth for anything that presents an anon key or
--   a real Supabase Auth session:
--     - The public catalogue (active products) and site settings are
--       readable by anyone.
--     - Orders and order items are readable by NOBODY except staff whose
--       Auth account carries the `app_metadata.role = "admin"` claim, and
--       the service role.
--     - Storage: the public media bucket is read-only for the world; writes
--       happen only via the service role (server-side upload route).
--
-- Granting admin access to a staff member:
--   1. Create a user in Authentication → Users.
--   2. Run:
--        update auth.users
--        set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
--        where email = 'staff@example.com';
--   The claim travels inside the signed JWT, so it cannot be forged by the
--   client.
-- ============================================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ----------------------------------------------------------------------------
-- 1. Products
-- ----------------------------------------------------------------------------
create table if not exists public.products (
    id uuid primary key default uuid_generate_v4(),
    title text not null,
    slug text unique not null,
    category text not null, -- 'bats', 'balls', 'pads', 'gloves', 'helmets', 'bags', 'shoes'
    brand text not null,    -- 'SG', 'SS', 'Kookaburra', 'Gray-Nicolls', 'MRF', etc.
    description text,
    price numeric(10, 2) not null check (price >= 0),
    stock_quantity integer not null default 0 check (stock_quantity >= 0),
    images text[] not null default '{}',
    specifications jsonb default '{}'::jsonb, -- e.g. {"willow": "English Grade 1", "weight": "2lb 8oz"}
    is_featured boolean not null default false,
    is_active boolean not null default true,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ----------------------------------------------------------------------------
-- 2. Orders
-- ----------------------------------------------------------------------------
create table if not exists public.orders (
    id uuid primary key default uuid_generate_v4(),
    customer_name text not null,
    customer_email text not null,
    customer_phone text not null,
    shipping_address jsonb not null, -- {"street": "", "city": "", "state": "", "postal_code": "", "country": ""}
    total_amount numeric(10, 2) not null check (total_amount >= 0),
    payment_method text not null check (payment_method in ('card', 'cod')),
    payment_status text not null default 'pending' check (payment_status in ('pending', 'paid', 'failed')),
    order_status text not null default 'new' check (order_status in ('new', 'packed', 'shipped', 'delivered', 'cancelled')),
    stripe_session_id text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ----------------------------------------------------------------------------
-- 3. Order items
-- ----------------------------------------------------------------------------
create table if not exists public.order_items (
    id uuid primary key default uuid_generate_v4(),
    order_id uuid references public.orders(id) on delete cascade not null,
    product_id uuid references public.products(id) on delete set null,
    product_title text not null,
    unit_price numeric(10, 2) not null check (unit_price >= 0),
    quantity integer not null check (quantity > 0),
    selected_options jsonb default '{}'::jsonb -- e.g. {"size": "Short Handle", "orientation": "Right Hand"}
);

-- ----------------------------------------------------------------------------
-- 4. Site settings (single-row CMS for the admin panel)
-- ----------------------------------------------------------------------------
create table if not exists public.site_settings (
    id integer primary key default 1 check (id = 1),
    announcement_text text default 'Fast delivery across the region on all cricket equipment.',
    hero_headline text default 'Engineered for the Perfect Stroke.',
    hero_subheadline text default 'Premium bats, protective gear, and equipment for serious cricketers.',
    hero_banner_image text default '',
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

insert into public.site_settings (id, announcement_text, hero_headline, hero_subheadline, hero_banner_image)
values (
    1,
    'Fast delivery across the region on all cricket equipment.',
    'Engineered for the Perfect Stroke.',
    'Premium bats, protective gear, and equipment for serious cricketers.',
    'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?q=80&w=1600&auto=format&fit=crop'
)
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- 5. Stripe webhook idempotency ledger
-- ----------------------------------------------------------------------------
-- Every processed webhook event id is recorded here so Stripe retries can
-- never double-apply a payment or double-decrement stock. Written only by
-- the server (service role); RLS is enabled with no policies on purpose.
create table if not exists public.stripe_events (
    id text primary key, -- Stripe event id (evt_...)
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ----------------------------------------------------------------------------
-- 6. Indexes
-- ----------------------------------------------------------------------------
create index if not exists products_category_idx on public.products (category);
create index if not exists products_brand_idx on public.products (brand);
create index if not exists products_active_featured_idx on public.products (is_active, is_featured);
create index if not exists orders_created_at_idx on public.orders (created_at desc);
create index if not exists orders_stripe_session_idx on public.orders (stripe_session_id);
create index if not exists order_items_order_id_idx on public.order_items (order_id);

-- ----------------------------------------------------------------------------
-- 7. updated_at maintenance for site_settings
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = timezone('utc'::text, now());
    return new;
end;
$$;

drop trigger if exists site_settings_set_updated_at on public.site_settings;
create trigger site_settings_set_updated_at
    before update on public.site_settings
    for each row
    execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 8. Row Level Security
-- ----------------------------------------------------------------------------
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.site_settings enable row level security;
alter table public.stripe_events enable row level security;

-- Staff predicate: true only for a signed-in Supabase Auth user whose JWT
-- carries the admin role claim in app_metadata. The claim is set by an
-- operator (SQL/dashboard) and signed into the token by Supabase, so it
-- cannot be forged from the client.
create or replace function public.is_admin()
returns boolean
language sql
stable
set search_path = ''
as $$
    select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$$;

-- Public (anonymous) read of the live catalogue and site settings.
drop policy if exists "Public can view active products" on public.products;
create policy "Public can view active products"
    on public.products for select
    using (is_active = true);

drop policy if exists "Public can read site settings" on public.site_settings;
create policy "Public can read site settings"
    on public.site_settings for select
    using (true);

-- Staff access via the admin role claim.
drop policy if exists "Admins manage products" on public.products;
create policy "Admins manage products"
    on public.products for all
    using (public.is_admin())
    with check (public.is_admin());

drop policy if exists "Admins manage orders" on public.orders;
create policy "Admins manage orders"
    on public.orders for all
    using (public.is_admin())
    with check (public.is_admin());

drop policy if exists "Admins manage order items" on public.order_items;
create policy "Admins manage order items"
    on public.order_items for all
    using (public.is_admin())
    with check (public.is_admin());

drop policy if exists "Admins manage site settings" on public.site_settings;
create policy "Admins manage site settings"
    on public.site_settings for all
    using (public.is_admin())
    with check (public.is_admin());

-- Explicitly neutralise any legacy policies that granted blanket access to
-- every authenticated user (the old insecure schema).
drop policy if exists "Admin full access to products" on public.products;
drop policy if exists "Admin full access to orders" on public.orders;
drop policy if exists "Admin full access to order items" on public.order_items;
drop policy if exists "Admin full access to site settings" on public.site_settings;

-- ----------------------------------------------------------------------------
-- 9. Storage — public media bucket, server-side writes only
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('product-media', 'product-media', true)
on conflict (id) do nothing;

-- The bucket is public, so files are readable via their public URL without a
-- policy. No insert/update/delete policies are created: uploads and deletes
-- happen exclusively through the Next.js server using the service role key.
-- Remove any legacy permissive policies from earlier installs.
drop policy if exists "Public Access to product-media" on storage.objects;
drop policy if exists "Admin Upload to product-media" on storage.objects;
drop policy if exists "Admin Delete from product-media" on storage.objects;
