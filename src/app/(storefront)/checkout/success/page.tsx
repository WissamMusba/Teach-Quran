import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { getOrderById } from '@/lib/supabaseServer';
import { verifyOrderToken } from '@/lib/orderToken';
import { CheckCircle2, PackageCheck, Truck, ArrowRight, ShieldAlert } from 'lucide-react';
import ClearCartOnMount from '@/components/storefront/ClearCartOnMount';

export const metadata: Metadata = {
  title: 'Order Confirmation',
  robots: { index: false, follow: false },
};

interface SuccessPageProps {
  searchParams: Promise<{
    order_id?: string;
    token?: string;
    session_id?: string;
  }>;
}

export default async function CheckoutSuccessPage({ searchParams }: SuccessPageProps) {
  const { order_id, token } = await searchParams;

  // The success URL carries an HMAC token that only the checkout server can
  // mint. Without a valid token we never look up or render order details —
  // order ids must not be enough to read customer PII.
  const verified = verifyOrderToken(order_id, token);
  const order = verified && order_id ? await getOrderById(order_id) : null;

  if (!order) {
    return (
      <div className="bg-[#050505] text-white min-h-screen py-16">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-[#0E0E14] border border-[#22222A] rounded-3xl p-10 shadow-2xl text-center space-y-5">
            <div className="w-16 h-16 bg-amber-950/60 border border-amber-700/60 rounded-2xl flex items-center justify-center mx-auto text-amber-400">
              <ShieldAlert className="w-10 h-10" />
            </div>
            <div className="space-y-2">
              <span className="text-xs font-black uppercase tracking-widest text-[#FF5500]">
                Order Lookup
              </span>
              <h1 className="font-display uppercase text-3xl sm:text-4xl font-black text-white tracking-tight">
                We Couldn&apos;t Verify This Order
              </h1>
              <p className="text-sm text-neutral-400 max-w-md mx-auto">
                This confirmation link is invalid, expired, or was copied incorrectly. If your
                payment went through, don&apos;t worry — your order is still on file and our team
                will reach out. Contact us with your order reference and we&apos;ll sort it out.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <Link
                href="/contact"
                className="inline-flex items-center justify-center px-8 py-4 rounded-xl bg-[#FF5500] hover:bg-[#FF6600] text-black font-black uppercase tracking-wider text-xs transition-all shadow-orange-glow"
              >
                Contact Support
              </Link>
              <Link
                href="/shop"
                className="inline-flex items-center justify-center px-8 py-4 rounded-xl bg-[#16161E] hover:bg-[#1E1E28] border border-[#2A2A38] text-white font-black uppercase tracking-wider text-xs transition-all"
              >
                Back to Shop
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const paymentBadge =
    order.payment_status === 'paid'
      ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-700/60'
      : order.payment_method === 'cod'
        ? 'bg-[#FF5500]/20 text-[#FF5500] border border-[#FF5500]/40'
        : 'bg-amber-950/60 text-amber-400 border border-amber-700/60';

  const paymentLabel =
    order.payment_status === 'paid'
      ? 'Card Paid via Stripe'
      : order.payment_method === 'cod'
        ? 'Cash on Delivery (Pending)'
        : 'Payment Processing';

  return (
    <div className="bg-[#050505] text-white min-h-screen py-16">
      <ClearCartOnMount />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Success Banner */}
        <div className="bg-[#0E0E14] border border-[#22222A] rounded-3xl p-10 shadow-2xl text-center space-y-5">
          <div className="w-16 h-16 bg-emerald-950/60 border border-emerald-700/60 rounded-2xl flex items-center justify-center mx-auto text-emerald-400">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div className="space-y-1">
            <span className="text-xs font-black uppercase tracking-widest text-[#FF5500]">
              Order Confirmed & Received
            </span>
            <h1 className="font-display uppercase text-3xl sm:text-5xl font-black text-white tracking-tight">
              Thank You for Your Order!
            </h1>
            <p className="text-xs sm:text-sm text-neutral-400 max-w-md mx-auto">
              We have received your cricket gear order. Our equipment team is preparing your
              package for courier dispatch.
            </p>
          </div>

          <div className="inline-block bg-[#16161E] border border-[#2A2A38] text-white text-xs font-mono font-bold px-4 py-2 rounded-xl">
            Order Reference #{order.id}
          </div>
        </div>

        {/* Invoice Summary */}
        <div className="mt-8 bg-[#0E0E14] border border-[#22222A] rounded-3xl p-7 sm:p-10 shadow-2xl space-y-8">
          <div className="flex items-center justify-between flex-wrap gap-3 pb-5 border-b border-[#1C1C24]">
            <h2 className="font-display uppercase text-2xl font-black text-white flex items-center space-x-2.5">
              <PackageCheck className="w-6 h-6 text-[#FF5500]" />
              <span>Invoice &amp; Delivery Summary</span>
            </h2>

            <span
              className={`text-xs px-3 py-1.5 rounded-full font-black uppercase tracking-wider ${paymentBadge}`}
            >
              {paymentLabel}
            </span>
          </div>

          {/* Customer & Shipping info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs text-neutral-300">
            <div className="bg-[#121218] p-5 rounded-2xl border border-[#202028]">
              <h3 className="font-black text-white uppercase tracking-wider mb-2">
                Customer Information
              </h3>
              <p className="font-bold text-white text-sm">{order.customer_name}</p>
              <p className="text-neutral-400">{order.customer_email}</p>
              <p className="text-neutral-400 font-mono">{order.customer_phone}</p>
            </div>

            <div className="bg-[#121218] p-5 rounded-2xl border border-[#202028]">
              <h3 className="font-black text-white uppercase tracking-wider mb-2">
                Shipping Destination
              </h3>
              <p className="font-bold text-white text-sm">{order.shipping_address.street}</p>
              <p className="text-neutral-400">
                {order.shipping_address.city}, {order.shipping_address.state}{' '}
                {order.shipping_address.postal_code}
              </p>
              <p className="text-neutral-400 font-semibold">{order.shipping_address.country}</p>
            </div>
          </div>

          {/* Line Items Table */}
          {order.items && order.items.length > 0 && (
            <div className="border border-[#202028] rounded-2xl overflow-hidden bg-[#121218]">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#161620] text-neutral-400 font-bold uppercase tracking-wider border-b border-[#202028]">
                  <tr>
                    <th className="py-3 px-5">Item</th>
                    <th className="py-3 px-5 text-center">Qty</th>
                    <th className="py-3 px-5 text-right">Price</th>
                    <th className="py-3 px-5 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#202028] text-neutral-300">
                  {order.items.map((it, idx) => (
                    <tr key={idx}>
                      <td className="py-3.5 px-5">
                        <span className="font-bold text-white text-sm">{it.product_title}</span>
                        {it.selected_options && Object.keys(it.selected_options).length > 0 && (
                          <span className="block text-[11px] text-neutral-400 mt-0.5">
                            {Object.entries(it.selected_options)
                              .map(([k, v]) => `${k}: ${v}`)
                              .join(' | ')}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-5 text-center font-bold text-white">
                        {it.quantity}
                      </td>
                      <td className="py-3.5 px-5 text-right font-mono text-xs">
                        AED {it.unit_price.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-5 text-right font-mono font-bold text-white">
                        AED {(it.unit_price * it.quantity).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Total */}
          <div className="border-t border-[#1C1C24] pt-5 flex justify-between items-baseline">
            <span className="font-display uppercase text-lg font-black text-neutral-400">
              Total Billed
            </span>
            <div className="flex items-baseline space-x-1.5">
              <span className="text-sm font-black text-[#FF5500]">AED</span>
              <span className="font-display text-4xl font-black text-white">
                {order.total_amount.toLocaleString()}
              </span>
            </div>
          </div>

          <div className="bg-[#121218] border border-[#202028] rounded-2xl p-4 flex items-center space-x-3 text-xs text-neutral-400">
            <Truck className="w-5 h-5 text-[#FF5500] shrink-0" />
            <span>
              Standard tracked courier dispatch. Tracking updates will be sent to your phone and
              email.
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/shop"
            className="inline-flex items-center justify-center space-x-2 px-8 py-4 rounded-xl bg-[#FF5500] hover:bg-[#FF6600] text-black font-black uppercase tracking-wider text-xs transition-all shadow-orange-glow"
          >
            <span>Continue Shopping</span>
            <ArrowRight className="w-4 h-4 text-black" />
          </Link>
        </div>
      </div>
    </div>
  );
}
