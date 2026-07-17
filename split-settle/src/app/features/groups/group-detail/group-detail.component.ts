import {
  Component,
  ElementRef,
  OnInit,
  ViewChild,
  inject,
  signal,
} from "@angular/core";
import { CommonModule } from "@angular/common";
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
import { Group } from "../../../core/models/group.model";
import { Expense } from "../../../core/models/expense.model";
import { Settlement } from "../../../core/models/settlement.model";
import { User } from "../../../core/models/user.model";
import { SkeletonLoaderComponent } from "../../../shared/components/skeleton-loader/skeleton-loader.component";
import { FabComponent } from "../../../shared/components/fab/fab.component";

interface CategoryOption {
  label: string;
  value: string;
  icon: string;
}

interface MemberOption {
  label: string;
  value: number;
}

type TabKey = "expenses" | "settlements";

interface ConfettiPiece {
  left: number;
  color: string;
  delay: number;
  duration: number;
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
  private messageService = inject(MessageService);
  private confirmationService = inject(ConfirmationService);

  @ViewChild("tabs", { static: false }) tabsRef?: ElementRef<HTMLDivElement>;

  groupId = 0;
  currentUserId = 0;
  loading = true;
  group: Group | null = null;

  expenses: Expense[] = [];
  loadingExpenses = false;
  settlements: Settlement[] = [];
  loadingSettlements = false;

  activeTab = signal<TabKey>("expenses");

  showMemberDialog = false;
  memberForm: FormGroup;
  addingMember = false;

  showExpenseDialog = false;
  expenseForm: FormGroup;
  addingExpense = false;

  settling: { [key: string]: boolean } = {};
  settledKey = signal<string | null>(null);

  swipeState: { [id: number]: number } = {};
  private swipeStart: { [id: number]: { x: number; y: number } } = {};
  private swipeLocked: { [id: number]: boolean } = {};
  private swipeAxis: { [id: number]: "x" | "y" | null } = {};
  readonly swipeThreshold = 72;

  confetti = signal<ConfettiPiece[] | null>(null);
  private prevSettlementCount = -1;

  categoryOptions: CategoryOption[] = [
    { label: "Food", value: "Food", icon: "pi-shopping-cart" },
    { label: "Travel", value: "Travel", icon: "pi-car" },
    { label: "Utilities", value: "Utilities", icon: "pi-bolt" },
    { label: "Entertainment", value: "Entertainment", icon: "pi-star" },
    { label: "Other", value: "Other", icon: "pi-tag" },
  ];
  memberOptions: MemberOption[] = [];

  constructor() {
    this.currentUserId = this.authService.getCurrentUserId();
    this.memberForm = this.fb.group({
      email: ["", [Validators.required, Validators.email]],
    });
    this.expenseForm = this.fb.group({
      description: ["", Validators.required],
      amount: [null, [Validators.required, Validators.min(1)]],
      category: ["Other", Validators.required],
      paidBy: [null, Validators.required],
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
  }

  loadGroup(): void {
    this.loading = true;
    this.groupService.getGroup(this.groupId).subscribe({
      next: (group) => {
        this.group = group;
        this.memberOptions = (group.members || []).map((m: User) => ({
          label: m.name,
          value: m.id,
        }));
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
    this.loadingExpenses = true;
    this.expenseService.getExpenses(this.groupId).subscribe({
      next: (expenses) => {
        this.expenses = expenses;
        this.loadingExpenses = false;
      },
      error: () => {
        this.loadingExpenses = false;
      },
    });
  }

  loadSettlements(): void {
    this.loadingSettlements = true;
    this.settlementService.getSettlements(this.groupId).subscribe({
      next: (settlements) => {
        const prev = this.prevSettlementCount;
        this.settlements = settlements;
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

  goBack(): void {
    this.router.navigate(["/groups"]);
  }

  // Tabs
  setTab(tab: TabKey): void {
    this.activeTab.set(tab);
  }

  // Categories
  categoryIcon(category: string): string {
    return (
      this.categoryOptions.find((c) => c.value === category)?.icon ?? "pi-tag"
    );
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
        this.memberOptions = (group.members || []).map((m: User) => ({
          label: m.name,
          value: m.id,
        }));
        this.addingMember = false;
        this.showMemberDialog = false;
        this.messageService.add({
          severity: "success",
          summary: "Member added",
          detail: `${email} joined the group`,
        });
        this.loadSettlements();
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
  openExpenseDialog(): void {
    this.expenseForm.reset({
      description: "",
      amount: null,
      category: "Other",
      paidBy: this.currentUserId || null,
    });
    this.showExpenseDialog = true;
  }

  closeExpenseDialog(): void {
    if (this.addingExpense) return;
    this.showExpenseDialog = false;
  }

  addExpense(): void {
    if (this.expenseForm.invalid || this.addingExpense) {
      this.expenseForm.markAllAsTouched();
      return;
    }
    this.addingExpense = true;
    const v = this.expenseForm.value;
    this.expenseService
      .addExpense({
        groupId: this.groupId,
        description: v.description,
        amount: v.amount,
        category: v.category,
        paidBy: v.paidBy,
      })
      .subscribe({
        next: () => {
          this.addingExpense = false;
          this.showExpenseDialog = false;
          this.messageService.add({
            severity: "success",
            summary: "Expense added",
            detail: `"${v.description}" added`,
          });
          this.loadExpenses();
          this.loadSettlements();
        },
        error: (error) => {
          this.addingExpense = false;
          this.messageService.add({
            severity: "error",
            summary: "Error",
            detail: error?.error?.message || "Failed to add expense",
          });
        },
      });
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
        this.loadExpenses();
        this.loadSettlements();
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
    this.swipeLocked[expenseId] = false;
    this.swipeAxis[expenseId] = null;
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
    const clamped = Math.max(-140, Math.min(0, dx));
    this.swipeState[expenseId] = clamped;
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

  isSettling(s: Settlement): boolean {
    return !!this.settling[this.settlementKey(s)];
  }

  isSettled(s: Settlement): boolean {
    return this.settledKey() === this.settlementKey(s);
  }

  categoryClass(category: string): string {
    return `cat cat-${(category || "other").toLowerCase()}`;
  }

  trackExpense(_: number, e: Expense): number {
    return e.id;
  }

  trackSettlement(_: number, s: Settlement): string {
    return this.settlementKey(s);
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
