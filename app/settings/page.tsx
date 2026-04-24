'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Nav from '@/components/Nav';
import { getErrorMessage } from '@/lib/client/errors';
import {
  changeVaultPassphrase,
  changePassword,
  clearVaultPassphrase,
  getSettings,
  getVaultStatus,
  lockVault,
  rotateDatabaseKey,
  setVaultPassphrase as enableDesktopVaultPassphrase,
  type UserSettings,
  type VaultStatus,
  updateSettings,
} from '@/lib/client/user-client';
import { useProtectedRoute } from '@/lib/client/use-protected-route';

const PAY_CYCLES = [
  { value: 'weekly', label: 'Weekly', description: '4.33 paychecks/month' },
  { value: 'bi-weekly', label: 'Bi-Weekly', description: '2.17 paychecks/month (every 2 weeks)' },
  { value: 'semi-monthly', label: 'Semi-Monthly', description: '2 paychecks/month (1st & 15th)' },
  { value: 'monthly', label: 'Monthly', description: '1 paycheck/month' },
];

export default function SettingsPage() {
  const router = useRouter();
  const { checkingAuth, authError } = useProtectedRoute();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [vaultStatus, setVaultStatus] = useState<VaultStatus | null>(null);
  const [payCycle, setPayCycle] = useState('bi-weekly');
  const [lastPaycheckDate, setLastPaycheckDate] = useState('');
  const [monthlyIncome, setMonthlyIncome] = useState('');
  const [currentSavings, setCurrentSavings] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState('');
  const [pwError, setPwError] = useState('');
  const [vaultLoading, setVaultLoading] = useState(false);
  const [vaultMsg, setVaultMsg] = useState('');
  const [vaultError, setVaultError] = useState('');
  const [accountPassword, setAccountPassword] = useState('');
  const [vaultPassphrase, setVaultPassphrase] = useState('');
  const [confirmVaultPassphrase, setConfirmVaultPassphrase] = useState('');
  const [currentVaultPassphrase, setCurrentVaultPassphrase] = useState('');
  const [newVaultPassphrase, setNewVaultPassphrase] = useState('');
  const [confirmNewVaultPassphrase, setConfirmNewVaultPassphrase] = useState('');
  const [removeVaultPassphrase, setRemoveVaultPassphrase] = useState('');
  const [rotationPassphrase, setRotationPassphrase] = useState('');

  useEffect(() => {
    if (checkingAuth || authError) {
      return;
    }

    async function loadSettings() {
      try {
        const [data, status] = await Promise.all([getSettings(), getVaultStatus()]);
        setSettings(data);
        setVaultStatus(status);
        setPayCycle(data.pay_cycle || 'bi-weekly');
        setLastPaycheckDate(data.last_paycheck_date || '');
        setMonthlyIncome(data.monthly_income ? String(data.monthly_income) : '');
        setCurrentSavings(data.current_savings ? String(data.current_savings) : '');
      } catch (loadError) {
        setSaveMsg(getErrorMessage(loadError, 'Failed to load settings.'));
      }
    }

    void loadSettings();
  }, [authError, checkingAuth]);

  if (checkingAuth || !settings) {
    return (
      <div className="flex min-h-screen">
        <Nav />
        <main className="ml-56 flex flex-1 items-center justify-center p-8">
          <div className="text-gray-400">
            {checkingAuth ? 'Checking session...' : authError || 'Loading settings...'}
          </div>
        </main>
      </div>
    );
  }

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveMsg('');

    try {
      const data = await updateSettings({
        pay_cycle: payCycle,
        last_paycheck_date: lastPaycheckDate,
        monthly_income: monthlyIncome ? parseFloat(monthlyIncome) : 0,
        current_savings: currentSavings ? parseFloat(currentSavings) : 0,
      });
      setSaveMsg('Settings saved successfully.');
      setSettings(data);
      setTimeout(() => setSaveMsg(''), 3000);
    } catch (saveError) {
      setSaveMsg(getErrorMessage(saveError, 'Failed to save settings.'));
    } finally {
      setSaving(false);
    }
  };

  const handleEnableVaultPassphrase = async (e: React.FormEvent) => {
    e.preventDefault();
    setVaultError('');
    setVaultMsg('');

    if (vaultPassphrase !== confirmVaultPassphrase) {
      setVaultError('Vault passphrases do not match.');
      return;
    }
    if (vaultPassphrase.length < 8) {
      setVaultError('Vault passphrase must be at least 8 characters.');
      return;
    }

    setVaultLoading(true);
    try {
      await enableDesktopVaultPassphrase({
        account_password: accountPassword,
        passphrase: vaultPassphrase,
      });
      setVaultStatus(await getVaultStatus());
      setVaultMsg('Vault passphrase enabled.');
      setAccountPassword('');
      setVaultPassphrase('');
      setConfirmVaultPassphrase('');
    } catch (vaultMutationError) {
      setVaultError(getErrorMessage(vaultMutationError, 'Failed to enable the vault passphrase.'));
    } finally {
      setVaultLoading(false);
    }
  };

  const handleChangeVaultPassphrase = async (e: React.FormEvent) => {
    e.preventDefault();
    setVaultError('');
    setVaultMsg('');

    if (newVaultPassphrase !== confirmNewVaultPassphrase) {
      setVaultError('New vault passphrases do not match.');
      return;
    }
    if (newVaultPassphrase.length < 8) {
      setVaultError('Vault passphrase must be at least 8 characters.');
      return;
    }

    setVaultLoading(true);
    try {
      await changeVaultPassphrase({
        current_passphrase: currentVaultPassphrase,
        new_passphrase: newVaultPassphrase,
      });
      setVaultMsg('Vault passphrase updated.');
      setCurrentVaultPassphrase('');
      setNewVaultPassphrase('');
      setConfirmNewVaultPassphrase('');
    } catch (vaultMutationError) {
      setVaultError(getErrorMessage(vaultMutationError, 'Failed to update the vault passphrase.'));
    } finally {
      setVaultLoading(false);
    }
  };

  const handleClearVaultPassphrase = async (e: React.FormEvent) => {
    e.preventDefault();
    setVaultError('');
    setVaultMsg('');
    setVaultLoading(true);

    try {
      await clearVaultPassphrase({
        current_passphrase: removeVaultPassphrase,
      });
      setVaultStatus(await getVaultStatus());
      setVaultMsg('Vault passphrase removed. The database is still encrypted on disk through the OS credential store.');
      setRemoveVaultPassphrase('');
    } catch (vaultMutationError) {
      setVaultError(getErrorMessage(vaultMutationError, 'Failed to remove the vault passphrase.'));
    } finally {
      setVaultLoading(false);
    }
  };

  const handleLockVault = async () => {
    setVaultError('');
    setVaultMsg('');
    setVaultLoading(true);

    try {
      await lockVault();
      router.push('/login');
      router.refresh();
    } catch (vaultMutationError) {
      setVaultError(getErrorMessage(vaultMutationError, 'Failed to lock the vault.'));
    } finally {
      setVaultLoading(false);
    }
  };

  const handleRotateDatabaseKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setVaultError('');
    setVaultMsg('');
    setVaultLoading(true);

    try {
      await rotateDatabaseKey(
        vaultStatus?.passphraseEnabled
          ? { current_passphrase: rotationPassphrase }
          : undefined,
      );
      setVaultMsg('Database encryption key rotated.');
      setRotationPassphrase('');
    } catch (vaultMutationError) {
      setVaultError(getErrorMessage(vaultMutationError, 'Failed to rotate the database encryption key.'));
    } finally {
      setVaultLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError('');
    setPwMsg('');

    if (newPassword !== confirmPassword) {
      setPwError('New passwords do not match.');
      return;
    }
    if (newPassword.length < 8) {
      setPwError('Password must be at least 8 characters.');
      return;
    }

    setPwSaving(true);
    try {
      await changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      setPwMsg('Password changed successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPwMsg(''), 3000);
    } catch (passwordError) {
      setPwError(getErrorMessage(passwordError, 'Failed to change password.'));
    } finally {
      setPwSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      <Nav />
      <main className="ml-56 flex-1 p-8">
        <div className="max-w-2xl mx-auto">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-white">Settings</h1>
            {settings && (
              <p className="text-gray-400 mt-1">Logged in as <span className="text-white">{settings.username}</span></p>
            )}
          </div>

          {/* Pay Cycle Settings */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
            <h2 className="text-base font-semibold text-white mb-5">Pay Cycle Configuration</h2>
            <form onSubmit={handleSaveSettings} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-3">Pay Frequency</label>
                <div className="space-y-2">
                  {PAY_CYCLES.map(cycle => (
                    <label
                      key={cycle.value}
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        payCycle === cycle.value
                          ? 'border-blue-600 bg-blue-900/20'
                          : 'border-gray-700 hover:border-gray-600'
                      }`}
                    >
                      <input
                        type="radio"
                        name="pay_cycle"
                        value={cycle.value}
                        checked={payCycle === cycle.value}
                        onChange={() => setPayCycle(cycle.value)}
                        className="mt-0.5 accent-blue-500"
                      />
                      <div>
                        <p className="text-white text-sm font-medium">{cycle.label}</p>
                        <p className="text-gray-500 text-xs mt-0.5">{cycle.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">Last Paycheck Date</label>
                <input
                  type="date"
                  value={lastPaycheckDate}
                  onChange={e => setLastPaycheckDate(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-gray-600 text-xs mt-1.5">Used to calculate days until next paycheck</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">Income Per Paycheck (after tax)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={monthlyIncome}
                    onChange={e => setMonthlyIncome(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-7 pr-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00"
                  />
                </div>
                <p className="text-gray-600 text-xs mt-1.5">Used to calculate monthly budget and per-paycheck leftover</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">Current Savings Balance</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={currentSavings}
                    onChange={e => setCurrentSavings(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-7 pr-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:text-gray-500"
                    placeholder="0.00"
                    disabled
                  />
                </div>
                <p className="text-gray-600 text-xs mt-1.5">Now managed from the Cash Buckets page so your savings balance stays aligned with transfers and manual cash entries.</p>
              </div>

              {saveMsg && (
                <div className={`rounded-lg px-3 py-2 text-sm border ${
                  saveMsg.includes('success')
                    ? 'bg-green-900/30 border-green-800 text-green-400'
                    : 'bg-red-900/30 border-red-800 text-red-400'
                }`}>
                  {saveMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={saving}
                className="bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
              >
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </form>
          </div>

          {/* Change Password */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h2 className="text-base font-semibold text-white mb-5">Change Password</h2>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">Current Password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="••••••••"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="••••••••"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="••••••••"
                  required
                />
              </div>

              {pwError && (
                <div className="bg-red-900/30 border border-red-800 rounded-lg px-3 py-2 text-red-400 text-sm">
                  {pwError}
                </div>
              )}

              {pwMsg && (
                <div className="bg-green-900/30 border border-green-800 rounded-lg px-3 py-2 text-green-400 text-sm">
                  {pwMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={pwSaving}
                className="bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
              >
                {pwSaving ? 'Updating...' : 'Change Password'}
              </button>
            </form>
          </div>

          <div className="mt-6 bg-gray-900 border border-gray-800 rounded-xl p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-white">Encrypted Vault</h2>
                <p className="mt-1 text-sm text-gray-400">
                  Desktop data stays encrypted at rest. You can add a separate vault passphrase so the app cannot read the database until you unlock it.
                </p>
              </div>
              {vaultStatus?.passphraseEnabled && (
                <button
                  type="button"
                  onClick={handleLockVault}
                  disabled={vaultLoading}
                  className="rounded-lg border border-gray-700 px-3 py-2 text-sm font-medium text-gray-200 transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Lock Now
                </button>
              )}
            </div>

            <div className="mt-4 rounded-lg border border-gray-800 bg-gray-950/60 p-4">
              <p className="text-sm text-white">
                {vaultStatus?.passphraseEnabled
                  ? 'Vault passphrase protection is enabled.'
                  : 'Vault passphrase protection is not enabled.'}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                {vaultStatus?.passphraseEnabled
                  ? 'Signing out will lock the encrypted database until the passphrase is entered again.'
                  : 'The database key currently lives only in the OS credential store, which still protects the file on disk.'}
              </p>
            </div>

            {vaultError && (
              <div className="mt-4 rounded-lg border border-red-800 bg-red-900/30 px-3 py-2 text-sm text-red-400">
                {vaultError}
              </div>
            )}

            {vaultMsg && (
              <div className="mt-4 rounded-lg border border-green-800 bg-green-900/30 px-3 py-2 text-sm text-green-400">
                {vaultMsg}
              </div>
            )}

            {!vaultStatus?.passphraseEnabled ? (
              <form onSubmit={handleEnableVaultPassphrase} className="mt-5 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1.5">Account Password</label>
                  <input
                    type="password"
                    value={accountPassword}
                    onChange={e => setAccountPassword(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Confirm your sign-in password"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1.5">New Vault Passphrase</label>
                  <input
                    type="password"
                    value={vaultPassphrase}
                    onChange={e => setVaultPassphrase(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="At least 8 characters"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1.5">Confirm Vault Passphrase</label>
                  <input
                    type="password"
                    value={confirmVaultPassphrase}
                    onChange={e => setConfirmVaultPassphrase(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Repeat the vault passphrase"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={vaultLoading}
                  className="bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
                >
                  {vaultLoading ? 'Saving...' : 'Enable Vault Passphrase'}
                </button>
              </form>
            ) : (
              <div className="mt-5 grid gap-6 lg:grid-cols-2">
                <form onSubmit={handleChangeVaultPassphrase} className="space-y-4 rounded-lg border border-gray-800 bg-gray-950/40 p-4">
                  <h3 className="text-sm font-semibold text-white">Change Vault Passphrase</h3>

                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1.5">Current Vault Passphrase</label>
                    <input
                      type="password"
                      value={currentVaultPassphrase}
                      onChange={e => setCurrentVaultPassphrase(e.target.value)}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1.5">New Vault Passphrase</label>
                    <input
                      type="password"
                      value={newVaultPassphrase}
                      onChange={e => setNewVaultPassphrase(e.target.value)}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1.5">Confirm New Vault Passphrase</label>
                    <input
                      type="password"
                      value={confirmNewVaultPassphrase}
                      onChange={e => setConfirmNewVaultPassphrase(e.target.value)}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={vaultLoading}
                    className="bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
                  >
                    {vaultLoading ? 'Saving...' : 'Update Vault Passphrase'}
                  </button>
                </form>

                <form onSubmit={handleClearVaultPassphrase} className="space-y-4 rounded-lg border border-gray-800 bg-gray-950/40 p-4">
                  <h3 className="text-sm font-semibold text-white">Remove Vault Passphrase</h3>
                  <p className="text-xs text-gray-500">
                    This keeps SQLCipher encryption on disk, but the app will unlock with the OS credential store only.
                  </p>

                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1.5">Current Vault Passphrase</label>
                    <input
                      type="password"
                      value={removeVaultPassphrase}
                      onChange={e => setRemoveVaultPassphrase(e.target.value)}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={vaultLoading}
                    className="rounded-lg border border-red-700 px-5 py-2.5 text-sm font-medium text-red-300 transition-colors hover:bg-red-950/40 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {vaultLoading ? 'Saving...' : 'Remove Vault Passphrase'}
                  </button>
                </form>
              </div>
            )}

            <form onSubmit={handleRotateDatabaseKey} className="mt-6 rounded-lg border border-gray-800 bg-gray-950/40 p-4">
              <h3 className="text-sm font-semibold text-white">Rotate Database Encryption Key</h3>
              <p className="mt-1 text-xs text-gray-500">
                This generates a fresh SQLCipher database key and rewrites the local encrypted store to use it.
              </p>

              {vaultStatus?.passphraseEnabled && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-400 mb-1.5">Current Vault Passphrase</label>
                  <input
                    type="password"
                    value={rotationPassphrase}
                    onChange={e => setRotationPassphrase(e.target.value)}
                    className="w-full max-w-md bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Required to rewrap the new key"
                    required
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={vaultLoading}
                className="mt-4 rounded-lg border border-gray-700 px-5 py-2.5 text-sm font-medium text-gray-100 transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {vaultLoading ? 'Rotating...' : 'Rotate Encryption Key'}
              </button>
            </form>
          </div>

          {/* App Info */}
          <div className="mt-6 bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wide">App Info</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Storage</span>
                <span className="text-gray-300">Local SQLCipher + OS credential store</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Auth</span>
                <span className="text-gray-300">bcrypt + desktop session state</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Vault</span>
                <span className="text-gray-300">{vaultStatus?.passphraseEnabled ? 'Passphrase + keychain' : 'Keychain only'}</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
