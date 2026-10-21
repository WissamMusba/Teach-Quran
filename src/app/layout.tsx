import type { Metadata, Viewport } from 'next';
import './globals.css';
import { CartProvider } from '@/context/CartContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { getSiteUrl } from '@/lib/site';

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: 'CG Sports | Pro Cricket Shop — Located at Seven Districts, Ajman, UAE',
    template: '%s | CG Sports',
  },
  description:
    'Official Equipment Store of CG Sports, located at Seven Districts Cricket Academy in Ajman, UAE. Tournament Grade 1 English Willow bats, match leather balls, protective armor, and gear with Card and COD delivery across the Emirates.',
  applicationName: 'CG Sports',
  openGraph: {
    type: 'website',
    locale: 'en_AE',
    siteName: 'CG Sports',
    title: 'CG Sports | Pro Cricket Shop — Located at Seven Districts, Ajman, UAE',
    description:
      'Official Equipment Store of CG Sports, located at Seven Districts Cricket Academy in Ajman, UAE. Tournament Grade 1 English Willow bats, protective armor, and match gear.',
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
            __html: `(function(){try{document.documentElement.classList.add('js');var t=localStorage.getItem('sdca_theme');if(t==='light'){document.documentElement.classList.remove('dark');document.documentElement.classList.add('light');}else{document.documentElement.classList.add('dark');document.documentElement.classList.remove('light');}}catch(e){}})();`,
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
