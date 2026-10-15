import { Category, Expense } from './types';
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

export type Insight = { tone: 'good' | 'warn' | 'bad' | 'info'; text: string };

export type MonthAnalysis = {
  month: string;
  isCurrent: boolean;
  count: number;
  totalSpent: number;
  totalBudget: number;
  dailyAllowance: number; // budget / days in month
  daysInMonth: number;
  elapsedDays: number;
  daysLeft: number;
  dailyAvg: number;
  projectedTotal: number;
  safeDaily: number;
  todaySpent: number;
  daily: number[];
  weekday: number[]; // Sun..Sat totals
  byCategory: CategoryStat[];
  insights: Insight[];
};

const sum = (xs: Expense[]) => xs.reduce((a, e) => a + e.amount, 0);

export function analyzeMonth(month: string, categories: Category[], expenses: Expense[]): MonthAnalysis {
  const [y, m] = month.split('-').map(Number);
  const dim = daysInMonth(y, m - 1);
  const now = new Date();
  const current = monthKey(now);
  const isCurrent = month === current;

  const elapsedDays = month < current ? dim : month > current ? 0 : now.getDate();
  const daysLeft = isCurrent ? dim - now.getDate() + 1 : month > current ? dim : 0;

  const inMonth = expenses.filter((e) => e.date.startsWith(month));
  const prevMonth = shiftMonth(month, -1);
  const inPrev = expenses.filter((e) => e.date.startsWith(prevMonth));
  const totalSpent = sum(inMonth);
  const totalBudget = categories.reduce((a, c) => a + (c.monthlyBudget || 0), 0);

  const daily = Array.from({ length: dim }, () => 0);
  const weekday = Array(7).fill(0);
  inMonth.forEach((e) => {
    const d = Number(e.date.slice(8, 10));
    if (d >= 1 && d <= dim) daily[d - 1] += e.amount;
    weekday[new Date(y, m - 1, d).getDay()] += e.amount;
  });

  const pace = (spent: number) => (elapsedDays > 0 && isCurrent ? (spent / elapsedDays) * dim : spent);

  const byCategory: CategoryStat[] = categories
    .map((c) => {
      const spent = sum(inMonth.filter((e) => e.categoryId === c.id));
      const prevSpent = sum(inPrev.filter((e) => e.categoryId === c.id));
      const budget = c.monthlyBudget || 0;
      const pct = budget > 0 ? spent / budget : 0;
      const projected = pace(spent);
      const status: CategoryStat['status'] =
        budget > 0 && spent > budget ? 'over' : budget > 0 && (pct >= 0.8 || (isCurrent && projected > budget * 1.05)) ? 'warning' : 'ok';
      return { category: c, spent, prevSpent, budget, pct, projected, status };
    })
    .sort((a, b) => b.spent - a.spent);

  const dailyAvg = elapsedDays > 0 ? totalSpent / elapsedDays : 0;
  const projectedTotal = pace(totalSpent);
  const safeDaily = daysLeft > 0 ? Math.max(0, (totalBudget - totalSpent) / daysLeft) : 0;
  const todaySpent = isCurrent ? daily[now.getDate() - 1] : 0;

  const insights: Insight[] = [];
  if (inMonth.length > 0) {
    if (isCurrent && totalBudget > 0) {
      if (projectedTotal > totalBudget) {
        insights.push({ tone: 'bad', text: `إذا استمر الصرف بنفس الوتيرة، رح يوصل مجموع الشهر لـ ${fmt(projectedTotal)}، أي ${fmt(projectedTotal - totalBudget)} فوق البادجت.` });
      } else {
        insights.push({ tone: 'good', text: `ماشي ضمن البادجت. المتوقع لآخر الشهر ${fmt(projectedTotal)} من أصل ${fmt(totalBudget)}.` });
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
                : `${s.category.name} بالوتيرة الحالية رح يوصل ${fmt(s.projected)} من أصل ${fmt(s.budget)}.`,
          }),
        );
    }
    const prevCut = String(Math.min(elapsedDays, 31)).padStart(2, '0');
    const prevSame = sum(inPrev.filter((e) => e.date.slice(8, 10) <= prevCut));
    if (prevSame > 0 && elapsedDays > 0) {
      const diff = (totalSpent - prevSame) / prevSame;
      insights.push({
        tone: diff > 0.1 ? 'warn' : diff < -0.1 ? 'good' : 'info',
        text:
          diff >= 0
            ? `صرفك أعلى بـ ${Math.round(diff * 100)}% من نفس الفترة في ${monthName(prevMonth)}.`
            : `صرفك أقل بـ ${Math.round(-diff * 100)}% من نفس الفترة في ${monthName(prevMonth)}.`,
      });
    }
    const top = byCategory[0];
    if (top && totalSpent > 0)
      insights.push({ tone: 'info', text: `${top.category.name} أكبر بند هذا الشهر، ${Math.round((top.spent / totalSpent) * 100)}% من مجموع الصرف.` });
    if (inMonth.length >= 8) {
      const maxIdx = weekday.indexOf(Math.max(...weekday));
      insights.push({ tone: 'info', text: `يوم ${AR_DAYS[maxIdx]} هو أكثر يوم بتصرف فيه.` });
    }
  }

  return {
    month, isCurrent, count: inMonth.length, totalSpent, totalBudget,
    dailyAllowance: totalBudget / dim, daysInMonth: dim, elapsedDays, daysLeft,
    dailyAvg, projectedTotal, safeDaily, todaySpent, daily, weekday, byCategory, insights,
  };
}

/** Totals for the n months ending at `month` (oldest first) */
export function monthHistory(month: string, n: number, expenses: Expense[]) {
  return Array.from({ length: n }, (_, i) => {
    const m = shiftMonth(month, i - n + 1);
    return { month: m, total: sum(expenses.filter((e) => e.date.startsWith(m))) };
  });
}
