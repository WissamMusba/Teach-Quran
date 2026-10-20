import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getOrderById } from '@/lib/supabaseServer';
import { OrderStatusSelect } from '@/components/admin/OrderStatusSelect';
import { PaymentStatusControl } from '@/components/admin/PaymentStatusControl';
import { requireAdminPage } from '@/lib/adminGuard';
import { ArrowLeft, User, MapPin, CreditCard } from 'lucide-react';

export const revalidate = 0;

interface OrderDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function OrderDetailPage({ params }: OrderDetailPageProps) {
  await requireAdminPage();
  const { id } = await params;
  const order = await getOrderById(id);

  if (!order) {
    notFound();
  }

  return (
    <div className="space-y-8 max-w-4xl text-white">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-[#1C1C24] gap-4">
        <div>
          <Link
            href="/admin/orders"
            className="inline-flex items-center space-x-2 text-xs font-black uppercase tracking-wider text-neutral-400 hover:text-[#FF5500] transition-colors mb-3"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Orders</span>
          </Link>
          <div className="flex items-center space-x-3">
            <h1 className="font-display uppercase text-3xl sm:text-4xl font-black text-white tracking-tight">
              Order #{order.id}
            </h1>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <span className="text-xs font-black uppercase tracking-widest text-neutral-400">
            Order Status:
          </span>
          <OrderStatusSelect orderId={order.id} initialStatus={order.order_status} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Customer Information */}
        <div className="bg-[#0E0E14] border border-[#22222A] rounded-3xl p-6 shadow-xl space-y-3">
          <div className="flex items-center space-x-2 text-xs font-black uppercase tracking-widest text-white pb-3 border-b border-[#1C1C24]">
            <User className="w-4 h-4 text-[#FF5500]" />
            <span>Customer</span>
          </div>
          <div className="text-xs space-y-1.5 text-neutral-300">
            <p className="font-bold text-white text-sm">{order.customer_name}</p>
            <p className="text-neutral-400">{order.customer_email}</p>
            <p className="font-mono text-neutral-400">{order.customer_phone}</p>
          </div>
        </div>

        {/* Shipping Address */}
        <div className="bg-[#0E0E14] border border-[#22222A] rounded-3xl p-6 shadow-xl space-y-3">
          <div className="flex items-center space-x-2 text-xs font-black uppercase tracking-widest text-white pb-3 border-b border-[#1C1C24]">
            <MapPin className="w-4 h-4 text-[#FF5500]" />
            <span>Shipping Destination</span>
          </div>
          <div className="text-xs space-y-1.5 text-neutral-300">
            <p className="font-bold text-white text-sm">{order.shipping_address.street}</p>
            <p className="text-neutral-400">
              {order.shipping_address.city}, {order.shipping_address.state}{' '}
              {order.shipping_address.postal_code}
            </p>
            <p className="font-bold text-neutral-300">{order.shipping_address.country}</p>
          </div>
        </div>

        {/* Payment & Logistics */}
        <div className="bg-[#0E0E14] border border-[#22222A] rounded-3xl p-6 shadow-xl space-y-3">
          <div className="flex items-center space-x-2 text-xs font-black uppercase tracking-widest text-white pb-3 border-b border-[#1C1C24]">
            <CreditCard className="w-4 h-4 text-[#FF5500]" />
            <span>Payment Summary</span>
          </div>
          <div className="text-xs space-y-2.5">
            <div className="flex justify-between">
              <span className="text-neutral-400">Method:</span>
              <span className="font-black uppercase text-white">
                {order.payment_method === 'cod'
                  ? 'Cash on Delivery'
                  : order.payment_method === 'bank_transfer'
                  ? 'Bank Wire Transfer'
                  : 'Stripe Card'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-400">Payment Status:</span>
              <span
                className={`font-black capitalize px-2 py-0.5 rounded text-[10px] tracking-wider uppercase ${
                  order.payment_status === 'paid'
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                    : 'bg-amber-950 text-amber-400 border border-amber-800'
                }`}
              >
                {order.payment_status}
              </span>
            </div>
            {order.stripe_session_id && (
              <div className="pt-1">
                <span className="text-neutral-500 block text-[10px]">Stripe Session ID:</span>
                <span className="font-mono text-[10px] text-neutral-400 break-all">
                  {order.stripe_session_id}
                </span>
              </div>
            )}
            <PaymentStatusControl
              orderId={order.id}
              method={order.payment_method}
              initialStatus={order.payment_status}
            />
          </div>
        </div>
      </div>

      {/* Ordered Line Items */}
      <div className="bg-[#0E0E14] border border-[#22222A] rounded-3xl shadow-xl overflow-hidden">
        <div className="p-6 border-b border-[#1C1C24] flex items-center justify-between bg-[#0A0A0E]">
          <h2 className="font-display uppercase text-2xl font-black text-white">
            Ordered Equipment Items
          </h2>
          <span className="text-xs font-black uppercase tracking-wider text-neutral-400">
            {order.items?.length || 0} line items
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#121218] text-neutral-400 font-bold uppercase tracking-wider border-b border-[#1C1C24]">
              <tr>
                <th className="py-3 px-6">Item</th>
                <th className="py-3 px-6 text-center">Qty</th>
                <th className="py-3 px-6 text-right">Unit Price</th>
                <th className="py-3 px-6 text-right">Line Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1C1C24] text-neutral-300">
              {order.items && order.items.length > 0 ? (
                order.items.map((it, idx) => (
                  <tr key={idx}>
                    <td className="py-4 px-6">
                      <span className="font-bold text-white text-sm block">{it.product_title}</span>
                      {it.selected_options && Object.keys(it.selected_options).length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {Object.entries(it.selected_options).map(([k, v]) => (
                            <span
                              key={k}
                              className="text-[10px] bg-[#16161E] border border-[#252530] text-neutral-300 px-2 py-0.5 rounded capitalize"
                            >
                              {k}: {v}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="py-4 px-6 text-center font-bold text-white">{it.quantity}</td>
                    <td className="py-4 px-6 text-right font-mono text-xs">AED {it.unit_price.toLocaleString()}</td>
                    <td className="py-4 px-6 text-right font-display text-lg font-black text-white">
                      AED {(it.unit_price * it.quantity).toLocaleString()}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-neutral-500">
                    No items recorded for this order.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="p-6 border-t border-[#1C1C24] bg-[#0A0A0E] flex justify-between items-baseline">
          <span className="font-display uppercase text-lg font-black text-neutral-400">Total Charged / Due:</span>
          <div className="flex items-baseline space-x-1.5">
            <span className="text-sm font-black text-[#FF5500]">AED</span>
            <span className="font-display text-4xl font-black text-white">
              {order.total_amount.toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
