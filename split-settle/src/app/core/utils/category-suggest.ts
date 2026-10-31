import { EXPENSE_CATEGORIES } from "../models/expense.model";

export interface CategorizedText {
  description: string;
  category: string;
}

const KEYWORDS: Record<string, readonly string[]> = {
  Food: [
    "food", "lunch", "dinner", "breakfast", "brunch", "snack", "snacks", "meal", "meals", "restaurant",
    "cafe", "canteen", "mess", "dhaba", "tiffin", "buffet", "dining", "eat", "eating", "coffee", "tea",
    "chai", "juice", "lassi", "pizza", "burger", "biryani", "dosa", "idli", "thali", "paratha", "momo",
    "momos", "maggi", "sandwich", "pasta", "noodle", "noodles", "cake", "dessert", "icecream", "sweets",
    "mithai", "bakery", "swiggy", "zomato", "domino", "dominos", "mcdonalds", "mcd", "kfc", "starbucks",
    "subway", "haldiram", "barbeque", "bbq", "grocery", "groceries", "vegetable", "vegetables", "veggies",
    "fruit", "fruits", "milk", "bread", "egg", "eggs", "chicken", "mutton", "fish", "paneer", "beer",
    "drink", "drinks", "wine", "liquor", "alcohol", "whisky", "vodka", "rum", "pub", "bar", "zepto",
    "blinkit", "bigbasket", "instamart", "dmart", "kirana", "supermarket", "ration",
  ],
  Travel: [
    "travel", "uber", "ola", "rapido", "cab", "taxi", "auto", "rickshaw", "bus", "train", "metro",
    "flight", "flights", "airport", "airline", "indigo", "vistara", "spicejet", "irctc", "railway",
    "petrol", "diesel", "fuel", "toll", "fastag", "parking", "hotel", "hostel", "airbnb", "oyo", "stay",
    "resort", "homestay", "lodge", "visa", "passport", "scooter", "bike", "car", "rental", "ferry",
    "boat", "cruise", "luggage", "makemytrip", "goibibo", "redbus", "yatra", "cleartrip", "tour",
    "sightseeing",
  ],
  Utilities: [
    "electricity", "electric", "water", "wifi", "internet", "broadband", "jio", "airtel", "bsnl",
    "vodafone", "recharge", "mobile", "phone", "postpaid", "prepaid", "lpg", "cylinder", "gas", "rent",
    "maintenance", "society", "maid", "cook", "cleaning", "laundry", "dhobi", "ironing", "repair",
    "plumber", "electrician", "carpenter", "dth", "tatasky", "insurance", "emi", "utilities", "utility",
  ],
  Entertainment: [
    "movie", "movies", "film", "cinema", "pvr", "inox", "bookmyshow", "netflix", "prime", "hotstar",
    "spotify", "youtube", "disney", "jiocinema", "sonyliv", "concert", "show", "party", "club", "game",
    "games", "gaming", "bowling", "karaoke", "museum", "zoo", "amusement", "adventure", "trek",
    "trekking", "rafting", "paragliding", "parasailing", "scuba", "snorkeling", "snorkelling", "safari",
    "sports", "cricket", "football", "match", "turf", "arcade", "casino", "spa", "massage", "event",
    "festival", "fest", "playstation", "xbox",
  ],
};

// Two-word phrases that override an ambiguous single word (e.g. "water" in "water park")
const PHRASES: Record<string, string> = {
  "water park": "Entertainment",
  "theme park": "Entertainment",
  "ice cream": "Food",
  "water bottle": "Food",
  "water bottles": "Food",
  "car rent": "Travel",
  "bike rent": "Travel",
  "scooter rent": "Travel",
};

const STOP_WORDS = new Set([
  "a", "an", "and", "at", "by", "for", "from", "in", "of", "on", "our", "my", "the", "to", "with",
  "paid", "pay", "bill", "day", "trip", "some", "got", "all", "rs", "inr", "rupees",
]);

const KEYWORD_INDEX = new Map<string, string>(
  Object.entries(KEYWORDS).flatMap(([category, words]) => words.map((w) => [w, category] as const)),
);

const KNOWN = new Set(EXPENSE_CATEGORIES.map((c) => c.value));

/**
 * Best-guess category for a description, or null when there is no signal.
 * Combines keyword rules with votes from the group's own earlier expenses.
 */
export function suggestCategory(
  description: string,
  history: readonly CategorizedText[] = [],
): string | null {
  const tokens = tokenize(description);
  if (tokens.length === 0) {
    return null;
  }

  const scores = new Map<string, number>();
  const add = (category: string, points: number) =>
    scores.set(category, (scores.get(category) ?? 0) + points);

  for (let i = 0; i < tokens.length; i++) {
    const category = lookup(tokens[i]);
    if (category) {
      add(category, 3);
    }
    const phrase = i > 0 ? PHRASES[`${tokens[i - 1]} ${tokens[i]}`] : undefined;
    if (phrase) {
      add(phrase, 5);
    }
  }

  const phraseKey = tokens.join(" ");
  const votes = new Map<string, Map<string, number>>();
  for (const past of history) {
    // "Other" is the default, so it usually means nobody picked a category
    if (!KNOWN.has(past.category) || past.category === "Other") {
      continue;
    }
    const pastTokens = tokenize(past.description);
    if (pastTokens.join(" ") === phraseKey) {
      add(past.category, 5);
    }
    for (const token of new Set(pastTokens)) {
      const byCategory = votes.get(token) ?? new Map<string, number>();
      byCategory.set(past.category, (byCategory.get(past.category) ?? 0) + 1);
      votes.set(token, byCategory);
    }
  }
  for (const token of tokens) {
    const byCategory = votes.get(token);
    if (!byCategory) {
      continue;
    }
    const total = [...byCategory.values()].reduce((sum, n) => sum + n, 0);
    byCategory.forEach((n, category) => add(category, (2 * n) / total));
  }

  let best: string | null = null;
  let bestScore = 0;
  scores.forEach((score, category) => {
    if (score > bestScore) {
      best = category;
      bestScore = score;
    }
  });
  return best;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t) && !/^\d+$/.test(t));
}

function lookup(token: string): string | undefined {
  return (
    KEYWORD_INDEX.get(token) ??
    (token.length > 3 && token.endsWith("s") ? KEYWORD_INDEX.get(token.slice(0, -1)) : undefined) ??
    (token.endsWith("es") ? KEYWORD_INDEX.get(token.slice(0, -2)) : undefined)
  );
}
