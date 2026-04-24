'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getErrorMessage } from '@/lib/client/errors';
import {
  getSettings,
  getVaultStatus,
  login,
  unlockVault,
  type VaultStatus,
} from '@/lib/client/user-client';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [vaultPassphrase, setVaultPassphrase] = useState('');
  const [error, setError] = useState('');
  const [unlockError, setUnlockError] = useState('');
  const [loading, setLoading] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [checkingSetup, setCheckingSetup] = useState(true);
  const [vaultStatus, setVaultStatus] = useState<VaultStatus | null>(null);

  useEffect(() => {
    async function loadSetupStatus() {
      try {
        const status = await getVaultStatus();
        setVaultStatus(status);

        if (status.setupRequired) {
          router.replace('/setup');
          return;
        }

        if (!status.passphraseEnabled || status.unlocked) {
          try {
            await getSettings();
            router.replace('/');
            return;
          } catch {
            // No active desktop session yet, so stay on the sign-in screen.
          }
        }

        setCheckingSetup(false);
      } catch {
        setCheckingSetup(false);
      }
    }

    void loadSetupStatus();
  }, [router]);

  const handleUnlock = async (event: React.FormEvent) => {
    event.preventDefault();
    setUnlockError('');
    setUnlocking(true);

    try {
      const status = await unlockVault({ passphrase: vaultPassphrase });
      setVaultStatus(status);
      setVaultPassphrase('');

      if (status.setupRequired) {
        router.replace('/setup');
        return;
      }
    } catch (unlockVaultError) {
      setUnlockError(getErrorMessage(unlockVaultError, 'Unable to unlock your local vault.'));
    } finally {
      setUnlocking(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login({ username, password });
      router.push('/bills');
      router.refresh();
    } catch (loginError) {
      setError(getErrorMessage(loginError, 'Network error. Please try again.'));
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
          ) : vaultStatus?.passphraseEnabled && !vaultStatus.unlocked ? (
            <form onSubmit={handleUnlock} className="space-y-4">
              <div className="rounded-lg border border-blue-900 bg-blue-950/40 px-3 py-2.5 text-sm text-blue-200">
                Your local database is encrypted and locked. Unlock the vault before signing in.
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-400">
                  Vault Passphrase
                </label>
                <input
                  type="password"
                  value={vaultPassphrase}
                  onChange={(e) => setVaultPassphrase(e.target.value)}
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2.5 text-white placeholder-gray-500 transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Unlock encrypted data"
                  required
                  autoFocus
                />
              </div>

              {unlockError && (
                <div className="rounded-lg border border-red-800 bg-red-900/30 px-3 py-2.5 text-sm text-red-400">
                  {unlockError}
                </div>
              )}

              <button
                type="submit"
                disabled={unlocking}
                className="mt-1 w-full rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-blue-800"
              >
                {unlocking ? 'Unlocking...' : 'Unlock Vault'}
              </button>
            </form>
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
