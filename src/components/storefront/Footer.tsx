import React from 'react';
import Link from 'next/link';
import { ShieldCheck, Truck, CreditCard, RotateCcw } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-[#000000] border-t border-[#1C1C24] text-neutral-400">
      {/* Value Proposition Badges */}
      <div className="border-b border-[#1C1C24] bg-[#050508]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center md:text-left">
            <div className="flex items-center space-x-3.5 justify-center md:justify-start">
              <div className="w-12 h-12 rounded-2xl bg-[#FF5500]/10 border border-[#FF5500]/30 text-[#FF5500] flex items-center justify-center shrink-0 shadow-orange-glow-sm">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-display uppercase tracking-wide font-black text-white text-base">
                  100% Authentic
                </h4>
                <p className="text-xs text-neutral-400">Direct from SG, SS, Kookaburra</p>
              </div>
            </div>

            <div className="flex items-center space-x-3.5 justify-center md:justify-start">
              <div className="w-12 h-12 rounded-2xl bg-[#FF5500]/10 border border-[#FF5500]/30 text-[#FF5500] flex items-center justify-center shrink-0 shadow-orange-glow-sm">
                <Truck className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-display uppercase tracking-wide font-black text-white text-base">
                  Fast Shipping
                </h4>
                <p className="text-xs text-neutral-400">Tracked dispatch with insurance</p>
              </div>
            </div>

            <div className="flex items-center space-x-3.5 justify-center md:justify-start">
              <div className="w-12 h-12 rounded-2xl bg-[#FF5500]/10 border border-[#FF5500]/30 text-[#FF5500] flex items-center justify-center shrink-0 shadow-orange-glow-sm">
                <CreditCard className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-display uppercase tracking-wide font-black text-white text-base">
                  Card & COD
                </h4>
                <p className="text-xs text-neutral-400">Stripe cards & Cash on Delivery</p>
              </div>
            </div>

            <div className="flex items-center space-x-3.5 justify-center md:justify-start">
              <div className="w-12 h-12 rounded-2xl bg-[#FF5500]/10 border border-[#FF5500]/30 text-[#FF5500] flex items-center justify-center shrink-0 shadow-orange-glow-sm">
                <RotateCcw className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-display uppercase tracking-wide font-black text-white text-base">
                  Quality Assured
                </h4>
                <p className="text-xs text-neutral-400">Hand-selected willow & leather</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Footer Links */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          <div className="space-y-4 md:col-span-1">
            <Link href="/" className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#1C1C24] to-[#0A0A0E] border border-[#2E2E38] flex items-center justify-center font-display font-black text-white text-sm">
                C<span className="text-[#FF5500]">S</span>
              </div>
              <span className="font-display text-2xl font-black tracking-tight text-white uppercase">
                CRICKET<span className="text-[#FF5500]">STORE</span>
              </span>
            </Link>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Equipping cricketers of all levels with professional bats, balls, pads, gloves, and protective gear. Direct brand partnerships guarantee authenticity.
            </p>
          </div>

          <div>
            <h4 className="font-display uppercase tracking-wider text-sm font-black text-white mb-4">
              Equipment Categories
            </h4>
            <ul className="space-y-2.5 text-xs">
              <li>
                <Link href="/shop?category=bats" className="hover:text-[#FF5500] transition-colors">
                  English Willow Bats
                </Link>
              </li>
              <li>
                <Link href="/shop?category=balls" className="hover:text-[#FF5500] transition-colors">
                  Four-Piece Match Balls
                </Link>
              </li>
              <li>
                <Link href="/shop?category=pads" className="hover:text-[#FF5500] transition-colors">
                  Batting Legguards
                </Link>
              </li>
              <li>
                <Link href="/shop?category=gloves" className="hover:text-[#FF5500] transition-colors">
                  Pittards Batting Gloves
                </Link>
              </li>
              <li>
                <Link href="/shop?category=helmets" className="hover:text-[#FF5500] transition-colors">
                  Titanium Helmets
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-display uppercase tracking-wider text-sm font-black text-white mb-4">
              Top Brands
            </h4>
            <ul className="space-y-2.5 text-xs">
              <li>
                <Link href="/shop?brand=Kookaburra" className="hover:text-[#FF5500] transition-colors">
                  Kookaburra
                </Link>
              </li>
              <li>
                <Link href="/shop?brand=Gray-Nicolls" className="hover:text-[#FF5500] transition-colors">
                  Gray-Nicolls
                </Link>
              </li>
              <li>
                <Link href="/shop?brand=SG" className="hover:text-[#FF5500] transition-colors">
                  SG (Sanspareils Greenlands)
                </Link>
              </li>
              <li>
                <Link href="/shop?brand=SS" className="hover:text-[#FF5500] transition-colors">
                  SS (Sareen Sports)
                </Link>
              </li>
              <li>
                <Link href="/shop?brand=MRF" className="hover:text-[#FF5500] transition-colors">
                  MRF Sports
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-display uppercase tracking-wider text-sm font-black text-white mb-4">
              Accepted Payments
            </h4>
            <div className="space-y-3 text-xs">
              <p className="text-xs text-neutral-400">
                We accept major international and regional payment methods securely:
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="px-3 py-1.5 rounded-lg bg-[#121218] border border-[#272732] text-xs font-bold text-white">
                  Visa
                </span>
                <span className="px-3 py-1.5 rounded-lg bg-[#121218] border border-[#272732] text-xs font-bold text-white">
                  Mastercard
                </span>
                <span className="px-3 py-1.5 rounded-lg bg-[#121218] border border-[#272732] text-xs font-bold text-white">
                  Apple Pay
                </span>
                <span className="px-3 py-1.5 rounded-lg bg-[#FF5500]/15 border border-[#FF5500]/40 text-xs font-black text-[#FF5500]">
                  Cash on Delivery (COD)
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-[#1C1C24] mt-12 pt-8 flex flex-col sm:flex-row justify-between items-center text-xs text-neutral-400 space-y-3 sm:space-y-0">
          <p>© {new Date().getFullYear()} CricketStore Inc. All rights reserved.</p>
          <div className="flex space-x-6">
            <Link href="/shop" className="hover:text-white transition-colors">
              Catalog
            </Link>
            <Link href="/checkout" className="hover:text-white transition-colors">
              Checkout
            </Link>
            <Link href="/admin/login" className="hover:text-white transition-colors">
              Staff Portal
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};
