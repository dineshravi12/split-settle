import {
  Component,
  EventEmitter,
  HostListener,
  Input,
  OnInit,
  Output,
  computed,
  inject,
  signal,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import {
  FormBuilder,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from "@angular/forms";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import {
  ExpenseRequest,
  ExpenseService,
} from "../../../../core/services/expense.service";
import { GroupMember } from "../../../../core/models/group.model";
import {
  EXPENSE_CATEGORIES,
  Expense,
  SplitType,
} from "../../../../core/models/expense.model";

interface SplitRow {
  userId: number;
  name: string;
  included: boolean;
  percent: number | null;
  exact: number | null;
}

interface SplitStatus {
  ok: boolean;
  text: string;
}

@Component({
  selector: "app-expense-form",
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: "./expense-form.component.html",
  styleUrls: ["./expense-form.component.scss"],
})
export class ExpenseFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private expenseService = inject(ExpenseService);

  @Input({ required: true }) groupId!: number;
  @Input({ required: true }) members: GroupMember[] = [];
  @Input() currentUserId = 0;
  @Input() expense: Expense | null = null;

  @Output() saved = new EventEmitter<Expense>();
  @Output() closed = new EventEmitter<void>();

  readonly categories = EXPENSE_CATEGORIES;
  readonly splitTypes: { value: SplitType; label: string }[] = [
    { value: "EQUAL", label: "Equally" },
    { value: "PERCENTAGE", label: "By %" },
    { value: "EXACT", label: "Exact ₹" },
  ];

  readonly form = this.fb.group({
    description: ["", [Validators.required, Validators.maxLength(255)]],
    amount: [null as number | null, [Validators.required, Validators.min(0.01)]],
    category: ["Other"],
    paidBy: [null as number | null, Validators.required],
  });

  readonly splitType = signal<SplitType>("EQUAL");
  readonly rows = signal<SplitRow[]>([]);
  readonly amount = signal(0);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly status = computed<SplitStatus>(() => {
    const type = this.splitType();
    const rows = this.rows();
    const totalPaise = Math.round(this.amount() * 100);

    if (type === "EQUAL") {
      const count = rows.filter((r) => r.included).length;
      if (count === 0) {
        return { ok: false, text: "Pick at least one person" };
      }
      const each =
        totalPaise > 0
          ? ` · ₹${formatHundredths(Math.floor(totalPaise / count))} each`
          : "";
      return {
        ok: true,
        text: `Split between ${count} ${count === 1 ? "person" : "people"}${each}`,
      };
    }

    const values = rows
      .map((r) => toHundredths(type === "PERCENTAGE" ? r.percent : r.exact))
      .filter((v): v is number => v !== null);
    if (values.some((v) => v < 0)) {
      return { ok: false, text: "Shares can't be negative" };
    }
    const assigned = values.filter((v) => v > 0);
    if (assigned.length === 0) {
      return { ok: false, text: "Enter a share for at least one person" };
    }

    const target = type === "PERCENTAGE" ? 10000 : totalPaise;
    const left = target - assigned.reduce((sum, v) => sum + v, 0);
    if (left === 0) {
      return {
        ok: true,
        text: type === "PERCENTAGE" ? "100% assigned" : "Adds up to the total",
      };
    }
    const format = (v: number) =>
      type === "PERCENTAGE" ? `${formatHundredths(v)}%` : `₹${formatHundredths(v)}`;
    return {
      ok: false,
      text: left > 0 ? `${format(left)} left to assign` : `${format(-left)} over the total`,
    };
  });

  constructor() {
    this.form.controls.amount.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((value) => this.amount.set(Number(value) || 0));
  }

  get isEdit(): boolean {
    return this.expense !== null;
  }

  ngOnInit(): void {
    const expense = this.expense;
    const type: SplitType = expense?.splitType ?? "EQUAL";
    const splitsByUser = new Map((expense?.splits ?? []).map((s) => [s.userId, s]));

    this.splitType.set(type);
    this.rows.set(
      this.members.map((m) => {
        const split = splitsByUser.get(m.userId);
        return {
          userId: m.userId,
          name: m.userId === this.currentUserId ? `${m.name} (you)` : m.name,
          included: expense ? !!split : true,
          percent: type === "PERCENTAGE" ? (split?.percentage ?? null) : null,
          exact: type === "EXACT" ? (split?.amountOwed ?? null) : null,
        };
      }),
    );
    this.form.reset({
      description: expense?.description ?? "",
      amount: expense?.amount ?? null,
      category: expense?.category ?? "Other",
      paidBy: expense?.paidByUserId ?? (this.currentUserId || null),
    });
  }

  @HostListener("document:keydown.escape")
  close(): void {
    if (!this.saving()) {
      this.closed.emit();
    }
  }

  setSplitType(type: SplitType): void {
    if (type === this.splitType()) {
      return;
    }
    this.splitType.set(type);
    this.error.set(null);
    this.prefill(type);
  }

  toggleIncluded(userId: number): void {
    this.rows.update((rows) =>
      rows.map((r) => (r.userId === userId ? { ...r, included: !r.included } : r)),
    );
  }

  setPercent(userId: number, value: number | null): void {
    this.rows.update((rows) =>
      rows.map((r) => (r.userId === userId ? { ...r, percent: value } : r)),
    );
  }

  setExact(userId: number, value: number | null): void {
    this.rows.update((rows) =>
      rows.map((r) => (r.userId === userId ? { ...r, exact: value } : r)),
    );
  }

  rowPreview(row: SplitRow): number | null {
    const amount = this.amount();
    if (amount <= 0) {
      return null;
    }
    if (this.splitType() === "EQUAL") {
      const count = this.rows().filter((r) => r.included).length;
      return row.included && count > 0 ? amount / count : null;
    }
    if (this.splitType() === "PERCENTAGE" && row.percent) {
      return (amount * row.percent) / 100;
    }
    return null;
  }

  submit(): void {
    if (this.saving() || !this.status().ok) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const type = this.splitType();
    const request: ExpenseRequest = {
      groupId: this.groupId,
      description: (value.description ?? "").trim(),
      amount: Number(value.amount),
      category: value.category ?? "Other",
      paidBy: Number(value.paidBy),
      splitType: type,
      splits: this.buildShares(type),
    };

    this.saving.set(true);
    this.error.set(null);
    const save$ = this.expense
      ? this.expenseService.updateExpense(this.expense.id, request)
      : this.expenseService.addExpense(request);
    save$.subscribe({
      next: (expense) => {
        this.saving.set(false);
        this.saved.emit(expense);
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set(err?.error?.message || "Couldn't save the expense. Please try again.");
      },
    });
  }

  trackRow(_: number, row: SplitRow): number {
    return row.userId;
  }

  /** Seeds an even split for the people already selected, unless the user has typed values for this mode. */
  private prefill(type: SplitType): void {
    if (type === "EQUAL") {
      return;
    }
    const rows = this.rows();
    const isPercent = type === "PERCENTAGE";
    if (rows.some((r) => (isPercent ? r.percent : r.exact) !== null)) {
      return;
    }
    const chosen = rows.filter((r) => r.included).map((r) => r.userId);
    const total = isPercent ? 10000 : Math.round(this.amount() * 100);
    if (chosen.length === 0 || total <= 0) {
      return;
    }
    const parts = splitEvenly(total, chosen.length);
    this.rows.set(
      rows.map((r) => {
        const index = chosen.indexOf(r.userId);
        if (index < 0) {
          return r;
        }
        const value = parts[index] / 100;
        return isPercent ? { ...r, percent: value } : { ...r, exact: value };
      }),
    );
  }

  private buildShares(type: SplitType): ExpenseRequest["splits"] {
    const rows = this.rows();
    if (type === "EQUAL") {
      return rows.filter((r) => r.included).map((r) => ({ userId: r.userId, value: null }));
    }
    return rows
      .map((r) => ({
        userId: r.userId,
        hundredths: toHundredths(type === "PERCENTAGE" ? r.percent : r.exact),
      }))
      .filter((s): s is { userId: number; hundredths: number } => s.hundredths !== null && s.hundredths > 0)
      .map((s) => ({ userId: s.userId, value: s.hundredths / 100 }));
  }
}

function toHundredths(value: number | null): number | null {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return null;
  }
  return Math.round(value * 100);
}

/** Integer split matching the API: rounding leftovers go to the last person. */
function splitEvenly(total: number, parts: number): number[] {
  const base = Math.floor(total / parts);
  const result = Array<number>(parts).fill(base);
  result[parts - 1] += total - base * parts;
  return result;
}

function formatHundredths(value: number): string {
  return (value / 100).toFixed(2).replace(/\.00$/, "");
}
