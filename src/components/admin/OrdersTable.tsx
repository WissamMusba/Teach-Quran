'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Order, OrderStatus } from '@/lib/types';
import { OrderStatusSelect } from './OrderStatusSelect';
import { Eye, Search, Filter } from 'lucide-react';

interface OrdersTableProps {
  initialOrders: Order[];
}

export const OrdersTable: React.FC<OrdersTableProps> = ({ initialOrders }) => {
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  const filteredOrders = orders.filter((o) => {
    const matchesStatus = statusFilter === 'all' || o.order_status === statusFilter;
    const matchesSearch =
      o.id.toLowerCase().includes(search.toLowerCase()) ||
      o.customer_name.toLowerCase().includes(search.toLowerCase()) ||
      o.customer_email.toLowerCase().includes(search.toLowerCase()) ||
      o.customer_phone.toLowerCase().includes(search.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const handleStatusChange = (orderId: string, newStatus: OrderStatus) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, order_status: newStatus } : o))
    );
  };

  return (
    <div className="bg-white border border-neutral-200 rounded-2xl shadow-xs overflow-hidden">
      {/* Filters Bar */}
      <div className="p-4 sm:p-5 border-b border-neutral-100 flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search by customer, email, or order ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-xs pl-10 pr-3.5 py-2.5 rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
          />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-neutral-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs px-3 py-2 rounded-xl border border-neutral-200 bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 font-semibold"
          >
            <option value="all">All Statuses ({orders.length})</option>
            <option value="new">New ({orders.filter((o) => o.order_status === 'new').length})</option>
            <option value="packed">Packed</option>
            <option value="shipped">Shipped</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Orders Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-neutral-50 text-neutral-500 font-bold uppercase tracking-wider border-b border-neutral-100">
            <tr>
              <th className="py-3 px-5">Order Reference</th>
              <th className="py-3 px-5">Date</th>
              <th className="py-3 px-5">Customer</th>
              <th className="py-3 px-5">Payment Method</th>
              <th className="py-3 px-5">Payment Status</th>
              <th className="py-3 px-5">Total</th>
              <th className="py-3 px-5">Order Status</th>
              <th className="py-3 px-5 text-right">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 text-neutral-800">
            {filteredOrders.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-neutral-400">
                  No customer orders found matching the filter criteria.
                </td>
              </tr>
            ) : (
              filteredOrders.map((order) => (
                <tr key={order.id} className="hover:bg-neutral-50/50 transition-colors">
                  <td className="py-3.5 px-5 font-mono font-bold text-neutral-700">
                    #{order.id.slice(0, 14)}
                  </td>
                  <td className="py-3.5 px-5 text-neutral-500">
                    {new Date(order.created_at).toLocaleDateString()}
                  </td>
                  <td className="py-3.5 px-5">
                    <span className="font-bold text-neutral-900 block">{order.customer_name}</span>
                    <span className="text-[11px] text-neutral-500">{order.customer_phone}</span>
                  </td>
                  <td className="py-3.5 px-5">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded text-[11px] font-bold uppercase ${
                        order.payment_method === 'cod'
                          ? 'bg-orange-100 text-orange-800'
                          : 'bg-neutral-100 text-neutral-800'
                      }`}
                    >
                      {order.payment_method === 'cod' ? 'COD' : 'Stripe Card'}
                    </span>
                  </td>
                  <td className="py-3.5 px-5">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded text-[11px] font-bold capitalize ${
                        order.payment_status === 'paid'
                          ? 'bg-emerald-100 text-emerald-800'
                          : order.payment_status === 'failed'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {order.payment_status}
                    </span>
                  </td>
                  <td className="py-3.5 px-5 font-bold text-neutral-900">
                    ${order.total_amount.toFixed(2)}
                  </td>
                  <td className="py-3.5 px-5">
                    <OrderStatusSelect
                      orderId={order.id}
                      initialStatus={order.order_status}
                      onStatusChange={(newStatus) => handleStatusChange(order.id, newStatus)}
                    />
                  </td>
                  <td className="py-3.5 px-5 text-right">
                    <Link
                      href={`/admin/orders/${order.id}`}
                      className="inline-flex items-center space-x-1 p-1.5 text-neutral-600 hover:text-orange-600 hover:bg-neutral-100 rounded-lg transition-colors"
                      title="Inspect Order"
                    >
                      <Eye className="w-4 h-4" />
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
