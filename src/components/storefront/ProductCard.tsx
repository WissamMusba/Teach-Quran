'use client';

import React from 'react';
import Link from 'next/link';
import { Product } from '@/lib/types';
import { useCart } from '@/context/CartContext';
import { ShoppingBag } from 'lucide-react';

interface ProductCardProps {
  product: Product;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const { addToCart } = useCart();
  const mainImage = product.images?.[0] || 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?q=80&w=800&auto=format&fit=crop';

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
    <div className="group relative bg-white border border-neutral-200/90 rounded-xl overflow-hidden hover:shadow-lg transition-all duration-300 flex flex-col justify-between">
      <div>
        {/* Thumbnail Container */}
        <Link href={`/product/${product.slug}`} className="block relative aspect-square bg-neutral-50 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={mainImage}
            alt={product.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />

          {/* Brand Pill */}
          <div className="absolute top-3 left-3">
            <span className="inline-block bg-white/95 backdrop-blur-sm border border-neutral-200 text-neutral-800 text-[11px] font-bold px-2 py-0.5 rounded shadow-xs">
              {product.brand}
            </span>
          </div>

          {/* Low Stock Warning if <= 5 */}
          {product.stock_quantity > 0 && product.stock_quantity <= 5 && (
            <div className="absolute top-3 right-3">
              <span className="inline-block bg-neutral-900/90 text-white text-[10px] font-semibold px-2 py-0.5 rounded">
                Only {product.stock_quantity} left
              </span>
            </div>
          )}
        </Link>

        {/* Content */}
        <div className="p-4 sm:p-5">
          <div className="text-xs uppercase font-medium text-neutral-500 tracking-wider mb-1">
            {product.category}
          </div>

          <Link href={`/product/${product.slug}`}>
            <h3 className="font-semibold text-neutral-900 text-base leading-snug hover:text-orange-600 transition-colors line-clamp-2">
              {product.title}
            </h3>
          </Link>

          {/* Quick Specification summary */}
          {product.specifications && Object.keys(product.specifications).length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1">
              {Object.entries(product.specifications).slice(0, 2).map(([key, value]) => (
                <span
                  key={key}
                  className="text-[11px] bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded"
                >
                  {value}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Pricing & Actions */}
      <div className="p-4 sm:p-5 pt-0 border-t border-neutral-100 mt-2 flex items-center justify-between">
        <div>
          <span className="text-xs text-neutral-500 block">Price</span>
          <span className="text-lg font-bold text-neutral-900">
            ${product.price.toFixed(2)}
          </span>
        </div>

        {product.stock_quantity > 0 ? (
          <button
            onClick={handleQuickAdd}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold rounded-lg shadow-sm transition-all active:scale-95"
            aria-label={`Add ${product.title} to cart`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Add</span>
          </button>
        ) : (
          <span className="text-xs font-semibold text-neutral-400 bg-neutral-100 px-2.5 py-1.5 rounded-lg">
            Sold Out
          </span>
        )}
      </div>
    </div>
  );
};
