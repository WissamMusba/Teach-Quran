'use client';

import { useEffect, useRef } from 'react';
import { useCart } from '@/context/CartContext';

/**
 * Clears the cart exactly once, and only after the order confirmation page
 * has verified the order token. Clearing on checkout submit (the old
 * behaviour) wiped the cart even when the customer abandoned or failed
 * payment.
 */
export default function ClearCartOnMount() {
  const { clearCart } = useCart();
  const cleared = useRef(false);

  useEffect(() => {
    if (cleared.current) return;
    cleared.current = true;
    clearCart();
  }, [clearCart]);

  return null;
}
