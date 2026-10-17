import React from 'react';
import { getOrders } from '@/lib/supabaseServer';
import { OrdersTable } from '@/components/admin/OrdersTable';

export const revalidate = 0;

export default async function AdminOrdersPage() {
  const orders = await getOrders();

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-neutral-900 tracking-tight">
          Customer Orders Fulfillment
        </h1>
        <p className="text-xs text-neutral-500 mt-1">
          Review placed orders, verify Cash on Delivery and Stripe settlements, and transition fulfillment status.
        </p>
      </div>

      <OrdersTable initialOrders={orders} />
    </div>
  );
}
