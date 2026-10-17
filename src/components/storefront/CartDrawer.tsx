'use client';

import React from 'react';
import Link from 'next/link';
import { useCart } from '@/context/CartContext';
import { X, ShoppingBag, Plus, Minus, Trash2, ArrowRight } from 'lucide-react';

export const CartDrawer: React.FC = () => {
  const {
    cart,
    isCartDrawerOpen,
    setIsCartDrawerOpen,
    updateQuantity,
    removeFromCart,
    totalAmount,
    totalItems,
  } = useCart();

  if (!isCartDrawerOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-neutral-900/60 transition-opacity backdrop-blur-sm"
        onClick={() => setIsCartDrawerOpen(false)}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col">
          {/* Header */}
          <div className="p-5 border-b border-neutral-200 flex items-center justify-between bg-neutral-50/50">
            <div className="flex items-center space-x-2">
              <ShoppingBag className="w-5 h-5 text-orange-600" />
              <h2 className="text-lg font-bold text-neutral-900">Your Cricket Cart</h2>
              <span className="bg-orange-100 text-orange-700 text-xs px-2 py-0.5 rounded-full font-semibold">
                {totalItems}
              </span>
            </div>
            <button
              onClick={() => setIsCartDrawerOpen(false)}
              className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 transition-colors"
              aria-label="Close cart"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Cart Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4 divide-y divide-neutral-100">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4">
                <div className="w-16 h-16 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-400">
                  <ShoppingBag className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="font-semibold text-neutral-900 text-base">Your cart is empty</h3>
                  <p className="text-sm text-neutral-500 mt-1">
                    Select tournament-grade bats, protective pads, and gear from our catalog.
                  </p>
                </div>
                <Link
                  href="/shop"
                  onClick={() => setIsCartDrawerOpen(false)}
                  className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-medium text-sm transition-colors shadow-sm"
                >
                  Browse Catalog
                </Link>
              </div>
            ) : (
              cart.map((item, index) => (
                <div key={`${item.productId}-${index}`} className="pt-4 first:pt-0 flex space-x-4">
                  {/* Thumbnail */}
                  <div className="w-20 h-20 bg-neutral-50 rounded-lg border border-neutral-200 overflow-hidden shrink-0 flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.image}
                      alt={item.title}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/product/${item.slug}`}
                      onClick={() => setIsCartDrawerOpen(false)}
                      className="font-medium text-sm text-neutral-900 hover:text-orange-600 line-clamp-1 transition-colors"
                    >
                      {item.title}
                    </Link>

                    {item.selectedOptions && Object.keys(item.selectedOptions).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {Object.entries(item.selectedOptions).map(([key, val]) => (
                          <span
                            key={key}
                            className="inline-block text-[11px] bg-neutral-100 text-neutral-600 px-1.5 py-0.5 rounded capitalize"
                          >
                            {key}: {val}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="mt-2 flex items-center justify-between">
                      <span className="font-bold text-sm text-neutral-900">
                        ${(item.price * item.quantity).toFixed(2)}
                      </span>

                      {/* Quantity Controls */}
                      <div className="flex items-center space-x-1 border border-neutral-200 rounded-lg p-0.5 bg-white">
                        <button
                          onClick={() => updateQuantity(item.productId, item.quantity - 1, item.selectedOptions)}
                          className="p-1 text-neutral-500 hover:text-neutral-900 rounded hover:bg-neutral-100"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-xs font-semibold px-2 text-neutral-800">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.productId, item.quantity + 1, item.selectedOptions)}
                          disabled={item.quantity >= item.maxStock}
                          className="p-1 text-neutral-500 hover:text-neutral-900 rounded hover:bg-neutral-100 disabled:opacity-40"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <button
                        onClick={() => removeFromCart(item.productId, item.selectedOptions)}
                        className="text-neutral-400 hover:text-red-600 p-1 transition-colors"
                        title="Remove item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {cart.length > 0 && (
            <div className="p-5 border-t border-neutral-200 bg-neutral-50 space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-neutral-600">Subtotal</span>
                <span className="font-bold text-lg text-neutral-900">
                  ${totalAmount.toFixed(2)}
                </span>
              </div>
              <p className="text-xs text-neutral-500">
                Taxes and shipping calculated at checkout. Card (Visa/Mastercard) and COD available.
              </p>

              <div className="grid grid-cols-2 gap-2 pt-2">
                <Link
                  href="/cart"
                  onClick={() => setIsCartDrawerOpen(false)}
                  className="w-full text-center py-2.5 px-4 border border-neutral-300 text-neutral-800 rounded-lg font-medium text-sm hover:bg-white hover:border-neutral-400 transition-colors"
                >
                  View Cart
                </Link>
                <Link
                  href="/checkout"
                  onClick={() => setIsCartDrawerOpen(false)}
                  className="w-full flex items-center justify-center space-x-1 py-2.5 px-4 bg-orange-600 hover:bg-orange-500 text-white rounded-lg font-semibold text-sm transition-colors shadow-sm"
                >
                  <span>Checkout</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
