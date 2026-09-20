import { effectiveProductPrice } from "./promotions";
import type { Product } from "../data/products";
import {
  USE_CASES,
  metricEvidence,
  metricValue,
  type MetricKey,
  type UseCaseId,
} from "./compare";
import { getProductFamily } from "./product-specifications";
import { productVariant } from "./product-variants";
import { formatCurrency } from "./format";

/**
 * "Find my laptop" quiz: budget + main use + screen size -> three laptops.
 *
 * Pure module, no React, so every rule is unit testable.
 *
 * The spec parsing and the "what matters for this use" weights are imported
 * from lib/compare.ts rather than redefined -- the compare page and this quiz
 * must never disagree about what makes a laptop good for gaming.
 *
 * Same honesty rule as the compare page: a laptop the catalogue cannot price
 * is never recommended, and when we cannot honour an answer we say so in
 * `notes` instead of quietly returning something that does not fit.
 */

export type ScreenPreference = "any" | "small" | "medium" | "large";

export const SCREEN_CHOICES: {
  id: ScreenPreference;
  label: string;
  hint: string;
  icon: string;
}[] = [
  { id: "any", label: "No preference", hint: "Show me everything", icon: "🙂" },
  { id: "small", label: "Small — 13\" and under", hint: "Easiest to carry", icon: "📒" },
  { id: "medium", label: "Medium — 14\" to 15\"", hint: "The popular size", icon: "💻" },
  { id: "large", label: "Large — 15.6\" and up", hint: "Best big screen", icon: "🖥️" },
];

export type QuizAnswers = {
  budgetMin: number;
  budgetMax: number;
  use: UseCaseId;
  screen: ScreenPreference;
};

export type QuizPick = {
  product: Product;
  /** 1, 2 or 3. */
  rank: number;
  badge: string;
  /** Plain-language reasons, quoting the published spec. */
  reasons: string[];
  /** Set when this pick does not fully match the answers. */
  caveat: string | null;
};

export type QuizResult = {
  picks: QuizPick[];
  /** Honest explanations when the answers could not be fully honoured. */
  notes: string[];
  /** How many priced, in-stock laptops sat inside the budget. */
  inBudgetCount: number;
  /** How many laptops the quiz could consider at all. */
  consideredCount: number;
};

const BADGES = ["Best match", "Great value", "Also consider"];

function screenMatches(inches: number | null, preference: ScreenPreference) {
  // An unknown screen size never disqualifies a laptop; it just cannot earn
  // the size bonus.
  if (preference === "any" || inches === null) return true;
  if (preference === "small") return inches <= 13.9;
  if (preference === "medium") return inches >= 14 && inches < 15.5;
  return inches >= 15.5;
}

function inBudget(price: number, answers: QuizAnswers) {
  return price >= answers.budgetMin && price <= answers.budgetMax;
}

/** Min-max scale, with nulls scoring 0 rather than dropping the candidate. */
function normalize(values: (number | null)[], lowerIsBetter: boolean) {
  const present = values.filter((value): value is number => value !== null);
  if (present.length === 0) return values.map(() => 0);

  const minimum = Math.min(...present);
  const maximum = Math.max(...present);

  return values.map((value) => {
    if (value === null) return 0;
    if (maximum === minimum) return 1;
    const scaled = (value - minimum) / (maximum - minimum);
    return lowerIsBetter ? 1 - scaled : scaled;
  });
}

function reasonsFor(
  product: Product,
  metrics: MetricKey[],
  answers: QuizAnswers
) {
  const reasons = metrics
    .map((metric) => metricEvidence(product, metric))
    .filter(Boolean)
    .slice(0, 3);

  if (inBudget(effectiveProductPrice(product), answers)) {
    reasons.push(`${formatCurrency(effectiveProductPrice(product))} — inside your budget`);
  }

  return reasons.slice(0, 4);
}

export function recommendLaptops(
  products: Product[],
  answers: QuizAnswers
): QuizResult {
  const useCase =
    USE_CASES.find((entry) => entry.id === answers.use) ?? USE_CASES[0];
  const notes: string[] = [];

  // A laptop with no price cannot be matched to a budget, and one that is out
  // of stock cannot be bought -- neither belongs in a buying recommendation.
  const priced = products.filter(
    (product) => getProductFamily(product) === "laptop" && effectiveProductPrice(product) > 0
  );
  const available = priced.filter((product) => product.stock === "In Stock");
  const candidates = available.length > 0 ? available : priced;

  if (available.length === 0 && priced.length > 0) {
    notes.push("None of these is in stock right now — ask us when more arrive.");
  }

  if (candidates.length === 0) {
    return {
      picks: [],
      notes: [
        "No laptop in the catalogue has a price yet, so we cannot match one to your budget. Please contact the shop.",
      ],
      inBudgetCount: 0,
      consideredCount: 0,
    };
  }

  const withinBudget = candidates.filter((product) =>
    inBudget(effectiveProductPrice(product), answers)
  );
  const matchingScreen = withinBudget.filter((product) =>
    screenMatches(metricValue(product, "screen"), answers.screen)
  );

  // Widen the search rather than return nothing, and say that we did.
  let pool = matchingScreen;
  if (pool.length < 3 && withinBudget.length >= 3) {
    pool = withinBudget;
    notes.push(
      "Not enough laptops in your budget match that screen size, so we included other sizes."
    );
  }
  if (pool.length < 3) {
    pool = candidates;
    if (withinBudget.length === 0) {
      notes.push(
        `No laptop falls inside ${formatCurrency(answers.budgetMin)} – ${formatCurrency(
          answers.budgetMax
        )}, so these are the closest we have.`
      );
    } else if (withinBudget.length < 3) {
      notes.push(
        `Only ${withinBudget.length} laptop${withinBudget.length === 1 ? "" : "s"} fits your budget exactly, so we added the nearest others.`
      );
    }
  }

  const metrics = Object.keys(useCase.weights) as MetricKey[];
  const columns = new Map(
    metrics.map((metric) => [
      metric,
      normalize(
        pool.map((product) => metricValue(product, metric)),
        metric === "price" || metric === "weight"
      ),
    ])
  );
  const totalWeight = metrics.reduce(
    (sum, metric) => sum + (useCase.weights[metric] ?? 0),
    0
  );

  // The answers are the shopper's constraints, not hints, so they order the
  // results: budget first, then screen size, and the specification score only
  // decides within a tier. A laptop that misses an answer can still be shown
  // (we always offer three) but never ahead of one that honours it -- a 3.5M
  // laptop must not outrank the 2.5M one when 2.5M is what was asked for.
  const scored = pool.map((product, index) => {
    const fit =
      metrics.reduce(
        (sum, metric) =>
          sum + (useCase.weights[metric] ?? 0) * (columns.get(metric)?.[index] ?? 0),
        0
      ) / (totalWeight || 1);

    const tier =
      (inBudget(effectiveProductPrice(product), answers) ? 2 : 0) +
      (screenMatches(metricValue(product, "screen"), answers.screen) ? 1 : 0);

    return { product, fit, tier };
  });

  scored.sort(
    (left, right) => right.tier - left.tier || right.fit - left.fit
  );

  // Being the best of an unsuitable bunch is not a recommendation.
  if (useCase.floor) {
    const best = metricValue(scored[0]?.product, useCase.floor.metric);
    if (best === null || best < useCase.floor.value) {
      notes.push(useCase.floor.message);
    }
  }

  const topMetrics = metrics
    .filter((metric) => metric !== "price")
    .sort(
      (left, right) => (useCase.weights[right] ?? 0) - (useCase.weights[left] ?? 0)
    );

  // Two versions of one laptop (256 GB / 512 GB) are one recommendation; the
  // better-ranked version stands for both.
  const seenModels = new Set<string>();
  const distinct = scored.filter(({ product }) => {
    const group = productVariant(product)?.group;
    if (!group) return true;
    if (seenModels.has(group)) return false;
    seenModels.add(group);
    return true;
  });

  const picks = distinct.slice(0, 3).map((entry, index) => {
    const caveats: string[] = [];
    if (!inBudget(effectiveProductPrice(entry.product), answers)) {
      caveats.push(
        effectiveProductPrice(entry.product) > answers.budgetMax
          ? "Above your budget"
          : "Below your budget"
      );
    }
    if (
      !screenMatches(metricValue(entry.product, "screen"), answers.screen) &&
      answers.screen !== "any"
    ) {
      caveats.push("different screen size");
    }
    if (entry.product.stock !== "In Stock") caveats.push("out of stock");

    return {
      product: entry.product,
      rank: index + 1,
      badge: BADGES[index] ?? "Also consider",
      reasons: reasonsFor(entry.product, topMetrics, answers),
      caveat: caveats.length > 0 ? caveats.join(" · ") : null,
    };
  });

  return {
    picks,
    notes,
    inBudgetCount: withinBudget.length,
    consideredCount: candidates.length,
  };
}
