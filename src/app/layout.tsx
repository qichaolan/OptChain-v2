import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/Providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: {
    default: 'OptChain - AI-Powered Options Analysis',
    template: '%s | OptChain',
  },
  description: 'Free AI-powered stock options analysis tool. Screen LEAPS, Credit Spreads, Iron Condors with real-time data and intelligent insights. Built with Google Gemini AI.',
  keywords: [
    'options trading',
    'options analysis',
    'LEAPS options',
    'credit spreads',
    'iron condors',
    'options screener',
    'stock options',
    'AI trading',
    'options chain',
    'put credit spread',
    'call credit spread',
    'options strategy',
    'delta',
    'implied volatility',
    'ROI calculator',
  ],
  authors: [{ name: 'OptChain' }],
  creator: 'OptChain',
  publisher: 'OptChain',
  metadataBase: new URL('https://optchain.app'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://optchain.app',
    siteName: 'OptChain',
    title: 'OptChain - AI-Powered Options Analysis',
    description: 'Free AI-powered stock options analysis tool. Screen LEAPS, Credit Spreads, Iron Condors with real-time data and intelligent insights.',
    images: [
      {
        url: '/opt.png',
        width: 512,
        height: 512,
        alt: 'OptChain Logo',
      },
    ],
  },
  twitter: {
    card: 'summary',
    title: 'OptChain - AI-Powered Options Analysis',
    description: 'Free AI-powered stock options screener for LEAPS, Credit Spreads, and Iron Condors.',
    images: ['/opt.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: '/opt.png',
    shortcut: '/opt.png',
    apple: '/opt.png',
  },
  manifest: '/manifest.json',
  category: 'finance',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
