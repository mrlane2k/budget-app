import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { getUser } from '@/lib/auth';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userPayload = getUser(request);
  if (!userPayload) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const billId = parseInt(id);

  try {
    const { name, category, amount, due_day, is_autopay, frequency, due_date } = await request.json();

    const freq = frequency || 'monthly';

    const db = getDb();
    const bill = db.prepare('SELECT * FROM bills WHERE id = ? AND user_id = ?').get(billId, userPayload.userId);
    if (!bill) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
    }

    if (freq === 'monthly') {
      if (!due_day || due_day < 1 || due_day > 31) {
        return NextResponse.json({ error: 'due_day (1-31) is required for monthly bills' }, { status: 400 });
      }
    } else {
      if (!due_date) {
        return NextResponse.json({ error: 'due_date is required for non-monthly bills' }, { status: 400 });
      }
    }

    db.prepare(`
      UPDATE bills SET name = ?, category = ?, amount = ?, due_day = ?, is_autopay = ?, frequency = ?, due_date = ?
      WHERE id = ? AND user_id = ?
    `).run(name, category || null, amount, freq === 'monthly' ? due_day : 1, is_autopay ? 1 : 0, freq, due_date || null, billId, userPayload.userId);

    const updatedBill = db.prepare('SELECT * FROM bills WHERE id = ?').get(billId);
    return NextResponse.json(updatedBill);
  } catch (error) {
    console.error('Update bill error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userPayload = getUser(request);
  if (!userPayload) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const billId = parseInt(id);

  const db = getDb();
  const bill = db.prepare('SELECT * FROM bills WHERE id = ? AND user_id = ?').get(billId, userPayload.userId);
  if (!bill) {
    return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
  }

  db.prepare('UPDATE bills SET active = 0 WHERE id = ? AND user_id = ?').run(billId, userPayload.userId);
  return NextResponse.json({ success: true });
}
