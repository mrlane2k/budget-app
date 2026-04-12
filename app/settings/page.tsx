'use client';
import { apiPath } from '@/lib/basepath';

import { useEffect, useState } from 'react';
import Nav from '@/components/Nav';

interface UserSettings {
  id: number;
  username: string;
  pay_cycle: string;
  last_paycheck_date: string;
  monthly_income: number;
  current_savings: number;
}

const PAY_CYCLES = [
  { value: 'weekly', label: 'Weekly', description: '4.33 paychecks/month' },
  { value: 'bi-weekly', label: 'Bi-Weekly', description: '2.17 paychecks/month (every 2 weeks)' },
  { value: 'semi-monthly', label: 'Semi-Monthly', description: '2 paychecks/month (1st & 15th)' },
  { value: 'monthly', label: 'Monthly', description: '1 paycheck/month' },
];

export default function SettingsPage() {
  const [settings, setSettings] = useState<UserSettings | null>(null);
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

  useEffect(() => {
    fetch(apiPath('/api/settings')).then(r => r.json()).then((data: UserSettings) => {
      setSettings(data);
      setPayCycle(data.pay_cycle || 'bi-weekly');
      setLastPaycheckDate(data.last_paycheck_date || '');
      setMonthlyIncome(data.monthly_income ? String(data.monthly_income) : '');
      setCurrentSavings(data.current_savings ? String(data.current_savings) : '');
    });
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveMsg('');

    const res = await fetch(apiPath('/api/settings'), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pay_cycle: payCycle, last_paycheck_date: lastPaycheckDate, monthly_income: monthlyIncome ? parseFloat(monthlyIncome) : 0, current_savings: currentSavings ? parseFloat(currentSavings) : 0 }),
    });

    const data = await res.json();
    setSaving(false);

    if (res.ok) {
      setSaveMsg('Settings saved successfully.');
      setSettings(data);
      setTimeout(() => setSaveMsg(''), 3000);
    } else {
      setSaveMsg(data.error || 'Failed to save settings.');
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
    if (newPassword.length < 6) {
      setPwError('Password must be at least 6 characters.');
      return;
    }

    setPwSaving(true);
    const res = await fetch(apiPath('/api/settings'), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    });

    const data = await res.json();
    setPwSaving(false);

    if (res.ok) {
      setPwMsg('Password changed successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPwMsg(''), 3000);
    } else {
      setPwError(data.error || 'Failed to change password.');
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
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-7 pr-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00"
                  />
                </div>
                <p className="text-gray-600 text-xs mt-1.5">Used to calculate your current emergency fund runway</p>
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

          {/* App Info */}
          <div className="mt-6 bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wide">App Info</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Storage</span>
                <span className="text-gray-300">Local SQLite (budget.db)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Auth</span>
                <span className="text-gray-300">bcrypt + JWT (httpOnly cookie)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Data location</span>
                <span className="text-gray-300 font-mono text-xs">./budget.db</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
