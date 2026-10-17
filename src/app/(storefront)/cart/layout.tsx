import type { Metadata } from 'next';

// The cart is per-shopper state and should never be indexed.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function CartLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
