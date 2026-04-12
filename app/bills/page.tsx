'use client';
import { apiPath } from '@/lib/basepath';

import { useEffect, useState } from 'react';
import Nav from '@/components/Nav';
import { getNextDueDate } from '@/lib/bills';

interface Bill {
  id: number;
  name: string;
  category: string;
  amount: number;
  due_day: number;
  due_date: string | null;
  is_autopay: number;
  active: number;
  status: string | null;
  amount_paid: number | null;
  payment_id: number | null;
  frequency: string;
}

interface BillForm {
  name: string;
  category: string;
  amount: string;
  due_day: string;
  due_date: string;
  is_autopay: boolean;
  frequency: string;
}

const CATEGORIES = ['Housing', 'Utilities', 'Subscriptions', 'Insurance', 'Transportation', 'Food', 'Healthcare', 'Other'];
const FREQUENCIES = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'semi-annually', label: 'Semi-Annually' },
  { value: 'annually', label: 'Annually' },
];

const emptyForm: BillForm = {
  name: '',
  category: '',
  amount: '',
  due_day: '',
  due_date: '',
  is_autopay: false,
  frequency: 'monthly',
};

const ANCHOR_HELPER: Record<string, string> = {
  quarterly: 'First due date — repeats every 3 months',
  'semi-annually': 'First due date — repeats every 6 months',
  annually: 'Due date — repeats every year',
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export default function BillsPage() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingBill, setEditingBill] = useState<Bill | null>(null);
  const [form, setForm] = useState<BillForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const fetchBills = async () => {
    const res = await fetch(apiPath('/api/bills'));
    const data = await res.json();
    setBills(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  useEffect(() => { fetchBills(); }, []);

  const openAdd = () => {
    setEditingBill(null);
    setForm(emptyForm);
    setError('');
    setShowForm(true);
  };

  const openEdit = (bill: Bill) => {
    setEditingBill(bill);
    setForm({
      name: bill.name,
      category: bill.category || '',
      amount: String(bill.amount),
      due_day: String(bill.due_day),
      due_date: bill.due_date || '',
      is_autopay: bill.is_autopay === 1,
      frequency: bill.frequency || 'monthly',
    });
    setError('');
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingBill(null);
    setForm(emptyForm);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    const payload = {
      name: form.name,
      category: form.category,
      amount: parseFloat(form.amount),
      due_day: form.frequency === 'monthly' ? parseInt(form.due_day) : 1,
      due_date: form.frequency !== 'monthly' ? form.due_date : null,
      is_autopay: form.is_autopay,
      frequency: form.frequency,
    };

    try {
      const url = editingBill ? apiPath(`/api/bills/${editingBill.id}`) : apiPath('/api/bills');
      const method = editingBill ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to save bill');
        return;
      }

      await fetchBills();
      closeForm();
    } catch {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (bill: Bill) => {
    if (!confirm(`Delete "${bill.name}"?`)) return;
    await fetch(apiPath(`/api/bills/${bill.id}`), { method: 'DELETE' });
    await fetchBills();
  };

  const handlePaymentStatus = async (bill: Bill, status: string) => {
    const newStatus = bill.status === status ? 'unpaid' : status;
    await fetch(apiPath(`/api/bills/${bill.id}/payments`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        year: currentYear,
        month: currentMonth,
        status: newStatus,
        amount_paid: newStatus === 'paid' ? bill.amount : null,
      }),
    });
    await fetchBills();
  };

  const totalAmount = bills.reduce((sum, b) => sum + b.amount, 0);
  const totalPaid = bills.filter(b => b.status === 'paid').reduce((sum, b) => sum + (b.amount_paid ?? b.amount), 0);
  const paidCount = bills.filter(b => b.status === 'paid').length;

  if (loading) {
    return (
      <div className="flex min-h-screen">
        <Nav />
        <main className="ml-56 flex-1 p-8 flex items-center justify-center">
          <div className="text-gray-400">Loading...</div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Nav />
      <main className="ml-56 flex-1 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-white">Bills</h1>
              <p className="text-gray-400 mt-1">
                {now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} &mdash; {paidCount}/{bills.length} paid
              </p>
            </div>
            <button
              onClick={openAdd}
              className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              + Add Bill
            </button>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Total Monthly</p>
              <p className="text-xl font-bold text-white">{formatCurrency(totalAmount)}</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Paid This Month</p>
              <p className="text-xl font-bold text-green-400">{formatCurrency(totalPaid)}</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Still Owed</p>
              <p className="text-xl font-bold text-yellow-400">{formatCurrency(totalAmount - totalPaid)}</p>
            </div>
          </div>

          {/* Bills Table */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wide px-5 py-3">Bill</th>
                  <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wide px-5 py-3">Category</th>
                  <th className="text-right text-xs font-medium text-gray-400 uppercase tracking-wide px-5 py-3">Amount</th>
                  <th className="text-center text-xs font-medium text-gray-400 uppercase tracking-wide px-5 py-3">Frequency</th>
                  <th className="text-center text-xs font-medium text-gray-400 uppercase tracking-wide px-5 py-3">Due</th>
                  <th className="text-center text-xs font-medium text-gray-400 uppercase tracking-wide px-5 py-3">Auto</th>
                  <th className="text-center text-xs font-medium text-gray-400 uppercase tracking-wide px-5 py-3">Status</th>
                  <th className="text-center text-xs font-medium text-gray-400 uppercase tracking-wide px-5 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {bills.map((bill, i) => (
                  <tr key={bill.id} className={`border-b border-gray-800/50 ${i % 2 === 0 ? '' : 'bg-gray-800/20'}`}>
                    <td className="px-5 py-3">
                      <span className="text-white text-sm font-medium">{bill.name}</span>
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-gray-400 text-sm">{bill.category || '—'}</span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <span className="text-white text-sm font-medium">{formatCurrency(bill.amount)}</span>
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span className="text-gray-400 text-xs capitalize">{bill.frequency || 'monthly'}</span>
                    </td>
                    <td className="px-5 py-3 text-center">
                      {(!bill.frequency || bill.frequency === 'monthly') ? (
                        <span className="text-gray-300 text-sm">Day {ordinal(bill.due_day)}</span>
                      ) : (() => {
                        const next = getNextDueDate(bill);
                        return next ? (
                          <span className="text-gray-300 text-sm">{next.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                        ) : <span className="text-gray-600 text-sm">—</span>;
                      })()}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span className={`text-xs ${bill.is_autopay ? 'text-green-400' : 'text-gray-600'}`}>
                        {bill.is_autopay ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handlePaymentStatus(bill, 'paid')}
                          className={`text-xs px-2 py-0.5 rounded-full font-medium transition-colors ${
                            bill.status === 'paid'
                              ? 'bg-green-700 text-green-100'
                              : 'bg-gray-700 text-gray-400 hover:bg-green-900/40 hover:text-green-400'
                          }`}
                        >
                          Paid
                        </button>
                        <button
                          onClick={() => handlePaymentStatus(bill, 'pending')}
                          className={`text-xs px-2 py-0.5 rounded-full font-medium transition-colors ${
                            bill.status === 'pending'
                              ? 'bg-yellow-700/60 text-yellow-200'
                              : 'bg-gray-700 text-gray-400 hover:bg-yellow-900/40 hover:text-yellow-400'
                          }`}
                        >
                          Pending
                        </button>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => openEdit(bill)}
                          className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(bill)}
                          className="text-xs text-red-500 hover:text-red-400 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {bills.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-5 py-10 text-center text-gray-500 text-sm">
                      No bills yet. Add your first bill!
                    </td>
                  </tr>
                )}
              </tbody>
              {bills.length > 0 && (
                <tfoot>
                  <tr className="border-t border-gray-700">
                    <td colSpan={2} className="px-5 py-3 text-gray-400 text-sm font-medium">Total</td>
                    <td className="px-5 py-3 text-right text-white text-sm font-bold">{formatCurrency(totalAmount)}</td>
                    <td colSpan={5} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </main>

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-gray-800">
              <h2 className="text-lg font-semibold text-white">
                {editingBill ? 'Edit Bill' : 'Add Bill'}
              </h2>
              <button onClick={closeForm} className="text-gray-400 hover:text-white transition-colors text-xl leading-none">
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. Rent, Netflix, Electric"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1.5">Category</label>
                  <select
                    value={form.category}
                    onChange={e => setForm({ ...form, category: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select category</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1.5">Frequency</label>
                  <select
                    value={form.frequency}
                    onChange={e => setForm({ ...form, frequency: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {FREQUENCIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1.5">Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.amount}
                    onChange={e => setForm({ ...form, amount: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00"
                    required
                  />
                </div>
                {form.frequency === 'monthly' ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1.5">Due Day of Month</label>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={form.due_day}
                      onChange={e => setForm({ ...form, due_day: e.target.value })}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="1–31"
                      required
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1.5">Anchor Due Date</label>
                    <input
                      type="date"
                      value={form.due_date}
                      onChange={e => setForm({ ...form, due_date: e.target.value })}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                    {ANCHOR_HELPER[form.frequency] && (
                      <p className="text-gray-600 text-xs mt-1">{ANCHOR_HELPER[form.frequency]}</p>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="autopay"
                  checked={form.is_autopay}
                  onChange={e => setForm({ ...form, is_autopay: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-600 bg-gray-700 accent-blue-500"
                />
                <label htmlFor="autopay" className="text-sm text-gray-300">Auto-pay enabled</label>
              </div>

              {error && (
                <div className="bg-red-900/30 border border-red-800 rounded-lg px-3 py-2 text-red-400 text-sm">
                  {error}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeForm}
                  className="flex-1 bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
                >
                  {saving ? 'Saving...' : editingBill ? 'Update Bill' : 'Add Bill'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
