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

/**
 * Picks the products worth showing as cards next to an AI answer, and the
 * compact catalogue slice used to ground the model. Only fields a customer can
 * already see are included -- never cost, stock counts or internal notes.
 */
export function groundingProducts(question: string, products: Product[], limit = 24) {
  const { products: ruleMatches } = assistantReply(question, products);
  const available = products.filter(
    (product) => product.stock === "In Stock" && product.price > 0
  );
  const seen = new Set<number>();
  const picked: Product[] = [];

  for (const product of [...(ruleMatches ?? []), ...available]) {
    if (seen.has(product.id)) continue;
    seen.add(product.id);
    picked.push(product);
    if (picked.length >= limit) break;
  }

  return picked;
}

export function catalogueLine(product: Product) {
  return `#${product.id} | ${product.name} | ${product.brand} | ${product.category} | ${formatCurrency(
    product.price
  )}`;
}
