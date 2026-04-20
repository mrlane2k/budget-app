'use client';
import { apiPath } from '@/lib/basepath';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingSetup, setCheckingSetup] = useState(true);

  useEffect(() => {
    fetch(apiPath('/api/setup/status'))
      .then((response) => response.json())
      .then((data: { setupRequired?: boolean }) => {
        if (data.setupRequired) {
          router.replace('/setup');
          return;
        }

        setCheckingSetup(false);
      })
      .catch(() => {
        setCheckingSetup(false);
      });
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch(apiPath('/api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Login failed');
        return;
      }

      router.push('/');
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-950 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-white">BudgetApp</h1>
          <p className="mt-2 text-gray-400">Personal Finance Tracker</p>
        </div>

        <div className="rounded-xl border border-gray-800 bg-gray-900 p-6 shadow-2xl">
          <h2 className="mb-5 text-lg font-semibold text-white">Sign In</h2>

          {checkingSetup ? (
            <div className="text-sm text-gray-400">Checking setup status...</div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-400">
                  Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2.5 text-white placeholder-gray-500 transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter your username"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-400">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2.5 text-white placeholder-gray-500 transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter your password"
                  required
                />
              </div>

              {error && (
                <div className="rounded-lg border border-red-800 bg-red-900/30 px-3 py-2.5 text-sm text-red-400">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="mt-1 w-full rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-blue-800"
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
