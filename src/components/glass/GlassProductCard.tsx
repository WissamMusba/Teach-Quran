'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Product } from '@/lib/types';
import { useCart } from '@/context/CartContext';
import { ShoppingBag, Zap } from 'lucide-react';

interface GlassProductCardProps {
  product: Product;
  priority?: boolean;
}

/**
 * Liquid Glass product card — translucent surface, specular highlight,
 * fluid hover lift. Mirrors ProductCard's add-to-cart behaviour.
 */
export const GlassProductCard = React.memo<GlassProductCardProps>(function GlassProductCard({
  product,
  priority = false,
}) {
  const { addToCart } = useCart();
  const mainImage =
    product.images?.[0] ||
    'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?q=80&w=800&auto=format&fit=crop';

  // Option-based categories must go through the product page, never quick-add.
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

  const actionClass =
    'btn-glass inline-flex items-center gap-2 rounded-full bg-[#FF5500] px-4 py-2.5 text-xs font-black uppercase tracking-wider text-black transition-all duration-200 hover:bg-[#FF6B1A] active:scale-95';

  return (
    <div className="glass-panel group flex h-full flex-col overflow-hidden rounded-[1.75rem] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_30px_60px_-25px_rgba(255,85,0,0.5)]">
      {/* Imagery */}
      <Link
        href={`/product/${product.slug}`}
        className="relative block aspect-[4/5] overflow-hidden p-7"
      >
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(circle_at_50%_36%,rgba(255,255,255,0.10),transparent_62%)]"
        />
        <div className="relative h-full w-full">
          <Image
            src={mainImage}
            alt={product.title}
            fill
            sizes="(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            loading={priority ? 'eager' : 'lazy'}
            priority={priority}
            className="object-contain transition-transform duration-500 will-change-transform group-hover:scale-108"
          />
        </div>

        <span className="glass-chip absolute left-4 top-4 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-neutral-900 dark:text-white">
          <span className="h-1.5 w-1.5 rounded-full bg-[#FF5500]" />
          {product.brand}
        </span>

        {product.stock_quantity > 0 && product.stock_quantity <= 5 && (
          <span className="glass-chip absolute right-4 top-4 border-[#FF5500]/50 bg-[#FF5500]/15 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-[#C2410C] dark:text-[#FFB088]">
            Only {product.stock_quantity} left
          </span>
        )}
      </Link>

      {/* Details */}
      <div className="flex-1 px-5">
        <div className="flex items-center gap-1 text-[11px] font-black uppercase tracking-widest text-[#C2410C] dark:text-[#FF9A5C]">
          <Zap className="h-3 w-3" aria-hidden="true" />
          <span>{product.category}</span>
        </div>
        <Link href={`/product/${product.slug}`}>
          <h3 className="mt-1.5 line-clamp-2 font-display text-lg font-black uppercase leading-tight tracking-wide text-neutral-900 transition-colors group-hover:text-[#C2410C] dark:text-white dark:group-hover:text-[#FF9A5C] sm:text-xl">
            {product.title}
          </h3>
        </Link>
      </div>

      {/* Price + action */}
      <div className="mt-4 flex items-center justify-between border-t border-white/50 p-5 pt-4 dark:border-white/10">
        <div>
          <span className="block text-[10px] font-bold uppercase tracking-widest text-neutral-500 dark:text-white/60">
            Match Price
          </span>
          <div className="flex items-baseline gap-1">
            <span className="text-xs font-black text-[#C2410C] dark:text-[#FF9A5C]">AED</span>
            <span className="font-display text-2xl font-black tracking-tight text-neutral-900 dark:text-white">
              {product.price.toLocaleString()}
            </span>
          </div>
        </div>

        {product.stock_quantity > 0 ? (
          hasOptions ? (
            <Link
              href={`/product/${product.slug}`}
              className={actionClass}
              aria-label={`Choose options for ${product.title}`}
            >
              <ShoppingBag className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Options</span>
            </Link>
          ) : (
            <button
              onClick={handleQuickAdd}
              className={actionClass}
              aria-label={`Add ${product.title} to cart`}
            >
              <ShoppingBag className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Add</span>
            </button>
          )
        ) : (
          <span className="glass-chip px-3 py-2 text-xs font-black uppercase tracking-wider text-neutral-500 dark:text-white/60">
            Sold Out
          </span>
        )}
      </div>
    </div>
  );
});
