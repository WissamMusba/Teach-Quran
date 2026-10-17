import type { Metadata } from 'next';

// Checkout and order confirmation pages must never appear in search results.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
