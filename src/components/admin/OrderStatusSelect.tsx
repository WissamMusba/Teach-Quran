'use client';

import React, { useState } from 'react';
import { OrderStatus } from '@/lib/types';
import { Loader2 } from 'lucide-react';

interface OrderStatusSelectProps {
  orderId: string;
  initialStatus: OrderStatus;
  onStatusChange?: (newStatus: OrderStatus) => void;
}

const STATUS_CONFIG: Record<OrderStatus, { label: string; badgeClass: string }> = {
  new: { label: 'New', badgeClass: 'bg-blue-50 text-blue-700 border-blue-200' },
  packed: { label: 'Packed', badgeClass: 'bg-amber-50 text-amber-700 border-amber-200' },
  shipped: { label: 'Shipped', badgeClass: 'bg-purple-50 text-purple-700 border-purple-200' },
  delivered: { label: 'Delivered', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  cancelled: { label: 'Cancelled', badgeClass: 'bg-neutral-100 text-neutral-600 border-neutral-300' },
};

export const OrderStatusSelect: React.FC<OrderStatusSelectProps> = ({
  orderId,
  initialStatus,
  onStatusChange,
}) => {
  const [status, setStatus] = useState<OrderStatus>(initialStatus);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value as OrderStatus;
    setStatus(newStatus);
    setIsUpdating(true);

    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        throw new Error('Failed to update status');
      }

      onStatusChange?.(newStatus);
    } catch (err) {
      console.error(err);
      setStatus(initialStatus); // revert
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="relative inline-flex items-center space-x-2">
      <select
        value={status}
        onChange={handleChange}
        disabled={isUpdating}
        className={`text-xs font-bold uppercase tracking-wider py-1.5 px-3 rounded-lg border appearance-none pr-8 cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-500/20 ${STATUS_CONFIG[status]?.badgeClass}`}
      >
        <option value="new">New</option>
        <option value="packed">Packed</option>
        <option value="shipped">Shipped</option>
        <option value="delivered">Delivered</option>
        <option value="cancelled">Cancelled</option>
      </select>

      {isUpdating && (
        <Loader2 className="w-3.5 h-3.5 animate-spin text-neutral-400 absolute right-2 pointer-events-none" />
      )}
    </div>
  );
};
