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
    <div className="bg-[#0E0E14] border border-[#22222A] rounded-3xl shadow-xl overflow-hidden text-white">
      {/* Filters Bar */}
      <div className="p-5 border-b border-[#1C1C24] flex flex-col sm:flex-row gap-4 items-center justify-between bg-[#0A0A0E]">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-neutral-500 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search customer, email, or order ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-xs pl-10 pr-3.5 py-2.5 rounded-xl border border-[#272730] bg-[#14141B] text-white placeholder-neutral-500 focus:outline-none focus:border-[#FF5500] transition-colors"
          />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-neutral-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs px-3.5 py-2.5 rounded-xl border border-[#272730] bg-[#14141B] text-white focus:outline-none focus:border-[#FF5500] font-bold uppercase tracking-wider"
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
          <thead className="bg-[#121218] text-neutral-400 font-bold uppercase tracking-wider border-b border-[#1C1C24]">
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
          <tbody className="divide-y divide-[#1C1C24] text-neutral-300">
            {filteredOrders.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-neutral-500">
                  No customer orders found matching the filter criteria.
                </td>
              </tr>
            ) : (
              filteredOrders.map((order) => (
                <tr key={order.id} className="hover:bg-[#14141C] transition-colors">
                  <td className="py-3.5 px-5 font-mono font-bold text-neutral-400">
                    #{order.id.slice(0, 14)}
                  </td>
                  <td className="py-3.5 px-5 text-neutral-400">
                    {new Date(order.created_at).toLocaleDateString()}
                  </td>
                  <td className="py-3.5 px-5">
                    <span className="font-bold text-white block">{order.customer_name}</span>
                    <span className="text-[11px] text-neutral-500">{order.customer_phone}</span>
                  </td>
                  <td className="py-3.5 px-5">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                        order.payment_method === 'cod'
                          ? 'bg-[#FF5500]/20 text-[#FF5500] border border-[#FF5500]/40'
                          : 'bg-[#181822] text-white border border-[#292938]'
                      }`}
                    >
                      {order.payment_method === 'cod' ? 'COD' : 'Stripe Card'}
                    </span>
                  </td>
                  <td className="py-3.5 px-5">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-bold capitalize ${
                        order.payment_status === 'paid'
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          : order.payment_status === 'failed'
                          ? 'bg-red-950 text-red-400 border border-red-800'
                          : 'bg-amber-950 text-amber-400 border border-amber-800'
                      }`}
                    >
                      {order.payment_status}
                    </span>
                  </td>
                  <td className="py-3.5 px-5 font-display text-lg font-black text-white">
                    AED {order.total_amount.toLocaleString()}
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
                      className="inline-flex items-center space-x-1 p-2 text-neutral-400 hover:text-white hover:bg-[#1C1C28] rounded-lg transition-colors"
                      title="Inspect Order"
                    >
                      <Eye className="w-4 h-4 text-[#FF5500]" />
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
