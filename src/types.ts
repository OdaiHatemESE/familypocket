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
