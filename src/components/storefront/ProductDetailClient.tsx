'use client';

import React, { useState } from 'react';
import { Product } from '@/lib/types';
import { useCart } from '@/context/CartContext';
import { ShoppingBag, ShieldCheck, Truck, RefreshCw, Check, AlertCircle, Zap } from 'lucide-react';

interface ProductDetailClientProps {
  product: Product;
}

export const ProductDetailClient: React.FC<ProductDetailClientProps> = ({ product }) => {
  const { addToCart } = useCart();
  const [selectedImage, setSelectedImage] = useState<string>(
    product.images?.[0] ||
      'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?q=80&w=800&auto=format&fit=crop'
  );
  const [quantity, setQuantity] = useState<number>(1);
  const [addedAnimation, setAddedAnimation] = useState<boolean>(false);

  // Variant selection states. Defaults must only apply to categories that
  // actually render the matching control, otherwise hidden options leak into
  // the cart (e.g. a ball ordered with size "Adult / Men").
  const categoryLower = product.category.toLowerCase();
  const [selectedSize, setSelectedSize] = useState<string>(
    categoryLower === 'bats'
      ? 'Short Handle'
      : categoryLower === 'shoes'
      ? 'UK 9'
      : categoryLower === 'helmets'
      ? 'Medium (58-61cm)'
      : ['pads', 'gloves'].includes(categoryLower)
      ? 'Adult / Men'
      : ''
  );

  const [selectedWeight, setSelectedWeight] = useState<string>(
    categoryLower === 'bats' ? '1,135g - 1,155g' : ''
  );

  const [selectedOrientation, setSelectedOrientation] = useState<string>(
    ['pads', 'gloves'].includes(categoryLower) ? 'Right Hand' : ''
  );

  const handleAddToCart = () => {
    if (product.stock_quantity <= 0) return;

    const options: Record<string, string> = {};
    if (selectedSize) options['size'] = selectedSize;
    if (selectedWeight) options['weight'] = selectedWeight;
    if (selectedOrientation) options['orientation'] = selectedOrientation;

    addToCart({
      productId: product.id,
      title: product.title,
      slug: product.slug,
      price: product.price,
      image: selectedImage,
      quantity,
      selectedOptions: options,
      maxStock: product.stock_quantity,
    });

    setAddedAnimation(true);
    setTimeout(() => setAddedAnimation(false), 2000);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
      {/* Left Column: Image Gallery */}
      <div className="space-y-4">
        {/* Main Display Stage */}
        <div className="aspect-square bg-white dark:bg-[#0E0E14] border border-neutral-200 dark:border-[#22222A] rounded-3xl overflow-hidden flex items-center justify-center p-8 shadow-sm dark:shadow-2xl relative group">
          <div className="absolute inset-0 bg-radial-gradient from-transparent to-black/5 dark:to-black/50 pointer-events-none" />

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={selectedImage}
            alt={product.title}
            className="w-full h-full object-contain group-hover:scale-108 transition-transform duration-500"
          />

          <span className="absolute top-5 left-5 bg-black/90 backdrop-blur-md border border-black text-white text-xs font-black uppercase tracking-wider px-3 py-1.5 rounded-lg shadow-md flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-[#FF5500]" />
            <span>{product.brand}</span>
          </span>
        </div>

        {/* Thumbnail Selector */}
        {product.images && product.images.length > 1 && (
          <div className="flex space-x-3 overflow-x-auto pb-2">
            {product.images.map((img, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedImage(img)}
                className={`w-20 h-20 rounded-2xl border-2 overflow-hidden shrink-0 bg-white dark:bg-[#0E0E14] p-2 transition-all ${
                  selectedImage === img
                    ? 'border-[#FF5500] ring-2 ring-[#FF5500]/30 shadow-orange-glow-sm'
                    : 'border-neutral-200 dark:border-[#22222A] hover:border-neutral-400'
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img}
                  alt={`${product.title} thumbnail ${idx + 1}`}
                  className="w-full h-full object-contain"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Right Column: Product Information & Purchase Panel */}
      <div className="space-y-6">
        <div>
          <div className="flex items-center space-x-2 text-xs uppercase tracking-widest font-black text-[#FF5500] mb-2">
            <Zap className="w-3.5 h-3.5 text-[#FF5500]" />
            <span>{product.category}</span>
            <span>•</span>
            <span>{product.brand}</span>
          </div>

          <h1 className="font-display uppercase text-3xl sm:text-5xl font-black text-black dark:text-white tracking-tight leading-[0.95]">
            {product.title}
          </h1>

          <div className="mt-5 flex items-baseline space-x-2 flex-wrap">
            <span className="text-lg sm:text-xl font-black text-[#FF5500]">
              AED
            </span>
            <span className="font-display text-4xl sm:text-5xl font-black text-black dark:text-white tracking-tight">
              {product.price.toLocaleString()}
            </span>
            <span className="text-[11px] uppercase tracking-wider font-bold text-neutral-500 ml-2">
              Tournament Match Price
            </span>
          </div>
        </div>

        {/* Stock Status Badge */}
        <div className="flex items-center space-x-2 text-sm">
          {product.stock_quantity > 0 ? (
            <div className="flex items-center space-x-2 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-3.5 py-1.5 rounded-full font-bold text-xs border border-emerald-200 dark:border-emerald-800/60 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>In Stock — {product.stock_quantity} available for immediate dispatch</span>
            </div>
          ) : (
            <div className="flex items-center space-x-2 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 px-3.5 py-1.5 rounded-full font-bold text-xs border border-red-200 dark:border-red-800/60 shadow-sm">
              <AlertCircle className="w-4 h-4 text-red-500" />
              <span>Currently Out of Stock</span>
            </div>
          )}
        </div>

        {/* Product Description */}
        {product.description && (
          <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed border-t border-b border-neutral-200 dark:border-[#1C1C24] py-5">
            {product.description}
          </p>
        )}

        {/* Specifications */}
        {product.specifications && Object.keys(product.specifications).length > 0 && (
          <div className="bg-white dark:bg-[#0E0E14] border border-neutral-200 dark:border-[#22222A] rounded-2xl p-5 shadow-sm">
            <h2 className="font-display uppercase text-sm font-black text-black dark:text-white tracking-widest mb-3">
              Specifications
            </h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 text-xs">
              {Object.entries(product.specifications).map(([key, value]) => (
                <div
                  key={key}
                  className="flex justify-between gap-4 py-1.5 border-b border-neutral-200 dark:border-[#1C1C24]"
                >
                  <dt className="text-neutral-500 dark:text-neutral-400 font-bold uppercase tracking-wider">{key}</dt>
                  <dd className="text-black dark:text-white font-semibold text-right">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        {/* Variants / Options */}
        <div className="space-y-5 pt-1">
          {/* Bats Size / Handle Option */}
          {categoryLower === 'bats' && (
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-neutral-700 dark:text-neutral-300 mb-2.5">
                Handle & Size
              </label>
              <div className="grid grid-cols-1 min-[340px]:grid-cols-3 gap-2">
                {['Short Handle', 'Harrow', 'Long Handle'].map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setSelectedSize(opt)}
                    className={`py-2 px-2.5 text-xs font-black uppercase tracking-wider rounded-xl border text-center transition-all ${
                      selectedSize === opt
                        ? 'border-[#FF5500] bg-[#FF5500] text-white shadow-orange-glow-sm'
                        : 'border-neutral-300 dark:border-[#252530] text-neutral-800 dark:text-neutral-300 hover:border-neutral-400 bg-neutral-100 dark:bg-[#121218]'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Bat Weight Option in Grams */}
          {categoryLower === 'bats' && (
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-neutral-700 dark:text-neutral-300 mb-2.5">
                Bat Weight Profile (Grams)
              </label>
              <div className="grid grid-cols-1 min-[340px]:grid-cols-3 gap-2">
                {['1,135g - 1,155g', '1,160g - 1,180g', '1,185g - 1,220g'].map((w) => (
                  <button
                    key={w}
                    onClick={() => setSelectedWeight(w)}
                    className={`py-2 px-2.5 text-xs font-black uppercase tracking-wider rounded-xl border text-center transition-all ${
                      selectedWeight === w
                        ? 'border-[#FF5500] bg-[#FF5500] text-white shadow-orange-glow-sm'
                        : 'border-neutral-300 dark:border-[#252530] text-neutral-800 dark:text-neutral-300 hover:border-neutral-400 bg-neutral-100 dark:bg-[#121218]'
                    }`}
                  >
                    {w}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Orientation for Pads and Gloves */}
          {['pads', 'gloves'].includes(categoryLower) && (
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-neutral-700 dark:text-neutral-300 mb-2.5">
                Batting Hand Orientation
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                {['Right Hand', 'Left Hand'].map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setSelectedOrientation(opt)}
                    className={`py-2.5 px-3 text-xs font-black uppercase tracking-wider rounded-xl border text-center transition-all ${
                      selectedOrientation === opt
                        ? 'border-[#FF5500] bg-[#FF5500] text-white shadow-orange-glow-sm'
                        : 'border-neutral-300 dark:border-[#252530] text-neutral-800 dark:text-neutral-300 hover:border-neutral-400 bg-neutral-100 dark:bg-[#121218]'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Generic Size for Pads, Gloves, Helmets, Shoes */}
          {['pads', 'gloves', 'helmets', 'shoes'].includes(categoryLower) && (
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-neutral-700 dark:text-neutral-300 mb-2.5">
                Equipment Size
              </label>
              <div className="flex flex-wrap gap-2.5">
                {(categoryLower === 'shoes'
                  ? ['UK 8', 'UK 9', 'UK 10', 'UK 11', 'UK 12']
                  : categoryLower === 'helmets'
                  ? ['Small (55-58cm)', 'Medium (58-61cm)', 'Large (60-63cm)']
                  : ['Youth', 'Adult / Men', 'Large Men']
                ).map((sz) => (
                  <button
                    key={sz}
                    onClick={() => setSelectedSize(sz)}
                    className={`py-2.5 px-3.5 text-xs font-black uppercase tracking-wider rounded-xl border text-center transition-all ${
                      selectedSize === sz
                        ? 'border-[#FF5500] bg-[#FF5500] text-white shadow-orange-glow-sm'
                        : 'border-neutral-300 dark:border-[#252530] text-neutral-800 dark:text-neutral-300 hover:border-neutral-400 bg-neutral-100 dark:bg-[#121218]'
                    }`}
                  >
                    {sz}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Quantity and Add to Cart Action */}
        <div className="pt-4 flex flex-col sm:flex-row gap-4">
          <div className="flex items-center border border-neutral-300 dark:border-[#272732] rounded-xl bg-neutral-100 dark:bg-[#121218] p-1 shadow-sm">
            <button
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              disabled={quantity <= 1 || product.stock_quantity <= 0}
              className="w-10 h-10 flex items-center justify-center text-neutral-600 hover:text-black dark:text-neutral-400 dark:hover:text-white rounded-lg hover:bg-neutral-200 dark:hover:bg-[#1C1C24] disabled:opacity-30 font-bold"
              aria-label="Decrease quantity"
            >
              −
            </button>
            <span className="w-12 text-center font-bold text-black dark:text-white text-sm" aria-hidden="true">
              {quantity}
            </span>
            <button
              onClick={() => setQuantity((q) => Math.min(product.stock_quantity, q + 1))}
              disabled={quantity >= product.stock_quantity || product.stock_quantity <= 0}
              className="w-10 h-10 flex items-center justify-center text-neutral-600 hover:text-black dark:text-neutral-400 dark:hover:text-white rounded-lg hover:bg-neutral-200 dark:hover:bg-[#1C1C24] disabled:opacity-30 font-bold"
              aria-label="Increase quantity"
            >
              +
            </button>
          </div>

          <button
            onClick={handleAddToCart}
            disabled={product.stock_quantity <= 0}
            className={`flex-1 py-4 px-8 rounded-xl font-black uppercase text-sm tracking-widest flex items-center justify-center space-x-2.5 transition-all duration-200 active:scale-[0.98] ${
              product.stock_quantity <= 0
                ? 'bg-neutral-300 dark:bg-neutral-800 text-neutral-500 cursor-not-allowed'
                : addedAnimation
                ? 'bg-emerald-500 text-white shadow-lg'
                : 'bg-[#FF5500] hover:bg-[#FF6600] text-white shadow-orange-glow'
            }`}
          >
            {addedAnimation ? (
              <>
                <Check className="w-5 h-5 animate-in zoom-in-50" />
                <span>Added to Cricket Cart!</span>
              </>
            ) : (
              <>
                <ShoppingBag className="w-5 h-5 text-white" />
                <span>Add to Cricket Cart</span>
              </>
            )}
          </button>
        </div>

        {/* Assurance Cards */}
        <div className="bg-white dark:bg-[#0E0E14] border border-neutral-200 dark:border-[#22222A] rounded-2xl p-5 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-neutral-600 dark:text-neutral-400 shadow-sm">
          <div className="flex items-center space-x-2.5">
            <ShieldCheck className="w-4 h-4 text-[#FF5500] shrink-0" />
            <span className="font-semibold text-neutral-800 dark:text-neutral-300">Certified Manufacturer Warranty</span>
          </div>
          <div className="flex items-center space-x-2.5">
            <Truck className="w-4 h-4 text-[#FF5500] shrink-0" />
            <span className="font-semibold text-neutral-800 dark:text-neutral-300">Tracked Courier Dispatch</span>
          </div>
          <div className="flex items-center space-x-2.5">
            <RefreshCw className="w-4 h-4 text-[#FF5500] shrink-0" />
            <span className="font-semibold text-neutral-800 dark:text-neutral-300">Card (Stripe) & Cash on Delivery</span>
          </div>
        </div>
      </div>
    </div>
  );
};
