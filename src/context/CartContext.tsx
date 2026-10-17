'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { CartItem } from '@/lib/types';

interface CartContextType {
  cart: CartItem[];
  addToCart: (item: CartItem) => void;
  removeFromCart: (productId: string, selectedOptions?: Record<string, string>) => void;
  updateQuantity: (productId: string, quantity: number, selectedOptions?: Record<string, string>) => void;
  clearCart: () => void;
  totalAmount: number;
  totalItems: number;
  isCartDrawerOpen: boolean;
  setIsCartDrawerOpen: (open: boolean) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

function matchOptions(opt1?: Record<string, string>, opt2?: Record<string, string>): boolean {
  if (!opt1 && !opt2) return true;
  if (!opt1 || !opt2) return false;
  const keys1 = Object.keys(opt1);
  const keys2 = Object.keys(opt2);
  if (keys1.length !== keys2.length) return false;
  return keys1.every((key) => opt1[key] === opt2[key]);
}

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartDrawerOpen, setIsCartDrawerOpen] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('cricket_store_cart');
      if (saved) {
        setCart(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Failed to parse cart from localStorage:', e);
    }
    setIsLoaded(true);
  }, []);

  // Save to localStorage whenever cart updates
  useEffect(() => {
    if (isLoaded) {
      try {
        localStorage.setItem('cricket_store_cart', JSON.stringify(cart));
      } catch (e) {
        console.error('Failed to save cart to localStorage:', e);
      }
    }
  }, [cart, isLoaded]);

  const addToCart = useCallback((newItem: CartItem) => {
    setCart((prev) => {
      const existingIndex = prev.findIndex(
        (item) => item.productId === newItem.productId && matchOptions(item.selectedOptions, newItem.selectedOptions)
      );

      if (existingIndex > -1) {
        const updated = [...prev];
        const newQty = Math.min(updated[existingIndex].quantity + newItem.quantity, newItem.maxStock || 99);
        updated[existingIndex] = { ...updated[existingIndex], quantity: newQty };
        return updated;
      }

      return [...prev, newItem];
    });
    setIsCartDrawerOpen(true);
  }, []);

  const removeFromCart = useCallback((productId: string, selectedOptions?: Record<string, string>) => {
    setCart((prev) =>
      prev.filter(
        (item) => !(item.productId === productId && matchOptions(item.selectedOptions, selectedOptions))
      )
    );
  }, []);

  const updateQuantity = useCallback((
    productId: string,
    quantity: number,
    selectedOptions?: Record<string, string>
  ) => {
    if (quantity <= 0) {
      removeFromCart(productId, selectedOptions);
      return;
    }

    setCart((prev) =>
      prev.map((item) => {
        if (item.productId === productId && matchOptions(item.selectedOptions, selectedOptions)) {
          const clamped = Math.min(quantity, item.maxStock || 99);
          return { ...item, quantity: clamped };
        }
        return item;
      })
    );
  }, [removeFromCart]);

  const clearCart = useCallback(() => {
    setCart([]);
    try {
      localStorage.removeItem('cricket_store_cart');
    } catch {}
  }, []);

  const totalAmount = useMemo(
    () => cart.reduce((acc, item) => acc + item.price * item.quantity, 0),
    [cart]
  );

  const totalItems = useMemo(
    () => cart.reduce((acc, item) => acc + item.quantity, 0),
    [cart]
  );

  const contextValue = useMemo(
    () => ({
      cart,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      totalAmount,
      totalItems,
      isCartDrawerOpen,
      setIsCartDrawerOpen,
    }),
    [
      cart,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      totalAmount,
      totalItems,
      isCartDrawerOpen,
    ]
  );

  return (
    <CartContext.Provider value={contextValue}>
      {children}
    </CartContext.Provider>
  );
};

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
