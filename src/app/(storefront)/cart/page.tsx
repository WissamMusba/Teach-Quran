'use client';

import React from 'react';
import Link from 'next/link';
import { useCart } from '@/context/CartContext';
import { ShoppingBag, ArrowRight, Trash2, Plus, Minus, ArrowLeft, ShieldCheck, Truck } from 'lucide-react';

export default function CartPage() {
  const { cart, updateQuantity, removeFromCart, clearCart, totalAmount, totalItems } = useCart();

  if (cart.length === 0) {
    return (
      <div className="bg-[#050505] text-white min-h-[75vh] flex items-center justify-center py-16 px-4">
        <div className="max-w-md w-full bg-[#0E0E14] border border-[#22222A] rounded-3xl p-10 text-center space-y-6 shadow-2xl">
          <div className="w-16 h-16 bg-[#16161E] border border-[#262630] rounded-2xl flex items-center justify-center mx-auto text-[#FF5500]">
            <ShoppingBag className="w-8 h-8" />
          </div>
          <div>
            <h2 className="font-display uppercase text-2xl sm:text-3xl font-black text-white">
              Your Cricket Cart is Empty
            </h2>
            <p className="text-xs sm:text-sm text-neutral-400 mt-2">
              Browse our catalog of Grade 1 bats, match balls, pads, and equipment to get started.
            </p>
          </div>
          <Link
            href="/shop"
            className="inline-flex items-center justify-center w-full py-3.5 px-4 rounded-xl bg-[#FF5500] hover:bg-[#FF6600] text-black font-black uppercase tracking-wider text-xs transition-all shadow-orange-glow-sm"
          >
            Explore Equipment Catalog
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#050505] text-white min-h-screen py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-[#1C1C24] mb-10 gap-4">
          <div>
            <h1 className="font-display uppercase text-3xl sm:text-5xl font-black text-white tracking-tight">
              Review Your Cricket Cart
            </h1>
            <p className="text-xs sm:text-sm text-neutral-400 mt-1">
              {totalItems} item{totalItems > 1 ? 's' : ''} ready for international match dispatch.
            </p>
          </div>

          <button
            onClick={clearCart}
            className="text-xs font-black uppercase tracking-wider text-neutral-400 hover:text-red-400 self-start sm:self-auto transition-colors"
          >
            Clear All Items
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* Cart Items List */}
          <div className="lg:col-span-2 space-y-4">
            {cart.map((item, idx) => (
              <div
                key={`${item.productId}-${idx}`}
                className="bg-[#0E0E14] border border-[#22222A] rounded-2xl p-6 flex flex-col sm:flex-row gap-6 items-start sm:items-center shadow-lg hover:border-[#2E2E38] transition-colors"
              >
                {/* Image */}
                <div className="w-24 h-24 bg-[#14141B] rounded-xl border border-[#252530] shrink-0 overflow-hidden flex items-center justify-center p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.image} alt={item.title} className="w-full h-full object-contain" />
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/product/${item.slug}`}
                    className="font-display uppercase tracking-wide font-black text-white hover:text-[#FF5500] text-lg transition-colors line-clamp-1"
                  >
                    {item.title}
                  </Link>

                  {item.selectedOptions && Object.keys(item.selectedOptions).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {Object.entries(item.selectedOptions).map(([k, v]) => (
                        <span
                          key={k}
                          className="text-xs bg-[#16161E] border border-[#252530] text-neutral-300 px-2 py-0.5 rounded capitalize font-medium"
                        >
                          {k}: {v}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="text-xs text-neutral-400 mt-2 font-mono">
                    Unit Price: AED {item.price.toLocaleString()}
                  </div>
                </div>

                {/* Quantity Controls & Line Total */}
                <div className="flex items-center justify-between sm:justify-end space-x-6 w-full sm:w-auto pt-4 sm:pt-0 border-t sm:border-t-0 border-[#1C1C24]">
                  <div className="flex items-center border border-[#272730] rounded-xl bg-[#121218] p-1">
                    <button
                      onClick={() => updateQuantity(item.productId, item.quantity - 1, item.selectedOptions)}
                      className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-[#1C1C24]"
                      aria-label="Decrease quantity"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-xs font-bold px-3 text-white">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.productId, item.quantity + 1, item.selectedOptions)}
                      disabled={item.quantity >= item.maxStock}
                      className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-[#1C1C24] disabled:opacity-40"
                      aria-label="Increase quantity"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="text-right">
                    <div className="flex items-baseline space-x-1 justify-end">
                      <span className="text-xs font-black text-[#FF5500]">AED</span>
                      <span className="font-display text-2xl font-black text-white block">
                        {(item.price * item.quantity).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => removeFromCart(item.productId, item.selectedOptions)}
                    className="text-neutral-500 hover:text-red-400 transition-colors p-1"
                    title="Remove item"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}

            <div className="pt-2">
              <Link
                href="/shop"
                className="inline-flex items-center space-x-2 text-xs font-black uppercase tracking-wider text-neutral-400 hover:text-[#FF5500] transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Continue Shopping Equipment</span>
              </Link>
            </div>
          </div>

          {/* Order Summary Card */}
          <div className="lg:col-span-1">
            <div className="bg-[#0E0E14] border border-[#22222A] rounded-3xl p-6 space-y-6 shadow-2xl sticky top-28">
              <h3 className="font-display uppercase text-2xl font-black text-white pb-4 border-b border-[#1C1C24]">
                Order Summary
              </h3>

              <div className="space-y-3.5 text-xs">
                <div className="flex justify-between text-neutral-400">
                  <span className="uppercase tracking-wider font-bold">Items Subtotal</span>
                  <span className="font-bold text-white font-mono text-sm">AED {totalAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-neutral-400">
                  <span className="uppercase tracking-wider font-bold">Tracked Courier</span>
                  <span className="font-bold text-[#FF5500] uppercase">Free Match Dispatch</span>
                </div>
                <div className="pt-4 border-t border-[#1C1C24] flex justify-between items-baseline">
                  <span className="font-display uppercase text-lg font-black text-white">Total</span>
                  <div className="flex items-baseline space-x-1">
                    <span className="text-sm font-black text-[#FF5500]">AED</span>
                    <span className="font-display text-4xl font-black text-white">
                      {totalAmount.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <Link
                  href="/checkout"
                  className="w-full py-4 px-4 bg-[#FF5500] hover:bg-[#FF6600] text-black font-black uppercase tracking-widest rounded-xl text-xs transition-all shadow-orange-glow flex items-center justify-center space-x-2 active:scale-98"
                >
                  <span>Proceed to Checkout</span>
                  <ArrowRight className="w-4 h-4 text-black" />
                </Link>
              </div>

              <div className="pt-4 border-t border-[#1C1C24] space-y-2.5 text-xs text-neutral-400">
                <div className="flex items-center space-x-2.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Stripe Card Security (Visa / Mastercard)</span>
                </div>
                <div className="flex items-center space-x-2.5">
                  <Truck className="w-4 h-4 text-[#FF5500] shrink-0" />
                  <span>Cash on Delivery (COD) Supported</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
