import { Component, DestroyRef, OnInit, computed, inject, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Router } from "@angular/router";
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
} from "@angular/forms";
import {
  trigger,
  transition,
  query,
  stagger,
  animate,
  style,
} from "@angular/animations";
import { ToastModule } from "primeng/toast";
import { ConfirmDialogModule } from "primeng/confirmdialog";
import { ConfirmationService, MessageService } from "primeng/api";
import { GroupService } from "../../../core/services/group.service";
import { ExpenseService } from "../../../core/services/expense.service";
import { SettlementService } from "../../../core/services/settlement.service";
import { AuthService } from "../../../core/services/auth.service";
import { UserService } from "../../../core/services/user.service";
import {
  GroupLiveEvent,
  LiveStatus,
  RealtimeService,
} from "../../../core/services/realtime.service";
import { whatsAppShareLink } from "../../../core/utils/payment-links";
import { activityAction } from "../../../core/utils/activity-text";
import { Group } from "../../../core/models/group.model";
import { EXPENSE_CATEGORIES, Expense } from "../../../core/models/expense.model";
import { Settlement } from "../../../core/models/settlement.model";
import { Activity } from "../../../core/models/activity.model";
import { SkeletonLoaderComponent } from "../../../shared/components/skeleton-loader/skeleton-loader.component";
import { FabComponent } from "../../../shared/components/fab/fab.component";
import { ExpenseFormComponent } from "./expense-form/expense-form.component";
import { ActivityFeedComponent } from "./activity-feed/activity-feed.component";
import { UpiPaySheetComponent } from "./upi-pay-sheet/upi-pay-sheet.component";
import { BudgetMeterComponent } from "./budget-meter/budget-meter.component";
import { BudgetSheetComponent } from "./budget-sheet/budget-sheet.component";
import { GroupInsightsComponent } from "./group-insights/group-insights.component";

type TabKey = "expenses" | "balances" | "activity" | "insights";
type RefreshPart = "group" | "expenses" | "settlements" | "activity";

const REFRESH_ON: Record<Activity["type"], RefreshPart[]> = {
  GROUP_CREATED: ["group"],
  MEMBER_ADDED: ["group", "settlements"],
  EXPENSE_ADDED: ["expenses", "settlements"],
  EXPENSE_UPDATED: ["expenses", "settlements"],
  EXPENSE_DELETED: ["expenses", "settlements"],
  PAYMENT_RECORDED: ["settlements"],
  BUDGET_UPDATED: ["group"],
};

interface ConfettiPiece {
  left: number;
  color: string;
  delay: number;
  duration: number;
}

interface ShareInfo {
  label: string;
  amount: number | null;
  tone: "lent" | "borrowed" | "none";
}

@Component({
  selector: "app-group-detail",
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ToastModule,
    ConfirmDialogModule,
    SkeletonLoaderComponent,
    FabComponent,
    ExpenseFormComponent,
    ActivityFeedComponent,
    UpiPaySheetComponent,
    BudgetMeterComponent,
    BudgetSheetComponent,
    GroupInsightsComponent,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: "./group-detail.component.html",
  styleUrls: ["./group-detail.component.scss"],
  animations: [
    trigger("listStagger", [
      transition("* => *", [
        query(
          ":enter",
          [
            style({ opacity: 0, transform: "translateY(12px)" }),
            stagger(50, [
              animate(
                "280ms cubic-bezier(0.16, 1, 0.3, 1)",
                style({ opacity: 1, transform: "translateY(0)" }),
              ),
            ]),
          ],
          { optional: true },
        ),
      ]),
    ]),
  ],
})
export class GroupDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private groupService = inject(GroupService);
  private expenseService = inject(ExpenseService);
  private settlementService = inject(SettlementService);
  private authService = inject(AuthService);
  private userService = inject(UserService);
  private realtime = inject(RealtimeService);
  private destroyRef = inject(DestroyRef);
  private messageService = inject(MessageService);
  private confirmationService = inject(ConfirmationService);

  readonly tabs: { key: TabKey; label: string; icon: string }[] = [
    { key: "expenses", label: "Expenses", icon: "pi-wallet" },
    { key: "balances", label: "Balances", icon: "pi-arrow-right-arrow-left" },
    { key: "activity", label: "Activity", icon: "pi-history" },
    { key: "insights", label: "Insights", icon: "pi-chart-pie" },
  ];

  groupId = 0;
  currentUserId = 0;
  loading = true;
  group: Group | null = null;

  expenses: Expense[] = [];
  totalSpent = 0;
  loadingExpenses = false;
  private expensesLoaded = false;
  settlements: Settlement[] = [];
  loadingSettlements = false;
  private settlementsLoaded = false;
  activities: Activity[] = [];
  loadingActivity = false;
  private activityLoaded = false;

  readonly liveStatus = signal<LiveStatus | null>(null);
  private pendingRefresh = new Set<RefreshPart>();
  private pendingActivities: Activity[] = [];
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;

  activeTab = signal<TabKey>("expenses");
  tabIndex = computed(() => this.tabs.findIndex((t) => t.key === this.activeTab()));

  showMemberDialog = false;
  memberForm: FormGroup;
  addingMember = false;

  showExpenseForm = false;
  editingExpense: Expense | null = null;
  showBudgetSheet = false;

  settling: { [key: string]: boolean } = {};
  settlingAll = false;
  settledKey = signal<string | null>(null);
  payingSettlement: Settlement | null = null;
  private myUpiId: string | null = null;

  swipeState: { [id: number]: number } = {};
  private swipeStart: { [id: number]: { x: number; y: number } } = {};
  private swipeAxis: { [id: number]: "x" | "y" | null } = {};
  // Set when a touch turned into a horizontal swipe, so the trailing click doesn't open the editor
  private swipeMoved: { [id: number]: boolean } = {};
  readonly swipeThreshold = 72;

  confetti = signal<ConfettiPiece[] | null>(null);
  private prevSettlementCount = -1;

  constructor() {
    this.currentUserId = this.authService.getCurrentUserId();
    this.memberForm = this.fb.group({
      email: ["", [Validators.required, Validators.email]],
    });
  }

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get("id");
    this.groupId = idParam ? +idParam : 0;
    if (!this.groupId) {
      this.router.navigate(["/groups"]);
      return;
    }
    this.loadGroup();
    this.loadExpenses();
    this.loadSettlements();
    this.userService.getMe().subscribe({
      next: (me) => (this.myUpiId = me.upiId),
      error: () => (this.myUpiId = null),
    });
    this.realtime
      .watchGroup(this.groupId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => this.onLiveEvent(event));
    this.destroyRef.onDestroy(() => {
      if (this.refreshTimer) {
        clearTimeout(this.refreshTimer);
      }
    });
  }

  loadGroup(): void {
    this.loading = true;
    this.groupService.getGroup(this.groupId).subscribe({
      next: (group) => {
        this.group = group;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.messageService.add({
          severity: "error",
          summary: "Error",
          detail: "Failed to load group",
        });
      },
    });
  }

  loadExpenses(): void {
    // Skeletons only on first load; later refreshes swap data in place
    this.loadingExpenses = !this.expensesLoaded;
    this.expenseService.getExpenses(this.groupId).subscribe({
      next: (expenses) => {
        this.expenses = expenses;
        this.totalSpent = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
        this.expensesLoaded = true;
        this.loadingExpenses = false;
      },
      error: () => {
        this.loadingExpenses = false;
      },
    });
  }

  loadSettlements(): void {
    this.loadingSettlements = !this.settlementsLoaded;
    this.settlementService.getSettlements(this.groupId).subscribe({
      next: (settlements) => {
        const prev = this.prevSettlementCount;
        this.settlements = settlements;
        this.settlementsLoaded = true;
        this.loadingSettlements = false;
        if (prev > 0 && settlements.length === 0) {
          this.launchConfetti();
        }
        this.prevSettlementCount = settlements.length;
      },
      error: () => {
        this.loadingSettlements = false;
      },
    });
  }

  loadActivity(): void {
    this.loadingActivity = !this.activityLoaded;
    this.groupService.getActivity(this.groupId).subscribe({
      next: (activities) => {
        this.activities = activities;
        this.activityLoaded = true;
        this.loadingActivity = false;
      },
      error: () => {
        this.loadingActivity = false;
      },
    });
  }

  goBack(): void {
    this.router.navigate(["/groups"]);
  }

  // Tabs
  setTab(tab: TabKey): void {
    this.activeTab.set(tab);
    if (tab === "activity" && !this.activityLoaded && !this.loadingActivity) {
      this.loadActivity();
    }
  }

  tabCount(tab: TabKey): number {
    if (tab === "expenses") return this.expenses.length;
    if (tab === "balances") return this.settlements.length;
    return 0;
  }

  // Categories
  categoryIcon(category: string): string {
    return EXPENSE_CATEGORIES.find((c) => c.value === category)?.icon ?? "pi-tag";
  }

  categoryClass(category: string): string {
    return `cat cat-${(category || "other").toLowerCase()}`;
  }

  shareInfo(expense: Expense): ShareInfo {
    const mine = expense.splits.find((s) => s.userId === this.currentUserId);
    const myShare = mine ? Number(mine.amountOwed) : 0;
    if (expense.paidByUserId === this.currentUserId) {
      const lent = Number(expense.amount) - myShare;
      return lent > 0.004
        ? { label: "you lent", amount: lent, tone: "lent" }
        : { label: "only you", amount: null, tone: "none" };
    }
    return myShare > 0
      ? { label: "you borrowed", amount: myShare, tone: "borrowed" }
      : { label: "not involved", amount: null, tone: "none" };
  }

  // Members
  openMemberDialog(): void {
    this.memberForm.reset({ email: "" });
    this.showMemberDialog = true;
  }

  closeMemberDialog(): void {
    if (this.addingMember) return;
    this.showMemberDialog = false;
  }

  addMember(): void {
    if (this.memberForm.invalid || this.addingMember) {
      this.memberForm.markAllAsTouched();
      return;
    }
    this.addingMember = true;
    const email = this.memberForm.value.email as string;
    this.groupService.addMember(this.groupId, email).subscribe({
      next: (group) => {
        this.group = group;
        this.addingMember = false;
        this.showMemberDialog = false;
        this.messageService.add({
          severity: "success",
          summary: "Member added",
          detail: `${email} joined the group`,
        });
        this.loadSettlements();
        this.refreshActivity();
      },
      error: (error) => {
        this.addingMember = false;
        this.messageService.add({
          severity: "error",
          summary: "Error",
          detail: error?.error?.message || "User not found",
        });
      },
    });
  }

  // Expenses
  openExpenseForm(expense: Expense | null = null): void {
    this.editingExpense = expense;
    this.showExpenseForm = true;
  }

  closeExpenseForm(): void {
    this.showExpenseForm = false;
    this.editingExpense = null;
  }

  onExpenseSaved(expense: Expense): void {
    const edited = this.editingExpense !== null;
    this.closeExpenseForm();
    this.messageService.add({
      severity: "success",
      summary: edited ? "Expense updated" : "Expense added",
      detail: `"${expense.description}" saved`,
    });
    this.refreshAll();
  }

  onExpenseClick(expense: Expense): void {
    if (this.swipeMoved[expense.id]) {
      delete this.swipeMoved[expense.id];
      return;
    }
    this.openExpenseForm(expense);
  }

  confirmDeleteExpense(expense: Expense): void {
    this.confirmationService.confirm({
      message: `Delete "${expense.description}"?`,
      header: "Confirm delete",
      icon: "pi pi-exclamation-triangle",
      accept: () => this.deleteExpense(expense),
      reject: () => this.resetSwipe(expense.id),
    });
  }

  deleteExpense(expense: Expense): void {
    this.expenseService.deleteExpense(expense.id).subscribe({
      next: () => {
        this.resetSwipe(expense.id);
        this.messageService.add({
          severity: "success",
          summary: "Deleted",
          detail: "Expense removed",
        });
        this.refreshAll();
      },
      error: (error) => {
        this.resetSwipe(expense.id);
        this.messageService.add({
          severity: "error",
          summary: "Error",
          detail: error?.error?.message || "Failed to delete expense",
        });
      },
    });
  }

  // Swipe handlers
  onSwipeStart(event: TouchEvent, expenseId: number): void {
    const t = event.touches[0];
    this.swipeStart[expenseId] = { x: t.clientX, y: t.clientY };
    this.swipeAxis[expenseId] = null;
    this.swipeMoved[expenseId] = false;
  }

  onSwipeMove(event: TouchEvent, expenseId: number): void {
    const start = this.swipeStart[expenseId];
    if (!start) return;
    const t = event.touches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;

    if (!this.swipeAxis[expenseId]) {
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
        this.swipeAxis[expenseId] = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      }
    }

    if (this.swipeAxis[expenseId] !== "x") return;

    event.preventDefault();
    this.swipeMoved[expenseId] = true;
    this.swipeState[expenseId] = Math.max(-140, Math.min(0, dx));
  }

  onSwipeEnd(expense: Expense): void {
    const dx = this.swipeState[expense.id] ?? 0;
    if (Math.abs(dx) > this.swipeThreshold) {
      this.swipeState[expense.id] = -100;
      this.confirmDeleteExpense(expense);
    } else {
      this.resetSwipe(expense.id);
    }
    delete this.swipeStart[expense.id];
    delete this.swipeAxis[expense.id];
    if (this.swipeMoved[expense.id]) {
      setTimeout(() => delete this.swipeMoved[expense.id], 400);
    }
  }

  resetSwipe(id: number): void {
    this.swipeState[id] = 0;
  }

  swipeTransform(id: number): string {
    const dx = this.swipeState[id] ?? 0;
    return `translateX(${dx}px)`;
  }

  // Settlements
  settlementKey(s: Settlement): string {
    return `${s.fromId}-${s.toId}`;
  }

  canSettle(s: Settlement): boolean {
    return s.fromId === this.currentUserId || s.toId === this.currentUserId;
  }

  mySettlementCount(): number {
    return this.settlements.filter((s) => this.canSettle(s)).length;
  }

  settlementClass(s: Settlement): string {
    if (s.fromId === this.currentUserId) return "settlement-card owe";
    if (s.toId === this.currentUserId) return "settlement-card owed";
    return "settlement-card neutral";
  }

  settlementText(s: Settlement): string {
    if (s.fromId === this.currentUserId) {
      return `You owe ${s.to} ₹${s.amount.toFixed(2)}`;
    }
    if (s.toId === this.currentUserId) {
      return `${s.from} owes you ₹${s.amount.toFixed(2)}`;
    }
    return `${s.from} owes ${s.to} ₹${s.amount.toFixed(2)}`;
  }

  confirmSettle(s: Settlement): void {
    this.confirmationService.confirm({
      message: `Mark "${this.settlementText(s)}" as settled?`,
      header: "Settle up",
      icon: "pi pi-check-circle",
      accept: () => this.settleUp(s),
    });
  }

  settleUp(s: Settlement): void {
    const key = this.settlementKey(s);
    this.settling[key] = true;
    this.settlementService.settleUp(this.groupId, s.fromId, s.toId).subscribe({
      next: () => {
        this.settling[key] = false;
        this.settledKey.set(key);
        setTimeout(() => {
          this.settledKey.set(null);
          this.loadSettlements();
          this.refreshActivity();
          this.messageService.add({
            severity: "success",
            summary: "Settled",
            detail: "Balance cleared",
          });
        }, 700);
      },
      error: (error) => {
        this.settling[key] = false;
        this.messageService.add({
          severity: "error",
          summary: "Error",
          detail: error?.error?.message || "Failed to settle",
        });
      },
    });
  }

  confirmSettleAll(): void {
    const count = this.mySettlementCount();
    this.confirmationService.confirm({
      message: `Record ${count} payments that clear everything you owe and are owed in this group?`,
      header: "Settle all your balances",
      icon: "pi pi-check-circle",
      accept: () => this.settleAll(),
    });
  }

  settleAll(): void {
    this.settlingAll = true;
    this.settlementService.settleAll(this.groupId).subscribe({
      next: ({ settled }) => {
        this.settlingAll = false;
        this.messageService.add({
          severity: "success",
          summary: "All settled",
          detail: `${settled} balance${settled === 1 ? "" : "s"} cleared`,
        });
        this.loadSettlements();
        this.refreshActivity();
      },
      error: (error) => {
        this.settlingAll = false;
        this.messageService.add({
          severity: "error",
          summary: "Error",
          detail: error?.error?.message || "Failed to settle",
        });
      },
    });
  }

  isSettling(s: Settlement): boolean {
    return !!this.settling[this.settlementKey(s)];
  }

  // Budget
  openBudgetSheet(): void {
    this.showBudgetSheet = true;
  }

  closeBudgetSheet(): void {
    this.showBudgetSheet = false;
  }

  onBudgetSaved(group: Group): void {
    const removed = group.budget === null;
    this.group = group;
    this.showBudgetSheet = false;
    this.messageService.add({
      severity: "success",
      summary: removed ? "Budget removed" : "Budget saved",
      detail: removed
        ? "This group no longer has a budget"
        : `Budget set to ₹${group.budget?.toLocaleString("en-US")}`,
    });
    this.refreshActivity();
  }

  // Payments & sharing
  openPaySheet(s: Settlement): void {
    this.payingSettlement = s;
  }

  closePaySheet(): void {
    this.payingSettlement = null;
  }

  onPaid(): void {
    const settlement = this.payingSettlement;
    this.payingSettlement = null;
    if (settlement) {
      this.settleUp(settlement);
    }
  }

  reminderLink(s: Settlement): string {
    const upi = this.myUpiId ? ` You can pay me on UPI at ${this.myUpiId}.` : "";
    return whatsAppShareLink(
      `Hi ${s.from}, a quick reminder from Split & Settle: you owe me ₹${s.amount.toFixed(2)} ` +
        `for "${this.group?.name}".${upi}`,
    );
  }

  summaryLink(): string {
    const lines = this.settlements.map(
      (s) => `• ${s.from} pays ${s.to} ₹${s.amount.toFixed(2)}`,
    );
    return whatsAppShareLink(
      [`💸 ${this.group?.name}: who owes whom`, ...lines, "", "Settle up on Split & Settle"].join("\n"),
    );
  }

  isSettled(s: Settlement): boolean {
    return this.settledKey() === this.settlementKey(s);
  }

  trackExpense(_: number, e: Expense): number {
    return e.id;
  }

  // Arrow function: ngFor calls trackBy without the component as `this`
  trackSettlement = (_: number, s: Settlement): string => this.settlementKey(s);

  private refreshActivity(): void {
    if (this.activityLoaded) {
      this.loadActivity();
    }
  }

  private refreshAll(): void {
    this.loadExpenses();
    this.loadSettlements();
    this.refreshActivity();
  }

  // Live updates
  private onLiveEvent(event: GroupLiveEvent): void {
    switch (event.kind) {
      case "status":
        this.liveStatus.set(event.status);
        return;
      case "resync":
        this.queueRefresh(["group", "expenses", "settlements", "activity"]);
        return;
      case "activity":
        if (event.activity.actorId !== this.currentUserId) {
          this.pendingActivities.push(event.activity);
        }
        this.queueRefresh([...REFRESH_ON[event.activity.type], "activity"]);
    }
  }

  /** Coalesces bursts (e.g. someone settling several balances at once) into one refetch and one toast. */
  private queueRefresh(parts: RefreshPart[]): void {
    parts.forEach((p) => this.pendingRefresh.add(p));
    this.refreshTimer ??= setTimeout(() => this.flushLiveUpdates(), 400);
  }

  private flushLiveUpdates(): void {
    const parts = this.pendingRefresh;
    const activities = this.pendingActivities;
    this.pendingRefresh = new Set();
    this.pendingActivities = [];
    this.refreshTimer = null;

    if (parts.has("group")) {
      this.groupService.getGroup(this.groupId).subscribe((group) => (this.group = group));
    }
    if (parts.has("expenses")) {
      this.loadExpenses();
    }
    if (parts.has("settlements")) {
      this.loadSettlements();
    }
    if (parts.has("activity")) {
      this.refreshActivity();
    }

    if (activities.length === 1) {
      const [a] = activities;
      this.messageService.add({
        severity: "info",
        summary: "Just now",
        detail: `${a.actorName} ${activityAction(a, this.currentUserId)}`,
        life: 4000,
      });
    } else if (activities.length > 1) {
      const names = [...new Set(activities.map((a) => a.actorName))];
      const who = names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0];
      this.messageService.add({
        severity: "info",
        summary: "Just now",
        detail: `${activities.length} updates from ${who}`,
        life: 4000,
      });
    }
  }

  private launchConfetti(): void {
    const colors = ["#7c3aed", "#a855f7", "#06b6d4", "#22c55e", "#f59e0b"];
    const pieces: ConfettiPiece[] = Array.from({ length: 60 }, () => ({
      left: Math.random() * 100,
      color: colors[Math.floor(Math.random() * colors.length)],
      delay: Math.random() * 400,
      duration: 2200 + Math.random() * 1500,
    }));
    this.confetti.set(pieces);
    setTimeout(() => this.confetti.set(null), 4000);
  }
}
