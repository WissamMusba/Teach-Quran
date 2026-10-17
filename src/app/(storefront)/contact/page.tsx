import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Mail, MapPin, Phone, Clock, PackageSearch, RotateCcw, Truck } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Contact Us',
  description:
    'Contact our cricket equipment store for order help, delivery questions, returns and warranty support.',
  alternates: { canonical: '/contact' },
};

export default function ContactPage() {
  return (
    <div className="bg-neutral-50 dark:bg-[#050505] text-neutral-900 dark:text-white min-h-screen py-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <header className="mb-10 pb-6 border-b border-neutral-200 dark:border-[#1C1C24]">
          <span className="text-xs font-black uppercase tracking-widest text-[#FF5500]">
            Customer Care
          </span>
          <h1 className="font-display uppercase text-3xl sm:text-5xl font-black text-neutral-950 dark:text-white tracking-tight mt-2">
            Contact Us
          </h1>
          <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-400">
            Order questions, delivery updates, returns or warranty claims — we are here to help.
            Include your order reference and we will answer as fast as we can.
          </p>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-[#0E0E14] border border-neutral-200 dark:border-[#22222A] rounded-2xl p-5 flex items-start space-x-3 shadow-sm">
            <Mail className="w-5 h-5 text-[#FF5500] shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <h2 className="text-xs font-black uppercase tracking-wider text-neutral-950 dark:text-white mb-1">
                Email
              </h2>
              <p className="text-sm text-neutral-700 dark:text-neutral-300">
                <a href="mailto:info@sevendistricts.ae" className="hover:text-[#FF5500] transition-colors">
                  info@sevendistricts.ae
                </a>
              </p>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1">
                Best for order details, returns and photos of faulty items.
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-[#0E0E14] border border-neutral-200 dark:border-[#22222A] rounded-2xl p-5 flex items-start space-x-3 shadow-sm">
            <Phone className="w-5 h-5 text-[#FF5500] shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <h2 className="text-xs font-black uppercase tracking-wider text-neutral-950 dark:text-white mb-1">
                Phone &amp; WhatsApp
              </h2>
              <p className="text-sm text-neutral-700 dark:text-neutral-300">+971 6 743 0000 / +971 50 717 1971</p>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1">
                For urgent order questions &amp; equipment advice during academy hours.
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-[#0E0E14] border border-neutral-200 dark:border-[#22222A] rounded-2xl p-5 flex items-start space-x-3 shadow-sm">
            <Clock className="w-5 h-5 text-[#FF5500] shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <h2 className="text-xs font-black uppercase tracking-wider text-neutral-950 dark:text-white mb-1">
                Academy &amp; Support Hours
              </h2>
              <p className="text-sm text-neutral-700 dark:text-neutral-300">Sunday – Friday: 8:00 AM – 9:00 PM GST</p>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1">
                Orders dispatched daily across all 7 UAE Emirates.
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-[#0E0E14] border border-neutral-200 dark:border-[#22222A] rounded-2xl p-5 flex items-start space-x-3 shadow-sm">
            <MapPin className="w-5 h-5 text-[#FF5500] shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <h2 className="text-xs font-black uppercase tracking-wider text-neutral-950 dark:text-white mb-1">
                Academy Location
              </h2>
              <p className="text-sm text-neutral-700 dark:text-neutral-300">
                Seven Districts Cricket Academy (TSDCA), Ajman, United Arab Emirates
              </p>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1">
                Pro Shop &amp; Academy Campus • Equipment dispatch across all UAE Emirates.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link
            href="/shipping"
            className="bg-white dark:bg-[#0E0E14] border border-neutral-200 dark:border-[#22222A] rounded-2xl p-5 hover:border-[#FF5500]/60 shadow-sm transition-colors flex items-center space-x-3"
          >
            <Truck className="w-5 h-5 text-[#FF5500]" aria-hidden="true" />
            <span className="text-xs font-black uppercase tracking-wider text-neutral-950 dark:text-white">
              Shipping &amp; Delivery
            </span>
          </Link>
          <Link
            href="/returns"
            className="bg-white dark:bg-[#0E0E14] border border-neutral-200 dark:border-[#22222A] rounded-2xl p-5 hover:border-[#FF5500]/60 shadow-sm transition-colors flex items-center space-x-3"
          >
            <RotateCcw className="w-5 h-5 text-[#FF5500]" aria-hidden="true" />
            <span className="text-xs font-black uppercase tracking-wider text-neutral-950 dark:text-white">
              Returns &amp; Refunds
            </span>
          </Link>
          <Link
            href="/shop"
            className="bg-white dark:bg-[#0E0E14] border border-neutral-200 dark:border-[#22222A] rounded-2xl p-5 hover:border-[#FF5500]/60 shadow-sm transition-colors flex items-center space-x-3"
          >
            <PackageSearch className="w-5 h-5 text-[#FF5500]" aria-hidden="true" />
            <span className="text-xs font-black uppercase tracking-wider text-neutral-950 dark:text-white">
              Continue Shopping
            </span>
          </Link>
        </div>

        <div className="mt-10 bg-white dark:bg-[#0E0E14] border border-neutral-200 dark:border-[#22222A] rounded-2xl p-6 space-y-3 shadow-sm">
          <h2 className="font-display uppercase text-lg font-black text-neutral-950 dark:text-white tracking-tight">
            About a Specific Order
          </h2>
          <ul className="list-disc pl-5 space-y-1.5 text-sm text-neutral-700 dark:text-neutral-300 marker:text-[#FF5500]">
            <li>
              Include your <strong className="text-neutral-950 dark:text-white">Order Reference</strong> (shown on your
              confirmation page, e.g. #123).
            </li>
            <li>
              For damaged or faulty items, attach clear photographs of the item and its packaging.
            </li>
            <li>
              For return requests, tell us whether you prefer a refund or a replacement.
            </li>
          </ul>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Business details: Seven Districts Cricket Academy LLC, Ajman, United Arab Emirates.
          </p>
        </div>
      </div>
    </div>
  );
}
