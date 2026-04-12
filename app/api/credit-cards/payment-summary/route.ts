import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { getUser } from '@/lib/auth';

// Returns a map of card_id -> { paid: boolean, amount_paid: number }
// for the current calendar month.
export async function GET(request: NextRequest) {
  const userPayload = getUser(request);
  if (!userPayload) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const monthEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-31`;

  const db = getDb();

  // Get all cards for this user
  const cards = db.prepare(
    'SELECT id FROM credit_cards WHERE user_id = ? AND active = 1'
  ).all(userPayload.userId) as { id: number }[];

  // Get payment totals per card for this month
  const rows = db.prepare(`
    SELECT cct.card_id, SUM(cct.amount) as amount_paid
    FROM credit_card_transactions cct
    JOIN credit_cards cc ON cc.id = cct.card_id
    WHERE cc.user_id = ?
      AND cct.type = 'payment'
      AND cct.transaction_date >= ?
      AND cct.transaction_date <= ?
    GROUP BY cct.card_id
  `).all(userPayload.userId, monthStart, monthEnd) as { card_id: number; amount_paid: number }[];

  const paymentMap: Record<number, number> = {};
  for (const row of rows) {
    paymentMap[row.card_id] = row.amount_paid;
  }

  const summary: Record<number, { paid: boolean; amount_paid: number }> = {};
  for (const card of cards) {
    const paid = paymentMap[card.id] ?? 0;
    summary[card.id] = { paid: paid > 0, amount_paid: paid };
  }

  return NextResponse.json(summary);
}
