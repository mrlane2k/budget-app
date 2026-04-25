'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getErrorMessage } from '@/lib/client/errors';
import { getVaultStatus, unlockVault, type VaultStatus } from '@/lib/client/user-client';

export default function LoginPage() {
  const router = useRouter();
  const [vaultPassphrase, setVaultPassphrase] = useState('');
  const [unlockError, setUnlockError] = useState('');
  const [unlocking, setUnlocking] = useState(false);
  const [checkingSetup, setCheckingSetup] = useState(true);
  const [vaultStatus, setVaultStatus] = useState<VaultStatus | null>(null);

  useEffect(() => {
    async function loadVaultStatus() {
      try {
        const status = await getVaultStatus();
        setVaultStatus(status);

        if (status.setupRequired) {
          router.replace('/setup');
          return;
        }

        if (!status.passphraseEnabled || status.unlocked) {
          router.replace('/');
          return;
        }

        setCheckingSetup(false);
      } catch {
        setCheckingSetup(false);
      }
    }

    void loadVaultStatus();
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

      router.replace('/');
      router.refresh();
    } catch (unlockVaultError) {
      setUnlockError(getErrorMessage(unlockVaultError, 'Unable to unlock your local vault.'));
    } finally {
      setUnlocking(false);
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
          <h2 className="mb-5 text-lg font-semibold text-white">Open Budget App</h2>

          {checkingSetup ? (
            <div className="text-sm text-gray-400">Checking setup status...</div>
          ) : vaultStatus?.passphraseEnabled && !vaultStatus.unlocked ? (
            <form onSubmit={handleUnlock} className="space-y-4">
              <div className="rounded-lg border border-blue-900 bg-blue-950/40 px-3 py-2.5 text-sm text-blue-200">
                Your local database is encrypted and locked. Unlock the vault to continue.
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
            <div className="rounded-lg border border-green-900 bg-green-950/30 px-3 py-2.5 text-sm text-green-200">
              Your local profile is ready. Redirecting into the app...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
