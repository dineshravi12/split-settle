import {
  Component,
  DestroyRef,
  EventEmitter,
  HostListener,
  Input,
  NgZone,
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
import { debounceTime } from "rxjs/operators";
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
import { suggestCategory } from "../../../../core/utils/category-suggest";
import { parseSpokenExpense } from "../../../../core/utils/voice-expense";
import {
  ReceiptScannerService,
  ScanStage,
} from "../../../../core/services/receipt-scanner.service";

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

// Minimal shape of the Web Speech API (not in TypeScript's DOM types)
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

interface SpeechResultEvent {
  resultIndex: number;
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function speechRecognitionCtor(): SpeechRecognitionCtor | null {
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
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
  private receiptScanner = inject(ReceiptScannerService);
  private zone = inject(NgZone);

  @Input({ required: true }) groupId!: number;
  @Input({ required: true }) members: GroupMember[] = [];
  @Input() currentUserId = 0;
  @Input() expense: Expense | null = null;
  /** Earlier expenses in the group, used to learn category choices. */
  @Input() history: readonly Expense[] = [];

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

  readonly autoCategory = signal(false);
  private categoryPicked = false;

  readonly speechSupported = speechRecognitionCtor() !== null;
  readonly listening = signal(false);
  readonly heard = signal<string | null>(null);
  /** Problems from voice input or receipt scanning, shown in the quick-fill row. */
  readonly quickError = signal<string | null>(null);
  private recognition: SpeechRecognitionLike | null = null;

  readonly scan = signal<{ stage: ScanStage; percent: number } | null>(null);
  readonly scanResult = signal<string | null>(null);
  private scanAbort: AbortController | null = null;

  readonly quickNote = computed(() => {
    const scan = this.scan();
    if (scan) {
      return scan.stage === "reading"
        ? `Reading receipt… ${scan.percent}%`
        : "Getting the scanner ready…";
    }
    const heard = this.heard();
    return heard ? `“${heard}”` : (this.scanResult() ?? null);
  });

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
    this.form.controls.description.valueChanges
      .pipe(debounceTime(250), takeUntilDestroyed())
      .subscribe((text) => this.autoPickCategory(text ?? ""));
    inject(DestroyRef).onDestroy(() => {
      this.recognition?.abort();
      this.scanAbort?.abort();
    });
  }

  get isEdit(): boolean {
    return this.expense !== null;
  }

  get voiceExample(): string {
    const other = this.members.find((m) => m.userId !== this.currentUserId);
    return other
      ? `“${other.name.split(" ")[0]} paid 1200 for dinner”`
      : "“Paid 500 for groceries”";
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
      this.recognition?.abort();
      this.scanAbort?.abort();
      this.closed.emit();
    }
  }

  pickCategory(category: string): void {
    this.categoryPicked = true;
    this.autoCategory.set(false);
    this.form.controls.category.setValue(category);
  }

  toggleVoice(): void {
    const active = this.recognition;
    if (active) {
      active.stop();
      // A session still waiting for mic permission may never end on its own
      setTimeout(() => {
        if (this.recognition === active) {
          active.abort();
          this.recognition = null;
          this.listening.set(false);
        }
      }, 1500);
      return;
    }
    const Recognition = speechRecognitionCtor();
    if (!Recognition) {
      return;
    }

    const recognition = new Recognition();
    recognition.lang = "en-IN";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    let finalText = "";
    recognition.onresult = (event) =>
      this.zone.run(() => {
        if (this.recognition !== recognition) {
          return;
        }
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            finalText += result[0].transcript;
          } else {
            interim += result[0].transcript;
          }
        }
        this.heard.set(`${finalText}${interim}`.trim() || null);
      });
    recognition.onerror = (event) =>
      this.zone.run(() => {
        if (this.recognition === recognition) {
          this.quickError.set(voiceErrorMessage(event.error));
        }
      });
    recognition.onend = () =>
      this.zone.run(() => {
        if (this.recognition !== recognition) {
          return;
        }
        this.listening.set(false);
        this.recognition = null;
        const text = (finalText || this.heard() || "").trim();
        if (text) {
          this.applySpoken(text);
        }
      });

    this.heard.set(null);
    this.scanResult.set(null);
    this.quickError.set(null);
    try {
      recognition.start();
      this.recognition = recognition;
      this.listening.set(true);
    } catch {
      this.quickError.set(voiceErrorMessage("start-failed"));
    }
  }

  async scanReceipt(input: HTMLInputElement): Promise<void> {
    const file = input.files?.[0];
    input.value = "";
    if (!file || this.scan()) {
      return;
    }
    if (!file.type.startsWith("image/")) {
      this.quickError.set("That isn't a photo. Pick an image of the receipt.");
      return;
    }

    const abort = new AbortController();
    this.scanAbort = abort;
    this.heard.set(null);
    this.scanResult.set(null);
    this.quickError.set(null);
    this.scan.set({ stage: "preparing", percent: 0 });
    try {
      const receipt = await this.receiptScanner.scan(
        file,
        (stage, fraction) =>
          this.zone.run(() => this.scan.set({ stage, percent: Math.round(fraction * 100) })),
        abort.signal,
      );
      if (abort.signal.aborted) {
        return;
      }
      const controls = this.form.controls;
      if (receipt.merchant && !controls.description.value?.trim()) {
        controls.description.setValue(receipt.merchant);
        controls.description.markAsTouched();
      }
      if (receipt.amount !== null) {
        controls.amount.setValue(receipt.amount);
        controls.amount.markAsTouched();
        const at = receipt.merchant ? ` at ${receipt.merchant}` : "";
        const amount = receipt.amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        this.scanResult.set(`Found ₹${amount}${at}. Check it before saving.`);
      } else {
        this.quickError.set("Couldn't find the total on that receipt. Type the amount in.");
      }
    } catch {
      if (!abort.signal.aborted) {
        this.quickError.set("Couldn't read that receipt. Try a sharper, well-lit photo.");
      }
    } finally {
      if (this.scanAbort === abort) {
        this.scanAbort = null;
        this.scan.set(null);
      }
    }
  }

  cancelScan(): void {
    this.scanAbort?.abort();
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

  /** Fills the form from a spoken phrase; fields that weren't mentioned are left alone. */
  applySpoken(text: string): void {
    const spoken = parseSpokenExpense(text, this.members, this.currentUserId);
    const controls = this.form.controls;
    if (spoken.description) {
      controls.description.setValue(spoken.description);
      controls.description.markAsTouched();
    }
    if (spoken.amount !== null) {
      controls.amount.setValue(spoken.amount);
      controls.amount.markAsTouched();
    }
    if (spoken.payerId !== null) {
      controls.paidBy.setValue(spoken.payerId);
    }
    if (spoken.amount === null && !spoken.description) {
      this.quickError.set(`Couldn't make that out. Try ${this.voiceExample}.`);
    } else if (spoken.amount === null) {
      this.quickError.set("Didn't catch an amount. Type it in or try again.");
    }
  }

  private autoPickCategory(text: string): void {
    if (this.isEdit || this.categoryPicked) {
      return;
    }
    const suggestion = suggestCategory(text, this.history);
    this.form.controls.category.setValue(suggestion ?? "Other");
    this.autoCategory.set(suggestion !== null);
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

function voiceErrorMessage(code: string): string | null {
  switch (code) {
    case "aborted":
      return null;
    case "not-allowed":
    case "service-not-allowed":
      return "Microphone access is blocked. Allow it in your browser settings.";
    case "no-speech":
      return "Didn't hear anything. Tap the mic and try again.";
    case "audio-capture":
      return "No microphone found.";
    case "network":
      return "Voice input needs an internet connection.";
    default:
      return "Voice input didn't work. Try again.";
  }
}
