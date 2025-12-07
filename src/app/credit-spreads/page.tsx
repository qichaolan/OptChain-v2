'use client';

/**
 * Credit Spreads Page with AI Integration
 */

import { CreditSpreadsPageWithAI } from '@/components/wrappers';

export default function CreditSpreadsPage() {
  // Use proxied embed path - Next.js rewrites this to the backend
  return <CreditSpreadsPageWithAI pageUrl="/embed/credit-spreads" />;
}
