import { Component, computed, input, output } from "@angular/core";
import { DecimalPipe } from "@angular/common";

@Component({
  selector: "app-budget-meter",
  standalone: true,
  imports: [DecimalPipe],
  templateUrl: "./budget-meter.component.html",
  styleUrls: ["./budget-meter.component.scss"],
})
export class BudgetMeterComponent {
  readonly budget = input.required<number>();
  readonly spent = input.required<number>();
  readonly edit = output<void>();

  readonly percent = computed(() => (this.spent() / this.budget()) * 100);
  readonly ratio = computed(() => Math.min(this.percent(), 100) / 100);
  readonly ariaNow = computed(() => Math.min(Math.round(this.percent()), 100));
  readonly remaining = computed(() => this.budget() - this.spent());
  readonly tone = computed(() =>
    this.percent() > 100 ? "over" : this.percent() >= 80 ? "warn" : "ok",
  );
}
