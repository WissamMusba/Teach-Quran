'use client';

import React, { useState } from 'react';
import { Loader2, BadgeCheck, Undo2 } from 'lucide-react';
import { PaymentStatus } from '@/lib/types';

interface PaymentStatusControlProps {
  orderId: string;
  method: 'card' | 'cod';
  initialStatus: PaymentStatus;
}

/**
 * Manual payment reconciliation for staff — mainly for Cash on Delivery
 * orders once the courier collects the amount. Card payments are reconciled
 * automatically by the Stripe webhook; this is the fallback.
 */
export const PaymentStatusControl: React.FC<PaymentStatusControlProps> = ({
  orderId,
  method,
  initialStatus,
}) => {
  const [status, setStatus] = useState<PaymentStatus>(initialStatus);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState('');

  const update = async (next: PaymentStatus, confirmMessage: string) => {
    if (!window.confirm(confirmMessage)) return;

    const previous = status;
    setStatus(next);
    setIsUpdating(true);
    setError('');

    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_status: next }),
      });
      if (!res.ok) throw new Error('Failed to update payment status');
    } catch (err) {
      console.error(err);
      setStatus(previous);
      setError('Could not update payment status. Please try again.');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="pt-1 space-y-2">
      {status === 'pending' ? (
        <button
          type="button"
          onClick={() =>
            update(
              'paid',
              method === 'cod'
                ? 'Confirm the courier has collected the cash for this order?'
                : 'Mark this order as paid? Only do this if payment has actually been received.'
            )
          }
          disabled={isUpdating}
          className="w-full inline-flex items-center justify-center space-x-1.5 text-[11px] font-black uppercase tracking-wider py-2 px-3 rounded-xl bg-emerald-950/80 text-emerald-300 border border-emerald-700/80 hover:bg-emerald-900/80 disabled:opacity-50 transition-colors"
        >
          {isUpdating ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <BadgeCheck className="w-3.5 h-3.5" />
          )}
          <span>{method === 'cod' ? 'Mark Cash Received' : 'Mark Payment Received'}</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() =>
            update('pending', 'Move this order back to "payment pending"? Use this if the status was set by mistake.')
          }
          disabled={isUpdating}
          className="w-full inline-flex items-center justify-center space-x-1.5 text-[10px] font-bold uppercase tracking-wider py-2 px-3 rounded-xl bg-[#121218] text-neutral-400 border border-[#252530] hover:text-white hover:border-neutral-500 disabled:opacity-50 transition-colors"
        >
          {isUpdating ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Undo2 className="w-3 h-3" />
          )}
          <span>Reset to Pending</span>
        </button>
      )}

      {error && (
        <p role="alert" className="text-[10px] text-red-400 font-semibold">
          {error}
        </p>
      )}
    </div>
  );
};
