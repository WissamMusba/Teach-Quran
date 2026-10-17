import React, { Suspense } from 'react';
import { getProducts } from '@/lib/supabaseServer';
import { ProductCard } from '@/components/storefront/ProductCard';
import { ShopFilter } from '@/components/storefront/ShopFilter';
import { PackageOpen, Sparkles } from 'lucide-react';
import Link from 'next/link';

export const revalidate = 60;

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
    <div className="bg-neutral-50/50 min-h-screen py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Page Title & Breadcrumb */}
        <div className="mb-8">
          <div className="flex items-center space-x-2 text-xs text-neutral-500 mb-2">
            <Link href="/" className="hover:text-orange-600">Home</Link>
            <span>/</span>
            <span className="text-neutral-900 font-semibold">Equipment Catalog</span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-black text-neutral-900 tracking-tight">
                Cricket Equipment Catalog
              </h1>
              <p className="text-sm text-neutral-500 mt-1">
                Standard tournament and club grade gear. No promotions, no markups—straight authentic pricing.
              </p>
            </div>

            <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-full bg-white border border-neutral-200 text-xs font-semibold text-neutral-700 shadow-xs self-start sm:self-auto">
              <Sparkles className="w-3.5 h-3.5 text-orange-500" />
              <span>{filteredProducts.length} Products Available</span>
            </div>
          </div>
        </div>

        {/* Content Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
          {/* Filters Sidebar */}
          <aside className="lg:col-span-1">
            <Suspense fallback={<div className="bg-white p-6 rounded-xl border border-neutral-200 h-64 animate-pulse" />}>
              <ShopFilter />
            </Suspense>
          </aside>

          {/* Product Grid */}
          <section className="lg:col-span-3">
            {filteredProducts.length === 0 ? (
              <div className="bg-white border border-neutral-200 rounded-2xl p-12 text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-neutral-100 flex items-center justify-center mx-auto text-neutral-400">
                  <PackageOpen className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-neutral-900">No matching equipment found</h3>
                  <p className="text-sm text-neutral-500 mt-1 max-w-md mx-auto">
                    Try adjusting your filters or search keywords to find the right bats, balls, or protective pads.
                  </p>
                </div>
                <Link
                  href="/shop"
                  className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-orange-600 text-white font-semibold text-sm hover:bg-orange-500 transition-colors shadow-sm"
                >
                  Clear All Filters
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredProducts.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
