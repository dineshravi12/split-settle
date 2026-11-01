import { Activity } from "../models/activity.model";

/** What the actor did, without their name, e.g. `added “Dinner”`. */
export function activityAction(a: Activity, currentUserId: number): string {
  const target = a.targetId === currentUserId ? "you" : (a.targetName ?? "someone");
  switch (a.type) {
    case "GROUP_CREATED":
      return "created the group";
    case "MEMBER_ADDED":
      return `added ${target}`;
    case "EXPENSE_ADDED":
      return `added “${a.description}”`;
    case "EXPENSE_UPDATED":
      return `edited “${a.description}”`;
    case "EXPENSE_DELETED":
      return `deleted “${a.description}”`;
    case "PAYMENT_RECORDED":
      return `paid ${target}`;
    case "BUDGET_UPDATED":
      return a.amount === null ? "removed the budget" : "set the budget";
  }
}
