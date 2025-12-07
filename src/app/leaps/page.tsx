'use client';

/**
 * LEAPS Page with AI Integration
 */

import { LeapsPageWithAI } from '@/components/wrappers';

export default function LeapsPage() {
  // In production, this would point to your deployed FastAPI backend
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080';

  return <LeapsPageWithAI pageUrl={backendUrl} />;
}
