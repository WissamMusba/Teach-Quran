import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { getProducts, getSiteSettings } from '@/lib/supabaseServer';
import { GlassHero } from '@/components/glass/GlassHero';
import { GlassProductCard } from '@/components/glass/GlassProductCard';
import { Reveal } from '@/components/storefront/Reveal';
import { CricketBatIcon, CricketBallIcon } from '@/components/storefront/icons';
import {
  ArrowRight,
  ArrowUpRight,
  Backpack,
  Banknote,
  CheckCircle2,
  Flame,
  Hand,
  HardHat,
  MapPin,
  PackageCheck,
  Phone,
  Shield,
  ShieldCheck,
  Trophy,
  Truck,
} from 'lucide-react';

export const revalidate = 60;

/** Quick department rail floating under the hero. */
const CATEGORY_STRIP = [
  { label: 'Bats', href: '/shop?category=bats', Icon: CricketBatIcon },
  { label: 'Match Balls', href: '/shop?category=balls', Icon: CricketBallIcon },
  { label: 'Pads', href: '/shop?category=pads', Icon: Shield },
  { label: 'Gloves', href: '/shop?category=gloves', Icon: Hand },
  { label: 'Helmets', href: '/shop?category=helmets', Icon: HardHat },
  { label: 'Kit Bags', href: '/shop?category=bags', Icon: Backpack },
];

/** Service promises — same facts as the athletic storefront. */
const SERVICE_PROMISES = [
  {
    icon: Truck,
    title: 'Same-Day Ajman Dispatch',
    caption: 'Order before 2 PM for same-day delivery within Ajman.',
  },
  {
    icon: PackageCheck,
    title: 'Free UAE Delivery',
    caption: 'Free tracked shipping on all orders above AED 500.',
  },
  {
    icon: Banknote,
    title: 'Card & Cash on Delivery',
    caption: 'Pay securely online with Stripe or in cash at your door.',
  },
  {
    icon: ShieldCheck,
    title: 'Authorized Dealer',
    caption: '100% authentic gear sourced direct from official brands.',
  },
];

const ACADEMY_STATS = [
  { value: '7', label: 'Emirates Served' },
  { value: '5', label: 'Authorized Brands' },
  { value: '100%', label: 'Authentic Gear' },
];

const CATEGORIES = [
  {
    name: 'English Willow Bats',
    slug: 'bats',
    count: 'Grade 1 & 2 Match Profiles',
    image:
      'https://images.unsplash.com/photo-1593341646782-e0b495cff86d?q=80&w=800&auto=format&fit=crop',
    span: 'col-span-1 md:col-span-2 lg:col-span-2',
  },
  {
    name: 'Match Leather Balls',
    slug: 'balls',
    count: '4-Piece Test Regulation',
    image:
      'https://images.unsplash.com/photo-1587280501635-68a0e82cd5ff?q=80&w=800&auto=format&fit=crop',
    span: 'col-span-1',
  },
  {
    name: 'Batting Legguards',
    slug: 'pads',
    count: 'Pro HD Foam Protection',
    image:
      'https://images.unsplash.com/photo-1531415074868-036b107e775a?q=80&w=800&auto=format&fit=crop',
    span: 'col-span-1',
  },
  {
    name: 'Batting Gloves',
    slug: 'gloves',
    count: 'Pittards Leather Palms',
    image:
      'https://images.unsplash.com/photo-1531415074868-036b107e775a?q=80&w=800&auto=format&fit=crop',
    span: 'col-span-1',
  },
  {
    name: 'Titanium Helmets',
    slug: 'helmets',
    count: 'BS 7928:2013 Dual Grille',
    image:
      'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?q=80&w=800&auto=format&fit=crop',
    span: 'col-span-1',
  },
  {
    name: 'Kit Bags & Wheelies',
    slug: 'bags',
    count: 'Heavy Duty 140L+ Lockers',
    image:
      'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?q=80&w=800&auto=format&fit=crop',
    span: 'col-span-1 md:col-span-2 lg:col-span-1',
  },
];

const BRANDS = ['SG', 'SS', 'Kookaburra', 'Gray-Nicolls', 'MRF'];

export default async function GlassHomePage() {
  const [settings, featuredProducts] = await Promise.all([
    getSiteSettings(),
    getProducts({ isFeatured: true, isActive: true, limit: 8 }),
  ]);

  return (
    <>
      {/* Full-bleed hero with frosted spec panel */}
      <GlassHero settings={settings} />

      {/* Floating department rail over the hero/next-section seam */}
      <div className="relative z-20 mx-auto -mt-10 xs:-mt-14 max-w-7xl px-3 xs:px-4 sm:px-6 lg:px-8">
        <div className="glass-panel glass-panel-strong flex items-center gap-2 overflow-x-auto touch-scroll-x rounded-2xl p-2 scrollbar-none sm:rounded-full">
          <span className="hidden shrink-0 px-3 text-[10px] font-black uppercase tracking-[0.18em] text-neutral-500 dark:text-white/60 sm:inline">
            Shop Departments
          </span>
          {CATEGORY_STRIP.map((category) => (
            <Link
              key={category.label}
              href={category.href}
              className="glass-chip shrink-0 px-3.5 xs:px-4 py-2 text-[10px] xs:text-[11px] font-black uppercase tracking-wider text-neutral-800 transition-colors hover:bg-white/85 dark:text-white/90 dark:hover:bg-white/15 touch-target flex items-center gap-1.5"
            >
              <category.Icon className="h-3.5 w-3.5 text-[#FF5500] shrink-0" aria-hidden="true" />
              <span>{category.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Service promise tiles */}
      <section
        aria-label="Academy service promises"
        className="mx-auto max-w-7xl px-3 xs:px-4 pt-12 xs:pt-16 sm:px-6 lg:px-8"
      >
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {SERVICE_PROMISES.map((promise, idx) => (
            <Reveal key={promise.title} delay={idx * 50} className="h-full">
              <div className="glass-panel h-full rounded-2xl xs:rounded-3xl p-3.5 xs:p-5 transition-transform duration-300 hover:-translate-y-1">
                <span className="glass-chip inline-flex h-9 w-9 xs:h-11 xs:w-11 items-center justify-center">
                  <promise.icon className="h-4 w-4 xs:h-5 xs:w-5 text-[#FF5500]" aria-hidden="true" />
                </span>
                <h3 className="mt-3 xs:mt-4 font-display text-sm xs:text-lg font-black uppercase tracking-wide text-neutral-900 dark:text-white">
                  {promise.title}
                </h3>
                <p className="mt-1 text-[11px] xs:text-xs leading-relaxed text-neutral-600 dark:text-white/60 line-clamp-2 xs:line-clamp-none">
                  {promise.caption}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Featured gear */}
      <section className="mx-auto max-w-7xl px-3 xs:px-4 pt-14 xs:pt-20 sm:px-6 lg:px-8">
        <Reveal>
          <div className="flex flex-col gap-3 xs:gap-4 border-b border-white/60 pb-5 xs:pb-6 dark:border-white/10 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-[11px] xs:text-xs font-black uppercase tracking-widest text-[#C2410C] dark:text-[#FF9A5C]">
                <Flame className="h-4 w-4 fill-current shrink-0" aria-hidden="true" />
                <span>Selected by Elite Stroke Makers</span>
              </div>
              <h2 className="mt-1.5 xs:mt-2 font-display text-2xl xs:text-3xl font-black uppercase tracking-tight text-neutral-900 dark:text-white sm:text-5xl">
                Featured Match Gear
              </h2>
            </div>
            <Link
              href="/shop"
              className="glass-chip mt-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-black uppercase tracking-wider text-neutral-800 transition-colors hover:bg-white/85 dark:text-white/90 dark:hover:bg-white/15 sm:mt-0 touch-target"
            >
              <span>Browse the Full Collection</span>
              <ArrowRight className="h-3.5 w-3.5 text-[#FF5500] shrink-0" aria-hidden="true" />
            </Link>
          </div>
        </Reveal>

        <div className="mt-8 xs:mt-10 grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-5">
          {featuredProducts.map((product, idx) => (
            <Reveal key={product.id} delay={idx * 55} className="h-full">
              <GlassProductCard product={product} priority={idx < 2} />
            </Reveal>
          ))}
        </div>
      </section>

      {/* Categories */}
      <section className="mx-auto max-w-7xl px-4 pt-20 sm:px-6 lg:px-8">
        <Reveal>
          <div className="flex flex-col gap-4 border-b border-white/60 pb-6 dark:border-white/10 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <span className="text-xs font-black uppercase tracking-widest text-[#C2410C] dark:text-[#FF9A5C]">
                Tournament Departments
              </span>
              <h2 className="mt-2 font-display text-3xl font-black uppercase tracking-tight text-neutral-900 dark:text-white sm:text-5xl">
                Shop by Category
              </h2>
            </div>
            <Link
              href="/shop"
              className="glass-chip mt-1 inline-flex items-center gap-2 px-4 py-2.5 text-xs font-black uppercase tracking-wider text-neutral-800 transition-colors hover:bg-white/85 dark:text-white/90 dark:hover:bg-white/15 sm:mt-0"
            >
              <span>View All Equipment</span>
              <ArrowUpRight className="h-3.5 w-3.5 text-[#FF5500]" aria-hidden="true" />
            </Link>
          </div>
        </Reveal>

        <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-3 lg:grid-cols-4">
          {CATEGORIES.map((cat, idx) => (
            <Reveal key={cat.slug} delay={idx * 50} className={cat.span}>
              <Link
                href={`/shop?category=${cat.slug}`}
                className="glass-panel group relative block h-64 overflow-hidden rounded-3xl transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_30px_60px_-25px_rgba(255,85,0,0.45)] sm:h-72"
              >
                <Image
                  src={cat.image}
                  alt={cat.name}
                  fill
                  sizes="(min-width: 1024px) 25vw, (min-width: 768px) 50vw, 100vw"
                  loading="lazy"
                  className="object-cover opacity-60 transition-all duration-700 will-change-transform group-hover:scale-108 group-hover:opacity-75"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#050506] via-[#050506]/55 to-[#050506]/10" />
                <span className="glass-chip-dark absolute right-4 top-4 h-9 w-9 items-center justify-center text-white">
                  <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="absolute inset-0 flex flex-col justify-end p-6">
                  <span className="glass-chip-dark w-fit px-3 py-1 text-[10px] font-black uppercase tracking-wider text-white/90">
                    {cat.count}
                  </span>
                  <h3 className="mt-2.5 font-display text-2xl font-black uppercase leading-tight text-white sm:text-3xl">
                    {cat.name}
                  </h3>
                  <div
                    className="mt-2 h-[3px] w-16 origin-left scale-x-0 bg-[#FF5500] shadow-orange-glow-sm transition-transform duration-300 group-hover:scale-x-100"
                    aria-hidden="true"
                  />
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Brand partnerships */}
      <section className="mx-auto max-w-7xl px-4 pt-20 sm:px-6 lg:px-8">
        <Reveal>
          <div className="mx-auto mb-10 max-w-2xl space-y-3 text-center">
            <span className="text-xs font-black uppercase tracking-widest text-[#C2410C] dark:text-[#FF9A5C]">
              Official Manufacturing Lineup
            </span>
            <h2 className="font-display text-3xl font-black uppercase tracking-tight text-neutral-900 dark:text-white sm:text-5xl">
              Authorized Cricket Partnerships
            </h2>
            <p className="text-xs text-neutral-600 dark:text-white/60 sm:text-sm">
              Direct factory allocation ensures unadulterated willow grades, official test weights,
              and certified player balance.
            </p>
          </div>
        </Reveal>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
          {BRANDS.map((brand, idx) => (
            <Reveal key={brand} delay={idx * 45} className="h-full">
              <Link
                href={`/shop?brand=${encodeURIComponent(brand)}`}
                className="glass-panel group flex h-full flex-col items-center justify-center rounded-2xl p-7 text-center transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_24px_50px_-24px_rgba(255,85,0,0.45)]"
              >
                <span className="font-display text-2xl font-black uppercase tracking-wider text-neutral-900 transition-colors group-hover:text-[#C2410C] dark:text-white dark:group-hover:text-[#FF9A5C]">
                  {brand}
                </span>
                <span className="mt-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-neutral-600 dark:text-white/60">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" aria-hidden="true" />
                  <span>Authorized</span>
                </span>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Academy CTA band */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 sm:py-24">
        <Reveal>
          <div className="glass-panel relative overflow-hidden rounded-[2rem] p-8 sm:p-14">
            <div
              className="orb-a absolute -right-24 -top-24 h-80 w-80 rounded-full bg-[#FF5500]/25 blur-[110px]"
              aria-hidden="true"
            />
            <div
              className="orb-b absolute -bottom-32 -left-20 h-80 w-80 rounded-full bg-[#EA580C]/20 blur-[110px]"
              aria-hidden="true"
            />

            <div className="relative grid items-center gap-10 lg:grid-cols-[1.4fr_1fr]">
              <div>
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-[#C2410C] dark:text-[#FF9A5C]">
                  <MapPin className="h-4 w-4" aria-hidden="true" />
                  <span>Seven Districts Cricket Academy • Ajman, UAE</span>
                </div>
                <h2 className="mt-3 font-display text-4xl font-black uppercase leading-[0.95] tracking-tight text-neutral-900 dark:text-white sm:text-6xl">
                  Train. Play.{' '}
                  <span className="text-[#EA580C] dark:text-[#FF5500]">Win the Districts.</span>
                </h2>
                <p className="mt-5 max-w-xl text-sm leading-relaxed text-neutral-600 dark:text-white/70 sm:text-base">
                  Match-ready gear assembled by academy coaches and trusted by players across the
                  UAE. Visit us in Ajman or order online with same-day dispatch and Cash on
                  Delivery.
                </p>

                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <Link
                    href="/contact"
                    className="btn-glass inline-flex items-center gap-2 rounded-full bg-[#FF5500] px-6 py-3 text-xs font-black uppercase tracking-wider text-black shadow-orange-glow transition-all duration-200 hover:bg-[#FF6B1A] active:scale-95"
                  >
                    <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Visit the Academy</span>
                  </Link>
                  <Link
                    href="/shop"
                    className="glass-chip inline-flex items-center gap-2 px-6 py-3 text-xs font-black uppercase tracking-wider text-neutral-800 transition-all duration-200 hover:bg-white/85 active:scale-95 dark:text-white/90 dark:hover:bg-white/15"
                  >
                    <span>Browse Full Catalog</span>
                    <ArrowRight className="h-3.5 w-3.5 text-[#FF5500]" aria-hidden="true" />
                  </Link>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                {ACADEMY_STATS.map((stat) => (
                  <div
                    key={stat.label}
                    className="glass-panel rounded-2xl p-5 text-center sm:p-6"
                  >
                    <Trophy className="mx-auto mb-2 h-4 w-4 text-[#FF5500]" aria-hidden="true" />
                    <span className="block font-display text-4xl font-black tracking-tight text-neutral-900 dark:text-white sm:text-5xl">
                      {stat.value}
                    </span>
                    <span className="mt-1.5 block text-[10px] font-bold uppercase tracking-widest text-neutral-500 dark:text-white/60 sm:text-[11px]">
                      {stat.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}
