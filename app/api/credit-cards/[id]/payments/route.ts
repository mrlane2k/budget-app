import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { getUser } from '@/lib/auth';

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function recalculateBalance(db: ReturnType<typeof getDb>, cardId: number, startingBalance: number): number {
  const transactions = db.prepare(`
    SELECT type, amount
    FROM credit_card_transactions
    WHERE card_id = ?
    ORDER BY transaction_date ASC, id ASC
  `).all(cardId) as { type: string; amount: number }[];

  return roundMoney(transactions.reduce((balance, tx) => {
    if (tx.type === 'payment') return balance - tx.amount;
    return balance + tx.amount;
  }, startingBalance));
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userPayload = getUser(request);
  if (!userPayload) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const cardId = parseInt(id);

  const db = getDb();
  const card = db.prepare('SELECT * FROM credit_cards WHERE id = ? AND user_id = ?').get(cardId, userPayload.userId) as {
    id: number;
    balance: number;
    minimum_payment: number;
    apr: number;
  } | undefined;

  if (!card) {
    return NextResponse.json({ error: 'Card not found' }, { status: 404 });
  }

  const transactions = db.prepare(`
    SELECT *
    FROM credit_card_transactions
    WHERE card_id = ?
    ORDER BY transaction_date DESC, id DESC
  `).all(cardId);

  return NextResponse.json(transactions);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userPayload = getUser(request);
  if (!userPayload) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const cardId = parseInt(id);

  try {
    const { payment_amount, interest_amount, payment_date, note } = await request.json();

    const db = getDb();
    const card = db.prepare('SELECT * FROM credit_cards WHERE id = ? AND user_id = ?').get(cardId, userPayload.userId) as {
      id: number;
      balance: number;
    } | undefined;

    if (!card) {
      return NextResponse.json({ error: 'Card not found' }, { status: 404 });
    }

    const paymentAmount = roundMoney(Math.max(0, Number(payment_amount) || 0));
    const interestAmount = roundMoney(Math.max(0, Number(interest_amount) || 0));
    const transactionDate = typeof payment_date === 'string' && payment_date ? payment_date : new Date().toISOString().slice(0, 10);

    if (paymentAmount <= 0 && interestAmount <= 0) {
      return NextResponse.json({ error: 'Enter a payment or interest amount' }, { status: 400 });
    }

    const tx = db.transaction(() => {
      if (paymentAmount > 0) {
        db.prepare(`
          INSERT INTO credit_card_transactions (card_id, type, amount, note, transaction_date)
          VALUES (?, 'payment', ?, ?, ?)
        `).run(cardId, paymentAmount, note || null, transactionDate);
      }

      if (interestAmount > 0) {
        db.prepare(`
          INSERT INTO credit_card_transactions (card_id, type, amount, note, transaction_date)
          VALUES (?, 'interest', ?, ?, ?)
        `).run(cardId, interestAmount, note || null, transactionDate);
      }

      const newBalance = Math.max(0, recalculateBalance(db, cardId, card.balance));
      db.prepare('UPDATE credit_cards SET balance = ? WHERE id = ? AND user_id = ?').run(newBalance, cardId, userPayload.userId);
    });

    tx();

    const transactions = db.prepare(`
      SELECT *
      FROM credit_card_transactions
      WHERE card_id = ?
      ORDER BY transaction_date DESC, id DESC
      LIMIT 10
    `).all(cardId);

    const updatedCard = db.prepare('SELECT * FROM credit_cards WHERE id = ?').get(cardId);
    return NextResponse.json({ card: updatedCard, transactions });
  } catch (error) {
    console.error('Create credit card transaction error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
