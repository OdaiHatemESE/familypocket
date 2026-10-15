import { BudgetRow, CategoryBudgetRow, Expense, FixedExpense, Member, MemberBudget } from './types';

/** The budget that applies to `month`: the member's latest saved month on or before it */
export function resolveBudget(userId: string, month: string, rows: BudgetRow[], catRows: CategoryBudgetRow[]): MemberBudget {
  let source: string | null = null;
  let total = 0;
  for (const r of rows) {
    if (r.userId === userId && r.month <= month && (!source || r.month > source)) {
      source = r.month;
      total = r.total;
    }
  }
  const cats: Record<string, number> = {};
  if (source) {
    for (const c of catRows) if (c.userId === userId && c.month === source) cats[c.categoryId] = c.amount;
  }
  return { userId, total, cats, sourceMonth: source };
}

export function resolveAll(members: Member[], month: string, rows: BudgetRow[], catRows: CategoryBudgetRow[]) {
  const out: Record<string, MemberBudget> = {};
  for (const m of members) out[m.id] = resolveBudget(m.id, month, rows, catRows);
  return out;
}

/** Whose budget an expense counts against: the obligation's owner for paid obligations, otherwise whoever recorded it */
export function expenseOwner(e: Expense, fixed: FixedExpense[]): string | null {
  if (e.fixedId) {
    const f = fixed.find((x) => x.id === e.fixedId);
    if (f?.ownerId) return f.ownerId;
  }
  return e.userId;
}
