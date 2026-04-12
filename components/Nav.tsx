'use client';
import { apiPath } from '@/lib/basepath';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    await fetch(apiPath('/api/auth/logout'), { method: 'POST' });
    router.push('/budget/login');
  };

  const links = [
    { href: '/budget/', label: 'Dashboard', icon: '▦' },
    { href: '/budget/bills', label: 'Bills', icon: '📋' },
    { href: '/budget/credit-cards', label: 'Credit Cards', icon: '💳' },
    { href: '/budget/settings', label: 'Settings', icon: '⚙' },
  ];

  return (
    <nav className="fixed left-0 top-0 h-full w-56 bg-gray-900 border-r border-gray-800 flex flex-col z-10">
      <div className="p-5 border-b border-gray-800">
        <h1 className="text-lg font-bold text-white">BudgetApp</h1>
        <p className="text-xs text-gray-500 mt-0.5">Personal Finance</p>
      </div>

      <div className="flex-1 p-3 space-y-1">
        {links.map(({ href, label, icon }) => {
          const isActive = href === '/budget/' ? pathname === '/budget/' || pathname === '/budget' : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              <span className="text-base">{icon}</span>
              {label}
            </Link>
          );
        })}
      </div>

      <div className="p-3 border-t border-gray-800">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
        >
          <span>⏻</span>
          Logout
        </button>
      </div>
    </nav>
  );
}
