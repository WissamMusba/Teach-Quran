import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getProductBySlug, getProducts } from '@/lib/supabaseServer';
import { ProductDetailClient } from '@/components/storefront/ProductDetailClient';
import { ProductCard } from '@/components/storefront/ProductCard';
import { ArrowLeft } from 'lucide-react';

export const revalidate = 60;

interface ProductPageProps {
  params: Promise<{
    slug: string;
  }>;
}

export default async function ProductDetailPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) {
    notFound();
  }

  // Related products from the same category
  const relatedProducts = (
    await getProducts({
      category: product.category,
      isActive: true,
      limit: 5,
    })
  ).filter((p) => p.id !== product.id).slice(0, 4);

  return (
    <div className="bg-white min-h-screen py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Navigation & Breadcrumbs */}
        <div className="flex items-center space-x-2 text-xs text-neutral-500 mb-8">
          <Link href="/" className="hover:text-orange-600">Home</Link>
          <span>/</span>
          <Link href={`/shop?category=${product.category}`} className="hover:text-orange-600 capitalize">
            {product.category}
          </Link>
          <span>/</span>
          <span className="text-neutral-900 font-semibold truncate max-w-xs">{product.title}</span>
        </div>

        {/* Back Link */}
        <div className="mb-6">
          <Link
            href="/shop"
            className="inline-flex items-center space-x-1.5 text-xs font-semibold text-neutral-600 hover:text-orange-600 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to All Equipment</span>
          </Link>
        </div>

        {/* Main Product Showcase */}
        <ProductDetailClient product={product} />

        {/* Related Category Equipment */}
        {relatedProducts.length > 0 && (
          <div className="mt-24 pt-12 border-t border-neutral-200">
            <div className="flex items-end justify-between mb-8">
              <div>
                <span className="text-xs uppercase tracking-wider font-bold text-orange-600 block mb-1">
                  Complementary Gear
                </span>
                <h2 className="text-2xl font-black text-neutral-900 tracking-tight">
                  More in {product.category}
                </h2>
              </div>
              <Link
                href={`/shop?category=${product.category}`}
                className="text-sm font-bold text-neutral-900 hover:text-orange-600 transition-colors"
              >
                View Category
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {relatedProducts.map((rel) => (
                <ProductCard key={rel.id} product={rel} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
