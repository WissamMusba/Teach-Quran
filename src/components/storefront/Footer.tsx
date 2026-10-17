import React from 'react';
import Link from 'next/link';
import { ShieldCheck, Truck, CreditCard, RotateCcw } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-neutral-50 border-t border-neutral-200 mt-20 text-neutral-600">
      {/* Value Proposition Badges */}
      <div className="border-b border-neutral-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center md:text-left">
            <div className="flex items-center space-x-3 justify-center md:justify-start">
              <div className="w-10 h-10 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-neutral-900">100% Authentic</h4>
                <p className="text-xs text-neutral-500">Direct from SG, SS, Kookaburra</p>
              </div>
            </div>

            <div className="flex items-center space-x-3 justify-center md:justify-start">
              <div className="w-10 h-10 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center shrink-0">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-neutral-900">Fast Shipping</h4>
                <p className="text-xs text-neutral-500">Tracked dispatch with insurance</p>
              </div>
            </div>

            <div className="flex items-center space-x-3 justify-center md:justify-start">
              <div className="w-10 h-10 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center shrink-0">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-neutral-900">Card & COD</h4>
                <p className="text-xs text-neutral-500">Stripe cards & Cash on Delivery</p>
              </div>
            </div>

            <div className="flex items-center space-x-3 justify-center md:justify-start">
              <div className="w-10 h-10 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center shrink-0">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-neutral-900">Quality Assured</h4>
                <p className="text-xs text-neutral-500">Hand-selected willow & leather</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Footer Links */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-4 md:col-span-1">
            <Link href="/" className="flex items-center space-x-2">
              <div className="w-7 h-7 rounded bg-[#0F172A] flex items-center justify-center font-black text-white text-xs">
                C<span className="text-orange-500">S</span>
              </div>
              <span className="text-lg font-black tracking-tight text-neutral-900">
                CRICKET<span className="text-orange-600">STORE</span>
              </span>
            </Link>
            <p className="text-sm text-neutral-500 leading-relaxed">
              Equipping cricketers of all levels with professional bats, balls, pads, gloves, and protective gear. Direct brand partnerships guarantee authenticity.
            </p>
          </div>

          <div>
            <h4 className="text-xs font-bold text-neutral-900 uppercase tracking-wider mb-4">
              Equipment Categories
            </h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/shop?category=bats" className="hover:text-orange-600 transition-colors">English Willow Bats</Link></li>
              <li><Link href="/shop?category=balls" className="hover:text-orange-600 transition-colors">Four-Piece Match Balls</Link></li>
              <li><Link href="/shop?category=pads" className="hover:text-orange-600 transition-colors">Batting Legguards</Link></li>
              <li><Link href="/shop?category=gloves" className="hover:text-orange-600 transition-colors">Pittards Batting Gloves</Link></li>
              <li><Link href="/shop?category=helmets" className="hover:text-orange-600 transition-colors">Titanium Helmets</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-bold text-neutral-900 uppercase tracking-wider mb-4">
              Top Brands
            </h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/shop?brand=Kookaburra" className="hover:text-orange-600 transition-colors">Kookaburra</Link></li>
              <li><Link href="/shop?brand=Gray-Nicolls" className="hover:text-orange-600 transition-colors">Gray-Nicolls</Link></li>
              <li><Link href="/shop?brand=SG" className="hover:text-orange-600 transition-colors">SG (Sanspareils Greenlands)</Link></li>
              <li><Link href="/shop?brand=SS" className="hover:text-orange-600 transition-colors">SS (Sareen Sports)</Link></li>
              <li><Link href="/shop?brand=MRF" className="hover:text-orange-600 transition-colors">MRF Sports</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-bold text-neutral-900 uppercase tracking-wider mb-4">
              Accepted Payments
            </h4>
            <div className="space-y-3 text-sm">
              <p className="text-xs text-neutral-500">
                We accept major international and regional payment methods securely:
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="px-2.5 py-1 rounded bg-white border border-neutral-200 text-xs font-semibold text-neutral-800">
                  Visa
                </span>
                <span className="px-2.5 py-1 rounded bg-white border border-neutral-200 text-xs font-semibold text-neutral-800">
                  Mastercard
                </span>
                <span className="px-2.5 py-1 rounded bg-white border border-neutral-200 text-xs font-semibold text-neutral-800">
                  Apple Pay
                </span>
                <span className="px-2.5 py-1 rounded bg-orange-50 border border-orange-200 text-xs font-bold text-orange-700">
                  Cash on Delivery (COD)
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-neutral-200 mt-10 pt-6 flex flex-col sm:flex-row justify-between items-center text-xs text-neutral-500 space-y-2 sm:space-y-0">
          <p>© {new Date().getFullYear()} CricketStore Inc. All rights reserved.</p>
          <div className="flex space-x-6">
            <Link href="/shop" className="hover:text-neutral-900">Catalog</Link>
            <Link href="/checkout" className="hover:text-neutral-900">Checkout</Link>
            <Link href="/admin/login" className="hover:text-neutral-900">Staff Login</Link>
          </div>
        </div>
      </div>
    </footer>
  );
};
