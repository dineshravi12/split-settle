import { Component, computed, input, output } from "@angular/core";
import { DecimalPipe } from "@angular/common";
import { EXPENSE_CATEGORIES, Expense } from "../../../../core/models/expense.model";
import { GroupMember } from "../../../../core/models/group.model";

interface CategorySlice {
  key: string;
  label: string;
  color: string;
  amount: number;
  percent: number;
  dash: string;
  offset: number;
}

interface Bucket {
  key: string;
  label: string;
  name: string;
  amount: number;
  height: number;
  showLabel: boolean;
}

interface PayerRow {
  userId: number;
  name: string;
  paid: number;
  share: number;
  paidWidth: number;
  shareWidth: number;
}

type BucketUnit = "day" | "week" | "month";

const CATEGORY_COLORS: Record<string, string> = {
  Food: "#f59e0b",
  Travel: "#3b82f6",
  Utilities: "#64748b",
  Entertainment: "#22c55e",
  Other: "#7c3aed",
};

const CAPTIONS: Record<BucketUnit, string> = {
  day: "Spending per day",
  week: "Spending per week",
  month: "Spending per month",
};

@Component({
  selector: "app-group-insights",
  standalone: true,
  imports: [DecimalPipe],
  templateUrl: "./group-insights.component.html",
  styleUrls: ["./group-insights.component.scss"],
})
export class GroupInsightsComponent {
  readonly expenses = input.required<Expense[]>();
  readonly members = input.required<GroupMember[]>();
  readonly currentUserId = input(0);
  readonly hasBudget = input(false);
  readonly setBudget = output<void>();

  readonly total = computed(() => sum(this.expenses().map((e) => Number(e.amount))));
  readonly totalCompact = computed(() => compactRupees(this.total()));

  readonly myShare = computed(() =>
    sum(
      this.expenses().flatMap((e) =>
        e.splits.filter((s) => s.userId === this.currentUserId()).map((s) => Number(s.amountOwed)),
      ),
    ),
  );
  readonly mySharePercent = computed(() =>
    this.total() > 0 ? (this.myShare() / this.total()) * 100 : 0,
  );
  readonly myPaid = computed(() =>
    sum(
      this.expenses()
        .filter((e) => e.paidByUserId === this.currentUserId())
        .map((e) => Number(e.amount)),
    ),
  );
  readonly perPerson = computed(() =>
    this.members().length > 0 ? this.total() / this.members().length : 0,
  );

  readonly categories = computed<CategorySlice[]>(() => {
    const totals = new Map<string, number>();
    for (const e of this.expenses()) {
      const key = normalizeCategory(e.category);
      totals.set(key, (totals.get(key) ?? 0) + Number(e.amount));
    }
    const total = this.total();
    // Leave a hairline gap between slices, unless there is only one
    const gap = totals.size > 1 ? 0.6 : 0;
    let start = 0;
    return [...totals.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([key, amount]) => {
        const percent = total > 0 ? (amount / total) * 100 : 0;
        const visible = Math.max(percent - gap, 0.01);
        // r = 100 / 2π makes the circumference 100; offset 25 starts at 12 o'clock
        const slice: CategorySlice = {
          key,
          label: EXPENSE_CATEGORIES.find((c) => c.value === key)?.label ?? key,
          color: CATEGORY_COLORS[key],
          amount,
          percent,
          dash: `${visible} ${100 - visible}`,
          offset: 25 - start,
        };
        start += percent;
        return slice;
      });
  });

  readonly donutLabel = computed(
    () =>
      "Spending by category: " +
      this.categories()
        .map((c) => `${c.label} ${Math.round(c.percent)}%`)
        .join(", "),
  );

  readonly timeline = computed(() => {
    const items = this.expenses()
      .map((e) => ({ at: new Date(e.createdAt), amount: Number(e.amount) }))
      .filter((i) => !Number.isNaN(i.at.getTime()));
    if (items.length === 0) {
      return { caption: CAPTIONS.day, buckets: [] as Bucket[], peak: null, summary: "" };
    }

    const times = items.map((i) => i.at.getTime());
    const first = startOfDay(new Date(Math.min(...times)));
    const last = startOfDay(new Date(Math.max(...times)));
    const spanDays = daysBetween(first, last) + 1;
    const unit: BucketUnit = spanDays <= 31 ? "day" : spanDays <= 26 * 7 ? "week" : "month";
    const spansYears = first.getFullYear() !== last.getFullYear();

    const totals = new Map<string, number>();
    for (const item of items) {
      const key = bucketKey(bucketStart(item.at, unit));
      totals.set(key, (totals.get(key) ?? 0) + item.amount);
    }

    const raw: { key: string; label: string; name: string; amount: number }[] = [];
    for (let d = bucketStart(first, unit); d <= last; d = nextBucket(d, unit)) {
      const key = bucketKey(d);
      const label = bucketLabel(d, unit, spansYears);
      raw.push({
        key,
        label,
        name: unit === "week" ? `Week of ${label}` : label,
        amount: totals.get(key) ?? 0,
      });
    }

    const max = Math.max(...raw.map((b) => b.amount));
    const every = Math.ceil(raw.length / 7);
    const buckets: Bucket[] = raw.map((b, i) => ({
      ...b,
      height: max > 0 ? Math.max((b.amount / max) * 100, b.amount > 0 ? 4 : 0) : 0,
      showLabel: (raw.length - 1 - i) % every === 0,
    }));
    const peak = raw.length > 1 ? raw.reduce((a, b) => (b.amount > a.amount ? b : a)) : null;
    const summary =
      `${CAPTIONS[unit]}: ` +
      raw
        .filter((b) => b.amount > 0)
        .map((b) => `${b.name} ₹${Math.round(b.amount).toLocaleString("en-US")}`)
        .join(", ");
    return { caption: CAPTIONS[unit], buckets, peak, summary };
  });

  readonly payers = computed<PayerRow[]>(() => {
    const paid = new Map<number, number>();
    const share = new Map<number, number>();
    for (const e of this.expenses()) {
      paid.set(e.paidByUserId, (paid.get(e.paidByUserId) ?? 0) + Number(e.amount));
      for (const s of e.splits) {
        share.set(s.userId, (share.get(s.userId) ?? 0) + Number(s.amountOwed));
      }
    }
    const rows = this.members().map((m) => ({
      userId: m.userId,
      name: m.userId === this.currentUserId() ? "You" : m.name,
      paid: paid.get(m.userId) ?? 0,
      share: share.get(m.userId) ?? 0,
    }));
    const max = Math.max(0, ...rows.flatMap((r) => [r.paid, r.share]));
    return rows
      .sort((a, b) => b.paid - a.paid || b.share - a.share)
      .map((r) => ({
        ...r,
        paidWidth: max > 0 ? (r.paid / max) * 100 : 0,
        shareWidth: max > 0 ? (r.share / max) * 100 : 0,
      }));
  });
}

function sum(values: number[]): number {
  return values.reduce((total, v) => total + (Number.isFinite(v) ? v : 0), 0);
}

function normalizeCategory(category: string | null | undefined): string {
  const match = EXPENSE_CATEGORIES.find(
    (c) => c.value.toLowerCase() === (category ?? "").trim().toLowerCase(),
  );
  return match?.value ?? "Other";
}

/** Indian short scale: 12.5k, 3.2L, 1.1Cr. */
function compactRupees(value: number): string {
  const units: [number, string][] = [
    [1e7, "Cr"],
    [1e5, "L"],
    [1e3, "k"],
  ];
  for (const [size, suffix] of units) {
    if (value >= size) {
      return `${(value / size).toFixed(1).replace(/\.0$/, "")}${suffix}`;
    }
  }
  return Math.round(value).toString();
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function daysBetween(a: Date, b: Date): number {
  const utc = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((utc(b) - utc(a)) / 86_400_000);
}

function bucketStart(d: Date, unit: BucketUnit): Date {
  if (unit === "month") {
    return new Date(d.getFullYear(), d.getMonth(), 1);
  }
  const day = startOfDay(d);
  if (unit === "week") {
    // Weeks start on Monday
    day.setDate(day.getDate() - ((day.getDay() + 6) % 7));
  }
  return day;
}

function nextBucket(d: Date, unit: BucketUnit): Date {
  if (unit === "month") {
    return new Date(d.getFullYear(), d.getMonth() + 1, 1);
  }
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + (unit === "week" ? 7 : 1));
}

function bucketKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function bucketLabel(d: Date, unit: BucketUnit, withYear: boolean): string {
  if (unit === "month") {
    return d.toLocaleDateString(undefined, withYear ? { month: "short", year: "2-digit" } : { month: "short" });
  }
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}
