import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { getUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const userPayload = getUser(request);
  if (!userPayload) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDb();

  const cards = db.prepare(`
    SELECT *
    FROM credit_cards
    WHERE user_id = ? AND active = 1
    ORDER BY apr DESC
  `).all(userPayload.userId);

  return NextResponse.json(cards);
}

export async function POST(request: NextRequest) {
  const userPayload = getUser(request);
  if (!userPayload) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { name, balance, credit_limit, minimum_payment, apr, due_day, last_four } = await request.json();

    if (!name || balance === undefined || !credit_limit || minimum_payment === undefined || apr === undefined || !due_day) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
    }

    const db = getDb();
    const result = db.prepare(`
      INSERT INTO credit_cards (user_id, name, balance, credit_limit, minimum_payment, apr, due_day, last_four)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(userPayload.userId, name, balance, credit_limit, minimum_payment, apr, due_day, last_four || null);

    const card = db.prepare('SELECT * FROM credit_cards WHERE id = ?').get(result.lastInsertRowid);
    return NextResponse.json(card, { status: 201 });
  } catch (error) {
    console.error('Create card error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
