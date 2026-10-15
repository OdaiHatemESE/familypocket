import { createContext, useContext } from 'react';
import { Expense } from './types';

type TabsCtx = {
  month: string;
  setMonth: (m: string) => void;
  openAdd: () => void;
  openExpense: (e: Expense) => void;
};

export const TabsContext = createContext<TabsCtx | null>(null);

export const useTabs = () => {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error('useTabs outside tabs layout');
  return ctx;
};
