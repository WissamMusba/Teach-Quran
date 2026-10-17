import React from 'react';
import Link from 'next/link';
import { getProducts, getSiteSettings } from '@/lib/supabaseServer';
import { HeroBanner } from '@/components/storefront/HeroBanner';
import { CategoryGrid } from '@/components/storefront/CategoryGrid';
import { ProductCard } from '@/components/storefront/ProductCard';
import { ArrowRight, Award, CheckCircle2 } from 'lucide-react';

export const revalidate = 60;

export default async function HomePage() {
  const [settings, featuredProducts] = await Promise.all([
    getSiteSettings(),
    getProducts({ isFeatured: true, isActive: true, limit: 8 }),
  ]);

  return (
    <div className="bg-white">
      {/* Dynamic Hero Banner */}
      <HeroBanner settings={settings} />

      {/* Featured Products Showcase */}
      <section className="py-16 sm:py-20 bg-neutral-50/50 border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-10">
            <div>
              <div className="flex items-center space-x-1.5 text-xs font-bold uppercase tracking-wider text-orange-600 mb-1">
                <Award className="w-4 h-4" />
                <span>Selected by Professionals</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-neutral-900 tracking-tight">
                Featured Match Gear
              </h2>
            </div>
            <Link
              href="/shop"
              className="mt-3 sm:mt-0 inline-flex items-center space-x-1.5 text-sm font-bold text-neutral-900 hover:text-orange-600 transition-colors"
            >
              <span>Explore All {featuredProducts.length}+ Items</span>
              <ArrowRight className="w-4 h-4 text-orange-600" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {featuredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </section>

      {/* Category Grid */}
      <CategoryGrid />

      {/* Brand Partnership Spotlight */}
      <section className="py-16 bg-white border-t border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-2xl font-black text-neutral-900 tracking-tight sm:text-3xl">
              Official Gear from Iconic Cricket Brands
            </h2>
            <p className="mt-2 text-sm text-neutral-500">
              Every bat and piece of armor is sourced directly from manufacturers, guaranteeing uncompromised willow quality and test-match safety standards.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
            {['SG', 'SS', 'Kookaburra', 'Gray-Nicolls', 'MRF'].map((brand) => (
              <Link
                key={brand}
                href={`/shop?brand=${encodeURIComponent(brand)}`}
                className="p-6 rounded-xl border border-neutral-200 bg-white hover:border-orange-500 hover:shadow-md transition-all flex flex-col items-center justify-center text-center group"
              >
                <span className="text-lg font-black tracking-tight text-neutral-800 group-hover:text-orange-600 transition-colors">
                  {brand}
                </span>
                <span className="text-xs text-neutral-400 mt-1 flex items-center space-x-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-500" />
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
