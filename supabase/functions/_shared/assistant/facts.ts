// A compact, pre-summed picture of the family's spending for the assistant to answer from.
// Totals are computed here, so the model reads numbers instead of adding up hundreds of rows.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import type { CatalogCategory } from '../receipt/schema.ts';

const AR_MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const r2 = (n: number) => Math.round(n * 100) / 100;
const monthName = (m: string) => `${AR_MONTHS[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;

type Line = { kind?: string; item_id: string | null; category_id: string; name: string; unit: string; quantity: number; amount: number };
type Exp = {
  user_id: string | null; category_id: string; fixed_id: string | null; amount: number; note: string; spent_on: string;
  expense_items: Line[] | null;
};

/** Adds `v` under `k` in a map of sums */
const add = (m: Map<string, number>, k: string, v: number) => m.set(k, (m.get(k) ?? 0) + v);

export async function buildFacts(supabase: SupabaseClient, categories: CatalogCategory[], today: string): Promise<string> {
  const thisMonth = today.slice(0, 7);
  const start = new Date(`${thisMonth}-01T00:00:00Z`);
  start.setUTCMonth(start.getUTCMonth() - 12);
  const from = start.toISOString().slice(0, 10);

  const [profilesRes, expRes, fixedRes, budRes, catBudRes, itemsRes, payRes, resRes, incRes] = await Promise.all([
    supabase.from('profiles').select('id, display_name, active'),
    supabase
      .from('expenses')
      .select('user_id, category_id, fixed_id, amount, note, spent_on, expense_items(kind, item_id, category_id, name, unit, quantity, amount)')
      .gte('spent_on', from)
      .order('spent_on', { ascending: false })
      .limit(6000),
    supabase.from('fixed_expenses').select('id, name, amount, due_day, active, owner_id, category_id, kind, every_months, variable'),
    supabase.from('member_budgets').select('user_id, month, total'),
    supabase.from('member_category_budgets').select('user_id, month, category_id, amount'),
    supabase.from('items').select('id, name, group_name'),
    supabase.from('commitment_payments').select('fixed_id, due_date, amount, method, reference, expense_id').order('due_date'),
    supabase.from('commitment_reserves').select('fixed_id, month, amount'),
    supabase.from('member_incomes').select('user_id, month, amount'),
  ]);

  const people = new Map((profilesRes.data ?? []).map((p) => [p.id, p.display_name as string]));
  const catName = new Map(categories.map((c) => [c.id, c.name]));
  const itemName = new Map((itemsRes.data ?? []).map((i) => [i.id, i.name as string]));
  const itemGroup = new Map((itemsRes.data ?? []).map((i) => [i.id, (i.group_name || i.name) as string]));
  const fixed = fixedRes.data ?? [];
  const fixedById = new Map(fixed.map((f) => [f.id, f]));
  const expenses = (expRes.data ?? []) as Exp[];
  const who = (id: string | null | undefined) => (id ? people.get(id) ?? 'عضو سابق' : 'غير معروف');
  const owner = (e: Exp) => (e.fixed_id && fixedById.get(e.fixed_id)?.owner_id) || e.user_id;

  // How one expense splits across categories (receipts split by their lines)
  const shares = (e: Exp) => {
    const lines = e.expense_items ?? [];
    if (!lines.length) return [[e.category_id, Number(e.amount)] as const];
    const by = new Map<string, number>();
    let sum = 0;
    for (const l of lines) {
      add(by, l.category_id, Number(l.amount));
      sum += Number(l.amount);
    }
    if (Number(e.amount) - sum > 0.005) add(by, e.category_id, Number(e.amount) - sum);
    return [...by.entries()];
  };

  // Day-to-day spending vs commitments (rent, bills…) vs transfers to family and savings
  const bucket = (e: Exp) => {
    if (!e.fixed_id) return 'daily';
    const k = fixedById.get(e.fixed_id)?.kind;
    return k === 'transfer' || k === 'saving' ? 'transfers' : 'commitments';
  };
  type MonthAgg = { total: number; count: number; byCat: Map<string, number>; byMember: Map<string, number>; byMemberCat: Map<string, number>; byBucket: Map<string, number> };
  const months = new Map<string, MonthAgg>();
  const items = new Map<string, Map<string, { qty: number; amount: number; times: number; unit: string; cat: string; group: string }>>();
  const types = new Map<string, Map<string, { amount: number; times: number; names: Set<string> }>>();
  const charges = new Map<string, Map<string, { amount: number; times: number }>>();
  for (const e of expenses) {
    const m = e.spent_on.slice(0, 7);
    if (!months.has(m)) months.set(m, { total: 0, count: 0, byCat: new Map(), byMember: new Map(), byMemberCat: new Map(), byBucket: new Map() });
    const a = months.get(m)!;
    a.total += Number(e.amount);
    add(a.byBucket, bucket(e), Number(e.amount));
    a.count += 1;
    const o = owner(e) ?? '';
    add(a.byMember, o, Number(e.amount));
    for (const [c, v] of shares(e)) {
      add(a.byCat, c, v);
      add(a.byMemberCat, `${o}|${c}`, v);
    }
    for (const l of e.expense_items ?? []) {
      // VAT, service, delivery, tips, fees and discounts are reported on their own, not as items
      if (l.kind && l.kind !== 'item') {
        if (!charges.has(m)) charges.set(m, new Map());
        const c = charges.get(m)!.get(l.kind) ?? { amount: 0, times: 0 };
        c.amount += Number(l.amount);
        c.times += 1;
        charges.get(m)!.set(l.kind, c);
        continue;
      }
      const name = (l.item_id && itemName.get(l.item_id)) || l.name;
      if (!items.has(m)) items.set(m, new Map());
      const key = `${name}|${l.unit}`;
      const group = (l.item_id && itemGroup.get(l.item_id)) || name;
      const cur = items.get(m)!.get(key) ?? { qty: 0, amount: 0, times: 0, unit: l.unit, cat: catName.get(l.category_id) ?? '', group };
      cur.qty += Number(l.quantity);
      cur.amount += Number(l.amount);
      cur.times += 1;
      items.get(m)!.set(key, cur);
      if (!types.has(m)) types.set(m, new Map());
      const t = types.get(m)!.get(group) ?? { amount: 0, times: 0, names: new Set<string>() };
      t.amount += Number(l.amount);
      t.times += 1;
      t.names.add(name);
      types.get(m)!.set(group, t);
    }
  }

  const out: string[] = [];
  out.push(`MEMBERS: ${[...people.entries()].map(([id, n]) => n + ((profilesRes.data ?? []).find((p) => p.id === id)?.active ? '' : ' (removed)')).join('، ')}`);
  out.push(`CATEGORIES: ${categories.map((c) => c.name).join('، ')}`);

  out.push('\nMONTHLY TOTALS (AED; month | total | day-to-day / commitments / transfers and savings | number of expenses | by category | by member):');
  const monthKeys = [...months.keys()].sort().reverse();
  if (!monthKeys.length) out.push('(no expenses recorded yet)');
  for (const m of monthKeys) {
    const a = months.get(m)!;
    const cats = [...a.byCat.entries()].sort((x, y) => y[1] - x[1]).map(([c, v]) => `${catName.get(c) ?? '?'} ${r2(v)}`).join('، ');
    const mem = [...a.byMember.entries()].map(([u, v]) => `${who(u)} ${r2(v)}`).join('، ');
    const split = ['daily', 'commitments', 'transfers'].map((k) => r2(a.byBucket.get(k) ?? 0)).join(' / ');
    out.push(`${monthName(m)}${m === thisMonth ? ' (current, until ' + today + ')' : ''} | ${r2(a.total)} | ${split} | ${a.count} | ${cats} | ${mem}`);
  }

  out.push('\nSPENDING BY MEMBER AND CATEGORY (month | member | category | AED):');
  for (const m of monthKeys.slice(0, 3)) {
    for (const [k, v] of months.get(m)!.byMemberCat) {
      const [u, c] = k.split('|');
      out.push(`${monthName(m)} | ${who(u)} | ${catName.get(c) ?? '?'} | ${r2(v)}`);
    }
  }

  const CHARGE: Record<string, string> = { tax: 'VAT', service: 'service charge', delivery: 'delivery fees', tip: 'tips', fee: 'other fees', discount: 'order discounts (negative)', adjust: 'corrections to match receipt totals' };
  out.push('\nFEES, TAXES AND DISCOUNTS ON RECEIPTS (month | kind | AED | number of receipts):');
  for (const m of monthKeys) {
    for (const [k, v] of charges.get(m) ?? []) out.push(`${monthName(m)} | ${CHARGE[k] ?? k} | ${r2(v.amount)} | ${v.times}`);
  }

  // Variants (خبز أبيض، خبز أسمر) are separate items that share a type (خبز): questions about "خبز" mean the type
  out.push('\nTYPES BOUGHT, variants added together (month | type | AED paid | times bought | items of this type):');
  for (const m of monthKeys) {
    const list = [...(types.get(m)?.entries() ?? [])].sort((x, y) => y[1].amount - x[1].amount);
    for (const [g, v] of list) out.push(`${monthName(m)} | ${g} | ${r2(v.amount)} | ${v.times} | ${[...v.names].join('، ')}`);
  }

  out.push('\nITEMS BOUGHT (month | item | type | category | quantity and unit | AED paid | times bought | average price per unit):');
  for (const m of monthKeys) {
    const list = [...(items.get(m)?.entries() ?? [])].sort((x, y) => y[1].amount - x[1].amount);
    for (const [k, v] of list) {
      out.push(`${monthName(m)} | ${k.split('|')[0]} | ${v.group} | ${v.cat} | ${r2(v.qty)} ${v.unit} | ${r2(v.amount)} | ${v.times} | ${v.qty ? r2(v.amount / v.qty) : '-'}`);
    }
  }

  // Budgets that apply this month: each member's latest saved month on or before it
  out.push(`\nBUDGETS FOR ${monthName(thisMonth)} (member | budget total | spent so far | by category: budget / spent):`);
  const cur = months.get(thisMonth);
  for (const [id, name] of people) {
    if (!(profilesRes.data ?? []).find((p) => p.id === id)?.active) continue;
    const rows = (budRes.data ?? []).filter((b) => b.user_id === id && b.month <= thisMonth).sort((a, b) => (a.month < b.month ? 1 : -1));
    const src = rows[0];
    const spent = cur?.byMember.get(id) ?? 0;
    if (!src) {
      out.push(`${name} | no budget set | ${r2(spent)} |`);
      continue;
    }
    const cats = (catBudRes.data ?? [])
      .filter((c) => c.user_id === id && c.month === src.month && Number(c.amount) > 0)
      .map((c) => `${catName.get(c.category_id) ?? '?'} ${r2(Number(c.amount))} / ${r2(cur?.byMemberCat.get(`${id}|${c.category_id}`) ?? 0)}`)
      .join('، ');
    out.push(`${name} | ${r2(Number(src.total))} | ${r2(spent)} | ${cats}`);
  }

  // Salaries (latest saved month on or before this one) and commitments
  const salary = (id: string) =>
    (incRes.data ?? []).filter((r) => r.user_id === id && r.month <= thisMonth).sort((a, b) => (a.month < b.month ? 1 : -1))[0];
  const salaries = [...people.entries()]
    .filter(([id]) => (profilesRes.data ?? []).find((p) => p.id === id)?.active)
    .map(([id, name]) => `${name} ${r2(Number(salary(id)?.amount ?? 0))}`);
  out.push(`\nMONTHLY SALARIES (AED): ${salaries.join('، ') || 'not set'}`);
  const KIND: Record<string, string> = { rent: 'rent', school: 'school fees', bill: 'bill', transfer: 'transfer to family', saving: 'savings', installment: 'instalment', other: 'other' };
  out.push(`\nCOMMITMENTS, taken off the salary before day-to-day spending (name | type | AED | how often | responsible | status in ${monthName(thisMonth)}):`);
  for (const f of fixed.filter((x) => x.active)) {
    const every = Number(f.every_months ?? 1);
    let status: string;
    if (every === 1) {
      const paid = expenses.find((e) => e.fixed_id === f.id && e.spent_on.startsWith(thisMonth));
      status = paid ? `paid ${r2(Number(paid.amount))}` : `not paid yet, due day ${f.due_day}${f.variable ? ' (amount varies, estimate)' : ''}`;
    } else {
      const schedule = (payRes.data ?? []).filter((p) => p.fixed_id === f.id);
      const next = schedule.find((p) => !p.expense_id);
      const reserved = (resRes.data ?? []).find((r) => r.fixed_id === f.id && r.month === thisMonth);
      const list = schedule.map((p, i) => `${p.method === 'cheque' ? 'cheque' : 'payment'} ${i + 1} ${p.due_date} ${r2(Number(p.amount))}${p.reference ? ` #${p.reference}` : ''} ${p.expense_id ? 'paid' : 'pending'}`).join('; ');
      status = `set aside ${r2(Number(f.amount) / every)} a month (${reserved ? 'done this month' : 'not yet this month'}); next ${next ? `${next.due_date} ${r2(Number(next.amount))}` : 'none scheduled'}; schedule: ${list || 'none'}`;
    }
    out.push(`${f.name} | ${KIND[f.kind] ?? f.kind} | ${r2(Number(f.amount))} | ${every === 1 ? 'monthly' : `every ${every} months`} | ${who(f.owner_id)} | ${status}`);
  }

  out.push('\nRECENT EXPENSES, LAST 45 DAYS (date | member | category | note | AED | items):');
  const cutoff = new Date(Date.parse(today) - 45 * 86400000).toISOString().slice(0, 10);
  for (const e of expenses.filter((x) => x.spent_on >= cutoff).slice(0, 400)) {
    const lines = (e.expense_items ?? [])
      .slice(0, 12)
      .map((l) => `${(l.item_id && itemName.get(l.item_id)) || l.name} ${r2(Number(l.quantity))} ${l.unit} ${r2(Number(l.amount))}`)
      .join('؛ ');
    const fixedName = e.fixed_id ? fixedById.get(e.fixed_id)?.name : '';
    out.push(`${e.spent_on} | ${who(owner(e))} | ${catName.get(e.category_id) ?? '?'} | ${fixedName || e.note || '-'} | ${r2(Number(e.amount))} | ${lines || '-'}`);
  }
  return out.join('\n');
}
