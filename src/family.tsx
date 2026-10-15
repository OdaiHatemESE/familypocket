import type { Session } from '@supabase/supabase-js';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { loginEmail } from './lib/config';
import { friendlyError, supabase } from './lib/supabase';
import { Category, Expense, FixedExpense, Household, Member } from './types';
import { monthKey, shiftMonth } from './utils';

type Status = 'loading' | 'signedOut' | 'ready';

type CategoryInput = Omit<Category, 'id' | 'sort'> & { id?: string };
type FixedInput = Omit<FixedExpense, 'id'> & { id?: string };
type ExpenseInput = { amount: number; note: string; categoryId: string; date: string; fixedId?: string | null };

type Ctx = {
  status: Status;
  me: Member | null;
  household: Household | null;
  members: Member[];
  categories: Category[];
  expenses: Expense[];
  fixed: FixedExpense[];
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
  saveFixed: (f: FixedInput) => Promise<void>;
  deleteFixed: (id: string) => Promise<void>;
  markFixedPaid: (f: FixedExpense, date: string) => Promise<void>;
};

const FamilyContext = createContext<Ctx | null>(null);

// ───── row mappers ─────
const toMember = (r: any): Member => ({ id: r.id, username: r.username, displayName: r.display_name, color: r.color, role: r.role });
const toCategory = (r: any): Category => ({
  id: r.id, name: r.name, icon: r.icon, color: r.color, monthlyBudget: Number(r.monthly_budget) || 0, sort: r.sort ?? 0,
});
const toExpense = (r: any): Expense => ({
  id: r.id, userId: r.user_id, categoryId: r.category_id, fixedId: r.fixed_id, amount: Number(r.amount) || 0,
  note: r.note ?? '', date: r.spent_on, createdAt: Date.parse(r.created_at) || 0,
});
const toFixed = (r: any): FixedExpense => ({
  id: r.id, name: r.name, categoryId: r.category_id, amount: Number(r.amount) || 0, dueDay: r.due_day, active: r.active,
});

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
  const [members, setMembers] = useState<Member[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [fixed, setFixed] = useState<FixedExpense[]>([]);
  const householdId = useRef<string | null>(null);

  const loaders = useMemo(
    () => ({
      members: async () => {
        const { data } = check(await supabase.from('profiles').select('*').order('created_at'));
        setMembers((data ?? []).map(toMember));
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
          await supabase.from('expenses').select('*').gte('spent_on', from).order('spent_on', { ascending: false }).order('created_at', { ascending: false }).limit(5000),
        );
        setExpenses((data ?? []).map(toExpense));
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
    setUserId(null); setMe(null); setHousehold(null); setMembers([]); setCategories([]); setExpenses([]); setFixed([]);
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
      await Promise.all([loaders.household(), loaders.members(), loaders.categories(), loaders.fixed(), loaders.expenses()]);
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
    channel.subscribe();
    return () => {
      Object.values(timers).forEach(clearTimeout);
      supabase.removeChannel(channel);
    };
  }, [status, loaders]);

  const value = useMemo<Ctx>(() => {
    const memberOf = (id: string | null) => members.find((m) => m.id === id);

    const expenseRow = (e: ExpenseInput) => ({
      amount: e.amount, note: e.note, category_id: e.categoryId, spent_on: e.date, fixed_id: e.fixedId ?? null,
    });

    return {
      status, me, household, members, categories, expenses, fixed, memberOf,
      refresh: async () => {
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
        setExpenses((xs) => [toExpense(data), ...xs.filter((x) => x.id !== data.id)]);
      },
      updateExpense: async (id, e) => {
        const { data } = check(await supabase.from('expenses').update(expenseRow(e)).eq('id', id).select().single());
        setExpenses((xs) => xs.map((x) => (x.id === id ? toExpense(data) : x)));
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
        await Promise.all([loaders.categories(), loaders.expenses(), loaders.fixed()]);
      },

      saveFixed: async (f) => {
        const row = { name: f.name, category_id: f.categoryId, amount: f.amount, due_day: f.dueDay, active: f.active };
        if (f.id) check(await supabase.from('fixed_expenses').update(row).eq('id', f.id));
        else check(await supabase.from('fixed_expenses').insert(row));
        await loaders.fixed();
      },
      deleteFixed: async (id) => {
        check(await supabase.from('fixed_expenses').delete().eq('id', id));
        await loaders.fixed();
      },
      markFixedPaid: async (f, date) => {
        const { data } = check(
          await supabase.from('expenses').insert({ amount: f.amount, note: f.name, category_id: f.categoryId, spent_on: date, fixed_id: f.id }).select().single(),
        );
        setExpenses((xs) => [toExpense(data), ...xs]);
      },
    };
  }, [status, me, household, members, categories, expenses, fixed, userId, loaders, loadAll]);

  return <FamilyContext.Provider value={value}>{children}</FamilyContext.Provider>;
}

export const useFamily = () => {
  const ctx = useContext(FamilyContext);
  if (!ctx) throw new Error('useFamily outside FamilyProvider');
  return ctx;
};
