import { expenseOwner, spentInCategory } from './budgets';
import { Category, Expense, FixedExpense, Member, MemberBudget } from './types';
import { AR_DAYS, daysInMonth, fmt, monthKey, monthName, shiftMonth } from './utils';

export type CategoryStat = {
  category: Category;
  spent: number;
  prevSpent: number;
  budget: number;
  pct: number;
  projected: number;
  status: 'ok' | 'warning' | 'over';
};

export type MemberStat = { member: Member | null; userId: string | null; spent: number; count: number; budget: number };

export type Insight = { tone: 'good' | 'warn' | 'bad' | 'info'; text: string };

export type MonthAnalysis = {
  month: string;
  isCurrent: boolean;
  count: number;
  totalSpent: number;
  totalBudget: number;
  allocated: number; // sum of category budgets
  unallocated: number; // total budget not assigned to any category
  hasBudget: boolean;
  scope: string | null; // member id, or null for the whole family
  dailyAllowance: number;
  daysInMonth: number;
  elapsedDays: number;
  daysLeft: number;
  dailyAvg: number;
  projectedTotal: number;
  safeDaily: number; // what can be spent per remaining day
  todaySpent: number;
  daily: number[];
  weekday: number[];
  byCategory: CategoryStat[];
  byMember: MemberStat[];
  insights: Insight[];
};

const sum = (xs: Expense[]) => xs.reduce((a, e) => a + e.amount, 0);

export function analyzeMonth(
  month: string,
  categories: Category[],
  allExpenses: Expense[],
  allFixed: FixedExpense[] = [],
  members: Member[] = [],
  budgets: Record<string, MemberBudget> = {},
  scope: string | null = null,
): MonthAnalysis {
  const [y, m] = month.split('-').map(Number);
  const dim = daysInMonth(y, m - 1);
  const now = new Date();
  const current = monthKey(now);
  const isCurrent = month === current;
  const isFuture = month > current;

  const elapsedDays = month < current ? dim : isFuture ? 0 : now.getDate();
  const daysLeft = isCurrent ? dim - now.getDate() + 1 : isFuture ? dim : 0;

  // Day-to-day spending only: commitments (rent, bills, transfers…) come off the salary first and are tracked apart.
  // Scope: one member's own spending, or the whole family.
  const daily = allExpenses.filter((e) => !e.fixedId);
  const expenses = scope ? daily.filter((e) => expenseOwner(e, allFixed) === scope) : daily;
  const scopedBudgets = scope ? (budgets[scope] ? [budgets[scope]] : []) : members.map((x) => budgets[x.id]).filter(Boolean);
  const catBudget = (id: string) => scopedBudgets.reduce((a, b) => a + (b.cats[id] ?? 0), 0);

  const inMonth = expenses.filter((e) => e.date.startsWith(month));
  const prevMonth = shiftMonth(month, -1);
  const inPrev = expenses.filter((e) => e.date.startsWith(prevMonth));
  const totalSpent = sum(inMonth);
  const totalBudget = scopedBudgets.reduce((a, b) => a + b.total, 0);
  const allocated = categories.reduce((a, c) => a + catBudget(c.id), 0);
  const budgetAware = totalBudget > 0;

  const byDay = Array.from({ length: dim }, () => 0);
  const weekday = Array(7).fill(0);
  inMonth.forEach((e) => {
    const d = Number(e.date.slice(8, 10));
    if (d >= 1 && d <= dim) byDay[d - 1] += e.amount;
    weekday[new Date(y, m - 1, d).getDay()] += e.amount;
  });

  const pace = (spent: number) => (elapsedDays > 0 && isCurrent ? (spent / elapsedDays) * dim : spent);

  const byCategory: CategoryStat[] = categories
    .map((c) => {
      const spent = spentInCategory(inMonth, c.id);
      const prevSpent = spentInCategory(inPrev, c.id);
      const budget = catBudget(c.id);
      const pct = budget > 0 ? spent / budget : 0;
      const projected = pace(spent);
      const status: CategoryStat['status'] =
        budget > 0 && spent > budget ? 'over' : budget > 0 && (pct >= 0.8 || (isCurrent && projected > budget * 1.05)) ? 'warning' : 'ok';
      return { category: c, spent, prevSpent, budget, pct, projected, status };
    })
    .sort((a, b) => b.spent - a.spent);

  const ownerOf = (e: Expense) => expenseOwner(e, allFixed);
  const memberIds = Array.from(new Set([...members.map((x) => x.id), ...inMonth.map(ownerOf)]));
  const byMember: MemberStat[] = memberIds
    .map((id) => {
      const mine = inMonth.filter((e) => ownerOf(e) === id);
      return { member: members.find((x) => x.id === id) ?? null, userId: id, spent: sum(mine), count: mine.length, budget: id ? budgets[id]?.total ?? 0 : 0 };
    })
    .filter((s) => s.member || s.count > 0)
    .sort((a, b) => b.spent - a.spent);

  const dailyAvg = elapsedDays > 0 ? totalSpent / elapsedDays : 0;
  const projectedTotal = pace(totalSpent);
  const safeDaily = daysLeft > 0 ? Math.max(0, (totalBudget - totalSpent) / daysLeft) : 0;
  const todaySpent = isCurrent ? byDay[now.getDate() - 1] : 0;

  // ───── insights ─────
  const insights: Insight[] = [];
  if (inMonth.length > 0) {
    if (isCurrent && budgetAware && totalBudget > 0) {
      if (projectedTotal > totalBudget) {
        insights.push({ tone: 'bad', text: `بوتيرة الصرف الحالية، رح يوصل المصروف اليومي لآخر الشهر لـ ${fmt(projectedTotal)}، أي ${fmt(projectedTotal - totalBudget)} فوق البادجت.` });
      } else {
        insights.push({ tone: 'good', text: `ماشيين ضمن البادجت. المتوقع لآخر الشهر ${fmt(projectedTotal)} من أصل ${fmt(totalBudget)}.` });
      }
    }
    byCategory
      .filter((s) => s.status === 'over')
      .forEach((s) => insights.push({ tone: 'bad', text: `${s.category.name} تجاوز البادجت بـ ${fmt(s.spent - s.budget)}.` }));
    if (isCurrent) {
      byCategory
        .filter((s) => s.status === 'warning')
        .forEach((s) =>
          insights.push({
            tone: 'warn',
            text:
              s.pct >= 1
                ? `${s.category.name} استهلك كامل البادجت، أي مصروف جديد فيه رح يكون تجاوز.`
                : s.pct >= 0.8
                  ? `${s.category.name} استهلك ${Math.round(s.pct * 100)}% من البادجت، والباقي ${fmt(s.budget - s.spent)}.`
                  : `${s.category.name} متوقع يوصل ${fmt(s.projected)} من أصل ${fmt(s.budget)}.`,
          }),
        );
    }
    const prevCut = String(Math.min(elapsedDays, 31)).padStart(2, '0');
    const prevSame = sum(inPrev.filter((e) => e.date.slice(8, 10) <= prevCut));
    if (prevSame > 0 && elapsedDays > 0 && totalSpent > 0) {
      const diff = (totalSpent - prevSame) / prevSame;
      insights.push({
        tone: diff > 0.1 ? 'warn' : diff < -0.1 ? 'good' : 'info',
        text: Math.abs(diff) < 0.05
          ? `الصرف بنفس مستوى نفس الفترة في ${monthName(prevMonth)}.`
          : diff > 0
            ? `الصرف أعلى بـ ${Math.round(diff * 100)}% من نفس الفترة في ${monthName(prevMonth)}.`
            : `الصرف أقل بـ ${Math.round(-diff * 100)}% من نفس الفترة في ${monthName(prevMonth)}.`,
      });
    }
    const top = byCategory[0];
    if (top && totalSpent > 0)
      insights.push({ tone: 'info', text: `${top.category.name} أكبر بند هذا الشهر، ${Math.round((top.spent / totalSpent) * 100)}% من مجموع الصرف.` });
    if (!scope) {
      byMember
        .filter((s) => s.member && s.budget > 0 && s.spent > s.budget)
        .forEach((s) => insights.push({ tone: 'bad', text: `${s.member!.displayName} تجاوز بادجته الشخصي بـ ${fmt(s.spent - s.budget)}.` }));
    }
    if (!scope && byMember.filter((s) => s.spent > 0).length > 1 && totalSpent > 0) {
      const t = byMember[0];
      insights.push({ tone: 'info', text: `${t.member?.displayName ?? 'عضو سابق'} صرف ${Math.round((t.spent / totalSpent) * 100)}% من مصاريف الشهر.` });
    }
    if (inMonth.length >= 8) {
      const maxIdx = weekday.indexOf(Math.max(...weekday));
      insights.push({ tone: 'info', text: `يوم ${AR_DAYS[maxIdx]} هو أكثر يوم بتصرفوا فيه.` });
    }
  }

  if (!budgetAware && isCurrent) {
    insights.unshift({ tone: 'warn', text: scope ? 'ما في بادجت محدد لهذا الشهر. حدّده من الإعدادات ← البادجت الشهري.' : 'ما في بادجت محدد للعائلة لهذا الشهر. حدّدوه من الإعدادات ← البادجت الشهري.' });
  }
  if (budgetAware && allocated > totalBudget) {
    insights.push({ tone: 'warn', text: `مجموع حصص التصنيفات (${fmt(allocated)}) أكبر من البادجت الكلي (${fmt(totalBudget)}).` });
  }

  return {
    month, isCurrent, count: inMonth.length, totalSpent, totalBudget,
    allocated, unallocated: Math.max(totalBudget - allocated, 0), hasBudget: budgetAware, scope,
    dailyAllowance: totalBudget / dim, daysInMonth: dim, elapsedDays, daysLeft,
    dailyAvg, projectedTotal, safeDaily, todaySpent, daily: byDay, weekday,
    byCategory, byMember, insights,
  };
}

/** Day-to-day spending of the last `n` months (commitments excluded) */
export function monthHistory(month: string, n: number, expenses: Expense[]) {
  const daily = expenses.filter((e) => !e.fixedId);
  return Array.from({ length: n }, (_, i) => {
    const m = shiftMonth(month, i - n + 1);
    return { month: m, total: sum(daily.filter((e) => e.date.startsWith(m))) };
  });
}
