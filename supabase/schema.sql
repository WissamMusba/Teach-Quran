-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Products Table
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
    specifications jsonb default '{}'::jsonb, -- e.g. {"willow": "English Grade 1", "weight": "2lb 8oz", "handle": "Short Handle"}
    is_featured boolean not null default false,
    is_active boolean not null default true,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Orders Table
create table if not exists public.orders (
    id uuid primary key default uuid_generate_v4(),
    customer_name text not null,
    customer_email text not null,
    customer_phone text not null,
    shipping_address jsonb not null, -- {"street": "", "city": "", "state": "", "postal_code": "", "country": ""}
    total_amount numeric(10, 2) not null,
    payment_method text not null check (payment_method in ('card', 'cod')),
    payment_status text not null default 'pending' check (payment_status in ('pending', 'paid', 'failed')),
    order_status text not null default 'new' check (order_status in ('new', 'packed', 'shipped', 'delivered', 'cancelled')),
    stripe_session_id text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Order Items Table
create table if not exists public.order_items (
    id uuid primary key default uuid_generate_v4(),
    order_id uuid references public.orders(id) on delete cascade not null,
    product_id uuid references public.products(id) on delete set null,
    product_title text not null,
    unit_price numeric(10, 2) not null,
    quantity integer not null check (quantity > 0),
    selected_options jsonb default '{}'::jsonb -- e.g. {"size": "Short Handle", "orientation": "Right Hand"}
);

-- 4. Site Settings (Single-Row CMS for Admin)
create table if not exists public.site_settings (
    id integer primary key default 1 check (id = 1),
    announcement_text text default 'Fast delivery across the region on all cricket equipment.',
    hero_headline text default 'Engineered for the Perfect Stroke.',
    hero_subheadline text default 'Premium bats, protective gear, and equipment for serious cricketers.',
    hero_banner_image text default '',
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Initialize default single row for site settings
insert into public.site_settings (id, announcement_text, hero_headline, hero_subheadline, hero_banner_image)
values (
    1,
    'Fast delivery across the region on all cricket equipment.',
    'Engineered for the Perfect Stroke.',
    'Premium bats, protective gear, and equipment for serious cricketers.',
    'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?q=80&w=1600&auto=format&fit=crop'
)
on conflict (id) do nothing;

-- 5. Row Level Security Policies
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.site_settings enable row level security;

-- Public read access for storefront
drop policy if exists "Public can view active products" on public.products;
create policy "Public can view active products" on public.products for select using (is_active = true);

drop policy if exists "Public can read site settings" on public.site_settings;
create policy "Public can read site settings" on public.site_settings for select using (true);

-- Allow authenticated admin users full access
drop policy if exists "Admin full access to products" on public.products;
create policy "Admin full access to products" on public.products for all using (auth.role() = 'authenticated');

drop policy if exists "Admin full access to orders" on public.orders;
create policy "Admin full access to orders" on public.orders for all using (auth.role() = 'authenticated');

drop policy if exists "Admin full access to order items" on public.order_items;
create policy "Admin full access to order items" on public.order_items for all using (auth.role() = 'authenticated');

drop policy if exists "Admin full access to site settings" on public.site_settings;
create policy "Admin full access to site settings" on public.site_settings for all using (auth.role() = 'authenticated');

-- 6. Storage Bucket for Product Media
insert into storage.buckets (id, name, public) 
values ('product-media', 'product-media', true)
on conflict (id) do nothing;

-- Storage RLS
drop policy if exists "Public Access to product-media" on storage.objects;
create policy "Public Access to product-media" on storage.objects for select using (bucket_id = 'product-media');

drop policy if exists "Admin Upload to product-media" on storage.objects;
create policy "Admin Upload to product-media" on storage.objects for insert with check (bucket_id = 'product-media');

drop policy if exists "Admin Delete from product-media" on storage.objects;
create policy "Admin Delete from product-media" on storage.objects for delete using (bucket_id = 'product-media');
