'use client';
import { apiPath } from '@/lib/basepath';

import { useEffect, useState } from 'react';
import Nav from '@/components/Nav';

interface CreditCard {
  id: number;
  name: string;
  balance: number;
  credit_limit: number;
  minimum_payment: number;
  apr: number;
  due_day: number;
  last_four: string | null;
}

interface CreditCardTransaction {
  id: number;
  card_id: number;
  type: 'payment' | 'interest';
  amount: number;
  note: string | null;
  transaction_date: string;
  created_at: string;
}

interface CardForm {
  name: string;
  balance: string;
  credit_limit: string;
  minimum_payment: string;
  apr: string;
  due_day: string;
  last_four: string;
}

interface PaymentForm {
  payment_amount: string;
  interest_amount: string;
  payment_date: string;
  note: string;
}

function calculateInterestFromPayment(card: CreditCard, paymentAmount: number): number {
  const normalizedPayment = Math.max(0, paymentAmount || 0);
  const remainingBalance = Math.max(0, card.balance - normalizedPayment);
  return parseFloat(((remainingBalance * card.apr) / 100 / 12).toFixed(2));
}

const emptyForm: CardForm = {
  name: '',
  balance: '',
  credit_limit: '',
  minimum_payment: '',
  apr: '',
  due_day: '',
  last_four: '',
};

const emptyPaymentForm: PaymentForm = {
  payment_amount: '',
  interest_amount: '',
  payment_date: new Date().toISOString().slice(0, 10),
  note: '',
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function monthlyInterest(card: CreditCard): number {
  return parseFloat(((card.balance * card.apr) / 100 / 12).toFixed(2));
}

/** Estimate months to pay off a balance with fixed payment and APR */
function monthsToPayoff(balance: number, monthlyPayment: number, apr: number): number | null {
  if (balance <= 0) return 0;
  const monthlyRate = apr / 100 / 12;
  if (monthlyRate === 0) {
    return Math.ceil(balance / monthlyPayment);
  }
  if (monthlyPayment <= balance * monthlyRate) return null;
  const months = -Math.log(1 - (balance * monthlyRate) / monthlyPayment) / Math.log(1 + monthlyRate);
  return Math.ceil(months);
}

export default function CreditCardsPage() {
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingCard, setEditingCard] = useState<CreditCard | null>(null);
  const [form, setForm] = useState<CardForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [payingCard, setPayingCard] = useState<CreditCard | null>(null);
  const [paymentForm, setPaymentForm] = useState<PaymentForm>(emptyPaymentForm);
  const [paymentError, setPaymentError] = useState('');
  const [transactions, setTransactions] = useState<Record<number, CreditCardTransaction[]>>({});
  const [expandedCardId, setExpandedCardId] = useState<number | null>(null);
  const [extraPayment, setExtraPayment] = useState(() =>
    typeof window !== 'undefined' ? (localStorage.getItem('budget_extra_payment') ?? '100') : '100'
  );

  const handleExtraPaymentChange = (val: string) => {
    setExtraPayment(val);
    if (typeof window !== 'undefined') localStorage.setItem('budget_extra_payment', val);
  };

  const fetchCards = async () => {
    const res = await fetch(apiPath('/api/credit-cards'));
    const data = await res.json();
    setCards(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  const fetchTransactions = async (cardId: number) => {
    const res = await fetch(apiPath(`/api/credit-cards/${cardId}/payments`));
    const data = await res.json();
    setTransactions(prev => ({ ...prev, [cardId]: Array.isArray(data) ? data : [] }));
  };

  useEffect(() => { fetchCards(); }, []);

  const openAdd = () => {
    setEditingCard(null);
    setForm(emptyForm);
    setError('');
    setShowForm(true);
  };

  const openEdit = (card: CreditCard) => {
    setEditingCard(card);
    setForm({
      name: card.name,
      balance: String(card.balance),
      credit_limit: String(card.credit_limit),
      minimum_payment: String(card.minimum_payment),
      apr: String(card.apr),
      due_day: String(card.due_day),
      last_four: card.last_four || '',
    });
    setError('');
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingCard(null);
    setForm(emptyForm);
    setError('');
  };

  const openPayment = (card: CreditCard) => {
    const defaultPayment = card.minimum_payment > 0 ? card.minimum_payment : 0;
    setPayingCard(card);
    setPaymentForm({
      payment_amount: defaultPayment > 0 ? String(defaultPayment) : '',
      interest_amount: calculateInterestFromPayment(card, defaultPayment).toFixed(2),
      payment_date: new Date().toISOString().slice(0, 10),
      note: '',
    });
    setPaymentError('');
    setShowPaymentForm(true);
  };

  const closePaymentForm = () => {
    setShowPaymentForm(false);
    setPayingCard(null);
    setPaymentForm(emptyPaymentForm);
    setPaymentError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    const payload = {
      name: form.name,
      balance: parseFloat(form.balance),
      credit_limit: parseFloat(form.credit_limit),
      minimum_payment: parseFloat(form.minimum_payment),
      apr: parseFloat(form.apr),
      due_day: parseInt(form.due_day),
      last_four: form.last_four || null,
    };

    try {
      const url = editingCard
        ? apiPath(`/api/credit-cards/${editingCard.id}`)
        : apiPath('/api/credit-cards');
      const method = editingCard ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to save card');
        return;
      }

      await fetchCards();
      closeForm();
    } catch {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (card: CreditCard) => {
    if (!confirm(`Delete "${card.name}"?`)) return;
    await fetch(apiPath(`/api/credit-cards/${card.id}`), { method: 'DELETE' });
    await fetchCards();
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingCard) return;

    setSaving(true);
    setPaymentError('');

    const paymentAmount = parseFloat(paymentForm.payment_amount) || 0;
    const interestAmount = parseFloat(paymentForm.interest_amount) || 0;

    if (paymentAmount <= 0 && interestAmount <= 0) {
      setPaymentError('Enter a payment or interest amount');
      setSaving(false);
      return;
    }

    try {
      const res = await fetch(apiPath(`/api/credit-cards/${payingCard.id}/payments`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_amount: paymentAmount,
          interest_amount: interestAmount,
          payment_date: paymentForm.payment_date,
          note: paymentForm.note || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setPaymentError(data.error || 'Failed to save payment');
        return;
      }

      await fetchCards();
      await fetchTransactions(payingCard.id);
      setExpandedCardId(payingCard.id);
      closePaymentForm();
    } catch {
      setPaymentError('Network error');
    } finally {
      setSaving(false);
    }
  };

  const toggleTransactions = async (cardId: number) => {
    if (expandedCardId === cardId) {
      setExpandedCardId(null);
      return;
    }
    if (!transactions[cardId]) await fetchTransactions(cardId);
    setExpandedCardId(cardId);
  };

  const totalBalance = cards.reduce((sum, c) => sum + c.balance, 0);
  const totalLimit = cards.reduce((sum, c) => sum + c.credit_limit, 0);
  const totalMinimums = cards.reduce((sum, c) => sum + c.minimum_payment, 0);
  const utilizationPct = totalLimit > 0 ? (totalBalance / totalLimit) * 100 : 0;
  const totalMonthlyInterest = cards.reduce((sum, c) => sum + monthlyInterest(c), 0);

  const extra = parseFloat(extraPayment) || 0;
  const sortedByApr = [...cards].filter(c => c.balance > 0).sort((a, b) => b.apr - a.apr);

  const simulateAvalanche = (extraMonthly: number): { months: number; totalInterest: number } => {
    if (sortedByApr.length === 0) return { months: 0, totalInterest: 0 };
    let balances = sortedByApr.map(c => ({ balance: c.balance, apr: c.apr, min: c.minimum_payment }));
    let month = 0;
    let totalInterest = 0;
    let extraPool = extraMonthly;
    const MAX_MONTHS = 600;
    while (balances.some(b => b.balance > 0) && month < MAX_MONTHS) {
      month++;
      let freed = 0;
      balances = balances.map(b => {
        if (b.balance <= 0) return b;
        const interest = (b.balance * b.apr) / 100 / 12;
        totalInterest += interest;
        b.balance += interest;
        const payment = Math.min(b.min, b.balance);
        b.balance -= payment;
        if (b.balance <= 0) { freed += Math.abs(b.balance) * -1; b.balance = 0; }
        return b;
      });
      let remaining = extraPool + freed;
      for (const b of balances) {
        if (b.balance <= 0 || remaining <= 0) continue;
        const payment = Math.min(remaining, b.balance);
        b.balance -= payment;
        remaining -= payment;
        if (b.balance <= 0) { remaining += Math.abs(b.balance) * -1; b.balance = 0; }
        break;
      }
    }
    return { months: month, totalInterest: Math.round(totalInterest * 100) / 100 };
  };

  const avalancheMin = simulateAvalanche(0);
  const avalancheExtra = simulateAvalanche(extra);

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
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-white">Credit Cards</h1>
              <p className="text-gray-400 mt-1">{cards.length} card{cards.length !== 1 ? 's' : ''} tracked</p>
            </div>
            <button
              onClick={openAdd}
              className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              + Add Card
            </button>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Total Balance</p>
              <p className="text-xl font-bold text-red-400">{formatCurrency(totalBalance)}</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Total Limit</p>
              <p className="text-xl font-bold text-white">{formatCurrency(totalLimit)}</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Monthly Minimums</p>
              <p className="text-xl font-bold text-white">{formatCurrency(totalMinimums)}</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Utilization</p>
              <p className={`text-xl font-bold ${utilizationPct > 30 ? 'text-red-400' : utilizationPct > 10 ? 'text-yellow-400' : 'text-green-400'}`}>
                {utilizationPct.toFixed(1)}%
              </p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Monthly Interest</p>
              <p className="text-xl font-bold text-orange-400">{formatCurrency(totalMonthlyInterest)}</p>
            </div>
          </div>

          {sortedByApr.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">
              <h2 className="text-base font-semibold text-white mb-4">Total Payoff Summary</h2>
              <div className="grid grid-cols-2 gap-6">
                <div className="bg-gray-800/40 rounded-lg p-4">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Minimums Only</p>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400 text-sm">Time to debt-free</span>
                      <span className="text-white text-sm font-bold">
                        {avalancheMin.months >= 600 ? 'Never' : avalancheMin.months <= 12
                          ? `${avalancheMin.months} mo`
                          : `${Math.floor(avalancheMin.months / 12)}y ${avalancheMin.months % 12}mo`}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400 text-sm">Total interest paid</span>
                      <span className="text-red-400 text-sm font-bold">{formatCurrency(avalancheMin.totalInterest)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400 text-sm">Total cost</span>
                      <span className="text-red-400 text-sm font-bold">{formatCurrency(totalBalance + avalancheMin.totalInterest)}</span>
                    </div>
                  </div>
                </div>
                <div className="bg-blue-900/20 border border-blue-800/40 rounded-lg p-4">
                  <p className="text-xs font-medium text-blue-400 uppercase tracking-wide mb-3">With +{formatCurrency(extra)}/mo Extra</p>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400 text-sm">Time to debt-free</span>
                      <span className="text-green-400 text-sm font-bold">
                        {avalancheExtra.months >= 600 ? 'Never' : avalancheExtra.months <= 12
                          ? `${avalancheExtra.months} mo`
                          : `${Math.floor(avalancheExtra.months / 12)}y ${avalancheExtra.months % 12}mo`}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400 text-sm">Total interest paid</span>
                      <span className="text-green-400 text-sm font-bold">{formatCurrency(avalancheExtra.totalInterest)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400 text-sm">Interest saved</span>
                      <span className="text-green-400 text-sm font-bold">
                        {formatCurrency(Math.max(0, avalancheMin.totalInterest - avalancheExtra.totalInterest))}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wide px-5 py-3">Card</th>
                  <th className="text-right text-xs font-medium text-gray-400 uppercase tracking-wide px-5 py-3">Balance</th>
                  <th className="text-right text-xs font-medium text-gray-400 uppercase tracking-wide px-5 py-3">Limit</th>
                  <th className="text-right text-xs font-medium text-gray-400 uppercase tracking-wide px-5 py-3">Min. Payment</th>
                  <th className="text-right text-xs font-medium text-gray-400 uppercase tracking-wide px-5 py-3">APR</th>
                  <th className="text-right text-xs font-medium text-gray-400 uppercase tracking-wide px-5 py-3">Mo. Interest</th>
                  <th className="text-center text-xs font-medium text-gray-400 uppercase tracking-wide px-5 py-3">Due</th>
                  <th className="text-center text-xs font-medium text-gray-400 uppercase tracking-wide px-5 py-3">Ledger</th>
                  <th className="text-center text-xs font-medium text-gray-400 uppercase tracking-wide px-5 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {cards.map((card, i) => (
                  <>
                    <tr key={card.id} className={`border-b border-gray-800/50 ${i % 2 === 0 ? '' : 'bg-gray-800/20'}`}>
                      <td className="px-5 py-3">
                        <span className="text-white text-sm font-medium">{card.name}</span>
                        {card.last_four && (
                          <span className="ml-2 text-gray-500 text-xs font-mono">•••• {card.last_four}</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span className="text-red-400 text-sm font-medium">{formatCurrency(card.balance)}</span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span className="text-gray-300 text-sm">{formatCurrency(card.credit_limit)}</span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span className="text-white text-sm">{formatCurrency(card.minimum_payment)}</span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span className={`text-sm font-medium ${card.apr > 25 ? 'text-red-400' : card.apr > 20 ? 'text-yellow-400' : 'text-gray-300'}`}>
                          {card.apr}%
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span className="text-orange-400 text-sm">{formatCurrency(monthlyInterest(card))}</span>
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span className="text-gray-300 text-sm">{ordinal(card.due_day)}</span>
                      </td>
                      <td className="px-5 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => openPayment(card)}
                            className="text-xs px-2 py-1 rounded bg-green-700/60 text-green-100 hover:bg-green-600 transition-colors"
                          >
                            Add Entry
                          </button>
                          <button
                            onClick={() => toggleTransactions(card.id)}
                            className="text-xs text-gray-400 hover:text-white transition-colors"
                          >
                            {expandedCardId === card.id ? 'Hide' : 'History'}
                          </button>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => openEdit(card)}
                            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(card)}
                            className="text-xs text-red-500 hover:text-red-400 transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedCardId === card.id && (
                      <tr className="bg-gray-950/70 border-b border-gray-800">
                        <td colSpan={9} className="px-5 py-4">
                          <div className="space-y-2">
                            <p className="text-sm font-medium text-white">Recent Ledger Entries</p>
                            {(transactions[card.id] || []).length === 0 ? (
                              <p className="text-sm text-gray-500">No payment or interest entries yet.</p>
                            ) : (
                              <div className="space-y-2">
                                {transactions[card.id].map(tx => (
                                  <div key={tx.id} className="flex items-center justify-between bg-gray-800/60 rounded-lg px-3 py-2 text-sm">
                                    <div>
                                      <p className="text-white capitalize">{tx.type}</p>
                                      <p className="text-gray-500 text-xs">{tx.transaction_date}{tx.note ? ` · ${tx.note}` : ''}</p>
                                    </div>
                                    <span className={tx.type === 'payment' ? 'text-green-400 font-medium' : 'text-orange-400 font-medium'}>
                                      {tx.type === 'payment' ? '−' : '+'}{formatCurrency(tx.amount)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
                {cards.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-5 py-10 text-center text-gray-500 text-sm">
                      No credit cards added yet.
                    </td>
                  </tr>
                )}
              </tbody>
              {cards.length > 0 && (
                <tfoot>
                  <tr className="border-t border-gray-700">
                    <td className="px-5 py-3 text-gray-400 text-sm font-medium">Total</td>
                    <td className="px-5 py-3 text-right text-red-400 text-sm font-bold">{formatCurrency(totalBalance)}</td>
                    <td className="px-5 py-3 text-right text-gray-300 text-sm">{formatCurrency(totalLimit)}</td>
                    <td className="px-5 py-3 text-right text-white text-sm font-bold">{formatCurrency(totalMinimums)}</td>
                    <td className="px-5 py-3 text-right text-orange-400 text-sm font-bold">{formatCurrency(totalMonthlyInterest)}</td>
                    <td colSpan={5} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </main>

      {showPaymentForm && payingCard && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-gray-800">
              <h2 className="text-lg font-semibold text-white">Add Ledger Entry</h2>
              <button onClick={closePaymentForm} className="text-gray-400 hover:text-white transition-colors text-xl leading-none">
                &times;
              </button>
            </div>

            <form onSubmit={handlePaymentSubmit} className="p-5 space-y-4">
              <div>
                <p className="text-sm text-white font-medium">{payingCard.name}</p>
                <p className="text-xs text-gray-500 mt-1">
                  Current balance {formatCurrency(payingCard.balance)} · estimated monthly interest {formatCurrency(monthlyInterest(payingCard))}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1.5">Payment Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={paymentForm.payment_amount}
                    onChange={e => {
                      const payment_amount = e.target.value;
                      const paymentValue = parseFloat(payment_amount) || 0;
                      setPaymentForm({
                        ...paymentForm,
                        payment_amount,
                        interest_amount: calculateInterestFromPayment(payingCard, paymentValue).toFixed(2),
                      });
                    }}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1.5">Interest Charged</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={paymentForm.interest_amount}
                    readOnly
                    className="w-full bg-gray-800/60 border border-gray-700 rounded-lg px-3 py-2.5 text-gray-300 focus:outline-none"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">Date</label>
                <input
                  type="date"
                  value={paymentForm.payment_date}
                  onChange={e => setPaymentForm({ ...paymentForm, payment_date: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">Note</label>
                <input
                  type="text"
                  value={paymentForm.note}
                  onChange={e => setPaymentForm({ ...paymentForm, note: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Optional memo"
                />
              </div>

              {paymentError && (
                <div className="bg-red-900/30 border border-red-800 rounded-lg px-3 py-2 text-red-400 text-sm">
                  {paymentError}
                </div>
              )}

              <div className="text-xs text-gray-500 bg-gray-800/50 rounded-lg p-3 space-y-1">
                <div>
                  Interest is automatically recalculated from the remaining balance after your payment.
                </div>
                <div>
                  New balance will be approximately {formatCurrency(Math.max(0, payingCard.balance - (parseFloat(paymentForm.payment_amount) || 0) + (parseFloat(paymentForm.interest_amount) || 0)))}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closePaymentForm}
                  className="flex-1 bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-green-600 hover:bg-green-500 disabled:bg-green-800 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
                >
                  {saving ? 'Saving...' : 'Save Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-gray-800">
              <h2 className="text-lg font-semibold text-white">
                {editingCard ? 'Edit Card' : 'Add Credit Card'}
              </h2>
              <button onClick={closeForm} className="text-gray-400 hover:text-white transition-colors text-xl leading-none">
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1.5">Card Name</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. Chase Sapphire"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1.5">Last 4 Digits</label>
                  <input
                    type="text"
                    value={form.last_four}
                    onChange={e => setForm({ ...form, last_four: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                    placeholder="1234"
                    maxLength={4}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1.5">Current Balance</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.balance}
                    onChange={e => setForm({ ...form, balance: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1.5">Credit Limit</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.credit_limit}
                    onChange={e => setForm({ ...form, credit_limit: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1.5">Min. Payment</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.minimum_payment}
                    onChange={e => setForm({ ...form, minimum_payment: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1.5">APR (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.apr}
                    onChange={e => setForm({ ...form, apr: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. 22.99"
                    required
                  />
                </div>
              </div>

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
                  {saving ? 'Saving...' : editingCard ? 'Update Card' : 'Add Card'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
