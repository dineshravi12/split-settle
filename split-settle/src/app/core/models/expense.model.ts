export interface Expense {
  id: number;
  groupId: number;
  description: string;
  amount: number;
  category: string;
  paidBy: number;
  paidByName: string;
  createdAt: string;
}