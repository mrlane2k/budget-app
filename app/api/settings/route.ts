import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import getDb from '@/lib/db';
import { getUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const userPayload = getUser(request);
  if (!userPayload) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDb();
  const user = db.prepare('SELECT id, username, pay_cycle, last_paycheck_date, monthly_income, current_savings, extra_cc_payment FROM users WHERE id = ?').get(userPayload.userId) as {
    id: number;
    username: string;
    pay_cycle: string;
    last_paycheck_date: string;
    monthly_income: number;
    current_savings: number;
    extra_cc_payment: number;
  } | undefined;

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  return NextResponse.json(user);
}

export async function PUT(request: NextRequest) {
  const userPayload = getUser(request);
  if (!userPayload) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const db = getDb();

    if (body.current_password && body.new_password) {
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userPayload.userId) as {
        id: number;
        password_hash: string;
      } | undefined;

      if (!user || !bcrypt.compareSync(body.current_password, user.password_hash)) {
        return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 });
      }

      const newHash = bcrypt.hashSync(body.new_password, 10);
      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, userPayload.userId);
      return NextResponse.json({ success: true, message: 'Password updated' });
    }

    if (body.pay_cycle || body.last_paycheck_date !== undefined || body.monthly_income !== undefined || body.current_savings !== undefined || body.extra_cc_payment !== undefined) {
      const updates: string[] = [];
      const values: any[] = [];

      if (body.pay_cycle) {
        updates.push('pay_cycle = ?');
        values.push(body.pay_cycle);
      }
      if (body.last_paycheck_date !== undefined) {
        updates.push('last_paycheck_date = ?');
        values.push(body.last_paycheck_date);
      }
      if (body.monthly_income !== undefined) {
        updates.push('monthly_income = ?');
        values.push(body.monthly_income);
      }
      if (body.current_savings !== undefined) {
        updates.push('current_savings = ?');
        values.push(body.current_savings);
      }
      if (body.extra_cc_payment !== undefined) {
        updates.push('extra_cc_payment = ?');
        values.push(body.extra_cc_payment);
      }

      values.push(userPayload.userId);
      db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }

    const updatedUser = db.prepare('SELECT id, username, pay_cycle, last_paycheck_date, monthly_income, current_savings, extra_cc_payment FROM users WHERE id = ?').get(userPayload.userId);
    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error('Update settings error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
