'use client';
import { stripBasePath } from '@/lib/basepath';

import type { ReactNode, SVGProps } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { logout } from '@/lib/client/user-client';

function Icon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    />
  );
}

function DashboardIcon() {
  return (
    <Icon className="h-4.5 w-4.5">
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="4.5" rx="1.5" />
      <rect x="13.5" y="11.5" width="7" height="9" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
    </Icon>
  );
}

function BillsIcon() {
  return (
    <Icon className="h-4.5 w-4.5">
      <path d="M7 3.5h8l3 3v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-15a1 1 0 0 1 1-1Z" />
      <path d="M15 3.5v4h4" />
      <path d="M9 11h6" />
      <path d="M9 15h6" />
    </Icon>
  );
}

function CashIcon() {
  return (
    <Icon className="h-4.5 w-4.5">
      <path d="M4 7.5h16" />
      <path d="M6.5 4.5h11a2.5 2.5 0 0 1 2.5 2.5v10a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17V7a2.5 2.5 0 0 1 2.5-2.5Z" />
      <circle cx="15.5" cy="13" r="1.5" />
      <path d="M7.5 13h3" />
    </Icon>
  );
}

function CreditCardIcon() {
  return (
    <Icon className="h-4.5 w-4.5">
      <rect x="3" y="5.5" width="18" height="13" rx="2.5" />
      <path d="M3 10h18" />
      <path d="M7 15h3" />
      <path d="M12 15h5" />
    </Icon>
  );
}

function TrendsIcon() {
  return (
    <Icon className="h-4.5 w-4.5">
      <path d="M4 18.5h16" />
      <path d="M6.5 15V10.5" />
      <path d="M12 15V6.5" />
      <path d="M17.5 15V8.5" />
      <path d="M6.5 10.5 12 6.5 17.5 8.5" />
    </Icon>
  );
}

function BudgetIcon() {
  return (
    <Icon className="h-4.5 w-4.5">
      <path d="M4.5 8.5 12 4l7.5 4.5v7L12 20l-7.5-4.5Z" />
      <path d="M12 4v16" />
      <path d="M8.5 10.5h7" />
    </Icon>
  );
}

function CalendarIcon() {
  return (
    <Icon className="h-4.5 w-4.5">
      <rect x="4" y="5.5" width="16" height="14" rx="2" />
      <path d="M8 3.5v4" />
      <path d="M16 3.5v4" />
      <path d="M4 9.5h16" />
      <path d="M8 13h3" />
      <path d="M13 13h3" />
      <path d="M8 16.5h3" />
    </Icon>
  );
}

function SettingsIcon() {
  return (
    <Icon className="h-4.5 w-4.5">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.5v2.2" />
      <path d="M12 18.3v2.2" />
      <path d="m18 6-1.6 1.6" />
      <path d="m7.6 16.4-1.6 1.6" />
      <path d="M20.5 12h-2.2" />
      <path d="M5.7 12H3.5" />
      <path d="m18 18-1.6-1.6" />
      <path d="M7.6 7.6 6 6" />
    </Icon>
  );
}

function LogoutIcon() {
  return (
    <Icon className="h-4.5 w-4.5">
      <path d="M10 4.5H6.5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2H10" />
      <path d="M14 16.5 19 12l-5-4.5" />
      <path d="M19 12H9" />
    </Icon>
  );
}

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const currentPath = stripBasePath(pathname);

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const links = [
    { href: '/', label: 'Dashboard', icon: <DashboardIcon /> },
    { href: '/bills', label: 'Bills', icon: <BillsIcon /> },
    { href: '/cash', label: 'Cash', icon: <CashIcon /> },
    { href: '/trends', label: 'Trends', icon: <TrendsIcon /> },
    { href: '/budget', label: 'Budget', icon: <BudgetIcon /> },
    { href: '/calendar', label: 'Calendar', icon: <CalendarIcon /> },
    { href: '/credit-cards', label: 'Credit Cards', icon: <CreditCardIcon /> },
    { href: '/settings', label: 'Settings', icon: <SettingsIcon /> },
  ] satisfies Array<{ href: string; label: string; icon: ReactNode }>;

  return (
    <nav className="fixed left-0 top-0 z-10 flex h-full w-56 flex-col border-r border-gray-800 bg-gray-900">
      <div className="border-b border-gray-800 p-5">
        <h1 className="text-lg font-bold text-white">BudgetApp</h1>
        <p className="mt-0.5 text-xs text-gray-500">Personal Finance</p>
      </div>

      <div className="flex-1 space-y-1 p-3">
        {links.map(({ href, label, icon }) => {
          const isActive =
            href === '/'
              ? currentPath === '/' || currentPath === ''
              : currentPath.startsWith(href);

          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <span className="flex h-5 w-5 items-center justify-center">
                {icon}
              </span>
              {label}
            </Link>
          );
        })}
      </div>

      <div className="border-t border-gray-800 p-3">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-400 transition-colors hover:bg-gray-800 hover:text-white"
        >
          <span className="flex h-5 w-5 items-center justify-center">
            <LogoutIcon />
          </span>
          Logout
        </button>
      </div>
    </nav>
  );
}
