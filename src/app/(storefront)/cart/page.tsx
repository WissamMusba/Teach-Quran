'use client';

import React from 'react';
import Link from 'next/link';
import { useCart } from '@/context/CartContext';
import { ShoppingBag, ArrowRight, Trash2, Plus, Minus, ArrowLeft, ShieldCheck, Truck } from 'lucide-react';

export default function CartPage() {
  const { cart, updateQuantity, removeFromCart, clearCart, totalAmount, totalItems } = useCart();

  if (cart.length === 0) {
    return (
      <div className="bg-neutral-50/50 min-h-[70vh] flex items-center justify-center py-16 px-4">
        <div className="max-w-md w-full bg-white border border-neutral-200 rounded-2xl p-8 text-center space-y-5 shadow-xs">
          <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mx-auto text-neutral-400">
            <ShoppingBag className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-neutral-900">Your Cricket Cart is Empty</h2>
            <p className="text-sm text-neutral-500 mt-2">
              Browse our catalog of Grade 1 bats, match balls, pads, and equipment to get started.
            </p>
          </div>
          <Link
            href="/shop"
            className="inline-flex items-center justify-center w-full py-3 px-4 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-semibold text-sm transition-all shadow-sm"
          >
            Explore Equipment Catalog
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-neutral-50/50 min-h-screen py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-neutral-200 mb-8 gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-neutral-900 tracking-tight">
              Review Your Cricket Cart
            </h1>
            <p className="text-sm text-neutral-500 mt-1">
              {totalItems} item{totalItems > 1 ? 's' : ''} ready for dispatch.
            </p>
          </div>

          <button
            onClick={clearCart}
            className="text-xs text-neutral-500 hover:text-red-600 self-start sm:self-auto font-medium transition-colors"
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
                className="bg-white border border-neutral-200 rounded-xl p-5 flex flex-col sm:flex-row gap-5 items-start sm:items-center shadow-xs"
              >
                {/* Image */}
                <div className="w-24 h-24 bg-neutral-50 rounded-lg border border-neutral-200 shrink-0 overflow-hidden flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.image} alt={item.title} className="w-full h-full object-cover" />
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/product/${item.slug}`}
                    className="font-bold text-neutral-900 hover:text-orange-600 text-base transition-colors line-clamp-1"
                  >
                    {item.title}
                  </Link>

                  {item.selectedOptions && Object.keys(item.selectedOptions).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {Object.entries(item.selectedOptions).map(([k, v]) => (
                        <span
                          key={k}
                          className="text-xs bg-neutral-100 text-neutral-700 px-2 py-0.5 rounded capitalize font-medium"
                        >
                          {k}: {v}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="text-xs text-neutral-400 mt-2">
                    Unit Price: ${item.price.toFixed(2)}
                  </div>
                </div>

                {/* Quantity Controls & Line Total */}
                <div className="flex items-center justify-between sm:justify-end space-x-6 w-full sm:w-auto pt-3 sm:pt-0 border-t sm:border-t-0 border-neutral-100">
                  <div className="flex items-center border border-neutral-200 rounded-lg bg-neutral-50 p-0.5">
                    <button
                      onClick={() => updateQuantity(item.productId, item.quantity - 1, item.selectedOptions)}
                      className="p-1.5 text-neutral-600 hover:text-neutral-900 rounded hover:bg-white"
                      aria-label="Decrease quantity"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-xs font-bold px-3 text-neutral-900">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.productId, item.quantity + 1, item.selectedOptions)}
                      disabled={item.quantity >= item.maxStock}
                      className="p-1.5 text-neutral-600 hover:text-neutral-900 rounded hover:bg-white disabled:opacity-40"
                      aria-label="Increase quantity"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="text-right">
                    <span className="font-bold text-neutral-900 text-base block">
                      ${(item.price * item.quantity).toFixed(2)}
                    </span>
                  </div>

                  <button
                    onClick={() => removeFromCart(item.productId, item.selectedOptions)}
                    className="text-neutral-400 hover:text-red-600 transition-colors p-1"
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
                className="inline-flex items-center space-x-1.5 text-xs font-bold text-neutral-700 hover:text-orange-600 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Continue Shopping</span>
              </Link>
            </div>
          </div>

          {/* Order Summary Card */}
          <div className="lg:col-span-1">
            <div className="bg-white border border-neutral-200 rounded-2xl p-6 space-y-6 shadow-xs sticky top-24">
              <h3 className="font-bold text-base text-neutral-900 pb-3 border-b border-neutral-100">
                Order Summary
              </h3>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between text-neutral-600">
                  <span>Items Subtotal</span>
                  <span className="font-semibold text-neutral-900">${totalAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-neutral-600">
                  <span>Shipping & Handling</span>
                  <span className="font-semibold text-emerald-600">Calculated Next</span>
                </div>
                <div className="pt-3 border-t border-neutral-100 flex justify-between items-baseline">
                  <span className="font-bold text-base text-neutral-900">Total</span>
                  <span className="font-black text-2xl text-neutral-900">
                    ${totalAmount.toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="pt-2">
                <Link
                  href="/checkout"
                  className="w-full py-3.5 px-4 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-xl text-sm transition-all shadow-md flex items-center justify-center space-x-2 active:scale-98"
                >
                  <span>Proceed to Checkout</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>

              <div className="pt-4 border-t border-neutral-100 space-y-2 text-xs text-neutral-500">
                <div className="flex items-center space-x-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Stripe Card Security (Visa / Mastercard)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Truck className="w-4 h-4 text-orange-600 shrink-0" />
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
