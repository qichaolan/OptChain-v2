'use client';

/**
 * About Page - OptChain
 *
 * Educational disclaimer, open-source info, contact, and liability statement.
 */

import Link from 'next/link';

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-primary-600 hover:text-primary-700 flex items-center gap-2">
            <span>&larr;</span>
            <span>Back to Home</span>
          </Link>
          <h1 className="text-xl font-semibold text-gray-900">About OptChain</h1>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Hero Section */}
        <section className="text-center mb-16">
          <h1 className="text-4xl font-bold text-gray-900 mb-6">About OptChain</h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
            An open-source, AI-powered options analytics platform designed to help investors
            learn, explore, and experiment with stock option strategies in an educational environment.
          </p>
        </section>

        {/* Mission */}
        <section className="mb-12 p-8 bg-white rounded-xl shadow-sm border border-gray-100">
          <p className="text-gray-700 leading-relaxed">
            Our goal is to make complex options concepts&mdash;such as LEAPS, credit spreads,
            and iron condors&mdash;clear and accessible through data-driven insights and interactive tools.
            This project is open to everyone, beginner or advanced, who wants a cleaner, smarter way
            to understand options mechanics.
          </p>
        </section>

        {/* Open Source Section */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
            <span className="text-3xl">&#128214;</span>
            Open Source &amp; Community
          </h2>
          <div className="p-8 bg-white rounded-xl shadow-sm border border-gray-100">
            <p className="text-gray-700 mb-6">
              OptChain is fully open-source and actively developed. We welcome new ideas,
              feature requests, and suggestions.
            </p>
            <div className="space-y-4">
              <a
                href="https://github.com/qichaolan/OptChain-v2"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <span className="text-2xl">&#128187;</span>
                <div>
                  <div className="font-medium text-gray-900">GitHub Repository</div>
                  <div className="text-sm text-gray-500">github.com/qichaolan/OptChain-v2</div>
                </div>
                <span className="ml-auto text-gray-400">&rarr;</span>
              </a>
              <a
                href="https://github.com/qichaolan/OptChain-v2/discussions"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <span className="text-2xl">&#128172;</span>
                <div>
                  <div className="font-medium text-gray-900">Discussions</div>
                  <div className="text-sm text-gray-500">Submit feedback or propose new features</div>
                </div>
                <span className="ml-auto text-gray-400">&rarr;</span>
              </a>
            </div>
            <p className="text-gray-600 mt-6 text-sm">
              If you are interested in contributing, improving documentation, or adding new
              analytics modules, pull requests are always appreciated.
            </p>
          </div>
        </section>

        {/* Contact Section */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
            <span className="text-3xl">&#9993;</span>
            Contact
          </h2>
          <div className="p-8 bg-white rounded-xl shadow-sm border border-gray-100">
            <p className="text-gray-700 mb-4">
              For any questions, technical issues, or feedback, feel free to reach out:
            </p>
            <a
              href="mailto:info@optchain.app"
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
            >
              <span>&#128233;</span>
              <span>info@optchain.app</span>
            </a>
          </div>
        </section>

        {/* Educational Disclaimer */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
            <span className="text-3xl">&#9888;</span>
            Educational Use Only
          </h2>
          <div className="p-8 bg-amber-50 rounded-xl border border-amber-200">
            <p className="text-amber-900 leading-relaxed mb-4">
              OptChain is built <strong>strictly for educational and informational purposes</strong>.
              It is <strong>NOT</strong> intended to provide financial advice, trading recommendations,
              or investment guidance.
            </p>
            <p className="text-amber-900 leading-relaxed mb-4">
              All calculations, AI insights, and projections are estimates based solely on the data
              provided and should not be interpreted as predictions of future performance.
            </p>
            <p className="text-amber-800 font-medium">
              Always perform your own due diligence and consult a licensed financial professional
              before making investment decisions.
            </p>
          </div>
        </section>

        {/* Liability Disclaimer */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
            <span className="text-3xl">&#128737;</span>
            Liability Disclaimer
          </h2>
          <div className="p-8 bg-gray-100 rounded-xl border border-gray-200">
            <p className="text-gray-700 leading-relaxed mb-4">
              OptChain and its contributors provide this software <strong>&quot;as-is&quot; with no warranties</strong>,
              express or implied. By using the application, you agree that:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-700 mb-4">
              <li>You bear full responsibility for any trading decisions you make.</li>
              <li>OptChain does not guarantee accuracy, completeness, or suitability of any results or analytics.</li>
              <li>The project developers, maintainers, and contributors are <strong>not liable</strong> for losses, damages, or outcomes resulting from the use of this website or its tools.</li>
            </ul>
            <p className="text-gray-600 italic">
              This platform is a learning aid&mdash;not a trading system.
            </p>
          </div>
        </section>

        {/* Thank You Section */}
        <section className="text-center p-8 bg-primary-50 rounded-xl border border-primary-100">
          <div className="text-4xl mb-4">&#128161;</div>
          <h2 className="text-2xl font-bold text-primary-900 mb-4">
            Thank You for Being Part of the Community
          </h2>
          <p className="text-primary-700">
            Your feedback and contributions directly shape the evolution of OptChain.
            Together, we can build the best open-source hub for options education and analytics.
          </p>
        </section>

        {/* Back to Home */}
        <div className="mt-12 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-medium"
          >
            <span>&larr;</span>
            <span>Back to Home</span>
          </Link>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-200 mt-12 py-8 text-center text-gray-500 text-sm">
        <p>&copy; {new Date().getFullYear()} OptChain. Open-source project.</p>
      </footer>
    </main>
  );
}
