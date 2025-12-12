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
    { href: '/', label: 'Chain', mobileLabel: 'Chain', color: 'gray' },
    { href: '/leaps', label: 'LEAPS', mobileLabel: 'LEAPS', color: 'blue' },
    { href: '/credit-spreads', label: 'Credit Spreads', mobileLabel: 'Spreads', color: 'green' },
    { href: '/iron-condors', label: 'Iron Condors', mobileLabel: 'Condors', color: 'purple' },
  ];

  const getNavItemClass = (href: string, color: string) => {
    const isActive = pathname === href || (href === '/' && pathname === '/chain-analysis');
    // Mobile: very compact padding, Desktop: normal size
    const baseClass = 'px-1.5 py-0.5 md:px-3 md:py-1.5 rounded md:rounded-lg text-[10px] md:text-sm font-medium transition-colors flex items-center whitespace-nowrap';

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
  // Single row layout on all devices: 48px mobile, 56px desktop

  return (
    <>
      {/* CSS for responsive header height variable */}
      <style jsx global>{`
        :root {
          --app-header-height: 48px;
        }
        @media (min-width: 768px) {
          :root {
            --app-header-height: 56px;
          }
        }
      `}</style>
      <header
        className="fixed top-0 left-0 right-0 z-[60] bg-white border-b-2 border-gray-200 px-2 md:px-4 py-1.5 md:py-2 shadow-md"
      >
        {/* Single row layout - all items in one row */}
        <div className="flex items-center justify-between gap-2 md:gap-4">
          {/* Logo and title */}
          <Link href="/" className="flex items-center gap-2 md:gap-3 flex-shrink-0">
            <Image
              src="/opt.png"
              alt="OptChain Logo"
              width={28}
              height={28}
              className="rounded-md md:w-9 md:h-9"
            />
            <span className="text-sm md:text-lg font-semibold text-gray-800 hover:text-blue-600 transition-colors">
              {title}
            </span>
          </Link>

          {/* Navigation tabs - always in same row, scrollable on mobile */}
          <nav className="flex gap-1 md:gap-2 bg-gray-100/80 rounded-lg px-1.5 md:px-3 py-1 md:py-1.5 border border-gray-200/60 overflow-x-auto scrollbar-hide flex-shrink min-w-0">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={getNavItemClass(item.href, item.color)}
              >
                {/* Mobile: short label, Desktop: full label */}
                <span className="md:hidden">{item.mobileLabel}</span>
                <span className="hidden md:inline">{item.label}</span>
              </Link>
            ))}
          </nav>
        </div>
      </header>
    </>
  );
}

export default Navigation;
