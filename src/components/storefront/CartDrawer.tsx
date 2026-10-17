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
        className="fixed inset-0 bg-black/80 transition-opacity backdrop-blur-sm"
        onClick={() => setIsCartDrawerOpen(false)}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-[#0A0A0E] border-l border-[#22222A] text-white shadow-2xl flex flex-col">
          {/* Header */}
          <div className="p-6 border-b border-[#1C1C24] flex items-center justify-between bg-[#08080C]">
            <div className="flex items-center space-x-2.5">
              <ShoppingBag className="w-5 h-5 text-[#FF5500]" />
              <h2 className="font-display uppercase text-2xl font-black text-white tracking-wide">
                Your Cricket Cart
              </h2>
              <span className="bg-[#FF5500] text-black text-xs px-2 py-0.5 rounded-full font-black">
                {totalItems}
              </span>
            </div>
            <button
              onClick={() => setIsCartDrawerOpen(false)}
              className="p-1.5 rounded-xl text-neutral-400 hover:text-white hover:bg-[#16161E] transition-colors"
              aria-label="Close cart"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Cart Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4 divide-y divide-[#1C1C24]">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-5">
                <div className="w-16 h-16 rounded-2xl bg-[#14141A] border border-[#272732] flex items-center justify-center text-[#FF5500]">
                  <ShoppingBag className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="font-display uppercase text-xl font-black text-white">
                    Your cart is empty
                  </h3>
                  <p className="text-xs text-neutral-400 mt-1 max-w-xs">
                    Select tournament-grade bats, protective pads, and gear from our catalog.
                  </p>
                </div>
                <Link
                  href="/shop"
                  onClick={() => setIsCartDrawerOpen(false)}
                  className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-[#FF5500] hover:bg-[#FF6600] text-black font-black uppercase tracking-wider text-xs transition-colors shadow-orange-glow-sm"
                >
                  Browse Catalog
                </Link>
              </div>
            ) : (
              cart.map((item, index) => (
                <div key={`${item.productId}-${index}`} className="pt-4 first:pt-0 flex space-x-4">
                  {/* Thumbnail */}
                  <div className="w-20 h-20 bg-[#14141A] rounded-xl border border-[#252530] overflow-hidden shrink-0 flex items-center justify-center p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.image}
                      alt={item.title}
                      className="w-full h-full object-contain"
                    />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/product/${item.slug}`}
                      onClick={() => setIsCartDrawerOpen(false)}
                      className="font-display uppercase tracking-wide font-bold text-sm text-white hover:text-[#FF5500] line-clamp-1 transition-colors"
                    >
                      {item.title}
                    </Link>

                    {item.selectedOptions && Object.keys(item.selectedOptions).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {Object.entries(item.selectedOptions).map(([key, val]) => (
                          <span
                            key={key}
                            className="inline-block text-[10px] bg-[#16161E] border border-[#252530] text-neutral-300 px-1.5 py-0.5 rounded capitalize"
                          >
                            {key}: {val}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="mt-2.5 flex items-center justify-between">
                      <span className="font-display text-lg font-black text-white">
                        ${(item.price * item.quantity).toFixed(2)}
                      </span>

                      {/* Quantity Controls */}
                      <div className="flex items-center space-x-1 border border-[#272730] rounded-xl p-0.5 bg-[#121218]">
                        <button
                          onClick={() =>
                            updateQuantity(item.productId, item.quantity - 1, item.selectedOptions)
                          }
                          className="p-1 text-neutral-400 hover:text-white rounded-lg hover:bg-[#1C1C24]"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-xs font-bold px-2 text-white">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() =>
                            updateQuantity(item.productId, item.quantity + 1, item.selectedOptions)
                          }
                          disabled={item.quantity >= item.maxStock}
                          className="p-1 text-neutral-400 hover:text-white rounded-lg hover:bg-[#1C1C24] disabled:opacity-30"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <button
                        onClick={() => removeFromCart(item.productId, item.selectedOptions)}
                        className="text-neutral-500 hover:text-red-400 p-1 transition-colors"
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
            <div className="p-6 border-t border-[#1C1C24] bg-[#08080C] space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                  Subtotal
                </span>
                <span className="font-display text-3xl font-black text-white">
                  ${totalAmount.toFixed(2)}
                </span>
              </div>
              <p className="text-[11px] text-neutral-400">
                Taxes and shipping calculated at checkout. Card (Visa/Mastercard) and COD available.
              </p>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <Link
                  href="/cart"
                  onClick={() => setIsCartDrawerOpen(false)}
                  className="w-full text-center py-3 px-4 border border-[#272730] bg-[#121218] text-white rounded-xl font-bold uppercase tracking-wider text-xs hover:border-neutral-400 transition-colors"
                >
                  View Cart
                </Link>
                <Link
                  href="/checkout"
                  onClick={() => setIsCartDrawerOpen(false)}
                  className="w-full flex items-center justify-center space-x-1.5 py-3 px-4 bg-[#FF5500] hover:bg-[#FF6600] text-black rounded-xl font-black uppercase tracking-wider text-xs transition-colors shadow-orange-glow-sm"
                >
                  <span>Checkout</span>
                  <ArrowRight className="w-4 h-4 text-black" />
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
