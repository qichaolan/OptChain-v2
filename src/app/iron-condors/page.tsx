'use client';

/**
 * Iron Condors Page with AI Integration
 */

import { IronCondorPageWithAI } from '@/components/wrappers';

export default function IronCondorsPage() {
  // In production, this would point to your deployed FastAPI backend
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080';

  return <IronCondorPageWithAI pageUrl={`${backendUrl}/iron-condors`} />;
}
