export type SplitType = "EQUAL" | "PERCENTAGE" | "EXACT";

export interface ExpenseSplit {
  userId: number;
  userName: string;
  amountOwed: number;
  percentage: number | null;
}

export interface Expense {
  id: number;
  groupId: number;
  description: string;
  amount: number;
  category: string;
  paidByUserId: number;
  paidByName: string;
  splitType: SplitType;
  splits: ExpenseSplit[];
  createdAt: string;
}

export const EXPENSE_CATEGORIES = [
  { value: "Food", label: "Food", icon: "pi-shopping-cart" },
  { value: "Travel", label: "Travel", icon: "pi-car" },
  { value: "Utilities", label: "Utilities", icon: "pi-bolt" },
  { value: "Entertainment", label: "Entertainment", icon: "pi-star" },
  { value: "Other", label: "Other", icon: "pi-tag" },
];