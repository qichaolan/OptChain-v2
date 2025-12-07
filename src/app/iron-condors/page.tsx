'use client';

/**
 * Iron Condors Page with AI Integration
 */

import { IronCondorPageWithAI } from '@/components/wrappers';

export default function IronCondorsPage() {
  // Use proxied embed path - Next.js rewrites this to the backend
  return <IronCondorPageWithAI pageUrl="/embed/iron-condors" />;
}
