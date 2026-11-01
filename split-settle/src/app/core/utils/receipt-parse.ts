export interface ParsedReceipt {
  amount: number | null;
  merchant: string | null;
}

// Higher rank wins; "subtotal" only counts when nothing better is printed
const TOTAL_PATTERNS: [RegExp, number][] = [
  [/grand\s*-?\s*total|net\s*(?:payable|amount|amt|total|bill)|(?:amount|amt|total)\s*payable|to\s*pay\b|bill\s*(?:amount|amt|total)|total\s*(?:amount|amt|due|bill)|(?:amount|balance)\s*due/, 3],
  [/(?<!sub\s?-?\s?)\btotal\b|\bpayable\b/, 2],
  [/sub\s*-?\s*total/, 1],
];
const NOT_A_TOTAL =
  /\b(?:qty|quantity|items?|tax|taxes|gst|cgst|sgst|igst|vat|cess|discount|savings?|saved|round(?:ed)?\s*off|change|tendered|tip|service\s*charge)\b/;
const HEADER_NOISE =
  /^(?:tax\s*invoice|retail\s*invoice|invoice|bill|receipt|cash\s*memo|estimate|original|duplicate|copy|welcome|thank|gstin|gst\s*no|fssai|cin|pan|phone|ph|tel|mob|mobile|email|address|date|time|table|order|kot|token|cashier|counter|bill\s*no|invoice\s*no)\b/i;
const MONEY = /(?:₹|\brs\.?|\binr)?\s*(\d[\d,.]*\d|\d)(?:\s*\/-)?/gi;

/** Picks the bill total and the shop name out of OCR'd receipt text. */
export function parseReceiptText(text: string): ParsedReceipt {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => l.length > 0);
  return { amount: findTotal(lines), merchant: findMerchant(lines) };
}

function findTotal(lines: string[]): number | null {
  let best: { rank: number; value: number } | null = null;
  for (let i = 0; i < lines.length; i++) {
    const lower = lines[i].toLowerCase();
    const rank = TOTAL_PATTERNS.find(([pattern]) => pattern.test(lower))?.[1];
    if (!rank || (rank < 3 && NOT_A_TOTAL.test(lower))) {
      continue;
    }
    // Some receipts print the figure on the line below the label
    const next = lines[i + 1];
    const value = lastAmount(lines[i]) ?? (next && !/[a-z]{3}/i.test(next) ? lastAmount(next) : null);
    if (value !== null && (!best || rank > best.rank || (rank === best.rank && value > best.value))) {
      best = { rank, value };
    }
  }
  if (best) {
    return best.value;
  }

  // No labelled total: fall back to the largest figure printed with paise (skips dates, phone numbers, bill numbers)
  const priced = lines.flatMap((l) => amounts(l).filter((a) => a.hasDecimals).map((a) => a.value));
  return priced.length > 0 ? Math.max(...priced) : null;
}

function lastAmount(line: string): number | null {
  const found = amounts(line);
  return found.length > 0 ? found[found.length - 1].value : null;
}

function amounts(line: string): { value: number; hasDecimals: boolean }[] {
  const result: { value: number; hasDecimals: boolean }[] = [];
  for (const match of line.matchAll(MONEY)) {
    const raw = match[1];
    // The last separator is a decimal point only when 1-2 digits follow it (OCR mixes up . and ,)
    const decimal = /^(.*?)[.,](\d{1,2})$/.exec(raw);
    const whole = (decimal ? decimal[1] : raw).replace(/[.,]/g, "");
    if (!/^\d{1,8}$/.test(whole)) {
      continue;
    }
    const value = Number(whole) + (decimal ? Number(decimal[2].padEnd(2, "0")) / 100 : 0);
    if (value > 0) {
      result.push({ value: Math.round(value * 100) / 100, hasDecimals: decimal !== null });
    }
  }
  return result;
}

function findMerchant(lines: string[]): string | null {
  for (const line of lines.slice(0, 6)) {
    if (HEADER_NOISE.test(line) || /www\.|https?:|@|\.com\b/i.test(line)) {
      continue;
    }
    const cleaned = line
      .replace(/[^A-Za-z0-9&'. -]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const letters = (cleaned.match(/[A-Za-z]/g) ?? []).length;
    if (letters < 3 || letters < cleaned.replace(/ /g, "").length * 0.6) {
      continue;
    }
    const name = cleaned === cleaned.toUpperCase() ? titleCase(cleaned) : cleaned;
    return name.slice(0, 40).trim();
  }
  return null;
}

function titleCase(text: string): string {
  return text
    .toLowerCase()
    .replace(/(^|[\s.&-])([a-z])/g, (_, sep: string, ch: string) => sep + ch.toUpperCase());
}
