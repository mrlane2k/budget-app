'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getErrorMessage } from '@/lib/client/errors';
import {
  createLocalProfile,
  getVaultStatus,
  importLegacyDatabase,
  type VaultStatus,
} from '@/lib/client/user-client';

export default function SetupPage() {
  const router = useRouter();
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
          router.replace('/');
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
    setLoading(true);

    try {
      await createLocalProfile();
      router.push('/');
      router.refresh();
    } catch (submitError) {
      setError(getErrorMessage(submitError, 'Unable to initialize your local profile.'));
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
        `Imported ${result.importedUsers} user, ${result.importedAccounts} accounts, ${result.importedBills} bills, ${result.importedBillPayments} bill payments, ${result.importedCreditCards ?? 0} credit cards, ${result.importedCreditCardTransactions ?? 0} credit card entries, ${result.importedTransfers ?? 0} transfers, ${result.importedCashTransactions ?? 0} cash transactions, ${result.importedMonthlyBudgets ?? 0} monthly budgets, and ${result.importedMonthlyCloses ?? 0} monthly close records from the earlier local database.${result.archivedLegacyDatabase ? ' The legacy database was archived so it will not be offered for import again.' : ''}`,
      );
      router.replace('/');
      router.refresh();
    } catch (importError) {
      setError(getErrorMessage(importError, 'Failed to import your earlier local database.'));
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-950 p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-white">BudgetApp</h1>
          <p className="mt-2 text-gray-400">Initialize your local profile</p>
        </div>

        <div className="rounded-xl border border-gray-800 bg-gray-900 p-6 shadow-2xl">
          <h2 className="mb-2 text-xl font-semibold text-white">First-Time Setup</h2>
          <p className="mb-6 text-sm text-gray-400">
            This app is built for one local owner. Create the local profile for this device to get started.
          </p>

          {vaultStatus?.legacyImportAvailable && (
            <div className="mb-5 rounded-lg border border-amber-800/70 bg-amber-950/30 px-4 py-3 text-sm text-amber-100">
              <p className="font-medium">Earlier local data found</p>
              <p className="mt-1 text-xs text-amber-300/80">
                You can import that data into the new encrypted desktop vault instead of creating a fresh local profile.
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
              <div className="rounded-lg border border-blue-900 bg-blue-950/30 px-3 py-2.5 text-sm text-blue-200">
                Budget App will create one local profile and keep your data encrypted on this device. You can add an optional vault passphrase later from Settings.
              </div>

              {info && (
                <div className="rounded-lg border border-green-800 bg-green-900/30 px-3 py-2.5 text-sm text-green-400">
                  {info}
                </div>
              )}

              {error && (
                <div className="rounded-lg border border-red-800 bg-red-900/30 px-3 py-2.5 text-sm text-red-400">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || checking}
                className="w-full rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-blue-800"
              >
                {loading ? 'Initializing...' : 'Create Local Profile'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
