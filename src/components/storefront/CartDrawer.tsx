'use client';

import React, { useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useCart } from '@/context/CartContext';
import { X, ShoppingBag, Plus, Minus, Trash2, ArrowRight } from 'lucide-react';

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

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

  const panelRef = useRef<HTMLDivElement>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);

  // Dialog behaviour: Esc closes, background scroll locks, focus moves into
  // the panel on open and returns to the trigger on close, Tab stays inside.
  useEffect(() => {
    if (!isCartDrawerOpen) return;

    lastFocusedRef.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const panel = panelRef.current;
    panel?.querySelector<HTMLElement>(FOCUSABLE)?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setIsCartDrawerOpen(false);
        return;
      }
      if (e.key !== 'Tab' || !panel) return;

      const focusables = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null
      );
      if (focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      lastFocusedRef.current?.focus?.();
    };
  }, [isCartDrawerOpen, setIsCartDrawerOpen]);

  if (!isCartDrawerOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 transition-opacity backdrop-blur-sm"
        onClick={() => setIsCartDrawerOpen(false)}
        aria-hidden="true"
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="cart-drawer-title"
          className="w-screen max-w-md bg-white text-neutral-900 border-l border-neutral-200 dark:bg-[#0A0A0E] dark:border-[#22222A] dark:text-white shadow-2xl flex flex-col transition-colors duration-200"
        >
          {/* Header */}
          <div className="p-6 border-b border-neutral-200 dark:border-[#1C1C24] flex items-center justify-between bg-neutral-50 dark:bg-[#08080C]">
            <div className="flex items-center space-x-2.5">
              <ShoppingBag className="w-5 h-5 text-[#FF5500]" aria-hidden="true" />
              <h2
                id="cart-drawer-title"
                className="font-display uppercase text-2xl font-black text-black dark:text-white tracking-wide"
              >
                Your Cricket Cart
              </h2>
              <span className="bg-[#FF5500] text-white text-xs px-2 py-0.5 rounded-full font-black">
                {totalItems}
              </span>
            </div>
            <button
              onClick={() => setIsCartDrawerOpen(false)}
              className="p-2 rounded-xl text-neutral-500 hover:text-black hover:bg-neutral-200 dark:text-neutral-400 dark:hover:text-white dark:hover:bg-[#16161E] transition-colors"
              aria-label="Close cart"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Cart Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4 divide-y divide-neutral-200 dark:divide-[#1C1C24]">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-5">
                <div className="w-16 h-16 rounded-2xl bg-neutral-100 dark:bg-[#14141A] border border-neutral-200 dark:border-[#272732] flex items-center justify-center text-[#FF5500]">
                  <ShoppingBag className="w-8 h-8" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="font-display uppercase text-xl font-black text-black dark:text-white">
                    Your cart is empty
                  </h3>
                  <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1 max-w-xs">
                    Select tournament-grade bats, protective pads, and gear from our catalog.
                  </p>
                </div>
                <Link
                  href="/shop"
                  onClick={() => setIsCartDrawerOpen(false)}
                  className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-[#FF5500] hover:bg-[#FF6600] text-white font-black uppercase tracking-wider text-xs transition-colors shadow-orange-glow-sm"
                >
                  Browse Catalog
                </Link>
              </div>
            ) : (
              cart.map((item, index) => (
                <div key={`${item.productId}-${index}`} className="pt-4 first:pt-0 flex space-x-4">
                  {/* Thumbnail */}
                  <div className="relative w-20 h-20 bg-neutral-100 dark:bg-[#14141A] rounded-xl border border-neutral-200 dark:border-[#252530] overflow-hidden shrink-0 p-2">
                    <Image
                      src={item.image}
                      alt={item.title}
                      fill
                      sizes="80px"
                      loading="lazy"
                      className="object-contain p-1"
                    />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/product/${item.slug}`}
                      onClick={() => setIsCartDrawerOpen(false)}
                      className="font-display uppercase tracking-wide font-bold text-sm text-black dark:text-white hover:text-[#FF5500] line-clamp-1 transition-colors"
                    >
                      {item.title}
                    </Link>

                    {item.selectedOptions && Object.keys(item.selectedOptions).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {Object.entries(item.selectedOptions).map(([key, val]) => (
                          <span
                            key={key}
                            className="inline-block text-[10px] bg-neutral-100 dark:bg-[#16161E] border border-neutral-200 dark:border-[#252530] text-neutral-700 dark:text-neutral-300 px-1.5 py-0.5 rounded capitalize"
                          >
                            {key}: {val}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="mt-2.5 flex items-center justify-between">
                      <div className="flex items-baseline space-x-1">
                        <span className="text-[11px] font-black text-[#FF5500]">AED</span>
                        <span className="font-display text-lg font-black text-black dark:text-white">
                          {(item.price * item.quantity).toLocaleString()}
                        </span>
                      </div>

                      {/* Quantity Controls */}
                      <div className="flex items-center space-x-1 border border-neutral-300 dark:border-[#272730] rounded-xl p-0.5 bg-neutral-100 dark:bg-[#121218]">
                        <button
                          onClick={() =>
                            updateQuantity(item.productId, item.quantity - 1, item.selectedOptions)
                          }
                          className="p-2 text-neutral-600 hover:text-black dark:text-neutral-400 dark:hover:text-white rounded-lg hover:bg-neutral-200 dark:hover:bg-[#1C1C24]"
                          aria-label={`Decrease quantity of ${item.title}`}
                        >
                          <Minus className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                        <span className="text-xs font-bold px-1.5 text-black dark:text-white" aria-hidden="true">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() =>
                            updateQuantity(item.productId, item.quantity + 1, item.selectedOptions)
                          }
                          disabled={item.quantity >= item.maxStock}
                          className="p-2 text-neutral-600 hover:text-black dark:text-neutral-400 dark:hover:text-white rounded-lg hover:bg-neutral-200 dark:hover:bg-[#1C1C24] disabled:opacity-30"
                          aria-label={`Increase quantity of ${item.title}`}
                        >
                          <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      </div>

                      <button
                        onClick={() => removeFromCart(item.productId, item.selectedOptions)}
                        className="text-neutral-400 hover:text-red-500 p-2 transition-colors"
                        title="Remove item"
                        aria-label={`Remove ${item.title} from cart`}
                      >
                        <Trash2 className="w-4 h-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {cart.length > 0 && (
            <div className="p-6 border-t border-neutral-200 dark:border-[#1C1C24] bg-neutral-50 dark:bg-[#08080C] space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400">
                  Subtotal
                </span>
                <div className="flex items-baseline space-x-1.5">
                  <span className="text-sm font-black text-[#FF5500]">AED</span>
                  <span className="font-display text-3xl font-black text-black dark:text-white">
                    {totalAmount.toLocaleString()}
                  </span>
                </div>
              </div>
              <p className="text-[11px] text-neutral-600 dark:text-neutral-400">
                Free tracked courier delivery across all 7 UAE Emirates. Pay by card (Stripe) or cash on delivery.
              </p>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <Link
                  href="/cart"
                  onClick={() => setIsCartDrawerOpen(false)}
                  className="w-full text-center py-3 px-4 border border-neutral-300 dark:border-[#272730] bg-neutral-100 hover:bg-neutral-200 text-black dark:bg-[#121218] dark:text-white rounded-xl font-bold uppercase tracking-wider text-xs hover:border-neutral-400 transition-colors"
                >
                  View Cart
                </Link>
                <Link
                  href="/checkout"
                  onClick={() => setIsCartDrawerOpen(false)}
                  className="w-full flex items-center justify-center space-x-1.5 py-3 px-4 bg-[#FF5500] hover:bg-[#FF6600] text-white rounded-xl font-black uppercase tracking-wider text-xs transition-colors shadow-orange-glow-sm"
                >
                  <span>Checkout</span>
                  <ArrowRight className="w-4 h-4 text-white" aria-hidden="true" />
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
