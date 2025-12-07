import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { CopilotProvider, OptionChainProvider } from '@/contexts';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'OptionChain v2 - AI-Powered Options Analysis',
  description: 'CopilotKit-enabled options trading analysis tool with LEAPS, Credit Spreads, and Iron Condors',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <OptionChainProvider>
          <CopilotProvider>
            {children}
          </CopilotProvider>
        </OptionChainProvider>
      </body>
    </html>
  );
}
