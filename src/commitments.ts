// What comes off the salary each month before day-to-day spending, and what is left.
// Monthly commitments (bills, transfers, savings) are paid each month. Commitments paid every few months
// (rent cheques, school fees) get a monthly set-aside, and are paid from what was set aside when they fall due.
import type { IconName } from './ui';
import { CommitmentKind, CommitmentPayment, Expense, FixedExpense, IncomeRow, Member, ReserveRow } from './types';
import { daysInMonth, monthKey } from './utils';

export const KINDS: { key: CommitmentKind; label: string; icon: IconName }[] = [
  { key: 'rent', label: 'إيجار', icon: 'home-city-outline' },
  { key: 'school', label: 'مدارس', icon: 'school-outline' },
  { key: 'bill', label: 'فاتورة', icon: 'flash-outline' },
  { key: 'transfer', label: 'تحويل للأهل', icon: 'bank-transfer' },
  { key: 'saving', label: 'ادخار', icon: 'piggy-bank-outline' },
  { key: 'installment', label: 'قسط', icon: 'credit-card-clock-outline' },
  { key: 'other', label: 'غير ذلك', icon: 'calendar-sync-outline' },
];
export const kindOf = (k: CommitmentKind) => KINDS.find((x) => x.key === k) ?? KINDS[KINDS.length - 1];

export const EVERY: { months: number; label: string }[] = [
  { months: 1, label: 'كل شهر' },
  { months: 2, label: 'كل شهرين' },
  { months: 3, label: 'كل 3 أشهر' },
  { months: 4, label: 'كل 4 أشهر' },
  { months: 6, label: 'كل 6 أشهر' },
  { months: 12, label: 'كل سنة' },
];
export const everyLabel = (n: number) => EVERY.find((e) => e.months === n)?.label ?? `كل ${n} أشهر`;

export const METHOD_LABEL: Record<CommitmentPayment['method'], string> = { cheque: 'شيك', transfer: 'تحويل', card: 'بطاقة', cash: 'كاش' };

/** Transfers to family and savings leave the household but are not consumption, so they are reported apart */
export const isTransferKind = (k: CommitmentKind) => k === 'transfer' || k === 'saving';

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Which bucket an expense belongs to: everyday spending, a commitment, or a transfer/saving */
export function expenseBucket(e: Expense, fixedById: Map<string, FixedExpense>): 'daily' | 'commitment' | 'transfer' {
  if (!e.fixedId) return 'daily';
  const f = fixedById.get(e.fixedId);
  return f && isTransferKind(f.kind) ? 'transfer' : 'commitment';
}

export type DuePayment = { payment: CommitmentPayment; index: number; count: number; paid: boolean; overdue: boolean };

export type CommitmentState = {
  fixed: FixedExpense;
  mode: 'monthly' | 'reserve';
  /** What this commitment takes from this month's money: the bill, or the monthly set-aside */
  amount: number;
  /** Paid this month (monthly) or set aside this month (reserve) */
  done: boolean;
  overdue: boolean;
  dueDate: string | null; // monthly: due date in this month
  paidExpense: Expense | null; // monthly: the payment recorded this month
  reserve: ReserveRow | null; // reserve: this month's set-aside
  share: number; // reserve: the suggested monthly set-aside
  fund: number; // reserve: set aside towards the next payment
  duePayments: DuePayment[]; // reserve: scheduled payments falling in this month
  nextPayment: CommitmentPayment | null; // reserve: the next unpaid payment
};

export type MonthCommitments = {
  items: CommitmentState[];
  total: number; // everything committed this month
  doneAmount: number;
  pendingAmount: number;
  doneCount: number;
  commitments: number; // rent, school, bills, instalments
  transfers: number; // transfers to family and savings
  dueThisMonth: DuePayment[]; // cheques and instalments falling due this month, across commitments
};

export function monthCommitments(
  month: string,
  fixed: FixedExpense[],
  payments: CommitmentPayment[],
  reserves: ReserveRow[],
  expenses: Expense[],
  scope: string | null = null,
  today = new Date(),
): MonthCommitments {
  const current = monthKey(today);
  const isCurrent = month === current;
  const [y, m] = month.split('-').map(Number);
  const dim = daysInMonth(y, m - 1);
  const todayKey = `${current}-${String(today.getDate()).padStart(2, '0')}`;

  const items: CommitmentState[] = fixed
    .filter((f) => f.active && (!scope || f.ownerId === scope))
    .map((f) => {
      if (f.everyMonths <= 1) {
        const day = Math.min(f.dueDay, dim);
        const paidExpense = expenses.find((e) => e.fixedId === f.id && e.date.startsWith(month)) ?? null;
        return {
          fixed: f, mode: 'monthly' as const,
          amount: paidExpense?.amount ?? f.amount,
          done: !!paidExpense,
          overdue: !paidExpense && isCurrent && today.getDate() > day,
          dueDate: `${month}-${String(day).padStart(2, '0')}`,
          paidExpense, reserve: null, share: 0, fund: 0, duePayments: [], nextPayment: null,
        };
      }
      const schedule = payments.filter((p) => p.fixedId === f.id).sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1));
      const nextPayment = schedule.find((p) => !p.expenseId && p.dueDate >= `${month}-01`) ?? schedule.find((p) => !p.expenseId) ?? null;
      const share = round2((nextPayment?.amount ?? f.amount) / f.everyMonths);
      const reserve = reserves.find((r) => r.fixedId === f.id && r.month === month) ?? null;
      // The piggy bank holds what was set aside since the last payment went out (from that payment's month on),
      // so a payment made before any setting aside never shows as a debt
      const lastPaid = [...schedule].reverse().find((p) => p.expenseId);
      const since = lastPaid ? lastPaid.dueDate.slice(0, 7) : '';
      const setAside = reserves.filter((r) => r.fixedId === f.id && r.month >= since).reduce((a, r) => a + r.amount, 0);
      const duePayments = schedule
        .map((p, i) => ({ payment: p, index: i + 1, count: schedule.length, paid: !!p.expenseId, overdue: !p.expenseId && p.dueDate < todayKey }))
        .filter((d) => d.payment.dueDate.startsWith(month));
      return {
        fixed: f, mode: 'reserve' as const,
        amount: reserve?.amount ?? share,
        done: !!reserve,
        overdue: duePayments.some((d) => d.overdue),
        dueDate: null, paidExpense: null, reserve, share,
        fund: round2(setAside), duePayments, nextPayment,
      };
    })
    .sort((a, b) => Number(a.done) - Number(b.done) || Number(b.overdue) - Number(a.overdue) || order(a) - order(b));

  const total = items.reduce((s, c) => s + c.amount, 0);
  const doneAmount = items.filter((c) => c.done).reduce((s, c) => s + c.amount, 0);
  return {
    items,
    total: round2(total),
    doneAmount: round2(doneAmount),
    pendingAmount: round2(total - doneAmount),
    doneCount: items.filter((c) => c.done).length,
    commitments: round2(items.filter((c) => !isTransferKind(c.fixed.kind)).reduce((s, c) => s + c.amount, 0)),
    transfers: round2(items.filter((c) => isTransferKind(c.fixed.kind)).reduce((s, c) => s + c.amount, 0)),
    dueThisMonth: items.flatMap((c) => c.duePayments).sort((a, b) => (a.payment.dueDate < b.payment.dueDate ? -1 : 1)),
  };
}

/** Sort key: the day in the month it falls due */
function order(c: CommitmentState) {
  if (c.dueDate) return Number(c.dueDate.slice(8));
  if (c.duePayments[0]) return Number(c.duePayments[0].payment.dueDate.slice(8));
  return 40;
}

/** Each member's salary for a month: the latest saved month on or before it */
export function incomesFor(month: string, members: Member[], rows: IncomeRow[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const mem of members) {
    let best: IncomeRow | null = null;
    for (const r of rows) if (r.userId === mem.id && r.month <= month && (!best || r.month > best.month)) best = r;
    out[mem.id] = best?.amount ?? 0;
  }
  return out;
}

/** Spread a payment evenly into a schedule: n payments every `every` months starting on `first` */
export function buildSchedule(first: string, every: number, n: number, amount: number): { dueDate: string; amount: number }[] {
  const [y, m, d] = first.split('-').map(Number);
  return Array.from({ length: n }, (_, i) => {
    const mi = m - 1 + i * every;
    const yy = y + Math.floor(mi / 12);
    const mm = (mi % 12) + 1;
    const dd = Math.min(d, daysInMonth(yy, mm - 1));
    return { dueDate: `${yy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`, amount };
  });
}
