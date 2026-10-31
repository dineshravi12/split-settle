import {
  Component,
  EventEmitter,
  HostListener,
  Input,
  OnInit,
  Output,
  inject,
  signal,
} from "@angular/core";
import { DecimalPipe } from "@angular/common";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { GroupService } from "../../../../core/services/group.service";
import { Group } from "../../../../core/models/group.model";

@Component({
  selector: "app-budget-sheet",
  standalone: true,
  imports: [DecimalPipe, ReactiveFormsModule],
  templateUrl: "./budget-sheet.component.html",
  styleUrls: ["./budget-sheet.component.scss"],
})
export class BudgetSheetComponent implements OnInit {
  private groupService = inject(GroupService);

  @Input({ required: true }) groupId!: number;
  @Input() budget: number | null = null;
  @Input() spent = 0;

  @Output() saved = new EventEmitter<Group>();
  @Output() closed = new EventEmitter<void>();

  readonly presets = [5000, 10000, 25000, 50000];
  readonly control = new FormControl<number | null>(null, [
    Validators.required,
    Validators.min(1),
    Validators.max(99999999),
  ]);
  readonly form = new FormGroup({ budget: this.control });
  readonly saving = signal<"save" | "remove" | null>(null);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.control.setValue(this.budget);
  }

  @HostListener("document:keydown.escape")
  close(): void {
    if (!this.saving()) {
      this.closed.emit();
    }
  }

  usePreset(value: number): void {
    this.control.setValue(value);
    this.control.markAsDirty();
  }

  save(): void {
    if (this.saving()) {
      return;
    }
    if (this.control.invalid) {
      this.control.markAsTouched();
      return;
    }
    this.submit("save", Math.round(Number(this.control.value) * 100) / 100);
  }

  remove(): void {
    if (!this.saving()) {
      this.submit("remove", null);
    }
  }

  private submit(action: "save" | "remove", budget: number | null): void {
    this.saving.set(action);
    this.error.set(null);
    this.groupService.setBudget(this.groupId, budget).subscribe({
      next: (group) => {
        this.saving.set(null);
        this.saved.emit(group);
      },
      error: (err) => {
        this.saving.set(null);
        this.error.set(err?.error?.message || "Couldn't update the budget. Please try again.");
      },
    });
  }
}
