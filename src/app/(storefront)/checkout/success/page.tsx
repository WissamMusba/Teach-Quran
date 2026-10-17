import React from 'react';
import Link from 'next/link';
import { getOrderById } from '@/lib/supabaseServer';
import { CheckCircle2, PackageCheck, Truck, ArrowRight } from 'lucide-react';

interface SuccessPageProps {
  searchParams: Promise<{
    order_id?: string;
    session_id?: string;
  }>;
}

export default async function CheckoutSuccessPage({ searchParams }: SuccessPageProps) {
  const { order_id } = await searchParams;
  const order = order_id ? await getOrderById(order_id) : null;

  return (
    <div className="bg-neutral-50/50 min-h-screen py-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Success Banner */}
        <div className="bg-white border border-neutral-200 rounded-2xl p-8 shadow-xs text-center space-y-4">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div className="space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">
              Order Confirmed & Received
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-neutral-900 tracking-tight">
              Thank You for Your Order!
            </h1>
            <p className="text-sm text-neutral-500 max-w-md mx-auto">
              We have received your cricket gear order. Our equipment team is preparing your package for courier dispatch.
            </p>
          </div>

          {order && (
            <div className="inline-block bg-neutral-100 text-neutral-800 text-xs font-mono font-bold px-3 py-1.5 rounded-lg">
              Order Reference #{order.id}
            </div>
          )}
        </div>

        {/* Invoice Summary */}
        {order ? (
          <div className="mt-6 bg-white border border-neutral-200 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-neutral-100">
              <h2 className="text-base font-bold text-neutral-900 flex items-center space-x-2">
                <PackageCheck className="w-5 h-5 text-orange-600" />
                <span>Invoice & Delivery Summary</span>
              </h2>

              <span
                className={`text-xs px-2.5 py-1 rounded-full font-bold uppercase tracking-wider ${
                  order.payment_method === 'cod'
                    ? 'bg-orange-100 text-orange-700'
                    : 'bg-emerald-100 text-emerald-700'
                }`}
              >
                {order.payment_method === 'cod' ? 'Cash on Delivery (Pending)' : 'Card Paid via Stripe'}
              </span>
            </div>

            {/* Customer & Shipping info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs text-neutral-600">
              <div>
                <h3 className="font-bold text-neutral-900 uppercase tracking-wider mb-2">
                  Customer Information
                </h3>
                <p className="font-semibold text-neutral-800">{order.customer_name}</p>
                <p>{order.customer_email}</p>
                <p>{order.customer_phone}</p>
              </div>

              <div>
                <h3 className="font-bold text-neutral-900 uppercase tracking-wider mb-2">
                  Shipping Destination
                </h3>
                <p className="font-semibold text-neutral-800">{order.shipping_address.street}</p>
                <p>
                  {order.shipping_address.city}, {order.shipping_address.state}{' '}
                  {order.shipping_address.postal_code}
                </p>
                <p>{order.shipping_address.country}</p>
              </div>
            </div>

            {/* Line Items Table */}
            {order.items && order.items.length > 0 && (
              <div className="border border-neutral-100 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-50 text-neutral-500 font-bold uppercase tracking-wider">
                    <tr>
                      <th className="py-2.5 px-4">Item</th>
                      <th className="py-2.5 px-4 text-center">Qty</th>
                      <th className="py-2.5 px-4 text-right">Price</th>
                      <th className="py-2.5 px-4 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 text-neutral-800">
                    {order.items.map((it, idx) => (
                      <tr key={idx}>
                        <td className="py-3 px-4">
                          <span className="font-semibold">{it.product_title}</span>
                          {it.selected_options && Object.keys(it.selected_options).length > 0 && (
                            <span className="block text-[11px] text-neutral-500">
                              {Object.entries(it.selected_options)
                                .map(([k, v]) => `${k}: ${v}`)
                                .join(' | ')}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center font-medium">{it.quantity}</td>
                        <td className="py-3 px-4 text-right">${it.unit_price.toFixed(2)}</td>
                        <td className="py-3 px-4 text-right font-bold">
                          ${(it.unit_price * it.quantity).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Total */}
            <div className="border-t border-neutral-200 pt-4 flex justify-between items-baseline">
              <span className="text-sm font-bold text-neutral-700">Total Billed</span>
              <span className="text-2xl font-black text-neutral-900">
                ${order.total_amount.toFixed(2)}
              </span>
            </div>

            <div className="bg-neutral-50 rounded-xl p-4 flex items-center space-x-3 text-xs text-neutral-600">
              <Truck className="w-5 h-5 text-orange-600 shrink-0" />
              <span>
                Standard tracked dispatch. You will receive email tracking notifications as soon as your parcel is scanned.
              </span>
            </div>
          </div>
        ) : null}

        {/* Action Buttons */}
        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/shop"
            className="inline-flex items-center justify-center space-x-2 px-6 py-3 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-sm transition-all shadow-sm"
          >
            <span>Continue Shopping</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
