import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { getUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const userPayload = getUser(request);
  if (!userPayload) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDb();
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const bills = db.prepare(`
    SELECT b.*, bp.status, bp.amount_paid, bp.paid_at, bp.id as payment_id
    FROM bills b
    LEFT JOIN bill_payments bp ON bp.bill_id = b.id AND bp.year = ? AND bp.month = ?
    WHERE b.user_id = ? AND b.active = 1
    ORDER BY b.due_day ASC
  `).all(year, month, userPayload.userId);

  return NextResponse.json(bills);
}

export async function POST(request: NextRequest) {
  const userPayload = getUser(request);
  if (!userPayload) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { name, category, amount, due_day, is_autopay, frequency, due_date } = await request.json();

    const freq = frequency || 'monthly';

    if (!name || !amount) {
      return NextResponse.json({ error: 'Name and amount are required' }, { status: 400 });
    }

    if (freq === 'monthly') {
      if (!due_day) {
        return NextResponse.json({ error: 'due_day is required for monthly bills' }, { status: 400 });
      }
      if (due_day < 1 || due_day > 31) {
        return NextResponse.json({ error: 'due_day must be between 1 and 31' }, { status: 400 });
      }
    } else {
      if (!due_date) {
        return NextResponse.json({ error: 'due_date is required for non-monthly bills' }, { status: 400 });
      }
    }

    const db = getDb();
    const result = db.prepare(`
      INSERT INTO bills (user_id, name, category, amount, due_day, is_autopay, frequency, due_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(userPayload.userId, name, category || null, amount, freq === 'monthly' ? due_day : 1, is_autopay ? 1 : 0, freq, due_date || null);

    const bill = db.prepare('SELECT * FROM bills WHERE id = ?').get(result.lastInsertRowid);
    return NextResponse.json(bill, { status: 201 });
  } catch (error) {
    console.error('Create bill error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
