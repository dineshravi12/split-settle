import {
  Component,
  EventEmitter,
  HostListener,
  Input,
  OnInit,
  Output,
  signal,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { encode } from "uqr";
import { Settlement } from "../../../../core/models/settlement.model";
import {
  upiPayLink,
  whatsAppShareLink,
} from "../../../../core/utils/payment-links";

@Component({
  selector: "app-upi-pay-sheet",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./upi-pay-sheet.component.html",
  styleUrls: ["./upi-pay-sheet.component.scss"],
})
export class UpiPaySheetComponent implements OnInit {
  @Input({ required: true }) settlement!: Settlement;
  @Input({ required: true }) groupName = "";

  @Output() markPaid = new EventEmitter<void>();
  @Output() closed = new EventEmitter<void>();

  upiLink: string | null = null;
  askLink = "";
  qrSize = 0;
  qrPath = "";
  readonly copied = signal(false);

  ngOnInit(): void {
    const s = this.settlement;
    this.upiLink = s.toUpiId
      ? upiPayLink({
          upiId: s.toUpiId,
          payeeName: s.to,
          amount: s.amount,
          note: `Split & Settle - ${this.groupName}`,
        })
      : null;

    if (this.upiLink) {
      const qr = encode(this.upiLink, { ecc: "M", border: 2 });
      this.qrSize = qr.size;
      this.qrPath = qr.data
        .flatMap((row, y) => row.map((dark, x) => (dark ? `M${x} ${y}h1v1h-1z` : "")))
        .join("");
    }

    this.askLink = whatsAppShareLink(
      `Hi ${s.to}, I want to pay you ₹${s.amount.toFixed(2)} for "${this.groupName}" on Split & Settle. ` +
        "Could you add your UPI ID in your profile?",
    );
  }

  async copyUpiId(): Promise<void> {
    if (!this.settlement.toUpiId) {
      return;
    }
    try {
      await navigator.clipboard.writeText(this.settlement.toUpiId);
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 1500);
    } catch {
      // Clipboard can be blocked (e.g. non-HTTPS); the ID stays visible to copy by hand
    }
  }

  @HostListener("document:keydown.escape")
  close(): void {
    this.closed.emit();
  }
}
