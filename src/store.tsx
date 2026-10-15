import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Category, Expense } from './types';
import { toKey, uid } from './utils';

const KEY = 'masarifi:v2';

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'home', name: 'متطلبات المنزل', icon: 'home-variant-outline', color: '#2E5EAA', monthlyBudget: 3000 },
  { id: 'car', name: 'مصاريف السيارة', icon: 'car-outline', color: '#C9822B', monthlyBudget: 1200 },
  { id: 'school', name: 'رسوم المدرسة', icon: 'school-outline', color: '#0F7B6C', monthlyBudget: 2500 },
  { id: 'kids', name: 'مصاريف الأطفال', icon: 'baby-face-outline', color: '#B23A58', monthlyBudget: 1000 },
  { id: 'bills', name: 'الفواتير', icon: 'lightning-bolt-outline', color: '#6B4FA3', monthlyBudget: 800 },
];

type State = { categories: Category[]; expenses: Expense[] };

type Ctx = State & {
  ready: boolean;
  addCategory: (c: Omit<Category, 'id'>) => void;
  updateCategory: (c: Category) => void;
  deleteCategory: (id: string) => void;
  addExpense: (e: Omit<Expense, 'id' | 'createdAt'>) => void;
  updateExpense: (e: Expense) => void;
  deleteExpense: (id: string) => void;
  loadDemo: () => void;
  resetAll: () => void;
};

const StoreContext = createContext<Ctx | null>(null);

/** Realistic sample data for the last ~2.5 months so the analysis has something to show */
function demoData(): State {
  const notes: Record<string, [string, number, number][]> = {
    home: [['كارفور', 120, 420], ['لولو', 60, 260], ['منظفات', 25, 90], ['خضار وفواكه', 30, 110]],
    car: [['بنزين', 90, 160], ['غسيل سيارة', 30, 45], ['سالك', 20, 60]],
    kids: [['حفاضات', 80, 140], ['ألعاب', 40, 150], ['ملابس', 90, 280]],
    bills: [['ديوا', 350, 620], ['اتصالات', 199, 199], ['إنترنت', 389, 389]],
  };
  let seed = 7;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  const expenses: Expense[] = [];
  const today = new Date();
  for (let back = 75; back >= 0; back--) {
    const d = new Date(today);
    d.setDate(d.getDate() - back);
    const key = toKey(d);
    const dom = d.getDate();
    const push = (cat: string, note: string, amount: number) =>
      expenses.push({ id: uid() + back + note, categoryId: cat, amount: Math.round(amount), note, date: key, createdAt: d.getTime() + expenses.length });
    if (dom === 2) push('school', 'قسط المدرسة', 2500);
    if (dom === 5) notes.bills.forEach(([n, a, b]) => push('bills', n, a + rnd() * (b - a)));
    const k = rnd() < 0.25 ? 0 : rnd() < 0.6 ? 1 : 2;
    for (let i = 0; i < k; i++) {
      const cat = ['home', 'home', 'car', 'kids'][Math.floor(rnd() * 4)];
      const opts = notes[cat];
      const [n, a, b] = opts[Math.floor(rnd() * opts.length)];
      push(cat, n, a + rnd() * (b - a));
    }
  }
  return { categories: DEFAULT_CATEGORIES, expenses: expenses.reverse() };
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>({ categories: [], expenses: [] });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(KEY);
        setState(raw ? JSON.parse(raw) : { categories: DEFAULT_CATEGORIES, expenses: [] });
      } catch {
        setState({ categories: DEFAULT_CATEGORIES, expenses: [] });
      }
      setReady(true);
    })();
  }, []);

  useEffect(() => {
    if (ready) AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {});
  }, [state, ready]);

  const value = useMemo<Ctx>(
    () => ({
      ...state,
      ready,
      addCategory: (c) => setState((s) => ({ ...s, categories: [...s.categories, { ...c, id: uid() }] })),
      updateCategory: (c) => setState((s) => ({ ...s, categories: s.categories.map((x) => (x.id === c.id ? c : x)) })),
      deleteCategory: (id) =>
        setState((s) => ({
          categories: s.categories.filter((x) => x.id !== id),
          expenses: s.expenses.filter((e) => e.categoryId !== id),
        })),
      addExpense: (e) => setState((s) => ({ ...s, expenses: [{ ...e, id: uid(), createdAt: Date.now() }, ...s.expenses] })),
      updateExpense: (e) => setState((s) => ({ ...s, expenses: s.expenses.map((x) => (x.id === e.id ? e : x)) })),
      deleteExpense: (id) => setState((s) => ({ ...s, expenses: s.expenses.filter((x) => x.id !== id) })),
      loadDemo: () => setState(demoData()),
      resetAll: () => setState({ categories: DEFAULT_CATEGORIES, expenses: [] }),
    }),
    [state, ready],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export const useStore = () => {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore outside provider');
  return ctx;
};
