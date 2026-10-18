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
  /** The member it belongs to (counts against their budget) */
  userId: string | null;
  /** Who recorded it; may be another family member */
  createdBy: string | null;
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

/**
 * Something the family buys, under a budget category, named as specifically as the receipt
 * (e.g. متطلبات المنزل ← شوكولاتة بندق). `group` is its general type (شوكولاتة), which analysis adds up;
 * it equals the name when there is no more general type.
 */
export type Item = { id: string; categoryId: string; name: string; group: string; unit: string; archived: boolean };

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
  /** General type for a new item read from a receipt (e.g. خبز for خبز أسمر); not stored on the line */
  group?: string;
  unit: string;
  quantity: number;
  amount: number; // line total
};

export type CommitmentKind = 'rent' | 'school' | 'bill' | 'transfer' | 'saving' | 'installment' | 'other';

/**
 * A commitment that comes off the salary before day-to-day spending: rent, school fees, bills,
 * transfers to family, savings. Monthly ones are paid each month; the rest are paid every few months
 * from money set aside monthly (see CommitmentPayment and ReserveRow).
 */
export type FixedExpense = {
  id: string;
  name: string;
  categoryId: string;
  amount: number; // per payment (monthly amount when everyMonths = 1); an estimate when `variable`
  dueDay: number; // 1..31, for monthly commitments
  active: boolean;
  ownerId: string | null; // the member responsible
  kind: CommitmentKind;
  everyMonths: number; // 1, 2, 3, 4, 6 or 12
  variable: boolean; // amount changes each time (electricity, water)
};

/** One scheduled payment of a commitment paid every few months: a rent cheque, a school instalment */
export type CommitmentPayment = {
  id: string;
  fixedId: string;
  dueDate: string; // YYYY-MM-DD
  amount: number;
  method: 'cheque' | 'transfer' | 'card' | 'cash';
  reference: string; // cheque number, bank
  expenseId: string | null; // set once paid / cashed
};

/** Money set aside in a month towards a commitment paid every few months */
export type ReserveRow = { fixedId: string; month: string; amount: number };

/** A member's salary from a month onwards */
export type IncomeRow = { userId: string; month: string; amount: number };

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
