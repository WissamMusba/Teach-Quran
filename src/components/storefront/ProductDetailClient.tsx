'use client';

import React, { useState } from 'react';
import { Product } from '@/lib/types';
import { useCart } from '@/context/CartContext';
import { ShoppingBag, ShieldCheck, Truck, RefreshCw, Check, AlertCircle } from 'lucide-react';

interface ProductDetailClientProps {
  product: Product;
}

export const ProductDetailClient: React.FC<ProductDetailClientProps> = ({ product }) => {
  const { addToCart } = useCart();
  const [selectedImage, setSelectedImage] = useState<string>(
    product.images?.[0] || 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?q=80&w=800&auto=format&fit=crop'
  );
  const [quantity, setQuantity] = useState<number>(1);
  const [addedAnimation, setAddedAnimation] = useState<boolean>(false);

  // Variant selection states
  const categoryLower = product.category.toLowerCase();
  const [selectedSize, setSelectedSize] = useState<string>(
    categoryLower === 'bats'
      ? 'Short Handle'
      : categoryLower === 'shoes'
      ? 'UK 9'
      : categoryLower === 'helmets'
      ? 'Medium (58-61cm)'
      : 'Adult / Men'
  );

  const [selectedWeight, setSelectedWeight] = useState<string>(
    categoryLower === 'bats' ? '2lb 8oz - 2lb 9oz' : ''
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
        {/* Main Display */}
        <div className="aspect-square bg-white border border-neutral-200 rounded-2xl overflow-hidden flex items-center justify-center p-4 shadow-xs relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={selectedImage}
            alt={product.title}
            className="w-full h-full object-contain hover:scale-105 transition-transform duration-300"
          />

          <span className="absolute top-4 left-4 bg-neutral-900 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
            {product.brand}
          </span>
        </div>

        {/* Thumbnail Selector */}
        {product.images && product.images.length > 1 && (
          <div className="flex space-x-3 overflow-x-auto pb-2">
            {product.images.map((img, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedImage(img)}
                className={`w-20 h-20 rounded-xl border-2 overflow-hidden shrink-0 bg-white transition-all ${
                  selectedImage === img
                    ? 'border-orange-600 ring-2 ring-orange-500/20'
                    : 'border-neutral-200 hover:border-neutral-400'
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img} alt={`${product.title} thumbnail ${idx + 1}`} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Right Column: Product Information & Purchase Panel */}
      <div className="space-y-6">
        <div>
          <div className="flex items-center space-x-2 text-xs uppercase tracking-wider font-bold text-orange-600 mb-1.5">
            <span>{product.category}</span>
            <span>•</span>
            <span>{product.brand}</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black text-neutral-900 tracking-tight leading-tight">
            {product.title}
          </h1>

          <div className="mt-4 flex items-baseline space-x-3">
            <span className="text-3xl font-black text-neutral-900">
              ${product.price.toFixed(2)}
            </span>
            <span className="text-xs text-neutral-500">Standard Price (USD)</span>
          </div>
        </div>

        {/* Stock Status */}
        <div className="flex items-center space-x-2 text-sm">
          {product.stock_quantity > 0 ? (
            <div className="flex items-center space-x-1.5 text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full font-semibold text-xs border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
              <span>In Stock ({product.stock_quantity} available for dispatch)</span>
            </div>
          ) : (
            <div className="flex items-center space-x-1.5 text-red-700 bg-red-50 px-3 py-1 rounded-full font-semibold text-xs border border-red-200">
              <AlertCircle className="w-4 h-4 text-red-500" />
              <span>Currently Out of Stock</span>
            </div>
          )}
        </div>

        {/* Product Description */}
        {product.description && (
          <p className="text-sm text-neutral-600 leading-relaxed border-t border-b border-neutral-100 py-4">
            {product.description}
          </p>
        )}

        {/* Variants / Options */}
        <div className="space-y-4 pt-2">
          {/* Bats Size / Handle Option */}
          {categoryLower === 'bats' && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-800 mb-2">
                Handle & Size
              </label>
              <div className="grid grid-cols-3 gap-2">
                {['Short Handle', 'Harrow', 'Long Handle'].map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setSelectedSize(opt)}
                    className={`py-2 px-3 text-xs font-semibold rounded-lg border text-center transition-all ${
                      selectedSize === opt
                        ? 'border-orange-600 bg-orange-50 text-orange-600 ring-1 ring-orange-600'
                        : 'border-neutral-200 text-neutral-700 hover:border-neutral-300 bg-white'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Bat Weight Option */}
          {categoryLower === 'bats' && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-800 mb-2">
                Bat Weight Profile
              </label>
              <div className="grid grid-cols-3 gap-2">
                {['2lb 7oz - 2lb 8oz', '2lb 8oz - 2lb 9oz', '2lb 10oz+'].map((w) => (
                  <button
                    key={w}
                    onClick={() => setSelectedWeight(w)}
                    className={`py-2 px-3 text-xs font-semibold rounded-lg border text-center transition-all ${
                      selectedWeight === w
                        ? 'border-orange-600 bg-orange-50 text-orange-600 ring-1 ring-orange-600'
                        : 'border-neutral-200 text-neutral-700 hover:border-neutral-300 bg-white'
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
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-800 mb-2">
                Batting Hand Orientation
              </label>
              <div className="grid grid-cols-2 gap-2">
                {['Right Hand', 'Left Hand'].map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setSelectedOrientation(opt)}
                    className={`py-2 px-3 text-xs font-semibold rounded-lg border text-center transition-all ${
                      selectedOrientation === opt
                        ? 'border-orange-600 bg-orange-50 text-orange-600 ring-1 ring-orange-600'
                        : 'border-neutral-200 text-neutral-700 hover:border-neutral-300 bg-white'
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
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-800 mb-2">
                Equipment Size
              </label>
              <div className="flex flex-wrap gap-2">
                {(categoryLower === 'shoes'
                  ? ['UK 8', 'UK 9', 'UK 10', 'UK 11', 'UK 12']
                  : categoryLower === 'helmets'
                  ? ['Small (55-58cm)', 'Medium (58-61cm)', 'Large (60-63cm)']
                  : ['Youth', 'Adult / Men', 'Large Men']
                ).map((sz) => (
                  <button
                    key={sz}
                    onClick={() => setSelectedSize(sz)}
                    className={`py-2 px-3 text-xs font-semibold rounded-lg border text-center transition-all ${
                      selectedSize === sz
                        ? 'border-orange-600 bg-orange-50 text-orange-600 ring-1 ring-orange-600'
                        : 'border-neutral-200 text-neutral-700 hover:border-neutral-300 bg-white'
                    }`}
                  >
                    {sz}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Quantity and Add to Cart Button */}
        <div className="pt-4 flex flex-col sm:flex-row gap-3">
          <div className="flex items-center border border-neutral-300 rounded-xl bg-white p-1">
            <button
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              disabled={quantity <= 1 || product.stock_quantity <= 0}
              className="w-10 h-10 flex items-center justify-center text-neutral-600 hover:text-neutral-900 rounded-lg hover:bg-neutral-100 disabled:opacity-30"
            >
              -
            </button>
            <span className="w-12 text-center font-bold text-neutral-900 text-sm">
              {quantity}
            </span>
            <button
              onClick={() => setQuantity((q) => Math.min(product.stock_quantity, q + 1))}
              disabled={quantity >= product.stock_quantity || product.stock_quantity <= 0}
              className="w-10 h-10 flex items-center justify-center text-neutral-600 hover:text-neutral-900 rounded-lg hover:bg-neutral-100 disabled:opacity-30"
            >
              +
            </button>
          </div>

          <button
            onClick={handleAddToCart}
            disabled={product.stock_quantity <= 0}
            className={`flex-1 py-3.5 px-6 rounded-xl font-bold text-sm tracking-wide flex items-center justify-center space-x-2 transition-all shadow-md active:scale-98 ${
              product.stock_quantity <= 0
                ? 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
                : addedAnimation
                ? 'bg-emerald-600 text-white'
                : 'bg-orange-600 hover:bg-orange-500 text-white'
            }`}
          >
            {addedAnimation ? (
              <>
                <Check className="w-5 h-5 animate-in zoom-in-50" />
                <span>Added to Cart!</span>
              </>
            ) : (
              <>
                <ShoppingBag className="w-5 h-5" />
                <span>Add to Cricket Cart</span>
              </>
            )}
          </button>
        </div>

        {/* Assurance Box */}
        <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-neutral-600">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-orange-600 shrink-0" />
            <span>Genuine Manufacturer Warranty</span>
          </div>
          <div className="flex items-center space-x-2">
            <Truck className="w-4 h-4 text-orange-600 shrink-0" />
            <span>Tracked Courier Dispatch</span>
          </div>
          <div className="flex items-center space-x-2">
            <RefreshCw className="w-4 h-4 text-orange-600 shrink-0" />
            <span>Card (Stripe) & Cash on Delivery</span>
          </div>
        </div>

        {/* Technical Specifications */}
        {product.specifications && Object.keys(product.specifications).length > 0 && (
          <div className="border border-neutral-200 rounded-xl p-5 bg-white space-y-3">
            <h3 className="font-bold text-sm text-neutral-900 uppercase tracking-wider">
              Technical Specifications
            </h3>
            <div className="divide-y divide-neutral-100">
              {Object.entries(product.specifications).map(([key, value]) => (
                <div key={key} className="py-2 flex justify-between text-xs">
                  <span className="font-medium text-neutral-500 capitalize">{key.replace('_', ' ')}</span>
                  <span className="font-bold text-neutral-900 text-right">{value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
