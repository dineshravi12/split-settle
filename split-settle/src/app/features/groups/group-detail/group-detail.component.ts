import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { ActivatedRoute, Router } from "@angular/router";
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
} from "@angular/forms";
import { TabViewModule } from "primeng/tabview";
import { ButtonModule } from "primeng/button";
import { DialogModule } from "primeng/dialog";
import { InputTextModule } from "primeng/inputtext";
import { InputNumberModule } from "primeng/inputnumber";
import { DropdownModule } from "primeng/dropdown";
import { ProgressSpinnerModule } from "primeng/progressspinner";
import { ToastModule } from "primeng/toast";
import { ConfirmDialogModule } from "primeng/confirmdialog";
import { TagModule } from "primeng/tag";
import { ConfirmationService, MessageService } from "primeng/api";
import { GroupService } from "../../../core/services/group.service";
import { ExpenseService } from "../../../core/services/expense.service";
import { SettlementService } from "../../../core/services/settlement.service";
import { AuthService } from "../../../core/services/auth.service";
import { Group } from "../../../core/models/group.model";
import { Expense } from "../../../core/models/expense.model";
import { Settlement } from "../../../core/models/settlement.model";
import { User } from "../../../core/models/user.model";
import { HeaderComponent } from "../../../shared/components/header/header.component";

interface CategoryOption {
  label: string;
  value: string;
}

interface MemberOption {
  label: string;
  value: number;
}

@Component({
  selector: "app-group-detail",
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TabViewModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    InputNumberModule,
    DropdownModule,
    ProgressSpinnerModule,
    ToastModule,
    ConfirmDialogModule,
    TagModule,
    HeaderComponent,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: "./group-detail.component.html",
  styleUrls: ["./group-detail.component.scss"],
})
export class GroupDetailComponent implements OnInit {
  groupId = 0;
  currentUserId = 0;
  loading = true;
  group: Group | null = null;

  expenses: Expense[] = [];
  loadingExpenses = false;
  settlements: Settlement[] = [];
  loadingSettlements = false;

  showMemberDialog = false;
  memberForm: FormGroup;
  addingMember = false;

  showExpenseDialog = false;
  expenseForm: FormGroup;
  addingExpense = false;

  settling: { [key: string]: boolean } = {};

  categoryOptions: CategoryOption[] = [
    { label: "Food", value: "Food" },
    { label: "Travel", value: "Travel" },
    { label: "Utilities", value: "Utilities" },
    { label: "Entertainment", value: "Entertainment" },
    { label: "Other", value: "Other" },
  ];
  memberOptions: MemberOption[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder,
    private groupService: GroupService,
    private expenseService: ExpenseService,
    private settlementService: SettlementService,
    private authService: AuthService,
    private messageService: MessageService,
    private confirmationService: ConfirmationService,
  ) {
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
        this.settlements = settlements;
        this.loadingSettlements = false;
      },
      error: () => {
        this.loadingSettlements = false;
      },
    });
  }

  // Members
  openMemberDialog(): void {
    this.memberForm.reset({ email: "" });
    this.showMemberDialog = true;
  }

  closeMemberDialog(): void {
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
          summary: "Member Added",
          detail: `${email} was added to the group`,
        });
        this.loadSettlements();
      },
      error: (error) => {
        this.addingMember = false;
        this.messageService.add({
          severity: "error",
          summary: "Error",
          detail: error.error?.message || "User not found",
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
            summary: "Expense Added",
            detail: `"${v.description}" was added`,
          });
          this.loadExpenses();
          this.loadSettlements();
        },
        error: (error) => {
          this.addingExpense = false;
          this.messageService.add({
            severity: "error",
            summary: "Error",
            detail: error.error?.message || "Failed to add expense",
          });
        },
      });
  }

  confirmDeleteExpense(expense: Expense): void {
    this.confirmationService.confirm({
      message: "Delete this expense?",
      header: "Confirm",
      icon: "pi pi-exclamation-triangle",
      accept: () => this.deleteExpense(expense),
    });
  }

  deleteExpense(expense: Expense): void {
    this.expenseService.deleteExpense(expense.id).subscribe({
      next: () => {
        this.messageService.add({
          severity: "success",
          summary: "Deleted",
          detail: "Expense removed",
        });
        this.loadExpenses();
        this.loadSettlements();
      },
      error: (error) => {
        this.messageService.add({
          severity: "error",
          summary: "Error",
          detail: error.error?.message || "Failed to delete expense",
        });
      },
    });
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
      header: "Settle Up",
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
        this.messageService.add({
          severity: "success",
          summary: "Settled",
          detail: "Balance cleared",
        });
        this.loadSettlements();
      },
      error: (error) => {
        this.settling[key] = false;
        this.messageService.add({
          severity: "error",
          summary: "Error",
          detail: error.error?.message || "Failed to settle",
        });
      },
    });
  }

  isSettling(s: Settlement): boolean {
    return !!this.settling[this.settlementKey(s)];
  }

  categorySeverity(
    category: string,
  ): "info" | "success" | "warn" | "danger" | "secondary" | "contrast" {
    switch (category) {
      case "Food":
        return "warn";
      case "Travel":
        return "info";
      case "Utilities":
        return "secondary";
      case "Entertainment":
        return "success";
      default:
        return "contrast";
    }
  }
}
