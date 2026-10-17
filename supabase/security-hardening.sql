-- ============================================================================
-- Cricket Store — security hardening migration (EXISTING installs)
-- ============================================================================
-- Run once in the Supabase SQL editor on a database created with an older
-- version of schema.sql. It is safe to re-run.
--
-- What it fixes:
--   1. Removes the old "every authenticated user is an admin" RLS policies
--      (auth.role() = 'authenticated') and replaces them with an
--      `app_metadata.role = "admin"` claim check.
--   2. Removes the storage insert/delete policies that let ANY visitor
--      upload or delete files in the media bucket. Uploads now happen only
--      through the server with the service role key.
--   3. Adds the stripe_events ledger so Stripe webhook retries cannot
--      double-apply payments or stock changes.
--   4. Adds performance indexes, a site_settings updated_at trigger and
--      defensive NOT VALID check constraints (they apply to new writes
--      without failing on legacy rows).
--
-- After running this file, make sure each staff member's Auth account has
-- the admin claim:
--   update auth.users
--   set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
--   where email = 'staff@example.com';
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Staff predicate
-- ----------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
set search_path = ''
as $$
    select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$$;

-- ----------------------------------------------------------------------------
-- 2. Replace the blanket "authenticated" policies
-- ----------------------------------------------------------------------------
drop policy if exists "Admin full access to products" on public.products;
drop policy if exists "Admin full access to orders" on public.orders;
drop policy if exists "Admin full access to order items" on public.order_items;
drop policy if exists "Admin full access to site settings" on public.site_settings;

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

-- Keep (or restore) the public read policies for the live catalogue.
drop policy if exists "Public can view active products" on public.products;
create policy "Public can view active products"
    on public.products for select
    using (is_active = true);

drop policy if exists "Public can read site settings" on public.site_settings;
create policy "Public can read site settings"
    on public.site_settings for select
    using (true);

-- ----------------------------------------------------------------------------
-- 3. Storage: server-side writes only
-- ----------------------------------------------------------------------------
-- The media bucket is public, so files are readable via their public URL
-- without a policy. Uploads/deletes go through the server (service role).
drop policy if exists "Public Access to product-media" on storage.objects;
drop policy if exists "Admin Upload to product-media" on storage.objects;
drop policy if exists "Admin Delete from product-media" on storage.objects;

insert into storage.buckets (id, name, public)
values ('product-media', 'product-media', true)
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- 4. Stripe webhook idempotency ledger
-- ----------------------------------------------------------------------------
create table if not exists public.stripe_events (
    id text primary key,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.stripe_events enable row level security;
-- No policies on purpose: only the service role (server) may touch it.

-- ----------------------------------------------------------------------------
-- 5. Indexes
-- ----------------------------------------------------------------------------
create index if not exists products_category_idx on public.products (category);
create index if not exists products_brand_idx on public.products (brand);
create index if not exists products_active_featured_idx on public.products (is_active, is_featured);
create index if not exists orders_created_at_idx on public.orders (created_at desc);
create index if not exists orders_stripe_session_idx on public.orders (stripe_session_id);
create index if not exists order_items_order_id_idx on public.order_items (order_id);

-- ----------------------------------------------------------------------------
-- 6. site_settings updated_at trigger
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
-- 7. Defensive NOT VALID constraints (apply to new writes only)
-- ----------------------------------------------------------------------------
do $$
begin
    alter table public.orders
        add constraint orders_total_amount_nonneg check (total_amount >= 0) not valid;
exception
    when duplicate_object then null;
end;
$$;

do $$
begin
    alter table public.order_items
        add constraint order_items_unit_price_nonneg check (unit_price >= 0) not valid;
exception
    when duplicate_object then null;
end;
$$;

-- ----------------------------------------------------------------------------
-- Done. Verify with:
--   select tablename, policyname from pg_policies where schemaname = 'public';
--   select * from storage.buckets where id = 'product-media';
-- ----------------------------------------------------------------------------
