'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Product } from '@/lib/types';
import { useCart } from '@/context/CartContext';
import { ShoppingBag, Zap } from 'lucide-react';

interface ProductCardProps {
  product: Product;
  priority?: boolean;
}

export const ProductCard = React.memo<ProductCardProps>(function ProductCard({ product, priority = false }) {
  const { addToCart } = useCart();
  const mainImage =
    product.images?.[0] ||
    'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?q=80&w=800&auto=format&fit=crop';

  // Categories that expose size / weight / orientation choices on the product
  // page must not be quick-added with default options — send the shopper to
  // the PDP to make a real selection instead.
  const hasOptions = ['bats', 'gloves', 'pads', 'shoes', 'helmets'].includes(
    product.category.toLowerCase()
  );

  const handleQuickAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    addToCart({
      productId: product.id,
      title: product.title,
      slug: product.slug,
      price: product.price,
      image: mainImage,
      quantity: 1,
      maxStock: product.stock_quantity,
    });
  };

  return (
    <div className="group relative h-full bg-white dark:bg-[#0E0E13] border border-neutral-200 dark:border-[#22222A] rounded-2xl overflow-hidden hover:border-[#FF5500] dark:hover:border-[#FF5500]/70 hover:shadow-xl dark:hover:shadow-orange-glow transition-all duration-300 flex flex-col justify-between shadow-sm">
      <div>
        {/* Thumbnail Container */}
        <Link
          href={`/product/${product.slug}`}
          className="block relative aspect-square bg-neutral-100/70 dark:bg-[#14141A] overflow-hidden p-6"
        >
          {/* Subtle Ambient Rim Light */}
          <div className="absolute inset-0 bg-radial-gradient from-transparent to-black/5 dark:to-black/40 pointer-events-none z-10" />

          <div className="relative w-full h-full">
            <Image
              src={mainImage}
              alt={product.title}
              fill
              sizes="(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
              loading={priority ? 'eager' : 'lazy'}
              priority={priority}
              className="object-contain group-hover:scale-108 transition-transform duration-500 will-change-transform"
            />
          </div>

          {/* Brand Badge in Athletic Black & Orange */}
          <div className="absolute top-3 left-3">
            <span className="inline-flex items-center space-x-1.5 bg-black/90 backdrop-blur-md border border-black text-white text-[11px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md shadow-md">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FF5500]" />
              <span>{product.brand}</span>
            </span>
          </div>

          {/* Low Stock Warning */}
          {product.stock_quantity > 0 && product.stock_quantity <= 5 && (
            <div className="absolute top-3 right-3">
              <span className="inline-block bg-[#FF5500]/20 border border-[#FF5500]/60 text-[#FF5500] text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded shadow-sm">
                Only {product.stock_quantity} left
              </span>
            </div>
          )}
        </Link>

        {/* Content */}
        <div className="p-5">
          <div className="text-[11px] uppercase font-black text-[#FF5500] tracking-widest mb-1.5 flex items-center space-x-1">
            <Zap className="w-3 h-3 text-[#FF5500]" />
            <span>{product.category}</span>
          </div>

          <Link href={`/product/${product.slug}`}>
            <h3 className="font-display uppercase tracking-wide text-lg sm:text-xl font-bold text-black dark:text-white group-hover:text-[#FF5500] transition-colors line-clamp-2 leading-tight">
              {product.title}
            </h3>
          </Link>
        </div>
      </div>

      {/* Pricing & Actions */}
      <div className="p-5 pt-0 border-t border-neutral-200 dark:border-[#1C1C24] mt-2 flex items-center justify-between">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 block">
            Standard Match Price
          </span>
          <div className="flex items-baseline space-x-1">
            <span className="text-xs font-black text-[#FF5500]">AED</span>
            <span className="text-2xl font-black text-black dark:text-white font-display tracking-tight">
              {product.price.toLocaleString()}
            </span>
          </div>
        </div>

        {product.stock_quantity > 0 ? (
          hasOptions ? (
            <Link
              href={`/product/${product.slug}`}
              className="inline-flex items-center space-x-2 px-4 py-2.5 bg-[#FF5500] hover:bg-[#FF6600] text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-orange-glow-sm transition-all active:scale-95"
              aria-label={`Choose options for ${product.title}`}
            >
              <ShoppingBag className="w-3.5 h-3.5 text-white" aria-hidden="true" />
              <span>Choose Options</span>
            </Link>
          ) : (
            <button
              onClick={handleQuickAdd}
              className="inline-flex items-center space-x-2 px-4 py-2.5 bg-[#FF5500] hover:bg-[#FF6600] text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-orange-glow-sm transition-all active:scale-95"
              aria-label={`Add ${product.title} to cart`}
            >
              <ShoppingBag className="w-3.5 h-3.5 text-white" aria-hidden="true" />
              <span>Add</span>
            </button>
          )
        ) : (
          <span className="text-xs font-black uppercase tracking-wider text-neutral-500 bg-neutral-100 dark:bg-[#16161E] border border-neutral-300 dark:border-[#252530] px-3 py-2 rounded-xl">
            Sold Out
          </span>
        )}
      </div>
    </div>
  );
});
