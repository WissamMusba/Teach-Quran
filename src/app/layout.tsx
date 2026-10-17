import type { Metadata, Viewport } from 'next';
import './globals.css';
import { CartProvider } from '@/context/CartContext';
import { ThemeProvider } from '@/context/ThemeContext';
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
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('sdca_theme');if(t==='light'){document.documentElement.classList.remove('dark');document.documentElement.classList.add('light');}else{document.documentElement.classList.add('dark');document.documentElement.classList.remove('light');}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-screen bg-white text-neutral-900 dark:bg-[#050505] dark:text-white selection:bg-[#FF5500] selection:text-white antialiased font-sans">
        <ThemeProvider>
          <CartProvider>{children}</CartProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
