export interface Settlement {
  from: string;
  fromId: number;
  to: string;
  toId: number;
  amount: number;
  /** Only sent to the person who owes this amount. */
  toUpiId?: string | null;
}