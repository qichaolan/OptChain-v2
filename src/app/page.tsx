'use client';

/**
 * Home Page - OptChain v2
 *
 * Landing page with navigation to different strategy pages.
 */

import Link from 'next/link';

// Configurable original app URL (defaults to localhost in development)
const ORIGINAL_APP_URL = process.env.NEXT_PUBLIC_ORIGINAL_APP_URL || 'http://localhost:8080';

export default function Home() {
  return (
    <main className="min-h-screen p-8">
      {/* Header */}
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            OptionChain v2
          </h1>
          <p className="text-xl text-gray-600">
            AI-Powered Options Analysis with CopilotKit
          </p>
          <div className="mt-4 inline-flex items-center gap-2 bg-primary-100 text-primary-700 px-4 py-2 rounded-full text-sm">
            <span>🤖</span>
            <span>Experimental Version</span>
          </div>
        </div>

        {/* Strategy Cards */}
        <div className="grid md:grid-cols-3 gap-6">
          {/* LEAPS Card */}
          <Link
            href="/leaps"
            className="group block p-6 bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-200 border border-gray-100"
          >
            <div className="text-3xl mb-4">📈</div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2 group-hover:text-primary-600">
              LEAPS Ranker
            </h2>
            <p className="text-gray-600 text-sm">
              Long-term options analysis with ROI simulation and AI-powered insights.
            </p>
            <div className="mt-4 text-primary-600 text-sm font-medium flex items-center gap-1">
              <span>Explore</span>
              <span>→</span>
            </div>
          </Link>

          {/* Credit Spreads Card */}
          <Link
            href="/credit-spreads"
            className="group block p-6 bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-200 border border-gray-100"
          >
            <div className="text-3xl mb-4">💰</div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2 group-hover:text-primary-600">
              Credit Spreads
            </h2>
            <p className="text-gray-600 text-sm">
              Put and call credit spread screener with probability analysis.
            </p>
            <div className="mt-4 text-primary-600 text-sm font-medium flex items-center gap-1">
              <span>Explore</span>
              <span>→</span>
            </div>
          </Link>

          {/* Iron Condors Card */}
          <Link
            href="/iron-condors"
            className="group block p-6 bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-200 border border-gray-100"
          >
            <div className="text-3xl mb-4">🦅</div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2 group-hover:text-primary-600">
              Iron Condors
            </h2>
            <p className="text-gray-600 text-sm">
              Neutral strategy screener for range-bound markets.
            </p>
            <div className="mt-4 text-primary-600 text-sm font-medium flex items-center gap-1">
              <span>Explore</span>
              <span>→</span>
            </div>
          </Link>
        </div>

        {/* Info Section */}
        <div className="mt-12 p-6 bg-blue-50 rounded-xl border border-blue-100">
          <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
            <span>ℹ️</span>
            About OptChain v2
          </h3>
          <p className="text-blue-800 text-sm mb-4">
            This is an experimental version of OptionChain with CopilotKit AI integration.
            It wraps the existing pages and adds an AI Insights panel powered by Google Gemini.
          </p>
          <div className="flex flex-wrap gap-2">
            <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs">
              React + TypeScript
            </span>
            <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs">
              CopilotKit
            </span>
            <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs">
              Google Gemini
            </span>
            <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs">
              Next.js 14
            </span>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-12 text-center text-gray-500 text-sm">
          <p>
            Original app running at{' '}
            <a
              href={ORIGINAL_APP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-600 hover:underline"
            >
              {ORIGINAL_APP_URL.replace(/^https?:\/\//, '')}
            </a>
          </p>
        </footer>
      </div>
    </main>
  );
}
