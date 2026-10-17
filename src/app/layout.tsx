import type { Metadata } from 'next';
import './globals.css';
import { CartProvider } from '@/context/CartContext';

export const metadata: Metadata = {
  title: 'CRICKET STORE | Premium Cricket Bats & Professional Gear',
  description: 'Engineered for the perfect stroke. Buy authentic Grade 1 English Willow bats, protective pads, gloves, helmets, and match balls.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-neutral-900 selection:bg-orange-500 selection:text-white">
        <CartProvider>
          {children}
        </CartProvider>
      </body>
    </html>
  );
}
