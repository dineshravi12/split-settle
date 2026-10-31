import { Component, Input, OnChanges } from "@angular/core";
import { CommonModule } from "@angular/common";
import { Activity, ActivityType } from "../../../../core/models/activity.model";

interface FeedEntry {
  id: number;
  icon: string;
  tone: string;
  actor: string;
  action: string;
  amount: number | null;
  when: string;
  exactTime: string;
}

const ICONS: Record<ActivityType, string> = {
  GROUP_CREATED: "pi-flag",
  MEMBER_ADDED: "pi-user-plus",
  EXPENSE_ADDED: "pi-plus",
  EXPENSE_UPDATED: "pi-pencil",
  EXPENSE_DELETED: "pi-trash",
  PAYMENT_RECORDED: "pi-check",
  BUDGET_UPDATED: "pi-bullseye",
};

const TONES: Record<ActivityType, string> = {
  GROUP_CREATED: "primary",
  MEMBER_ADDED: "accent",
  EXPENSE_ADDED: "primary",
  EXPENSE_UPDATED: "warning",
  EXPENSE_DELETED: "danger",
  PAYMENT_RECORDED: "success",
  BUDGET_UPDATED: "accent",
};

@Component({
  selector: "app-activity-feed",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./activity-feed.component.html",
  styleUrls: ["./activity-feed.component.scss"],
})
export class ActivityFeedComponent implements OnChanges {
  @Input({ required: true }) items: Activity[] = [];
  @Input() currentUserId = 0;

  entries: FeedEntry[] = [];

  ngOnChanges(): void {
    const now = Date.now();
    this.entries = this.items.map((a) => {
      const at = new Date(a.createdAt);
      return {
        id: a.id,
        icon: ICONS[a.type],
        tone: TONES[a.type],
        actor: a.actorId === this.currentUserId ? "You" : a.actorName,
        action: this.describe(a),
        amount: a.amount,
        when: timeAgo(at.getTime(), now),
        exactTime: at.toLocaleString(),
      };
    });
  }

  trackById(_: number, entry: FeedEntry): number {
    return entry.id;
  }

  private describe(a: Activity): string {
    const target = a.targetId === this.currentUserId ? "you" : (a.targetName ?? "someone");
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
}

function timeAgo(then: number, now: number): string {
  const seconds = Math.max(0, Math.round((now - then) / 1000));
  if (seconds < 45) {
    return "just now";
  }
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  const days = Math.round(hours / 24);
  if (days === 1) {
    return "yesterday";
  }
  if (days < 7) {
    return `${days}d ago`;
  }
  return new Date(then).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}
