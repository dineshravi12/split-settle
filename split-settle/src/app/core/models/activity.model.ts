export type ActivityType =
  | "GROUP_CREATED"
  | "MEMBER_ADDED"
  | "EXPENSE_ADDED"
  | "EXPENSE_UPDATED"
  | "EXPENSE_DELETED"
  | "PAYMENT_RECORDED";

export interface Activity {
  id: number;
  type: ActivityType;
  actorId: number;
  actorName: string;
  targetId: number | null;
  targetName: string | null;
  description: string | null;
  amount: number | null;
  createdAt: string;
}
