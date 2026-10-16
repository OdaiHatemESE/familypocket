import { createContext, useContext } from 'react';
import { Expense, ReceiptPrefill } from './types';

type TabsCtx = {
  month: string;
  setMonth: (m: string) => void;
  /** null = whole family, otherwise a member id */
  scope: string | null;
  setScope: (s: string | null) => void;
  openAdd: () => void;
  openExpense: (e: Expense) => void;
  /** Opens the expense sheet on a receipt prepared elsewhere, for review before saving */
  openDraft: (d: ReceiptPrefill) => void;
};

export const TabsContext = createContext<TabsCtx | null>(null);

export const useTabs = () => {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error('useTabs outside tabs layout');
  return ctx;
};
