// Free, offline rule engine for the "Instant help" assistant.
//
// Extracted unchanged from ChatbotButton.tsx so it can run in two places:
//   * the browser, for instant answers with no network round-trip;
//   * the server, as the fallback whenever GEMINI_API_KEY is missing or the
//     Gemini call fails -- the assistant must never go dead just because an
//     external provider is unavailable.
//
// Deliberately has no React and no "use client" so the route handler can
// import it.
import type { Product } from "../data/products";
import { formatCurrency } from "./format";

export const quickQuestions = [
  "Recommend a laptop",
  "Build a MMK 6,700,000 PC",
  "How do returns work?",
  "SSD or HDD: which is better?",
  "Show Acer products",
];

export type AssistantReply = { body: string; products?: Product[] };

export function assistantReply(question: string, products: Product[]): AssistantReply {
  const text = question.toLowerCase();
  const available = products.filter(
    (product) => product.stock === "In Stock" && product.price > 0
  );
  const brand = Array.from(new Set(products.map((product) => product.brand))).find(
    (value) => text.includes(value.toLowerCase())
  );
  let matches: Product[] = [];

  if (brand) matches = available.filter((product) => product.brand === brand);
  else if (/gaming|game|graphics|gpu/.test(text))
    matches = available.filter(
      (product) =>
        product.type === "laptop" &&
        /gaming|rtx|radeon|geforce/i.test(
          `${product.name} ${product.category} ${product.fullSpecs.graphics ?? ""}`
        )
    );
  else if (/student|school|office|work|laptop|recommend/.test(text))
    matches = available.filter((product) => product.type === "laptop");
  else if (/accessor|mouse|keyboard|bag|head/.test(text))
    matches = available.filter((product) => product.type === "accessory");

  const budget = Number(text.replaceAll(",", "").match(/\d{5,}/)?.[0] ?? 0);
  if (budget > 0)
    matches = (matches.length ? matches : available).filter(
      (product) => product.price <= budget
    );
  matches = matches.sort((left, right) => left.price - right.price).slice(0, 3);

  if (/return|wrong|defect|error|broken|color|colour|storage/.test(text))
    return {
      body: "You can request a return from My Orders within 7 days after delivery. Choose the exact problem, then select courier pickup or store drop-off. The refund is recorded only after the machine is received and inspected.",
    };
  if (/build.*pc|pc.*build|computer.*budget/.test(text))
    return {
      body: "Open the PC Build Planner from the header. Enter your minimum and maximum budget (for example MMK 6,700,000–8,040,000) and choose gaming, office, development, streaming, creative, or 3D work. It will generate demo parts lists from current in-stock PC parts.",
    };
  if (/receipt|invoice/.test(text))
    return {
      body: "Your digital receipt appears in My Orders after an administrator confirms the order. Open it and choose Print / Save PDF. A confirmation email is also sent when email delivery is configured.",
    };
  if (/deliver|shipping|arrive|track/.test(text))
    return {
      body: "Open My Orders to see Pending, Confirmed, Shipped, or Delivered status. For a specific delivery time, use Live support so the admin team can check your order.",
    };
  if (/cancel|out of stock/.test(text))
    return {
      body: "Pending or confirmed orders can be cancelled. Customers can send a cancellation request, and administrators can cancel directly when stock is unavailable. Reserved stock is restored automatically.",
    };
  if (matches.length)
    return {
      body: `These in-stock choices look relevant${
        budget ? ` for a budget up to ${formatCurrency(budget)}` : ""
      }. Open a product to compare its full specifications.`,
      products: matches,
    };

  return {
    body: "I can help with product recommendations, Acer and other brands, receipts, order tracking, cancellation, and returns. Tell me what the laptop is for and your approximate budget, or switch to Live support for a person.",
  };
}

const STOP_WORDS = new Set([
  "the", "and", "for", "with", "that", "this", "what", "which", "have", "has", "does", "you",
  "your", "can", "are", "how", "not", "from", "about", "need", "want", "best", "good", "any",
  "show", "tell", "give", "please", "much", "price", "cost", "buy", "get", "one", "some",
  "there", "will", "would", "should", "could", "between", "better", "than", "like",
]);

function wordsOf(text: string) {
  return Array.from(
    new Set(
      text
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((word) => word.length >= 3 && !STOP_WORDS.has(word))
    )
  );
}

function specText(product: Product) {
  return [
    product.fullSpecs.processor ?? product.specs.cpu,
    product.fullSpecs.ram ?? product.specs.ram,
    product.fullSpecs.storage ?? product.specs.storage,
    product.fullSpecs.graphics,
    product.fullSpecs.display ?? product.specs.display,
  ]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map((value) => value.trim().slice(0, 40));
}

/**
 * Picks the catalogue slice the model is shown (and the cards that can sit
 * beside its answer). Products that match words in the question come first, so
 * "is the Dell Latitude 5440 good for office work?" really sees that Dell; the
 * rest is a spread across product types so a general question still has
 * something real to point at. Only fields a customer can already see are
 * included -- never cost, stock counts or internal notes.
 */
export function groundingProducts(question: string, products: Product[], limit = 24) {
  const { products: ruleMatches } = assistantReply(question, products);
  const available = products.filter(
    (product) => product.stock === "In Stock" && product.price > 0
  );
  const wanted = wordsOf(question);
  const ruleIds = new Set((ruleMatches ?? []).map((product) => product.id));
  const budget = Number(question.toLowerCase().replaceAll(",", "").match(/\d{5,}/)?.[0] ?? 0);
  const asksForLaptop = wanted.includes("laptop") || wanted.includes("notebook") || wanted.includes("laptops");

  const relevant = available
    .map((product) => {
      const name = product.name.toLowerCase();
      const brand = product.brand.toLowerCase();
      const rest = `${product.category} ${specText(product).join(" ")}`.toLowerCase();
      let score = ruleIds.has(product.id) ? 4 : 0;
      for (const word of wanted) {
        // A brand the customer named outranks a spec word that RAM kits and
        // SSDs also contain ("16 GB RAM" appears in many accessory names).
        if (brand.includes(word)) score += 6;
        else if (name.includes(word)) score += 3;
        else if (rest.includes(word)) score += 1;
      }
      // "laptop" means the machines, not the parts whose category says "Laptop - RAM".
      if (asksForLaptop) score += product.type === "laptop" ? 3 : -3;
      // Over budget stays visible: "nothing under 3 million, the cheapest is..." is a useful answer.
      if (score > 0 && budget > 0) score += product.price <= budget ? 1 : -1;
      return { product, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.product.price - b.product.price)
    .map((entry) => entry.product);

  const picked: Product[] = [];
  const seen = new Set<number>();
  const add = (product: Product) => {
    if (seen.has(product.id) || picked.length >= limit) return;
    seen.add(product.id);
    picked.push(product);
  };

  relevant.slice(0, Math.ceil(limit * 0.75)).forEach(add);

  // Fill the remaining room round-robin by type, cheapest first.
  const byType = new Map<string, Product[]>();
  for (const product of [...available].sort((a, b) => a.price - b.price)) {
    const list = byType.get(product.type) ?? [];
    list.push(product);
    byType.set(product.type, list);
  }
  const lists = [...byType.values()];
  for (let index = 0; picked.length < limit && lists.some((list) => index < list.length); index += 1) {
    for (const list of lists) if (index < list.length) add(list[index]);
  }

  return picked;
}

export function catalogueLine(product: Product) {
  const specs = specText(product).join(" / ");

  return `#${product.id} | ${product.name} | ${product.brand} | ${product.category} | ${formatCurrency(
    product.price
  )}${specs ? ` | ${specs}` : ""}`;
}
