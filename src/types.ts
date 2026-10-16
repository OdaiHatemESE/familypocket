export type Role = 'owner' | 'member';

export type Member = {
  id: string;
  username: string;
  displayName: string;
  color: string;
  role: Role;
  active: boolean;
};

export type Household = { id: string; name: string; currency: string };

export type Category = {
  id: string;
  name: string;
  icon: string; // MaterialCommunityIcons name
  color: string;
  monthlyBudget: number; // AED
  sort: number;
};

export type Expense = {
  id: string;
  userId: string | null;
  categoryId: string;
  fixedId: string | null;
  amount: number;
  note: string;
  date: string; // YYYY-MM-DD
  createdAt: number;
  /** Receipt lines; empty for a single-amount expense */
  lines: ExpenseLine[];
};

/** Units an item can be measured in */
export const UNITS = ['حبة', 'علبة', 'كيلو', 'غرام', 'لتر', 'ربطة', 'كيس', 'كرتونة', 'عبوة', 'رغيف'] as const;

/** Something the family buys, under a category (e.g. منظفات ← دواء جلي، علبة) */
export type Item = { id: string; categoryId: string; name: string; unit: string; archived: boolean };

/** One line on a receipt */
export type ExpenseLine = {
  id?: string;
  /** Text printed on the receipt, when the line came from a photo (not stored on the line) */
  raw?: string;
  /** Read from a photo and not checked yet */
  uncertain?: boolean;
  /** Described in words without a price; must be priced before saving */
  needsPrice?: boolean;
  itemId: string | null;
  categoryId: string;
  name: string;
  unit: string;
  quantity: number;
  amount: number; // line total
};

/** A recurring monthly obligation: rent, school instalment, utilities… */
export type FixedExpense = {
  id: string;
  name: string;
  categoryId: string;
  amount: number;
  dueDay: number; // 1..31
  active: boolean;
  ownerId: string | null; // whose budget it is charged to
};

/** A member's saved budget for one month */
export type BudgetRow = { userId: string; month: string; total: number };
export type CategoryBudgetRow = { userId: string; month: string; categoryId: string; amount: number };

/** A member's budget as it applies to a given month (inherited from the latest saved month) */
export type MemberBudget = {
  userId: string;
  total: number;
  cats: Record<string, number>;
  sourceMonth: string | null; // month the numbers were saved in; null = never set
};

/** A receipt prepared elsewhere (e.g. by the assistant) and opened in the expense sheet for review */
export type ReceiptPrefill = { lines: ExpenseLine[]; date?: string | null; note?: string | null; warnings?: string[] };
