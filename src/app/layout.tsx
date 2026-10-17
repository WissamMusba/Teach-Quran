import type { Metadata } from 'next';
import './globals.css';
import { CartProvider } from '@/context/CartContext';

export const metadata: Metadata = {
  title: 'CRICKET STORE | Pro:Direct Cricket Gear & Match Equipment',
  description: 'Engineered for tournament performance. High-impact Grade 1 English Willow bats, protective pads, gloves, helmets, and match leather balls.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark bg-[#050505]">
      <body className="min-h-screen bg-[#050505] text-white selection:bg-[#FF5500] selection:text-white antialiased font-sans">
        <CartProvider>{children}</CartProvider>
      </body>
    </html>
  );
}
