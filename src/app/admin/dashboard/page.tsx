import React from 'react';
import Link from 'next/link';
import { getOrders, getProducts } from '@/lib/supabaseServer';
import {
  Package,
  ShoppingBag,
  DollarSign,
  AlertTriangle,
  ArrowRight,
  Plus,
  Eye,
} from 'lucide-react';
import { OrderStatusSelect } from '@/components/admin/OrderStatusSelect';

export const revalidate = 0;

export default async function AdminDashboardPage() {
  const [orders, products] = await Promise.all([getOrders(), getProducts()]);

  const totalRevenue = orders
    .filter((o) => o.payment_status === 'paid')
    .reduce((acc, curr) => acc + curr.total_amount, 0);

  const pendingOrders = orders.filter((o) => o.order_status === 'new').length;
  const lowStockProducts = products.filter((p) => p.stock_quantity <= 5);
  const activeProducts = products.filter((p) => p.is_active).length;

  return (
    <div className="space-y-8 max-w-7xl text-white">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#1C1C24]">
        <div>
          <h1 className="font-display uppercase text-3xl sm:text-5xl font-black text-white tracking-tight">
            Inventory & Sales Dashboard
          </h1>
          <p className="text-xs text-neutral-400 mt-1">
            Real-time cricket equipment metrics, stock health, and recent customer orders.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <Link
            href="/admin/products/new"
            className="inline-flex items-center space-x-2 px-5 py-3 rounded-xl bg-[#FF5500] hover:bg-[#FF6600] text-black font-black text-xs uppercase tracking-wider transition-all shadow-orange-glow-sm active:scale-95"
          >
            <Plus className="w-4 h-4 text-black" />
            <span>New Gear</span>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Revenue */}
        <div className="bg-[#0E0E14] border border-[#22222A] rounded-2xl p-5 shadow-lg flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-950/60 border border-emerald-800/60 text-emerald-400 flex items-center justify-center shrink-0">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-black text-neutral-400 block uppercase tracking-wider">
              Settled Revenue
            </span>
            <span className="font-display text-3xl font-black text-white">
              ${totalRevenue.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Total Orders */}
        <div className="bg-[#0E0E14] border border-[#22222A] rounded-2xl p-5 shadow-lg flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-[#FF5500]/10 border border-[#FF5500]/30 text-[#FF5500] flex items-center justify-center shrink-0">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-black text-neutral-400 block uppercase tracking-wider">
              Total Orders
            </span>
            <div className="flex items-baseline space-x-2">
              <span className="font-display text-3xl font-black text-white">{orders.length}</span>
              {pendingOrders > 0 && (
                <span className="text-xs text-[#FF5500] font-black">({pendingOrders} new)</span>
              )}
            </div>
          </div>
        </div>

        {/* Active Gear */}
        <div className="bg-[#0E0E14] border border-[#22222A] rounded-2xl p-5 shadow-lg flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-[#14141E] border border-[#272735] text-white flex items-center justify-center shrink-0">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-black text-neutral-400 block uppercase tracking-wider">
              Active Inventory
            </span>
            <span className="font-display text-3xl font-black text-white">
              {activeProducts} Items
            </span>
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div className="bg-[#0E0E14] border border-[#22222A] rounded-2xl p-5 shadow-lg flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-amber-950/60 border border-amber-800/60 text-amber-400 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-black text-neutral-400 block uppercase tracking-wider">
              Low Stock Alert
            </span>
            <span className="font-display text-3xl font-black text-white">
              {lowStockProducts.length} Items
            </span>
          </div>
        </div>
      </div>

      {/* Low Stock Attention List */}
      {lowStockProducts.length > 0 && (
        <div className="bg-[#1A1005] border border-[#4D2802] rounded-2xl p-5 space-y-3">
          <div className="flex items-center space-x-2 text-amber-300 font-bold text-xs uppercase tracking-wider">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span>Low Stock Attention Needed (&le; 5 units remaining)</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {lowStockProducts.map((p) => (
              <div
                key={p.id}
                className="bg-[#0E0E14] border border-[#331C04] rounded-xl p-3 flex items-center justify-between text-xs"
              >
                <div className="min-w-0 pr-2">
                  <span className="font-bold text-white block truncate">{p.title}</span>
                  <span className="text-neutral-400 font-mono text-[11px]">
                    {p.brand} • ${p.price.toFixed(2)}
                  </span>
                </div>
                <span className="font-mono font-bold text-amber-400 bg-amber-950 px-2 py-0.5 rounded border border-amber-800">
                  {p.stock_quantity} left
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Orders Preview */}
      <div className="bg-[#0E0E14] border border-[#22222A] rounded-2xl shadow-xl overflow-hidden">
        <div className="p-5 border-b border-[#1C1C24] flex items-center justify-between bg-[#0A0A0E]">
          <div>
            <h2 className="font-display uppercase text-2xl font-black text-white tracking-wide">
              Recent Customer Orders
            </h2>
            <p className="text-xs text-neutral-400">Live order flow with immediate status dispatcher</p>
          </div>
          <Link
            href="/admin/orders"
            className="text-xs font-black uppercase tracking-wider text-[#FF5500] hover:text-[#FF6600] flex items-center space-x-1"
          >
            <span>View All Orders</span>
            <ArrowRight className="w-3.5 h-3.5 text-[#FF5500]" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#121218] text-neutral-400 font-bold uppercase tracking-wider border-b border-[#1C1C24]">
              <tr>
                <th className="py-3 px-5">Order ID</th>
                <th className="py-3 px-5">Customer</th>
                <th className="py-3 px-5">Payment</th>
                <th className="py-3 px-5">Total</th>
                <th className="py-3 px-5">Order Status</th>
                <th className="py-3 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1C1C24] text-neutral-300">
              {orders.slice(0, 5).map((order) => (
                <tr key={order.id} className="hover:bg-[#14141B] transition-colors">
                  <td className="py-3.5 px-5 font-mono font-bold text-neutral-400">
                    #{order.id.slice(0, 12)}
                  </td>
                  <td className="py-3.5 px-5">
                    <span className="font-bold text-white block">{order.customer_name}</span>
                    <span className="text-[11px] text-neutral-500">{order.customer_email}</span>
                  </td>
                  <td className="py-3.5 px-5">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                        order.payment_method === 'cod'
                          ? 'bg-[#FF5500]/20 text-[#FF5500] border border-[#FF5500]/40'
                          : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                      }`}
                    >
                      {order.payment_method.toUpperCase()} ({order.payment_status})
                    </span>
                  </td>
                  <td className="py-3.5 px-5 font-display text-lg font-black text-white">
                    ${order.total_amount.toFixed(2)}
                  </td>
                  <td className="py-3.5 px-5">
                    <OrderStatusSelect orderId={order.id} initialStatus={order.order_status} />
                  </td>
                  <td className="py-3.5 px-5 text-right">
                    <Link
                      href={`/admin/orders/${order.id}`}
                      className="inline-flex items-center space-x-1 p-2 text-neutral-400 hover:text-white hover:bg-[#181824] rounded-lg transition-colors"
                      title="View details"
                    >
                      <Eye className="w-4 h-4 text-[#FF5500]" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
