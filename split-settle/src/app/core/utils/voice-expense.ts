export interface SpokenExpense {
  amount: number | null;
  description: string;
  payerId: number | null;
}

interface Person {
  userId: number;
  name: string;
}

const MULTIPLIERS: Record<string, number> = {
  k: 1_000,
  thousand: 1_000,
  hundred: 100,
  lakh: 100_000,
  lakhs: 100_000,
  lac: 100_000,
};
const CURRENCY = /^(?:rs\.?|inr|rupees?|bucks)$/i;
const AMOUNT_HINT = /^(?:paid|spent|cost|costs|costing|worth|gave|pay|total)$/i;
const PAY_VERB = "(?:paid|spent|gave|bought|covered)";
const LEADING_FILLER =
  /^(?:and|so|just|already|i|we|paid|spent|pay|gave|for|on|towards?|of|add|added|an?|expense|cost|costs|worth|total)\b[\s,]*/i;
const TRAILING_FILLER = /[\s,]*\b(?:for|on|of|paid|spent|and|to|at|with|only)$/i;

/** Turns a phrase like "Meera paid ₹1,200 for scooter rentals" into form values. */
export function parseSpokenExpense(
  transcript: string,
  members: readonly Person[],
  currentUserId: number,
): SpokenExpense {
  let text = transcript
    .replace(/₹\s*/g, " rs ")
    .replace(/(\d),(?=\d)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();

  let payerId: number | null = null;
  const self = new RegExp(`\\b(?:i|me|myself)\\s+(?:just\\s+|already\\s+)?${PAY_VERB}\\b`, "i");
  if (self.test(text)) {
    payerId = currentUserId;
    text = text.replace(self, " ");
  } else {
    // Longest names first, so "Ravi Kumar" wins over another member called "Ravi"
    const names = members
      .flatMap((m) => {
        const full = m.name.trim();
        const first = full.split(/\s+/)[0];
        return first && first !== full ? [{ m, name: full }, { m, name: first }] : [{ m, name: full }];
      })
      .filter((n) => n.name.length > 1)
      .sort((a, b) => b.name.length - a.name.length);
    for (const { m, name } of names) {
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const patterns = [
        new RegExp(`\\b${escaped}\\s+(?:just\\s+|already\\s+)?${PAY_VERB}\\b`, "i"),
        new RegExp(`\\b(?:paid|bought|covered)\\s+by\\s+${escaped}\\b`, "i"),
      ];
      const hit = patterns.find((p) => p.test(text));
      if (hit) {
        payerId = m.userId;
        text = text.replace(hit, " ");
        break;
      }
    }
  }

  let amount: number | null = null;
  let best: { start: number; end: number; score: number; value: number } | null = null;
  for (const match of text.matchAll(/(\d+(?:\.\d+)?)(?:\s*(k|thousand|hundred|lakhs?|lac)\b)?/gi)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    const value = parseFloat(match[1]) * (match[2] ? MULTIPLIERS[match[2].toLowerCase()] : 1);
    const before = text.slice(0, start).trim().split(" ").pop() ?? "";
    const after = text.slice(end).trim().split(" ")[0] ?? "";
    const score = CURRENCY.test(before) || CURRENCY.test(after) ? 3 : AMOUNT_HINT.test(before) ? 2 : 0;
    if (!best || score > best.score || (score === best.score && value > best.value)) {
      best = { start, end, score, value };
    }
  }
  if (best && best.value > 0) {
    amount = Math.round(best.value * 100) / 100;
    text = `${text.slice(0, best.start)} ${text.slice(best.end)}`;
  }

  text = text
    .replace(/\b(?:rs\.?|inr|rupees?|bucks)(?=[\s,.]|$)/gi, " ")
    .replace(/\bsplit\b.*$/i, " ")
    .replace(/\s+/g, " ")
    .trim();
  let previous;
  do {
    previous = text;
    text = text
      .replace(LEADING_FILLER, "")
      .replace(TRAILING_FILLER, "")
      .replace(/^[\s,.;:-]+|[\s,.;:-]+$/g, "");
  } while (text !== previous);

  const description = text.charAt(0).toUpperCase() + text.slice(1);
  return { amount, description: description.slice(0, 255), payerId };
}
