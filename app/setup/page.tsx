'use client';
import { apiPath } from '@/lib/basepath';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SetupPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(apiPath('/api/setup/status'))
      .then((response) => response.json())
      .then((data: { setupRequired?: boolean }) => {
        if (!data.setupRequired) {
          router.replace('/login');
          return;
        }

        setChecking(false);
      })
      .catch(() => {
        setError('Unable to check setup status.');
        setChecking(false);
      });
  }, [router]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(apiPath('/api/setup'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Setup failed.');
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
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white">BudgetApp</h1>
          <p className="text-gray-400 mt-2">Create your first admin account</p>
        </div>

        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 shadow-2xl">
          <h2 className="text-lg font-semibold text-white mb-2">Initial Setup</h2>
          <p className="text-sm text-gray-400 mb-5">
            This screen is only available until the first user is created.
          </p>

          {checking ? (
            <div className="text-sm text-gray-400">Checking setup status...</div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">
                  Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="admin"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="At least 8 characters"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Repeat your password"
                  required
                />
              </div>

              {error && (
                <div className="bg-red-900/30 border border-red-800 rounded-lg px-3 py-2.5 text-red-400 text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || checking}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-medium py-2.5 px-4 rounded-lg transition-colors"
              >
                {loading ? 'Creating account...' : 'Create Admin Account'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
