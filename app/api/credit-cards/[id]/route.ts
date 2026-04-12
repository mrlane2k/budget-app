import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { getUser } from '@/lib/auth';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userPayload = getUser(request);
  if (!userPayload) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const cardId = parseInt(id);

  try {
    const { name, balance, credit_limit, minimum_payment, apr, due_day, last_four } = await request.json();

    const db = getDb();
    const card = db.prepare('SELECT * FROM credit_cards WHERE id = ? AND user_id = ?').get(cardId, userPayload.userId);
    if (!card) {
      return NextResponse.json({ error: 'Card not found' }, { status: 404 });
    }

    db.prepare(`
      UPDATE credit_cards SET name = ?, balance = ?, credit_limit = ?, minimum_payment = ?, apr = ?, due_day = ?, last_four = ?
      WHERE id = ? AND user_id = ?
    `).run(name, balance, credit_limit, minimum_payment, apr, due_day, last_four || null, cardId, userPayload.userId);

    const updatedCard = db.prepare('SELECT * FROM credit_cards WHERE id = ?').get(cardId);
    return NextResponse.json(updatedCard);
  } catch (error) {
    console.error('Update card error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userPayload = getUser(request);
  if (!userPayload) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const cardId = parseInt(id);

  const db = getDb();
  const card = db.prepare('SELECT * FROM credit_cards WHERE id = ? AND user_id = ?').get(cardId, userPayload.userId);
  if (!card) {
    return NextResponse.json({ error: 'Card not found' }, { status: 404 });
  }

  db.prepare('UPDATE credit_cards SET active = 0 WHERE id = ? AND user_id = ?').run(cardId, userPayload.userId);
  return NextResponse.json({ success: true });
}
