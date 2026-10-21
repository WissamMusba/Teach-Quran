import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Banknote, CreditCard, RotateCcw, ShieldCheck, Truck } from 'lucide-react';

const EQUIPMENT_LINKS = [
  { label: 'Cricket Bats', href: '/shop?category=bats' },
  { label: 'Match Balls', href: '/shop?category=balls' },
  { label: 'Batting Pads', href: '/shop?category=pads' },
  { label: 'Gloves', href: '/shop?category=gloves' },
  { label: 'Helmets', href: '/shop?category=helmets' },
  { label: 'Kit Bags & Shoes', href: '/shop?category=bags' },
];

const SUPPORT_LINKS = [
  { label: 'Contact the Academy', href: '/contact' },
  { label: 'Track My Order', href: '/orders' },
  { label: 'Shopping Cart', href: '/cart' },
  { label: 'Staff Portal', href: '/admin/login' },
];

const PAYMENT_CHIPS = ['Bank Transfer (Emirates Islamic)', 'Cash on Delivery'];

/**
 * Liquid Glass footer — translucent band continuing the ambient page field.
 */
export const GlassFooter: React.FC = () => (
  <footer className="relative z-10 mt-12 border-t border-white/60 bg-white/55 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.03]">
    <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
      <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
        {/* Brand */}
        <div className="space-y-4">
          <Link href="/" className="flex items-center gap-2.5">
            <Image
              src="/logo-seven-districts.png"
              alt="CG Sports"
              width={40}
              height={40}
              className="h-10 w-10 rounded-full border border-white/50 bg-white/60 object-contain p-0.5 dark:border-white/20 dark:bg-white/10"
            />
            <span className="flex flex-col leading-none">
              <span className="font-display text-xl font-black uppercase tracking-tight text-black dark:text-white">
                CG Sports<span className="text-[#FF5500]">.</span>
              </span>
              <span className="text-[9px] font-black uppercase tracking-[0.18em] text-neutral-500 dark:text-white/60">
                Located at Seven Districts • Ajman, UAE
              </span>
            </span>
          </Link>
          <p className="text-xs leading-relaxed text-neutral-600 dark:text-white/60">
            Tournament-grade cricket equipment assembled by coaches and trusted by players
            across all 7 Emirates.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <span className="glass-chip px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-neutral-700 dark:text-white/80">
              <Truck className="h-3 w-3 text-[#FF5500]" aria-hidden="true" />
              Same-Day Ajman
            </span>
            <span className="glass-chip px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-neutral-700 dark:text-white/80">
              <ShieldCheck className="h-3 w-3 text-[#FF5500]" aria-hidden="true" />
              Authentic Gear
            </span>
          </div>
        </div>

        {/* Equipment */}
        <nav aria-label="Equipment" className="space-y-3">
          <h3 className="text-[11px] font-black uppercase tracking-[0.18em] text-neutral-500 dark:text-white/60">
            Equipment
          </h3>
          <ul className="space-y-2">
            {EQUIPMENT_LINKS.map((link) => (
              <li key={link.label}>
                <Link
                  href={link.href}
                  className="text-xs font-bold text-neutral-700 transition-colors hover:text-[#C2410C] dark:text-white/75 dark:hover:text-[#FF9A5C]"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Support */}
        <nav aria-label="Support" className="space-y-3">
          <h3 className="text-[11px] font-black uppercase tracking-[0.18em] text-neutral-500 dark:text-white/60">
            Support
          </h3>
          <ul className="space-y-2">
            {SUPPORT_LINKS.map((link) => (
              <li key={link.label}>
                <Link
                  href={link.href}
                  className="text-xs font-bold text-neutral-700 transition-colors hover:text-[#C2410C] dark:text-white/75 dark:hover:text-[#FF9A5C]"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Payments */}
        <div className="space-y-3">
          <h3 className="text-[11px] font-black uppercase tracking-[0.18em] text-neutral-500 dark:text-white/60">
            Payments & Delivery
          </h3>
          <div className="flex flex-wrap gap-2">
            {PAYMENT_CHIPS.map((chip) => (
              <span
                key={chip}
                className="glass-chip px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-neutral-700 dark:text-white/80"
              >
                {chip === 'Card' || chip.includes('Pay') ? (
                  <CreditCard className="h-3 w-3 text-[#FF5500]" aria-hidden="true" />
                ) : (
                  <Banknote className="h-3 w-3 text-[#FF5500]" aria-hidden="true" />
                )}
                {chip}
              </span>
            ))}
          </div>
          <p className="flex items-center gap-1.5 pt-1 text-[10px] font-bold uppercase tracking-wider text-neutral-500 dark:text-white/50">
            <RotateCcw className="h-3 w-3" aria-hidden="true" />
            Free UAE delivery over AED 500
          </p>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-white/60 pt-6 text-[11px] text-neutral-500 dark:border-white/10 dark:text-white/50 sm:flex-row">
        <p>© {new Date().getFullYear()} CG Sports • Located at Seven Districts, Ajman, UAE. All rights reserved.</p>
        <div className="flex items-center gap-5">
          <Link href="/shop" className="transition-colors hover:text-[#C2410C] dark:hover:text-[#FF9A5C]">
            Full Catalog
          </Link>
          <Link href="/contact" className="transition-colors hover:text-[#C2410C] dark:hover:text-[#FF9A5C]">
            Visit Us
          </Link>
          <Link href="/classic" className="transition-colors hover:text-[#C2410C] dark:hover:text-[#FF9A5C]">
            Athletic Design
          </Link>
        </div>
      </div>
    </div>
  </footer>
);
