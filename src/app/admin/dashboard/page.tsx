import React from 'react';
import Link from 'next/link';
import { getOrders, getProducts } from '@/lib/supabaseServer';
import { requireAdminPage } from '@/lib/adminGuard';
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
  await requireAdminPage();
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

      {/* KPI Cards — responsive 2 columns on foldables & phones, 4 on desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Revenue */}
        <div className="liquid-glass-card rounded-2xl p-3.5 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:space-x-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(16,185,129,0.15)]">
            <DollarSign className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] sm:text-[11px] font-black text-neutral-400 block uppercase tracking-wider truncate">
              Revenue
            </span>
            <div className="flex items-baseline space-x-1">
              <span className="text-[10px] sm:text-xs font-black text-[#FF5500]">AED</span>
              <span className="font-display text-xl sm:text-3xl font-black text-white truncate">
                {totalRevenue.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Total Orders */}
        <div className="liquid-glass-card rounded-2xl p-3.5 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:space-x-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-[#FF5500]/15 border border-[#FF5500]/30 text-[#FF5500] flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(255,85,0,0.15)]">
            <ShoppingBag className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] sm:text-[11px] font-black text-neutral-400 block uppercase tracking-wider truncate">
              Orders
            </span>
            <div className="flex items-baseline space-x-1.5">
              <span className="font-display text-xl sm:text-3xl font-black text-white">{orders.length}</span>
              {pendingOrders > 0 && (
                <span className="text-[10px] sm:text-xs text-[#FF5500] font-black truncate">({pendingOrders} new)</span>
              )}
            </div>
          </div>
        </div>

        {/* Active Gear */}
        <div className="liquid-glass-card rounded-2xl p-3.5 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:space-x-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-white/5 border border-white/10 text-white flex items-center justify-center shrink-0">
            <Package className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] sm:text-[11px] font-black text-neutral-400 block uppercase tracking-wider truncate">
              Active Gear
            </span>
            <span className="font-display text-xl sm:text-3xl font-black text-white truncate block">
              {activeProducts} Items
            </span>
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div className="liquid-glass-card rounded-2xl p-3.5 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:space-x-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(245,158,11,0.15)]">
            <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] sm:text-[11px] font-black text-neutral-400 block uppercase tracking-wider truncate">
              Low Stock
            </span>
            <span className="font-display text-xl sm:text-3xl font-black text-white truncate block">
              {lowStockProducts.length} Items
            </span>
          </div>
        </div>
      </div>

      {/* Low Stock Attention List */}
      {lowStockProducts.length > 0 && (
        <div className="liquid-glass-orange rounded-2xl p-4 sm:p-5 space-y-3">
          <div className="flex items-center space-x-2 text-amber-300 font-bold text-xs uppercase tracking-wider">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span>Low Stock Attention Needed (&le; 5 units remaining)</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3">
            {lowStockProducts.map((p) => (
              <div
                key={p.id}
                className="liquid-glass rounded-xl p-3 flex items-center justify-between text-xs"
              >
                <div className="min-w-0 pr-2">
                  <span className="font-bold text-white block truncate">{p.title}</span>
                  <span className="text-neutral-400 font-mono text-[11px]">
                    {p.brand} • AED {p.price.toLocaleString()}
                  </span>
                </div>
                <span className="font-mono font-bold text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/40 shrink-0">
                  {p.stock_quantity} left
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Orders Preview */}
      <div className="liquid-glass rounded-2xl shadow-xl overflow-hidden border border-white/10">
        <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between bg-white/[0.02] gap-2">
          <div>
            <h2 className="font-display uppercase text-xl sm:text-2xl font-black text-white tracking-wide">
              Recent Orders
            </h2>
            <p className="text-[11px] text-neutral-400">Live order flow with immediate status dispatcher</p>
          </div>
          <Link
            href="/admin/orders"
            className="text-xs font-black uppercase tracking-wider text-[#FF5500] hover:text-[#FF6600] flex items-center space-x-1 shrink-0 touch-target items-center"
          >
            <span>View All</span>
            <ArrowRight className="w-3.5 h-3.5 text-[#FF5500]" />
          </Link>
        </div>

        {/* Mobile / Foldable Recent Orders Card View */}
        <div className="md:hidden divide-y divide-white/5">
          {orders.slice(0, 5).map((order) => (
            <div key={order.id} className="p-4 space-y-3 hover:bg-white/[0.03] transition-colors">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs font-bold text-neutral-400">
                  #{order.id.slice(0, 12)}
                </span>
                <span
                  className={`inline-block px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                    order.payment_method === 'cod'
                      ? 'bg-[#FF5500]/20 text-[#FF5500] border border-[#FF5500]/40'
                      : order.payment_method === 'bank_transfer'
                      ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
                      : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                  }`}
                >
                  {order.payment_method === 'bank_transfer' ? 'BANK TRANSFER' : order.payment_method.toUpperCase()} ({order.payment_status})
                </span>
              </div>

              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className="font-bold text-sm text-white block truncate">{order.customer_name}</span>
                  <span className="text-xs text-neutral-400 block truncate">{order.customer_email}</span>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-[10px] text-[#FF5500] font-black mr-1">AED</span>
                  <span className="font-display text-xl font-black text-white">
                    {order.total_amount.toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 pt-2 border-t border-white/5">
                <div className="flex-1 max-w-[200px]">
                  <OrderStatusSelect orderId={order.id} initialStatus={order.order_status} />
                </div>
                <Link
                  href={`/admin/orders/${order.id}`}
                  className="inline-flex items-center gap-1.5 px-3 py-2 liquid-glass-pill hover:bg-white/10 text-xs font-bold uppercase tracking-wider text-white rounded-xl transition-colors shrink-0"
                >
                  <Eye className="w-3.5 h-3.5 text-[#FF5500]" />
                  <span>Inspect</span>
                </Link>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-white/[0.02] text-neutral-400 font-bold uppercase tracking-wider border-b border-white/10">
              <tr>
                <th className="py-3 px-5">Order ID</th>
                <th className="py-3 px-5">Customer</th>
                <th className="py-3 px-5">Payment</th>
                <th className="py-3 px-5">Total</th>
                <th className="py-3 px-5">Order Status</th>
                <th className="py-3 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-neutral-300">
              {orders.slice(0, 5).map((order) => (
                <tr key={order.id} className="hover:bg-white/[0.03] transition-colors">
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
                          : order.payment_method === 'bank_transfer'
                          ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
                          : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                      }`}
                    >
                      {order.payment_method === 'bank_transfer' ? 'BANK TRANSFER' : order.payment_method.toUpperCase()} ({order.payment_status})
                    </span>
                  </td>
                  <td className="py-3.5 px-5 font-display text-lg font-black text-white">
                    AED {order.total_amount.toLocaleString()}
                  </td>
                  <td className="py-3.5 px-5">
                    <OrderStatusSelect orderId={order.id} initialStatus={order.order_status} />
                  </td>
                  <td className="py-3.5 px-5 text-right">
                    <Link
                      href={`/admin/orders/${order.id}`}
                      className="inline-flex items-center space-x-1 p-2 text-neutral-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
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
