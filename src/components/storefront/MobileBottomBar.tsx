'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import { Home, Compass, Search, ShoppingBag, Headphones } from 'lucide-react';

export const MobileBottomBar: React.FC = () => {
  const pathname = usePathname();
  const { totalItems, setIsCartDrawerOpen } = useCart();

  const isHome = pathname === '/';
  const isShop = pathname.startsWith('/shop') || pathname.startsWith('/product');
  const isContact = pathname.startsWith('/contact');

  return (
    <nav
      aria-label="Mobile Navigation"
      className="fixed bottom-0 inset-x-0 z-50 md:hidden bg-[#07070A]/95 backdrop-blur-xl border-t border-[#1C1C24] px-2 py-1.5 shadow-[0_-8px_24px_rgba(0,0,0,0.8)]"
      style={{ paddingBottom: 'max(0.375rem, env(safe-area-inset-bottom))' }}
    >
      <div className="grid grid-cols-5 items-center max-w-md mx-auto">
        {/* Home */}
        <Link
          href="/"
          className={`flex flex-col items-center justify-center py-1 px-1 transition-colors ${
            isHome ? 'text-[#FF5500]' : 'text-neutral-400 hover:text-white'
          }`}
        >
          <Home className={`w-5 h-5 ${isHome ? 'stroke-[2.5]' : 'stroke-2'}`} />
          <span className="text-[10px] font-bold tracking-tight uppercase mt-0.5">Home</span>
        </Link>

        {/* Shop / Gear */}
        <Link
          href="/shop"
          className={`flex flex-col items-center justify-center py-1 px-1 transition-colors ${
            isShop ? 'text-[#FF5500]' : 'text-neutral-400 hover:text-white'
          }`}
        >
          <Compass className={`w-5 h-5 ${isShop ? 'stroke-[2.5]' : 'stroke-2'}`} />
          <span className="text-[10px] font-bold tracking-tight uppercase mt-0.5">Gear</span>
        </Link>

        {/* Search */}
        <Link
          href="/shop"
          className="flex flex-col items-center justify-center py-1 px-1 text-neutral-400 hover:text-white transition-colors"
        >
          <Search className="w-5 h-5 stroke-2" />
          <span className="text-[10px] font-bold tracking-tight uppercase mt-0.5">Search</span>
        </Link>

        {/* Cart Trigger */}
        <button
          type="button"
          onClick={() => setIsCartDrawerOpen(true)}
          className="relative flex flex-col items-center justify-center py-1 px-1 text-neutral-400 hover:text-[#FF5500] transition-colors focus:outline-none"
          aria-label="Open Cart"
        >
          <div className="relative">
            <ShoppingBag className="w-5 h-5 stroke-2" />
            {totalItems > 0 && (
              <span className="absolute -top-1.5 -right-2 bg-[#FF5500] text-black font-black text-[9px] min-w-[16px] h-4 rounded-full flex items-center justify-center px-1 shadow-orange-glow animate-in zoom-in-50">
                {totalItems}
              </span>
            )}
          </div>
          <span className="text-[10px] font-bold tracking-tight uppercase mt-0.5">Cart</span>
        </button>

        {/* Contact / Support Shortcut */}
        <Link
          href="/contact"
          className={`flex flex-col items-center justify-center py-1 px-1 transition-colors ${
            isContact ? 'text-[#FF5500]' : 'text-neutral-400 hover:text-white'
          }`}
        >
          <Headphones className={`w-5 h-5 ${isContact ? 'stroke-[2.5]' : 'stroke-2'}`} />
          <span className="text-[10px] font-bold tracking-tight uppercase mt-0.5">Contact</span>
        </Link>
      </div>
    </nav>
  );
};
