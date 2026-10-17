import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
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

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) {
    return { title: 'Product Not Found' };
  }

  const description =
    product.description ||
    `Buy the ${product.title} by ${product.brand} — match-grade cricket equipment with card and Cash on Delivery options.`;
  const image = product.images?.[0];

  return {
    title: product.title,
    description,
    alternates: { canonical: `/product/${product.slug}` },
    openGraph: {
      title: product.title,
      description,
      type: 'website',
      images: image ? [{ url: image }] : undefined,
    },
  };
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
  )
    .filter((p) => p.id !== product.id)
    .slice(0, 4);

  return (
    <div className="bg-[#050505] text-white min-h-screen py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Navigation & Breadcrumbs */}
        <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-neutral-500 mb-8">
          <Link href="/" className="hover:text-[#FF5500] transition-colors">
            Home
          </Link>
          <span>/</span>
          <Link
            href={`/shop?category=${product.category}`}
            className="hover:text-[#FF5500] transition-colors capitalize"
          >
            {product.category}
          </Link>
          <span>/</span>
          <span className="text-white font-black truncate max-w-xs">{product.title}</span>
        </div>

        {/* Back Link */}
        <div className="mb-8">
          <Link
            href="/shop"
            className="inline-flex items-center space-x-2 text-xs font-black uppercase tracking-wider text-neutral-400 hover:text-[#FF5500] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Equipment Catalog</span>
          </Link>
        </div>

        {/* Main Product Showcase */}
        <ProductDetailClient product={product} />

        {/* Related Category Equipment */}
        {relatedProducts.length > 0 && (
          <div className="mt-28 pt-16 border-t border-[#1C1C24]">
            <div className="flex items-end justify-between mb-10">
              <div>
                <span className="text-xs uppercase tracking-widest font-black text-[#FF5500] block mb-1">
                  Complementary Match Gear
                </span>
                <h2 className="font-display uppercase text-3xl sm:text-4xl font-black text-white tracking-tight">
                  More in {product.category}
                </h2>
              </div>
              <Link
                href={`/shop?category=${product.category}`}
                className="text-xs font-black uppercase tracking-wider text-neutral-300 hover:text-[#FF5500] transition-colors"
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
