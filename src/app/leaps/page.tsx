'use client';

/**
 * LEAPS Page with AI Integration
 */

import { LeapsPageWithAI } from '@/components/wrappers';

export default function LeapsPage() {
  // Use proxied embed path - Next.js rewrites this to the backend
  return <LeapsPageWithAI pageUrl="/embed/leaps" />;
}
