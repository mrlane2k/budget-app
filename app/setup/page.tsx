'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getErrorMessage } from '@/lib/client/errors';
import {
  createInitialUser,
  getVaultStatus,
  importLegacyDatabase,
  type VaultStatus,
} from '@/lib/client/user-client';

export default function SetupPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [vaultStatus, setVaultStatus] = useState<VaultStatus | null>(null);

  useEffect(() => {
    async function loadSetupStatus() {
      try {
        const status = await getVaultStatus();
        setVaultStatus(status);

        if (status.passphraseEnabled && !status.unlocked) {
          router.replace('/login');
          return;
        }

        if (status.setupRequired === false) {
          router.replace('/login');
          return;
        }

        setChecking(false);
      } catch (statusError) {
        setError(getErrorMessage(statusError, 'Unable to check setup status.'));
        setChecking(false);
      }
    }

    void loadSetupStatus();
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
      await createInitialUser({ username, password });
      router.push('/bills');
      router.refresh();
    } catch (submitError) {
      setError(getErrorMessage(submitError, 'Network error. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const handleImportLegacyData = async () => {
    setError('');
    setInfo('');
    setImporting(true);

    try {
      const result = await importLegacyDatabase();
      setInfo(
        `Imported ${result.importedUsers} user, ${result.importedAccounts} accounts, ${result.importedBills} bills, ${result.importedBillPayments} bill payments, ${result.importedCreditCards ?? 0} credit cards, ${result.importedCreditCardTransactions ?? 0} credit card entries, ${result.importedTransfers ?? 0} transfers, ${result.importedCashTransactions ?? 0} cash transactions, ${result.importedMonthlyBudgets ?? 0} monthly budgets, and ${result.importedMonthlyCloses ?? 0} monthly close records from the earlier local database.`,
      );
      router.replace('/login');
      router.refresh();
    } catch (importError) {
      setError(getErrorMessage(importError, 'Failed to import your earlier local database.'));
    } finally {
      setImporting(false);
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

          {vaultStatus?.legacyImportAvailable && (
            <div className="mb-5 rounded-lg border border-amber-800 bg-amber-950/40 p-4">
              <p className="text-sm text-amber-200">
                A previous local prototype database was found on this machine.
              </p>
              <p className="mt-1 text-xs text-amber-300/80">
                You can import that data into the new encrypted desktop vault instead of creating a fresh account.
              </p>
              <button
                type="button"
                onClick={handleImportLegacyData}
                disabled={importing || loading || checking}
                className="mt-3 rounded-lg border border-amber-700 px-3 py-2 text-sm font-medium text-amber-100 transition-colors hover:bg-amber-900/40 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {importing ? 'Importing...' : 'Import Existing Local Data'}
              </button>
            </div>
          )}

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

              {info && (
                <div className="rounded-lg border border-green-800 bg-green-900/30 px-3 py-2.5 text-sm text-green-400">
                  {info}
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
