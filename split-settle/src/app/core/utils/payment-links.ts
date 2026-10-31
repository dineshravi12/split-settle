/** Mirrors the API's validation, which also keeps the value safe to embed in upi:// links. */
export const UPI_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{1,99}@[A-Za-z][A-Za-z0-9]{1,49}$/;

export interface UpiPayment {
  upiId: string;
  payeeName: string;
  amount: number;
  note: string;
}

/** NPCI upi://pay link; GPay, PhonePe, Paytm and BHIM all open it and scan its QR form. */
export function upiPayLink(payment: UpiPayment): string | null {
  if (!UPI_ID_PATTERN.test(payment.upiId)) {
    return null;
  }
  // pa stays unencoded: some UPI apps reject %40, and the pattern above guarantees it is URL-safe
  return [
    `upi://pay?pa=${payment.upiId}`,
    `pn=${encodeURIComponent(payment.payeeName)}`,
    `am=${payment.amount.toFixed(2)}`,
    "cu=INR",
    `tn=${encodeURIComponent(payment.note.slice(0, 50))}`,
  ].join("&");
}

export function whatsAppShareLink(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
