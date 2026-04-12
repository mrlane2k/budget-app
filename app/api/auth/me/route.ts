import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { getUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const userPayload = getUser(request);
  if (!userPayload) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDb();
  const user = db.prepare('SELECT id, username, pay_cycle, last_paycheck_date, created_at FROM users WHERE id = ?').get(userPayload.userId) as {
    id: number;
    username: string;
    pay_cycle: string;
    last_paycheck_date: string;
    created_at: string;
  } | undefined;

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  return NextResponse.json(user);
}
