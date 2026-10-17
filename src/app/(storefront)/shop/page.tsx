import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import { getProducts } from '@/lib/supabaseServer';
import { ProductCard } from '@/components/storefront/ProductCard';
import { ShopFilter } from '@/components/storefront/ShopFilter';
import { PackageOpen, Sparkles } from 'lucide-react';
import Link from 'next/link';

export const revalidate = 60;

export const metadata: Metadata = {
  title: 'Cricket Equipment Catalog',
  description:
    'Browse match-grade cricket bats, balls, pads, gloves, helmets, bags and shoes. Authentic brands with transparent AED pricing and UAE-wide delivery.',
  alternates: { canonical: '/shop' },
};

interface ShopPageProps {
  searchParams: Promise<{
    category?: string;
    brand?: string;
    sort?: string;
    q?: string;
  }>;
}

export default async function ShopPage({ searchParams }: ShopPageProps) {
  const resolvedParams = await searchParams;
  const category = resolvedParams.category;
  const brand = resolvedParams.brand;
  const sort = resolvedParams.sort;
  const query = resolvedParams.q?.toLowerCase() || '';

  const unfilteredCatalog = await getProducts({ isActive: true });
  const availableBrands = Array.from(new Set(unfilteredCatalog.map((p) => p.brand).filter(Boolean)));

  const allProducts = await getProducts({
    category,
    brand,
    sort,
    isActive: true,
  });

  const filteredProducts = query
    ? allProducts.filter(
        (p) =>
          p.title.toLowerCase().includes(query) ||
          p.brand.toLowerCase().includes(query) ||
          p.category.toLowerCase().includes(query) ||
          (p.description && p.description.toLowerCase().includes(query))
      )
    : allProducts;

  return (
    <div className="bg-neutral-50 text-neutral-900 dark:bg-[#050505] dark:text-white min-h-screen py-12 transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Page Title & Breadcrumb */}
        <div className="mb-10 pb-6 border-b border-neutral-200 dark:border-[#1C1C24]">
          <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-neutral-500 mb-3">
            <Link href="/" className="hover:text-[#FF5500] transition-colors">
              Home
            </Link>
            <span>/</span>
            <span className="text-black dark:text-white font-black">Equipment Catalog</span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="font-display uppercase text-3xl sm:text-5xl font-black text-black dark:text-white tracking-tight">
                Cricket Equipment Catalog
              </h1>
              <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 mt-1 max-w-xl">
                International match-standard bats, four-piece leather balls, and high-impact armor. Non-discount, authentic transparent pricing.
              </p>
            </div>

            <div className="inline-flex items-center space-x-2 px-4 py-2 rounded-full bg-white dark:bg-[#121218] border border-neutral-200 dark:border-[#262630] text-xs font-black uppercase tracking-wider text-black dark:text-white shadow-sm self-start sm:self-auto">
              <Sparkles className="w-4 h-4 text-[#FF5500]" />
              <span>{filteredProducts.length} Items Available</span>
            </div>
          </div>
        </div>

        {/* Content Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
          {/* Filters Sidebar */}
          <aside className="lg:col-span-1">
            <Suspense
              fallback={
                <div className="bg-white dark:bg-[#0E0E14] border border-neutral-200 dark:border-[#22222A] p-6 rounded-2xl h-80 animate-pulse shadow-sm" />
              }
            >
              <ShopFilter availableBrands={availableBrands} />
            </Suspense>
          </aside>

          {/* Product Grid */}
          <section className="lg:col-span-3">
            {filteredProducts.length === 0 ? (
              <div className="bg-white dark:bg-[#0E0E14] border border-neutral-200 dark:border-[#22222A] rounded-2xl p-16 text-center space-y-5 shadow-sm">
                <div className="w-16 h-16 rounded-full bg-neutral-100 dark:bg-[#16161E] border border-neutral-200 dark:border-[#262630] flex items-center justify-center mx-auto text-[#FF5500]">
                  <PackageOpen className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="font-display uppercase text-2xl font-black text-black dark:text-white">
                    No matching equipment found
                  </h3>
                  <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 mt-1 max-w-md mx-auto">
                    Try adjusting your filters or search keywords to find the right bats, balls, or protective pads.
                  </p>
                </div>
                <Link
                  href="/shop"
                  className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-[#FF5500] text-white font-black uppercase tracking-wider text-xs hover:bg-[#FF6600] transition-colors shadow-orange-glow-sm"
                >
                  Clear All Filters
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredProducts.map((product, idx) => (
                  <ProductCard key={product.id} product={product} priority={idx < 3} />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
