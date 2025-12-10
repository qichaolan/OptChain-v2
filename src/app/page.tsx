import { redirect } from 'next/navigation';

/**
 * Home Page - OptChain v2
 *
 * Redirects to Chain Analysis page (the main home page)
 */
export default function Home() {
  redirect('/chain-analysis');
}
