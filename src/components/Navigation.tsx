'use client';

/**
 * Shared Navigation Component
 *
 * Provides consistent navigation across all pages with links to:
 * - Home (Chain Analysis)
 * - LEAPS
 * - Credit Spreads
 * - Iron Condors
 */

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';

interface NavigationProps {
  title?: string;
  subtitle?: string;
}

export function Navigation({ title = 'OptChain', subtitle }: NavigationProps) {
  const pathname = usePathname();

  const navItems = [
    { href: '/', label: 'Chain', color: 'gray' },
    { href: '/leaps', label: 'LEAPS', color: 'blue' },
    { href: '/credit-spreads', label: 'Credit Spreads', color: 'green' },
    { href: '/iron-condors', label: 'Iron Condors', color: 'purple' },
  ];

  const getNavItemClass = (href: string, color: string) => {
    const isActive = pathname === href || (href === '/' && pathname === '/chain-analysis');
    const baseClass = 'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1';

    if (isActive) {
      switch (color) {
        case 'blue':
          return `${baseClass} bg-blue-600 text-white`;
        case 'green':
          return `${baseClass} bg-green-600 text-white`;
        case 'purple':
          return `${baseClass} bg-purple-600 text-white`;
        default:
          return `${baseClass} bg-gray-600 text-white`;
      }
    }

    switch (color) {
      case 'blue':
        return `${baseClass} bg-blue-50 text-blue-700 hover:bg-blue-100`;
      case 'green':
        return `${baseClass} bg-green-50 text-green-700 hover:bg-green-100`;
      case 'purple':
        return `${baseClass} bg-purple-50 text-purple-700 hover:bg-purple-100`;
      default:
        return `${baseClass} bg-gray-50 text-gray-700 hover:bg-gray-100`;
    }
  };

  // Header height is defined here as a CSS variable for consistent layout
  // Mobile: ~100px (2 rows with nav), Desktop: 56px (1 row)
  // Using CSS media query in style for proper responsive handling

  return (
    <>
      {/* CSS for responsive header height variable */}
      <style jsx global>{`
        :root {
          --app-header-height: 100px;
        }
        @media (min-width: 768px) {
          :root {
            --app-header-height: 56px;
          }
        }
      `}</style>
      <header
        className="fixed top-0 left-0 right-0 z-[60] bg-gradient-to-r from-white to-gray-50 border-b border-gray-200 px-4 py-2 shadow-sm"
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 md:gap-3">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2.5 text-xl font-bold text-gray-900 hover:text-blue-600 transition-colors">
            <Image
              src="/opt.png"
              alt="OptChain Logo"
              width={40}
              height={40}
              className="rounded-md"
            />
            {title}
          </Link>
            {subtitle && (
              <span className="text-gray-400 text-sm hidden sm:inline">|</span>
            )}
            {subtitle && (
              <span className="text-gray-600 text-sm hidden sm:inline">{subtitle}</span>
            )}
          </div>
          <nav className="flex flex-wrap gap-2 bg-gray-100/80 rounded-xl px-3 py-2 border border-gray-200/60 shadow-inner">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={getNavItemClass(item.href, item.color)}
              >
                <span>{item.label}</span>
              </Link>
            ))}
        </nav>
      </div>
      </header>
    </>
  );
}

export default Navigation;
