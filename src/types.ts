export type Category = {
  id: string;
  name: string;
  icon: string; // emoji
  color: string;
  monthlyBudget: number; // AED
};

export type Expense = {
  id: string;
  categoryId: string;
  amount: number;
  note: string;
  date: string; // YYYY-MM-DD (local)
  createdAt: number;
};
