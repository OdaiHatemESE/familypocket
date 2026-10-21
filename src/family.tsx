import type { Session } from '@supabase/supabase-js';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { loginEmail } from './lib/config';
import { friendlyError, supabase } from './lib/supabase';
import { resolveAll } from './budgets';
import { normalizeAlias } from '../supabase/functions/_shared/receipt/alias';
import { incomesFor } from './commitments';
import { BudgetRow, Category, CategoryBudgetRow, CommitmentPayment, Expense, ExpenseLine, FixedExpense, Household, IncomeRow, Item, Member, MemberBudget, ReserveRow } from './types';
import { monthKey, shiftMonth } from './utils';

type Status = 'loading' | 'signedOut' | 'ready';

type CategoryInput = Omit<Category, 'id' | 'sort'> & { id?: string };
type FixedInput = Omit<FixedExpense, 'id'> & { id?: string };
type ExpenseInput = { amount: number; note: string; categoryId: string; date: string; fixedId?: string | null; lines?: ExpenseLine[]; /** Defaults to the signed-in member */ userId?: string | null };
type ItemInput = { id?: string; categoryId: string; name: string; unit: string; group?: string };

export type ScanLine = {
  kind?: import('./lineKinds').LineKind;
  raw: string;
  itemId: string | null;
  name: string;
  /** General type (خبز for خبز أسمر) */
  group?: string;
  unit: string;
  categoryId: string | null;
  quantity: number;
  amount: number;
  isNew: boolean;
  uncertain: boolean;
  learned: boolean;
  /** Said in words without a price: amount is 0 until filled in */
  needsPrice?: boolean;
};
export type ScanDraft = {
  store: string | null;
  date: string | null;
  total: number | null;
  linesTotal: number;
  lines: ScanLine[];
  warnings: string[];
  provider: string;
  model: string;
};

export type ChatTurn = { role: 'user' | 'assistant'; text: string };
export type AssistantReply =
  | { kind: 'answer'; answer: string }
  | { kind: 'receipt'; answer: string; draft: Omit<ScanDraft, 'provider' | 'model'> };

/** An error from one of our server functions: a ready Arabic sentence plus a code such as PROVIDER_BUSY */
export class FnError extends Error {
  constructor(message: string, public code: string) {
    super(message);
  }
}

/** Calls one of our server functions; their errors carry a ready Arabic sentence in `message` */
async function invokeFn<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    let payload: { error?: string; message?: string } | null = null;
    try {
      const ctx = (error as { context?: Response }).context;
      payload = ctx ? await ctx.json() : null;
    } catch {
      /* response was not JSON */
    }
    throw new FnError(payload?.message || friendlyError(error), payload?.error ?? 'UNKNOWN');
  }
  return data as T;
}

type Ctx = {
  status: Status;
  me: Member | null;
  household: Household | null;
  members: Member[];
  categories: Category[];
  expenses: Expense[];
  fixed: FixedExpense[];
  items: Item[];
  /** Creates the item (or returns the existing one with the same name in that category) */
  saveItem: (i: ItemInput) => Promise<Item>;
  deleteItem: (id: string) => Promise<void>;
  /** Sends a receipt (one photo, several photos of one long receipt, or a PDF) and returns a draft to review */
  scanReceipt: (files: { base64: string; mimeType: string }[]) => Promise<ScanDraft>;
  /** Sends a chat message: answers a question, or turns a purchase described in words into a receipt draft */
  askAssistant: (message: string, history: ChatTurn[]) => Promise<AssistantReply>;
  /** Remembers what a shop prints for each item, so the next receipt matches by itself */
  learnAliases: (pairs: { raw: string; itemId: string }[]) => Promise<void>;
  budgetRows: BudgetRow[];
  categoryBudgetRows: CategoryBudgetRow[];
  /** Each active member's budget as it applies to `month` */
  budgetsFor: (month: string) => Record<string, MemberBudget>;
  saveBudget: (userId: string, month: string, total: number, cats: Record<string, number>) => Promise<void>;
  memberOf: (id: string | null) => Member | undefined;
  refresh: () => Promise<void>;
  // auth
  signIn: (username: string, password: string) => Promise<void>;
  register: (p: { username: string; password: string; displayName: string; familyName: string }) => Promise<void>;
  signOut: () => Promise<void>;
  changePassword: (password: string) => Promise<void>;
  updateMe: (p: { displayName: string; color: string }) => Promise<void>;
  renameHousehold: (name: string) => Promise<void>;
  // family
  addMember: (p: { username: string; password: string; displayName: string; color: string }) => Promise<void>;
  setMemberPassword: (userId: string, password: string) => Promise<void>;
  removeMember: (userId: string) => Promise<void>;
  // data
  addExpense: (e: ExpenseInput) => Promise<void>;
  updateExpense: (id: string, e: ExpenseInput) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  saveCategory: (c: CategoryInput) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  /** Saves a commitment and returns its id */
  saveFixed: (f: FixedInput) => Promise<string>;
  deleteFixed: (id: string) => Promise<void>;
  /** Records this month's payment of a monthly commitment; `amount` overrides the estimate for variable bills */
  markFixedPaid: (f: FixedExpense, date: string, amount?: number) => Promise<void>;
  /** Scheduled payments (cheques, instalments) and monthly set-asides for commitments paid every few months */
  payments: CommitmentPayment[];
  reserves: ReserveRow[];
  /** Replaces a commitment's unpaid schedule; paid payments are kept */
  saveSchedule: (fixedId: string, rows: { dueDate: string; amount: number; method: CommitmentPayment['method']; reference: string }[]) => Promise<void>;
  /** Records a scheduled payment as paid (cheque cashed) on `date` */
  payScheduled: (p: CommitmentPayment, date: string) => Promise<void>;
  /** Sets or clears (null) the money set aside this month towards a commitment */
  setReserve: (fixedId: string, month: string, amount: number | null) => Promise<void>;
  /** Salaries: each member's for a month, and saving one from a month onwards */
  incomeRows: IncomeRow[];
  incomesFor: (month: string) => Record<string, number>;
  saveIncome: (userId: string, month: string, amount: number) => Promise<void>;
  /** Owner only. 'month': that month's expenses and set-asides. 'all': everything except members; categories back to the defaults */
  resetData: (scope: 'month' | 'all', month?: string) => Promise<void>;
};

const FamilyContext = createContext<Ctx | null>(null);

// ───── row mappers ─────
const toMember = (r: any): Member => ({ id: r.id, username: r.username, displayName: r.display_name, color: r.color, role: r.role, active: r.active !== false });
const toCategory = (r: any): Category => ({
  id: r.id, name: r.name, icon: r.icon, color: r.color, monthlyBudget: Number(r.monthly_budget) || 0, sort: r.sort ?? 0,
});
const toLine = (r: any): ExpenseLine => ({
  id: r.id, kind: r.kind ?? 'item', itemId: r.item_id, categoryId: r.category_id, name: r.name, unit: r.unit, quantity: Number(r.quantity) || 0, amount: Number(r.amount) || 0,
});
const CHARGE_ORDER = ['tax', 'service', 'delivery', 'tip', 'fee', 'discount', 'adjust'];
const lineOrder = (l: ExpenseLine) => (!l.kind || l.kind === 'item' ? 0 : 1 + CHARGE_ORDER.indexOf(l.kind));
const toExpense = (r: any): Expense => ({
  id: r.id, userId: r.user_id, createdBy: r.created_by ?? r.user_id, categoryId: r.category_id, fixedId: r.fixed_id, amount: Number(r.amount) || 0,
  note: r.note ?? '', date: r.spent_on, createdAt: Date.parse(r.created_at) || 0,
  // Products first, largest first; then charges (VAT, delivery…) in a fixed order
  lines: (r.expense_items ?? []).map(toLine).sort((a: ExpenseLine, b: ExpenseLine) => lineOrder(a) - lineOrder(b) || b.amount - a.amount),
});
const toItem = (r: any): Item => ({ id: r.id, categoryId: r.category_id, name: r.name, group: r.group_name || r.name, unit: r.unit, archived: !!r.archived });
const toFixed = (r: any): FixedExpense => ({
  id: r.id, name: r.name, categoryId: r.category_id, amount: Number(r.amount) || 0, dueDay: r.due_day, active: r.active, ownerId: r.owner_id ?? null,
  kind: r.kind ?? 'bill', everyMonths: r.every_months ?? 1, variable: !!r.variable,
});
const toPayment = (r: any): CommitmentPayment => ({
  id: r.id, fixedId: r.fixed_id, dueDate: r.due_date, amount: Number(r.amount) || 0, method: r.method, reference: r.reference ?? '', expenseId: r.expense_id ?? null,
});
const toReserve = (r: any): ReserveRow => ({ fixedId: r.fixed_id, month: r.month, amount: Number(r.amount) || 0 });
const toIncome = (r: any): IncomeRow => ({ userId: r.user_id, month: r.month, amount: Number(r.amount) || 0 });
const toBudget = (r: any): BudgetRow => ({ userId: r.user_id, month: r.month, total: Number(r.total) || 0 });
const toCatBudget = (r: any): CategoryBudgetRow => ({ userId: r.user_id, month: r.month, categoryId: r.category_id, amount: Number(r.amount) || 0 });

/** Throws a user-facing Error when Supabase returns an error */
function check<T extends { error: unknown }>(res: T): T {
  if (res.error) throw new Error(friendlyError(res.error));
  return res;
}

const HISTORY_MONTHS = 13;

export function FamilyProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [me, setMe] = useState<Member | null>(null);
  const [household, setHousehold] = useState<Household | null>(null);
  const [profiles, setProfiles] = useState<Member[]>([]); // includes former members, for names on old expenses
  const members = useMemo(() => profiles.filter((m) => m.active), [profiles]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [fixed, setFixed] = useState<FixedExpense[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [budgetRows, setBudgetRows] = useState<BudgetRow[]>([]);
  const [categoryBudgetRows, setCategoryBudgetRows] = useState<CategoryBudgetRow[]>([]);
  const [payments, setPayments] = useState<CommitmentPayment[]>([]);
  const [reserves, setReserves] = useState<ReserveRow[]>([]);
  const [incomeRows, setIncomeRows] = useState<IncomeRow[]>([]);
  const householdId = useRef<string | null>(null);
  const itemsRef = useRef<Item[]>([]);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const loaders = useMemo(
    () => ({
      members: async () => {
        const { data } = check(await supabase.from('profiles').select('*').order('created_at'));
        setProfiles((data ?? []).map(toMember));
      },
      categories: async () => {
        const { data } = check(await supabase.from('categories').select('*').order('sort').order('created_at'));
        setCategories((data ?? []).map(toCategory));
      },
      fixed: async () => {
        const { data } = check(await supabase.from('fixed_expenses').select('*').order('due_day'));
        setFixed((data ?? []).map(toFixed));
      },
      expenses: async () => {
        const from = shiftMonth(monthKey(new Date()), -(HISTORY_MONTHS - 1)) + '-01';
        const { data } = check(
          await supabase.from('expenses').select('*, expense_items(*)').gte('spent_on', from).order('spent_on', { ascending: false }).order('created_at', { ascending: false }).limit(5000),
        );
        setExpenses((data ?? []).map(toExpense));
      },
      items: async () => {
        const { data } = check(await supabase.from('items').select('*').order('name'));
        setItems((data ?? []).map(toItem));
      },
      budgets: async () => {
        const [a, b] = await Promise.all([
          supabase.from('member_budgets').select('*'),
          supabase.from('member_category_budgets').select('*'),
        ]);
        check(a); check(b);
        setBudgetRows((a.data ?? []).map(toBudget));
        setCategoryBudgetRows((b.data ?? []).map(toCatBudget));
      },
      commitments: async () => {
        const [a, b] = await Promise.all([
          supabase.from('commitment_payments').select('*').order('due_date'),
          supabase.from('commitment_reserves').select('*'),
        ]);
        check(a); check(b);
        setPayments((a.data ?? []).map(toPayment));
        setReserves((b.data ?? []).map(toReserve));
      },
      incomes: async () => {
        const { data } = check(await supabase.from('member_incomes').select('*'));
        setIncomeRows((data ?? []).map(toIncome));
      },
      household: async () => {
        const { data } = check(await supabase.from('households').select('*').limit(1).maybeSingle());
        if (data) setHousehold({ id: data.id, name: data.name, currency: data.currency });
      },
    }),
    [],
  );

  const clear = useCallback(() => {
    householdId.current = null;
    setUserId(null); setMe(null); setHousehold(null); setProfiles([]); setCategories([]); setExpenses([]); setFixed([]); setItems([]); setBudgetRows([]); setCategoryBudgetRows([]);
    setPayments([]); setReserves([]); setIncomeRows([]);
    setStatus('signedOut');
  }, []);

  const loadAll = useCallback(async (uid: string) => {
    const { data: profile, error } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle();
    if (error || !profile) {
      await supabase.auth.signOut();
      clear();
      return;
    }
    setUserId(uid);
    setMe(toMember(profile));
    householdId.current = profile.household_id;
    try {
      await Promise.all([loaders.household(), loaders.members(), loaders.categories(), loaders.fixed(), loaders.expenses(), loaders.budgets(), loaders.items(), loaders.commitments(), loaders.incomes()]);
    } finally {
      setStatus('ready');
    }
  }, [loaders, clear]);

  // ── auth state ──
  useEffect(() => {
    const apply = (session: Session | null) => {
      if (!session) clear();
      else loadAll(session.user.id).catch(() => setStatus('ready'));
    };
    supabase.auth.getSession().then(({ data }) => apply(data.session ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') return;
      // Supabase advises not to call its API directly inside this callback
      setTimeout(() => apply(session), 0);
    });
    return () => sub.subscription.unsubscribe();
  }, [loadAll, clear]);

  // ── realtime: reload a table whenever anyone in the family changes it ──
  useEffect(() => {
    const hid = householdId.current;
    if (status !== 'ready' || !hid) return;
    const timers: Record<string, ReturnType<typeof setTimeout>> = {};
    const reload = (key: keyof typeof loaders) => {
      clearTimeout(timers[key]);
      timers[key] = setTimeout(() => loaders[key]().catch(() => {}), 250);
    };
    const channel = supabase.channel(`family-${hid}`);
    const watch = (table: string, key: keyof typeof loaders) =>
      channel.on('postgres_changes' as any, { event: '*', schema: 'public', table, filter: `household_id=eq.${hid}` }, () => reload(key));
    watch('expenses', 'expenses');
    watch('categories', 'categories');
    watch('fixed_expenses', 'fixed');
    watch('profiles', 'members');
    watch('member_budgets', 'budgets');
    watch('items', 'items');
    watch('expense_items', 'expenses');
    watch('member_category_budgets', 'budgets');
    watch('commitment_payments', 'commitments');
    watch('commitment_reserves', 'commitments');
    watch('member_incomes', 'incomes');
    channel.subscribe();
    return () => {
      Object.values(timers).forEach(clearTimeout);
      supabase.removeChannel(channel);
    };
  }, [status, loaders]);

  const value = useMemo<Ctx>(() => {
    const memberOf = (id: string | null) => profiles.find((m) => m.id === id);

    const lineRow = (expenseId: string, l: ExpenseLine) => ({
      expense_id: expenseId, kind: l.kind ?? 'item', item_id: l.itemId, category_id: l.categoryId, name: l.name, unit: l.unit, quantity: l.quantity, amount: l.amount,
    });
    const expenseRow = (e: ExpenseInput) => ({
      amount: e.amount, note: e.note, category_id: e.categoryId, spent_on: e.date, fixed_id: e.fixedId ?? null,
      ...(e.userId ? { user_id: e.userId } : {}),
    });

    return {
      status, me, household, members, categories, expenses, fixed, memberOf, items,
      saveItem: async (i) => {
        const name = i.name.trim().replace(/\s+/g, ' ');
        const group = (i.group ?? '').trim().replace(/\s+/g, ' ') || name;
        // Read the latest list (not this render's), so two lines with the same new name make one item
        const existing = itemsRef.current.find((x) => x.categoryId === i.categoryId && x.name === name && x.id !== i.id);
        if (existing && !i.id) {
          if (existing.archived) await supabase.from('items').update({ archived: false }).eq('id', existing.id);
          return existing;
        }
        if (existing) throw new Error('في صنف بنفس الاسم بهذا التصنيف');
        const row = { category_id: i.categoryId, name, unit: i.unit, group_name: group };
        let res = i.id
          ? await supabase.from('items').update(row).eq('id', i.id).select().single()
          : await supabase.from('items').insert(row).select().single();
        if (res.error?.code === '23505' && !i.id) {
          // Saved a moment ago (another line, or another family member): use that one
          res = await supabase.from('items').select('*').eq('category_id', i.categoryId).eq('name', name).single();
        }
        const { data } = check(res);
        const saved = toItem(data);
        itemsRef.current = [...itemsRef.current.filter((x) => x.id !== saved.id), saved];
        setItems((xs) => [...xs.filter((x) => x.id !== saved.id), saved].sort((a, b) => a.name.localeCompare(b.name, 'ar')));
        return saved;
      },
      scanReceipt: (files) => invokeFn<ScanDraft>('scan-receipt', { files: files.map((f) => ({ data: f.base64, mimeType: f.mimeType })) }),
      askAssistant: (message, history) => invokeFn<AssistantReply>('assistant', { message, history: history.slice(-6) }),
      learnAliases: async (pairs) => {
        const rows = new Map<string, string>();
        for (const p of pairs) {
          const alias = normalizeAlias(p.raw);
          if (alias.length >= 2) rows.set(alias, p.itemId);
        }
        if (!rows.size) return;
        // Best effort: a failure here must never block saving the receipt
        await supabase
          .from('item_aliases')
          .upsert([...rows.entries()].map(([alias, item_id]) => ({ alias, item_id, updated_at: new Date().toISOString() })), { onConflict: 'household_id,alias' });
      },
      deleteItem: async (id) => {
        check(await supabase.from('items').delete().eq('id', id));
        setItems((xs) => xs.filter((x) => x.id !== id));
      },
      budgetRows, categoryBudgetRows,
      budgetsFor: (month) => resolveAll(members, month, budgetRows, categoryBudgetRows),
      saveBudget: async (userId, month, total, cats) => {
        check(await supabase.from('member_budgets').upsert({ user_id: userId, month, total, updated_at: new Date().toISOString() }));
        // Save every category (zeros included) so this month is a complete snapshot that later months inherit
        const rows = categories.map((c) => ({ user_id: userId, month, category_id: c.id, amount: cats[c.id] ?? 0 }));
        if (rows.length) check(await supabase.from('member_category_budgets').upsert(rows));
        await loaders.budgets();
      },
      refresh: async () => {
        if (userId) await loadAll(userId);
      },
      resetData: async (scope, month) => {
        const { error } = await supabase.rpc('reset_family_data', { p_scope: scope, p_month: month ?? null });
        if (error) throw new Error((error as { code?: string }).code === 'PGRST202' ? 'هالخيار لسه مش مفعّل على السيرفر' : friendlyError(error));
        if (userId) await loadAll(userId);
      },

      signIn: async (username, password) => {
        const { error } = await supabase.auth.signInWithPassword({ email: loginEmail(username), password });
        if (error) throw new Error(friendlyError(error));
      },
      register: async ({ username, password, displayName, familyName }) => {
        check(await supabase.rpc('register_family', {
          p_username: username.trim().toLowerCase(), p_password: password, p_display_name: displayName, p_family_name: familyName,
        }));
        const { error } = await supabase.auth.signInWithPassword({ email: loginEmail(username), password });
        if (error) throw new Error(friendlyError(error));
      },
      signOut: async () => {
        await supabase.auth.signOut();
      },
      changePassword: async (password) => {
        if (password.length < 6) throw new Error('كلمة المرور لازم تكون 6 خانات أو أكثر');
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw new Error(friendlyError(error));
      },
      updateMe: async ({ displayName, color }) => {
        if (!me) return;
        check(await supabase.from('profiles').update({ display_name: displayName.trim(), color }).eq('id', me.id));
        setMe({ ...me, displayName: displayName.trim(), color });
        await loaders.members();
      },
      renameHousehold: async (name) => {
        if (!household) return;
        check(await supabase.from('households').update({ name: name.trim() }).eq('id', household.id));
        setHousehold({ ...household, name: name.trim() });
      },

      addMember: async ({ username, password, displayName, color }) => {
        check(await supabase.rpc('add_family_member', {
          p_username: username.trim().toLowerCase(), p_password: password, p_display_name: displayName, p_color: color,
        }));
        await loaders.members();
      },
      setMemberPassword: async (userId, password) => {
        check(await supabase.rpc('set_member_password', { p_user: userId, p_password: password }));
      },
      removeMember: async (userId) => {
        check(await supabase.rpc('remove_family_member', { p_user: userId }));
        await Promise.all([loaders.members(), loaders.expenses()]);
      },

      addExpense: async (e) => {
        const { data } = check(await supabase.from('expenses').insert(expenseRow(e)).select().single());
        if (e.lines?.length) {
          const res = await supabase.from('expense_items').insert(e.lines.map((l) => lineRow(data.id, l)));
          if (res.error) {
            // Don't leave a receipt without its lines
            await supabase.from('expenses').delete().eq('id', data.id);
            throw new Error(friendlyError(res.error));
          }
        }
        const { data: full } = check(await supabase.from('expenses').select('*, expense_items(*)').eq('id', data.id).single());
        setExpenses((xs) => [toExpense(full), ...xs.filter((x) => x.id !== full.id)]);
      },
      updateExpense: async (id, e) => {
        check(await supabase.from('expenses').update(expenseRow(e)).eq('id', id));
        // Replace the receipt lines with the edited set
        check(await supabase.from('expense_items').delete().eq('expense_id', id));
        if (e.lines?.length) check(await supabase.from('expense_items').insert(e.lines.map((l) => lineRow(id, l))));
        const { data: full } = check(await supabase.from('expenses').select('*, expense_items(*)').eq('id', id).single());
        setExpenses((xs) => xs.map((x) => (x.id === id ? toExpense(full) : x)));
      },
      deleteExpense: async (id) => {
        check(await supabase.from('expenses').delete().eq('id', id));
        setExpenses((xs) => xs.filter((x) => x.id !== id));
      },

      saveCategory: async (c) => {
        const row = { name: c.name, icon: c.icon, color: c.color, monthly_budget: c.monthlyBudget };
        if (c.id) check(await supabase.from('categories').update(row).eq('id', c.id));
        else check(await supabase.from('categories').insert({ ...row, sort: categories.length + 1 }));
        await loaders.categories();
      },
      deleteCategory: async (id) => {
        check(await supabase.from('categories').delete().eq('id', id));
        await Promise.all([loaders.categories(), loaders.expenses(), loaders.fixed(), loaders.items()]);
      },

      saveFixed: async (f) => {
        const row = {
          name: f.name, category_id: f.categoryId, amount: f.amount, due_day: f.dueDay, active: f.active, owner_id: f.ownerId,
          kind: f.kind, every_months: f.everyMonths, variable: f.variable,
        };
        const { data } = f.id
          ? check(await supabase.from('fixed_expenses').update(row).eq('id', f.id).select('id').single())
          : check(await supabase.from('fixed_expenses').insert(row).select('id').single());
        await loaders.fixed();
        return data!.id as string;
      },
      deleteFixed: async (id) => {
        check(await supabase.from('fixed_expenses').delete().eq('id', id));
        await Promise.all([loaders.fixed(), loaders.commitments()]);
      },
      markFixedPaid: async (f, date, amount) => {
        const { data } = check(
          await supabase.from('expenses').insert({ amount: amount ?? f.amount, note: f.name, category_id: f.categoryId, spent_on: date, fixed_id: f.id }).select().single(),
        );
        setExpenses((xs) => [toExpense({ ...data, expense_items: [] }), ...xs]);
      },
      payments, reserves,
      saveSchedule: async (fixedId, rows) => {
        check(await supabase.from('commitment_payments').delete().eq('fixed_id', fixedId).is('expense_id', null));
        if (rows.length) {
          check(await supabase.from('commitment_payments').insert(
            rows.map((r) => ({ fixed_id: fixedId, due_date: r.dueDate, amount: r.amount, method: r.method, reference: r.reference })),
          ));
        }
        await loaders.commitments();
      },
      payScheduled: async (p, date) => {
        const f = fixed.find((x) => x.id === p.fixedId);
        if (!f) throw new Error('الالتزام مش موجود');
        const note = p.method === 'cheque' && p.reference ? `${f.name}، شيك ${p.reference}` : f.name;
        const { data } = check(
          await supabase.from('expenses').insert({ amount: p.amount, note, category_id: f.categoryId, spent_on: date, fixed_id: f.id }).select().single(),
        );
        const linked = await supabase.from('commitment_payments').update({ expense_id: data.id }).eq('id', p.id);
        if (linked.error) {
          // Keep the two in step: without the link the payment would still show as due
          await supabase.from('expenses').delete().eq('id', data.id);
          check(linked);
        }
        setExpenses((xs) => [toExpense({ ...data, expense_items: [] }), ...xs]);
        await loaders.commitments();
      },
      setReserve: async (fixedId, month, amount) => {
        if (amount === null) check(await supabase.from('commitment_reserves').delete().eq('fixed_id', fixedId).eq('month', month));
        else check(await supabase.from('commitment_reserves').upsert({ fixed_id: fixedId, month, amount }));
        await loaders.commitments();
      },
      incomeRows,
      incomesFor: (month) => incomesFor(month, members, incomeRows),
      saveIncome: async (uid, month, amount) => {
        check(await supabase.from('member_incomes').upsert({ user_id: uid, month, amount, updated_at: new Date().toISOString() }));
        await loaders.incomes();
      },
    };
  }, [status, me, household, members, profiles, categories, expenses, fixed, items, budgetRows, categoryBudgetRows, payments, reserves, incomeRows, userId, loaders, loadAll]);

  return <FamilyContext.Provider value={value}>{children}</FamilyContext.Provider>;
}

export const useFamily = () => {
  const ctx = useContext(FamilyContext);
  if (!ctx) throw new Error('useFamily outside FamilyProvider');
  return ctx;
};
