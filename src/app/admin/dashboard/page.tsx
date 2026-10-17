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

export const revalidate = 0; // always fresh in admin

export default async function AdminDashboardPage() {
  const [orders, products] = await Promise.all([getOrders(), getProducts()]);

  const totalRevenue = orders
    .filter((o) => o.payment_status === 'paid')
    .reduce((acc, curr) => acc + curr.total_amount, 0);

  const pendingOrders = orders.filter((o) => o.order_status === 'new').length;
  const lowStockProducts = products.filter((p) => p.stock_quantity <= 5);
  const activeProducts = products.filter((p) => p.is_active).length;

  return (
    <div className="space-y-8 max-w-7xl">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-neutral-900 tracking-tight">
            Inventory & Sales Dashboard
          </h1>
          <p className="text-xs text-neutral-500 mt-1">
            Real-time cricket equipment metrics, stock health, and recent customer orders.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <Link
            href="/admin/products/new"
            className="inline-flex items-center space-x-1.5 px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-sm active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>New Gear</span>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Revenue */}
        <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-xs flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-neutral-500 block uppercase tracking-wider">
              Settled Revenue
            </span>
            <span className="text-2xl font-black text-neutral-900">
              ${totalRevenue.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Total Orders */}
        <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-xs flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-neutral-500 block uppercase tracking-wider">
              Total Orders
            </span>
            <div className="flex items-baseline space-x-2">
              <span className="text-2xl font-black text-neutral-900">{orders.length}</span>
              {pendingOrders > 0 && (
                <span className="text-xs text-orange-600 font-bold">({pendingOrders} new)</span>
              )}
            </div>
          </div>
        </div>

        {/* Active Gear */}
        <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-xs flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-neutral-100 text-neutral-800 flex items-center justify-center shrink-0">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-neutral-500 block uppercase tracking-wider">
              Active Inventory
            </span>
            <span className="text-2xl font-black text-neutral-900">{activeProducts} Items</span>
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-xs flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-neutral-500 block uppercase tracking-wider">
              Low Stock Alert
            </span>
            <span className="text-2xl font-black text-neutral-900">
              {lowStockProducts.length} Items
            </span>
          </div>
        </div>
      </div>

      {/* Low Stock Attention List */}
      {lowStockProducts.length > 0 && (
        <div className="bg-amber-50/60 border border-amber-200 rounded-2xl p-5 space-y-3">
          <div className="flex items-center space-x-2 text-amber-800 font-bold text-sm">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span>Low Stock Attention Needed (&le; 5 units remaining)</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {lowStockProducts.map((p) => (
              <div
                key={p.id}
                className="bg-white border border-amber-200/80 rounded-xl p-3 flex items-center justify-between text-xs"
              >
                <div className="min-w-0 pr-2">
                  <span className="font-bold text-neutral-900 block truncate">{p.title}</span>
                  <span className="text-neutral-500">{p.brand} • ${p.price.toFixed(2)}</span>
                </div>
                <span className="font-mono font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                  {p.stock_quantity} left
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Orders Preview */}
      <div className="bg-white border border-neutral-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="p-5 border-b border-neutral-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-neutral-900">Recent Customer Orders</h2>
            <p className="text-xs text-neutral-500">Live order flow with immediate status dispatcher</p>
          </div>
          <Link
            href="/admin/orders"
            className="text-xs font-bold text-orange-600 hover:text-orange-500 flex items-center space-x-1"
          >
            <span>View All Orders</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-50 text-neutral-500 font-bold uppercase tracking-wider border-b border-neutral-100">
              <tr>
                <th className="py-3 px-5">Order ID</th>
                <th className="py-3 px-5">Customer</th>
                <th className="py-3 px-5">Payment</th>
                <th className="py-3 px-5">Total</th>
                <th className="py-3 px-5">Order Status</th>
                <th className="py-3 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 text-neutral-800">
              {orders.slice(0, 5).map((order) => (
                <tr key={order.id} className="hover:bg-neutral-50/50 transition-colors">
                  <td className="py-3.5 px-5 font-mono font-medium text-neutral-600">
                    #{order.id.slice(0, 12)}
                  </td>
                  <td className="py-3.5 px-5">
                    <span className="font-bold text-neutral-900 block">{order.customer_name}</span>
                    <span className="text-[11px] text-neutral-500">{order.customer_email}</span>
                  </td>
                  <td className="py-3.5 px-5">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold uppercase ${
                        order.payment_method === 'cod'
                          ? 'bg-orange-100 text-orange-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {order.payment_method.toUpperCase()} ({order.payment_status})
                    </span>
                  </td>
                  <td className="py-3.5 px-5 font-bold text-neutral-900">
                    ${order.total_amount.toFixed(2)}
                  </td>
                  <td className="py-3.5 px-5">
                    <OrderStatusSelect orderId={order.id} initialStatus={order.order_status} />
                  </td>
                  <td className="py-3.5 px-5 text-right">
                    <Link
                      href={`/admin/orders/${order.id}`}
                      className="inline-flex items-center space-x-1 p-1.5 text-neutral-500 hover:text-orange-600 hover:bg-neutral-100 rounded-lg transition-colors"
                      title="View details"
                    >
                      <Eye className="w-4 h-4" />
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
