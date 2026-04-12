import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { getUser } from '@/lib/auth';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userPayload = getUser(request);
  if (!userPayload) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const billId = parseInt(id);
  const { searchParams } = new URL(request.url);
  const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()));
  const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1));

  const db = getDb();
  const bill = db.prepare('SELECT * FROM bills WHERE id = ? AND user_id = ?').get(billId, userPayload.userId);
  if (!bill) {
    return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
  }

  const payment = db.prepare('SELECT * FROM bill_payments WHERE bill_id = ? AND year = ? AND month = ?').get(billId, year, month);
  return NextResponse.json(payment || { bill_id: billId, year, month, status: 'unpaid', amount_paid: null });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userPayload = getUser(request);
  if (!userPayload) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const billId = parseInt(id);

  try {
    const { year, month, status, amount_paid } = await request.json();

    const db = getDb();
    const bill = db.prepare('SELECT * FROM bills WHERE id = ? AND user_id = ?').get(billId, userPayload.userId);
    if (!bill) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
    }

    const paidAt = status === 'paid' ? new Date().toISOString() : null;

    db.prepare(`
      INSERT INTO bill_payments (bill_id, year, month, status, amount_paid, paid_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(bill_id, year, month) DO UPDATE SET
        status = excluded.status,
        amount_paid = excluded.amount_paid,
        paid_at = excluded.paid_at
    `).run(billId, year, month, status, amount_paid || null, paidAt);

    const payment = db.prepare('SELECT * FROM bill_payments WHERE bill_id = ? AND year = ? AND month = ?').get(billId, year, month);
    return NextResponse.json(payment);
  } catch (error) {
    console.error('Update payment error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
