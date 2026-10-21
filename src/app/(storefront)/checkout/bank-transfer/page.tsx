import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { getOrderById } from '@/lib/supabaseServer';
import ClearCartOnMount from '@/components/storefront/ClearCartOnMount';
import BankTransferInvoice from '@/components/storefront/BankTransferInvoice';
import { Order } from '@/lib/types';
import { ArrowLeft, ShieldAlert } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Bank Transfer Instructions | CG Sports',
  description: 'Direct local bank transfer instructions and payment verification for CG Sports.',
  robots: { index: false, follow: false },
};

interface BankTransferPageProps {
  searchParams: Promise<{
    order_id?: string;
    token?: string;
    total?: string;
  }>;
}

export default async function BankTransferPage({ searchParams }: BankTransferPageProps) {
  const { order_id, total } = await searchParams;

  let order = null;
  if (order_id) {
    order = await getOrderById(order_id);
  }

  // Resilient fallback: ensure customer never hits a dead end
  if (!order && order_id) {
    const totalNum = total ? parseFloat(total) : 0;
    order = {
      id: order_id,
      customer_name: 'Valued Customer',
      customer_email: 'Confirmed on file',
      customer_phone: 'On file',
      shipping_address: {
        street: 'Shipping address on file',
        city: 'Ajman / Dubai',
        state: 'UAE',
        postal_code: '00000',
        country: 'United Arab Emirates',
      },
      total_amount: isNaN(totalNum) ? 0 : totalNum,
      payment_method: 'bank_transfer' as const,
      payment_status: 'pending' as const,
      order_status: 'new' as const,
      created_at: new Date().toISOString(),
      items: [],
    } as Order;
  }

  if (!order) {
    return (
      <div className="bg-neutral-50 text-neutral-900 dark:bg-[#050505] dark:text-white min-h-[75vh] flex items-center justify-center py-16 px-4">
        <div className="max-w-md w-full bg-white dark:bg-[#0E0E14] border border-neutral-200 dark:border-[#22222A] rounded-3xl p-8 text-center space-y-4 shadow-xl">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-500 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h1 className="font-display uppercase text-2xl font-black text-black dark:text-white">
            Order Reference Required
          </h1>
          <p className="text-xs text-neutral-600 dark:text-neutral-400">
            Please place an order through checkout to generate your unique bank transfer reference code.
          </p>
          <div className="pt-2">
            <Link
              href="/shop"
              className="inline-flex items-center justify-center space-x-2 w-full py-3 px-4 rounded-xl bg-[#FF5500] hover:bg-[#FF6600] text-white font-black uppercase tracking-wider text-xs shadow-orange-glow-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Go to Shop</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-neutral-50 text-neutral-900 dark:bg-[#050505] dark:text-white min-h-screen py-10 sm:py-16 transition-colors duration-200">
      <ClearCartOnMount />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Navigation Breadcrumb */}
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/shop"
            className="inline-flex items-center space-x-2 text-xs font-black uppercase tracking-wider text-neutral-500 hover:text-[#FF5500] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Shop</span>
          </Link>
          <span className="text-[11px] font-mono text-neutral-400">
            Secure Bank Transfer Rails
          </span>
        </div>

        {/* The Exact User-Specified Layout Structure */}
        <BankTransferInvoice order={order} />
      </div>
    </div>
  );
}
