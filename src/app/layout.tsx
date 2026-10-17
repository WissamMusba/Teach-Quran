import type { Metadata, Viewport } from 'next';
import './globals.css';
import { CartProvider } from '@/context/CartContext';
import { getSiteUrl } from '@/lib/site';

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: 'Seven Districts Cricket Academy | Pro Shop — Ajman, UAE',
    template: '%s | Seven Districts Cricket Academy',
  },
  description:
    'Official Equipment Store of Seven Districts Cricket Academy (TSDCA) in Ajman, UAE. Tournament Grade 1 English Willow bats, match leather balls, protective armor, and gear with Card and COD delivery across the Emirates.',
  applicationName: 'Seven Districts Cricket Academy',
  openGraph: {
    type: 'website',
    locale: 'en_AE',
    siteName: 'Seven Districts Cricket Academy',
    title: 'Seven Districts Cricket Academy | Pro Shop — Ajman, UAE',
    description:
      'Official Equipment Store of Seven Districts Cricket Academy (TSDCA) in Ajman, UAE. Tournament Grade 1 English Willow bats, protective armor, and match gear.',
  },
};

export const viewport: Viewport = {
  themeColor: '#050505',
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
