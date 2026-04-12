export function getNextDueDate(bill: { frequency: string; due_day: number; due_date?: string | null }): Date | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (bill.frequency === 'monthly' || !bill.frequency) {
    const candidate = new Date(today.getFullYear(), today.getMonth(), bill.due_day);
    if (candidate < today) candidate.setMonth(candidate.getMonth() + 1);
    return candidate;
  }

  if (!bill.due_date) return null;

  const anchor = new Date(bill.due_date + 'T00:00:00');

  if (bill.frequency === 'annually') {
    let candidate = new Date(today.getFullYear(), anchor.getMonth(), anchor.getDate());
    if (candidate < today) candidate = new Date(today.getFullYear() + 1, anchor.getMonth(), anchor.getDate());
    return candidate;
  }

  const monthsIncrement = bill.frequency === 'quarterly' ? 3 : 6;
  const candidate = new Date(anchor);
  while (candidate < today) candidate.setMonth(candidate.getMonth() + monthsIncrement);
  return candidate;
}

export function getUpcomingDueDates(
  bill: { frequency: string; due_day: number; due_date?: string | null },
  withinDays: number
): Date[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const limit = new Date(today);
  limit.setDate(limit.getDate() + withinDays);

  const results: Date[] = [];

  if (bill.frequency === 'monthly' || !bill.frequency) {
    let candidate = new Date(today.getFullYear(), today.getMonth(), bill.due_day);
    if (candidate < today) candidate.setMonth(candidate.getMonth() + 1);
    while (candidate <= limit) {
      results.push(new Date(candidate));
      candidate.setMonth(candidate.getMonth() + 1);
    }
    return results;
  }

  if (!bill.due_date) return [];

  const anchor = new Date(bill.due_date + 'T00:00:00');

  if (bill.frequency === 'annually') {
    let candidate = new Date(today.getFullYear(), anchor.getMonth(), anchor.getDate());
    if (candidate < today) candidate = new Date(today.getFullYear() + 1, anchor.getMonth(), anchor.getDate());
    if (candidate <= limit) results.push(candidate);
    return results;
  }

  const monthsIncrement = bill.frequency === 'quarterly' ? 3 : 6;
  const candidate = new Date(anchor);
  while (candidate < today) candidate.setMonth(candidate.getMonth() + monthsIncrement);
  while (candidate <= limit) {
    results.push(new Date(candidate));
    candidate.setMonth(candidate.getMonth() + monthsIncrement);
  }
  return results;
}
