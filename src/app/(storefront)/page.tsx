import React from 'react';
import Link from 'next/link';
import { getProducts, getSiteSettings } from '@/lib/supabaseServer';
import { HeroBanner } from '@/components/storefront/HeroBanner';
import { CategoryGrid } from '@/components/storefront/CategoryGrid';
import { ProductCard } from '@/components/storefront/ProductCard';
import { ArrowRight, Award, CheckCircle2, Flame } from 'lucide-react';

export const revalidate = 60;

export default async function HomePage() {
  const [settings, featuredProducts] = await Promise.all([
    getSiteSettings(),
    getProducts({ isFeatured: true, isActive: true, limit: 8 }),
  ]);

  return (
    <div className="bg-white text-neutral-900 dark:bg-[#050505] dark:text-white transition-colors duration-200">
      {/* Hero Banner with Dynamic Settings & Featured Equipment Spotlight */}
      <HeroBanner settings={settings} spotlightProduct={featuredProducts[0]} />

      {/* Featured Match Gear Showcase */}
      <section className="py-20 sm:py-24 bg-neutral-50 dark:bg-[#08080C] border-b border-neutral-200 dark:border-[#1C1C24] relative overflow-hidden transition-colors duration-200">
        {/* Glow Spot */}
        <div className="absolute top-1/2 right-0 w-96 h-96 bg-[#FF5500]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-12 border-b border-neutral-200 dark:border-[#1C1C24] pb-6">
            <div>
              <div className="flex items-center space-x-2 text-xs font-black uppercase tracking-widest text-[#FF5500] mb-2">
                <Flame className="w-4 h-4 text-[#FF5500] fill-[#FF5500]" />
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
              <ArrowRight className="w-4 h-4 text-[#FF5500]" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {featuredProducts.map((product, idx) => (
              <ProductCard key={product.id} product={product} priority={idx < 2} />
            ))}
          </div>
        </div>
      </section>

      {/* Category Grid Section */}
      <CategoryGrid />

      {/* Authorized Brand Partnerships */}
      <section className="py-20 bg-white dark:bg-[#060608] border-t border-neutral-200 dark:border-[#1C1C24] transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
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

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
            {['SG', 'SS', 'Kookaburra', 'Gray-Nicolls', 'MRF'].map((brand) => (
              <Link
                key={brand}
                href={`/shop?brand=${encodeURIComponent(brand)}`}
                className="p-8 rounded-2xl border border-neutral-200 bg-neutral-50 hover:bg-white hover:border-[#FF5500] hover:shadow-lg dark:border-[#22222A] dark:bg-[#0E0E14] dark:hover:border-[#FF5500]/70 dark:hover:shadow-orange-glow transition-all duration-300 flex flex-col items-center justify-center text-center group shadow-sm"
              >
                <span className="font-display uppercase text-2xl font-black tracking-wider text-black dark:text-white group-hover:text-[#FF5500] transition-colors">
                  {brand}
                </span>
                <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400 mt-2 flex items-center space-x-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Authorized</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
