import { redirect } from 'next/navigation';

// Force dynamic rendering to avoid SSG issues with context providers
export const dynamic = 'force-dynamic';

/**
 * Home Page - OptChain
 *
 * Redirects to Chain Analysis page (the main home page)
 */
export default function Home() {
  redirect('/chain-analysis');
}
