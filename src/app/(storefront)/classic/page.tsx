import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { getProducts, getSiteSettings } from '@/lib/supabaseServer';
import { HeroBanner } from '@/components/storefront/HeroBanner';
import { CategoryGrid } from '@/components/storefront/CategoryGrid';
import { ProductCard } from '@/components/storefront/ProductCard';
import { Reveal } from '@/components/storefront/Reveal';
import {
  ArrowRight,
  Banknote,
  CheckCircle2,
  Flame,
  MapPin,
  PackageCheck,
  Phone,
  ShieldCheck,
  Trophy,
  Truck,
} from 'lucide-react';

export const revalidate = 60;

/** Archived design preview — the Liquid Glass design now lives at the site root. */
export const metadata: Metadata = {
  title: 'Classic Storefront (Design Preview)',
  robots: { index: false, follow: false },
};

/** Service promises — kept factual to the academy's delivery & payment policy. */
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

export default async function HomePage() {
  const [settings, featuredProducts] = await Promise.all([
    getSiteSettings(),
    getProducts({ isFeatured: true, isActive: true, limit: 8 }),
  ]);

  return (
    <div className="bg-white text-neutral-900 dark:bg-[#050505] dark:text-white transition-colors duration-200">
      {/* Hero Banner with Dynamic Settings & Featured Equipment Spotlight */}
      <HeroBanner settings={settings} spotlightProduct={featuredProducts[0]} />

      {/* Service Promise Strip — value proposition under the hero */}
      <section
        aria-label="Academy service promises"
        className="bg-white dark:bg-[#0A0A0E] border-b border-neutral-200 dark:border-[#1C1C24] transition-colors duration-200"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {SERVICE_PROMISES.map((promise, idx) => (
              <Reveal
                key={promise.title}
                delay={idx * 50}
                className={idx > 0 ? 'lg:border-l lg:border-neutral-200 dark:lg:border-[#1C1C24]' : ''}
              >
                <div
                  className={`flex items-start space-x-3.5 py-6 lg:py-8 ${
                    idx > 0 ? 'lg:pl-8' : ''
                  }`}
                >
                  <div className="w-11 h-11 rounded-xl bg-[#FF5500]/10 border border-[#FF5500]/30 text-[#FF5500] flex items-center justify-center shrink-0">
                    <promise.icon className="w-5 h-5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-display uppercase tracking-wide font-black text-black dark:text-white text-base leading-tight">
                      {promise.title}
                    </h3>
                    <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1 leading-relaxed">
                      {promise.caption}
                    </p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Match Gear Showcase */}
      <section className="py-20 sm:py-24 bg-neutral-50 dark:bg-[#08080C] border-b border-neutral-200 dark:border-[#1C1C24] relative overflow-hidden transition-colors duration-200">
        {/* Glow Spot */}
        <div className="absolute top-1/2 right-0 w-96 h-96 bg-[#FF5500]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <Reveal>
            <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-12 border-b border-neutral-200 dark:border-[#1C1C24] pb-6">
              <div>
                <div className="flex items-center space-x-2 text-xs font-black uppercase tracking-widest text-[#FF5500] mb-2">
                  <Flame className="w-4 h-4 text-[#FF5500] fill-[#FF5500]" aria-hidden="true" />
                  <span>Selected by Elite Stroke Makers</span>
                </div>
                <h2 className="font-display uppercase text-3xl sm:text-5xl font-black text-black dark:text-white tracking-tight">
                  Featured Match Gear
                </h2>
              </div>
              <Link
                href="/shop"
                className="mt-4 sm:mt-0 inline-flex items-center space-x-2 text-xs font-black uppercase tracking-wider text-neutral-700 hover:text-[#FF5500] dark:text-neutral-300 dark:hover:text-[#FF5500] transition-colors"
              >
                <span>Browse the Full Collection</span>
                <ArrowRight className="w-4 h-4 text-[#FF5500]" aria-hidden="true" />
              </Link>
            </div>
          </Reveal>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {featuredProducts.map((product, idx) => (
              <Reveal key={product.id} delay={idx * 55} className="h-full">
                <ProductCard product={product} priority={idx < 2} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Category Grid Section */}
      <CategoryGrid />

      {/* Authorized Brand Partnerships */}
      <section className="py-20 bg-white dark:bg-[#060608] border-t border-neutral-200 dark:border-[#1C1C24] transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="text-center max-w-2xl mx-auto mb-12 space-y-3">
              <span className="text-xs font-black uppercase tracking-widest text-[#FF5500]">
                Official Manufacturing Lineup
              </span>
              <h2 className="font-display uppercase text-3xl sm:text-5xl font-black text-black dark:text-white tracking-tight">
                Authorized Cricket Partnerships
              </h2>
              <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400">
                Direct factory allocation ensures unadulterated willow grades, official test weights, and certified player balance.
              </p>
            </div>
          </Reveal>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
            {['SG', 'SS', 'Kookaburra', 'Gray-Nicolls', 'MRF'].map((brand, idx) => (
              <Reveal key={brand} delay={idx * 45} className="h-full">
                <Link
                  href={`/shop?brand=${encodeURIComponent(brand)}`}
                  className="h-full p-8 rounded-2xl border border-neutral-200 bg-neutral-50 hover:bg-white hover:border-[#FF5500] hover:shadow-lg dark:border-[#22222A] dark:bg-[#0E0E14] dark:hover:border-[#FF5500]/70 dark:hover:shadow-orange-glow transition-all duration-300 flex flex-col items-center justify-center text-center group shadow-sm"
                >
                  <span className="font-display uppercase text-2xl font-black tracking-wider text-black dark:text-white group-hover:text-[#FF5500] transition-colors">
                    {brand}
                  </span>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400 mt-2 flex items-center space-x-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" aria-hidden="true" />
                    <span>Authorized</span>
                  </span>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Academy CTA Band — proof + primary conversion block */}
      <section className="relative overflow-hidden bg-neutral-950 dark:bg-black border-t border-neutral-200 dark:border-[#1C1C24] text-white">
        {/* Ambient glow */}
        <div
          className="absolute -top-32 right-0 w-[32rem] h-[32rem] bg-[#FF5500]/20 rounded-full blur-3xl pointer-events-none"
          aria-hidden="true"
        />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-24 relative">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <Reveal>
              <div className="flex items-center space-x-2 text-xs font-black uppercase tracking-widest text-[#FF5500] mb-3">
                <MapPin className="w-4 h-4" aria-hidden="true" />
                <span>CG Sports • Located at Seven Districts, Ajman, UAE</span>
              </div>
              <h2 className="font-display uppercase text-4xl sm:text-6xl font-black tracking-tight leading-[0.95] text-white">
                Train. Play.{' '}
                <span className="text-[#FF5500]">Win the Districts.</span>
              </h2>
              <p className="mt-5 text-sm sm:text-base text-neutral-300 leading-relaxed max-w-xl">
                Match-ready gear assembled by expert coaches and trusted by players across the UAE.
                Visit CG Sports at Seven Districts in Ajman or order online with same-day dispatch and Cash on Delivery.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href="/contact"
                  className="inline-flex items-center space-x-2 px-6 py-3 rounded-full bg-[#FF5500] hover:bg-[#FF6600] text-white font-black uppercase tracking-wider text-xs transition-all duration-200 shadow-orange-glow active:scale-95"
                >
                  <Phone className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Visit the Academy</span>
                </Link>
                <Link
                  href="/shop"
                  className="inline-flex items-center space-x-2 px-6 py-3 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 text-white font-black uppercase tracking-wider text-xs transition-all duration-200 active:scale-95"
                >
                  <span>Browse Full Catalog</span>
                  <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                </Link>
              </div>
            </Reveal>

            <Reveal delay={120}>
              <div className="grid grid-cols-3 gap-4">
                {ACADEMY_STATS.map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-2xl bg-white/[0.04] border border-white/10 p-5 sm:p-6 text-center"
                  >
                    <Trophy className="w-4 h-4 text-[#FF5500] mx-auto mb-2" aria-hidden="true" />
                    <span className="block font-display text-4xl sm:text-5xl font-black text-white tracking-tight">
                      {stat.value}
                    </span>
                    <span className="block text-[10px] sm:text-[11px] font-bold uppercase tracking-widest text-neutral-400 mt-1.5">
                      {stat.label}
                    </span>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Liquid Glass switcher — remove this block to hide it */}
      <Link
        href="/"
        className="fixed bottom-5 left-5 z-50 hidden items-center gap-2 rounded-full border border-white/15 bg-black/80 px-4 py-2.5 text-[11px] font-black uppercase tracking-wider text-white shadow-lg backdrop-blur-md transition-colors hover:bg-[#FF5500] hover:text-black md:inline-flex"
      >
        View Liquid Glass Design
        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
      </Link>
    </div>
  );
}
