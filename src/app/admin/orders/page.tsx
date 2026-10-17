import React from 'react';
import { getOrders } from '@/lib/supabaseServer';
import { OrdersTable } from '@/components/admin/OrdersTable';

export const revalidate = 0;

export default async function AdminOrdersPage() {
  const orders = await getOrders();

  return (
    <div className="space-y-8 max-w-7xl text-white">
      <div className="pb-6 border-b border-[#1C1C24]">
        <h1 className="font-display uppercase text-3xl sm:text-5xl font-black text-white tracking-tight">
          Customer Orders Fulfillment
        </h1>
        <p className="text-xs text-neutral-400 mt-1">
          Review placed orders, verify Cash on Delivery and Stripe settlements, and transition fulfillment status.
        </p>
      </div>

      <OrdersTable initialOrders={orders} />
    </div>
  );
}
