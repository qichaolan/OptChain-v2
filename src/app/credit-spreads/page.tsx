'use client';

/**
 * Credit Spreads Page with AI Integration
 */

import { CreditSpreadsPageWithAI } from '@/components/wrappers';

export default function CreditSpreadsPage() {
  // In production, this would point to your deployed FastAPI backend
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080';

  return <CreditSpreadsPageWithAI pageUrl={`${backendUrl}/credit-spreads`} />;
}
