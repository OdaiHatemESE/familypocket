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

/** How an expense's amount splits across categories (receipts split by their lines) */
export function categoryShares(e: Expense): { categoryId: string; amount: number }[] {
  if (!e.lines.length) return [{ categoryId: e.categoryId, amount: e.amount }];
  const by = new Map<string, number>();
  let linesTotal = 0;
  for (const l of e.lines) {
    by.set(l.categoryId, (by.get(l.categoryId) ?? 0) + l.amount);
    linesTotal += l.amount;
  }
  const rest = e.amount - linesTotal;
  if (rest > 0.005) by.set(e.categoryId, (by.get(e.categoryId) ?? 0) + rest);
  return [...by.entries()].map(([categoryId, amount]) => ({ categoryId, amount }));
}

/** Total spent in one category across a list of expenses */
export const spentInCategory = (list: Expense[], categoryId: string) =>
  list.reduce((a, e) => a + categoryShares(e).filter((s) => s.categoryId === categoryId).reduce((x, s) => x + s.amount, 0), 0);

/** Does this expense touch the category (directly or through a receipt line)? */
export const touchesCategory = (e: Expense, categoryId: string) =>
  e.categoryId === categoryId || e.lines.some((l) => l.categoryId === categoryId);

export type ItemStat = {
  key: string;
  itemId: string | null;
  name: string;
  unit: string;
  categoryId: string;
  quantity: number;
  amount: number;
  purchases: number; // number of receipts it appeared on
  avgPrice: number; // per unit
  prevAvgPrice: number | null; // previous month, per unit
  prevQuantity: number;
};

/** Quantities and prices per item for a month, compared with the month before */
export function itemStats(month: string, prevMonth: string, expenses: Expense[]): ItemStat[] {
  const agg = (m: string) => {
    const map = new Map<string, { itemId: string | null; name: string; unit: string; categoryId: string; quantity: number; amount: number; purchases: number }>();
    for (const e of expenses) {
      if (!e.date.startsWith(m)) continue;
      for (const l of e.lines) {
        const key = l.itemId ?? `${l.name}|${l.unit}`;
        const cur = map.get(key) ?? { itemId: l.itemId, name: l.name, unit: l.unit, categoryId: l.categoryId, quantity: 0, amount: 0, purchases: 0 };
        cur.quantity += l.quantity;
        cur.amount += l.amount;
        cur.purchases += 1;
        map.set(key, cur);
      }
    }
    return map;
  };
  const now = agg(month);
  const prev = agg(prevMonth);
  return [...now.entries()]
    .map(([key, v]) => {
      const p = prev.get(key);
      return {
        key, ...v,
        avgPrice: v.quantity ? v.amount / v.quantity : 0,
        prevAvgPrice: p && p.quantity ? p.amount / p.quantity : null,
        prevQuantity: p?.quantity ?? 0,
      };
    })
    .sort((a, b) => b.amount - a.amount);
}

/** "2 علبة", "1.5 كيلو" */
export const qtyLabel = (q: number, unit: string) => `${Number(q.toFixed(3)).toLocaleString('en-US')} ${unit}`;
