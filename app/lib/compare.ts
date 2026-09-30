import { effectiveProductPrice } from "./promotions";
import type { Product } from "../data/products";
import { formatProductPrice } from "./format";
import { getProductSpecifications } from "./product-specifications";

/**
 * Comparison table + "which one suits me" logic for /compare.
 *
 * Pure module on purpose -- no React, no fetch -- so every rule below is unit
 * testable and the page only renders what this returns.
 *
 * The honesty rule that shapes this whole file: the catalogue is sheet-driven
 * and most specs arrive as ONE free-text "detail" string, so anything we cannot
 * parse is `null`, never a guess. A use case with nothing to judge on returns
 * no winner and says why instead of picking arbitrarily.
 */

/** Dell shows four columns; past that the table scrolls and stops being
 *  readable on a laptop screen. */
export const COMPARE_LIMIT = 4;

export type MetricKey =
  | "price"
  | "cpu"
  | "gpu"
  | "ram"
  | "storage"
  | "screen"
  | "refresh"
  | "weight"
  | "battery"
  | "vram"
  | "wattage";

export const METRIC_LABELS: Record<MetricKey, string> = {
  price: "Price",
  cpu: "Processor",
  gpu: "Graphics",
  ram: "RAM",
  storage: "Storage",
  screen: "Screen size",
  refresh: "Refresh rate",
  weight: "Weight",
  battery: "Battery",
  vram: "Video memory",
  wattage: "Wattage",
};

/** Metrics where a smaller number is the better one. */
const LOWER_IS_BETTER: MetricKey[] = ["price", "weight"];

function higherIsBetter(metric: MetricKey) {
  return !LOWER_IS_BETTER.includes(metric);
}

// ---------------------------------------------------------------------------
// Reading values out of sheet text
// ---------------------------------------------------------------------------

function normalizedKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** First non-empty value for any of `aliases`, in alias priority order. */
function specValue(product: Product, aliases: string[]) {
  for (const alias of aliases) {
    const wanted = normalizedKey(alias);
    for (const source of [product.fullSpecs, product.specs]) {
      for (const [key, raw] of Object.entries(source ?? {})) {
        if (normalizedKey(key) !== wanted) continue;
        if (typeof raw !== "string" && typeof raw !== "number") continue;
        const text = String(raw).trim();
        if (text && text !== "-") return text;
      }
    }
  }
  return "";
}

function productText(product: Product) {
  return [
    product.name,
    product.brand,
    product.category,
    ...Object.values(product.specs ?? {}),
    ...Object.values(product.fullSpecs ?? {}),
  ]
    .filter(
      (value): value is string | number =>
        typeof value === "string" || typeof value === "number"
    )
    .map(String)
    .join(" • ");
}

function firstNumber(text: string, pattern: RegExp) {
  const match = text.match(pattern);
  if (!match) return null;
  const value = Number.parseFloat(match[1]);
  return Number.isFinite(value) ? value : null;
}

/** Looks in the dedicated spec field first, then the free-text blob. */
function scopedNumber(
  product: Product,
  aliases: string[],
  pattern: RegExp,
  fallback?: RegExp
) {
  const scoped = specValue(product, aliases);
  const direct = scoped ? firstNumber(scoped, pattern) : null;
  if (direct !== null) return direct;
  return fallback ? firstNumber(productText(product), fallback) : null;
}

function parseRamGb(product: Product) {
  // "16GB DDR5", "DDR4 8 GB", "RAM 16GB"
  return scopedNumber(
    product,
    ["ram", "memory"],
    /(\d{1,3})\s*GB/i,
    /(?:\bram\b|\bddr\d\b|\blpddr\d\b|\bmemory\b)[^0-9•]{0,14}(\d{1,3})\s*GB/i
  );
}

function parseStorageGb(product: Product) {
  const scoped = specValue(product, ["storage", "ssd", "hard drive", "capacity"]);
  const text = scoped || productText(product);
  const terabytes = firstNumber(text, /(\d(?:\.\d)?)\s*TB/i);
  if (terabytes !== null) return terabytes * 1024;
  const gigabytes = scoped
    ? firstNumber(scoped, /(\d{3,4})\s*GB/i)
    : firstNumber(text, /(\d{3,4})\s*GB[^0-9•]{0,14}(?:\bssd\b|\bhdd\b|\bnvme\b|\bstorage\b)/i);
  return gigabytes;
}

function parseScreenInches(product: Product) {
  return scopedNumber(
    product,
    ["display", "screen", "screen size"],
    /(\d{2}(?:\.\d)?)\s*(?:inch|"|”)/i,
    /(\d{2}(?:\.\d)?)\s*(?:inch|"|”)/i
  );
}

function parseRefreshHz(product: Product) {
  return scopedNumber(
    product,
    ["refresh rate", "display", "screen"],
    /(\d{2,3})\s*Hz/i,
    /(\d{2,3})\s*Hz/i
  );
}

function parseWeightKg(product: Product) {
  const scoped = specValue(product, ["weight"]);
  const text = scoped || productText(product);
  const kilograms = firstNumber(text, /(\d(?:\.\d+)?)\s*kg/i);
  if (kilograms !== null) return kilograms;
  const grams = firstNumber(text, /(\d{3,4})\s*g\b/i);
  return grams === null ? null : grams / 1000;
}

/**
 * Battery as watt-hours. When only a runtime in hours is published we convert
 * it with a rough 6 Wh-per-hour factor so the two can be ranked together --
 * ranking only. The reason text always quotes the original spec, never this
 * derived number.
 */
function parseBatteryWh(product: Product) {
  const scoped = specValue(product, ["battery", "battery life"]);
  const text = scoped || productText(product);
  const wattHours = firstNumber(text, /(\d{2,3})\s*Wh/i);
  if (wattHours !== null) return wattHours;
  const hours = firstNumber(text, /(\d{1,2}(?:\.\d)?)\s*(?:hours|hrs|hr)\b/i);
  return hours === null ? null : hours * 6;
}

function parseVramGb(product: Product) {
  return scopedNumber(
    product,
    ["vram", "video memory", "memory"],
    /(\d{1,2})\s*GB/i,
    /(\d{1,2})\s*GB\s*GDDR\dX?/i
  );
}

function parseWattage(product: Product) {
  return scopedNumber(product, ["wattage", "power"], /(\d{3,4})\s*W\b/i, /(\d{3,4})\s*W\b/i);
}

/**
 * Rough processor ranking. Deliberately coarse: it orders product tiers
 * (i3 < i5 < i7 < i9) rather than pretending to benchmark exact models, which
 * the sheet text could not support anyway.
 */
function parseCpuScore(product: Product) {
  const text = `${specValue(product, ["processor", "cpu"])} ${product.name}`.toLowerCase();

  // Apple silicon only when there is Apple context -- "M2" also appears in
  // "M.2 SSD" style strings on non-Apple machines.
  if (/\bapple\b|\bmacbook\b|\bmac\b/.test(text)) {
    const generation = text.match(/\bm([1-4])\b/);
    if (generation) {
      const base = 66 + (Number(generation[1]) - 1) * 7;
      if (/\bultra\b/.test(text)) return Math.min(base + 16, 100);
      if (/\bmax\b/.test(text)) return Math.min(base + 12, 100);
      if (/\bpro\b/.test(text)) return Math.min(base + 6, 100);
      return base;
    }
  }

  if (/\bultra\s*9\b/.test(text)) return 88;
  if (/\bultra\s*7\b/.test(text)) return 80;
  if (/\bultra\s*5\b/.test(text)) return 70;
  if (/\bi9\b|\bryzen\s*9\b/.test(text)) return 86;
  if (/\bi7\b|\bryzen\s*7\b/.test(text)) return 76;
  if (/\bi5\b|\bryzen\s*5\b/.test(text)) return 63;
  if (/\bi3\b|\bryzen\s*3\b/.test(text)) return 47;
  if (/\bceleron\b|\bpentium\b|\bathlon\b|\batom\b/.test(text)) return 25;
  return null;
}

/** Same idea for graphics: family + model tier, not a benchmark. */
function parseGpuScore(product: Product) {
  const text = `${specValue(product, ["graphics", "gpu"])} ${product.name}`.toLowerCase();

  const rtx = text.match(/\brtx\s*(\d{4})\b/);
  if (rtx) {
    const model = Number(rtx[1]);
    return Math.min(55 + Math.floor(model / 1000) * 4 + ((model % 1000) / 10) * 0.28, 100);
  }
  const gtx = text.match(/\bgtx\s*(\d{3,4})\b/);
  if (gtx) {
    const model = Number(gtx[1]);
    return 58 + ((model % 1000) / 10) * 0.15;
  }
  const radeon = text.match(/\brx\s*(\d{4})\b/);
  if (radeon) {
    const model = Number(radeon[1]);
    return Math.min(50 + Math.floor(model / 1000) * 4 + ((model % 1000) / 10) * 0.26, 100);
  }

  if (/\biris\s*xe\b/.test(text)) return 38;
  if (/\bradeon\s*graphics\b|\bvega\b/.test(text)) return 35;
  if (/\buhd\s*graphics\b|\bhd\s*graphics\b/.test(text)) return 28;
  if (/\bapple\b|\bmacbook\b/.test(text)) {
    const generation = text.match(/\bm([1-4])\b/);
    if (generation) return 55 + (Number(generation[1]) - 1) * 5;
  }
  return null;
}

/** Numeric value for a metric, or null when the catalogue does not say. */
export function metricValue(product: Product, metric: MetricKey): number | null {
  switch (metric) {
    // Most rows are still unpriced in the sheet, and 0 means "pending", not free.
    case "price":
      return effectiveProductPrice(product) > 0 ? effectiveProductPrice(product) : null;
    case "cpu":
      return parseCpuScore(product);
    case "gpu":
      return parseGpuScore(product);
    case "ram":
      return parseRamGb(product);
    case "storage":
      return parseStorageGb(product);
    case "screen":
      return parseScreenInches(product);
    case "refresh":
      return parseRefreshHz(product);
    case "weight":
      return parseWeightKg(product);
    case "battery":
      return parseBatteryWh(product);
    case "vram":
      return parseVramGb(product);
    case "wattage":
      return parseWattage(product);
  }
}

function shorten(value: string, limit = 52) {
  const text = value.trim();
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}

/** Human evidence for a metric -- quotes the published spec where there is one. */
export function metricEvidence(product: Product, metric: MetricKey): string {
  const value = metricValue(product, metric);

  switch (metric) {
    case "price":
      return formatProductPrice(effectiveProductPrice(product));
    case "cpu":
      return shorten(specValue(product, ["processor", "cpu"])) || "processor in the model name";
    case "gpu":
      return shorten(specValue(product, ["graphics", "gpu"])) || "graphics in the model name";
    case "ram":
      return value === null ? "" : `${value} GB RAM`;
    case "storage":
      return value === null
        ? ""
        : value >= 1024
          ? `${Math.round((value / 1024) * 10) / 10} TB storage`
          : `${value} GB storage`;
    case "screen":
      return value === null ? "" : `${value}" screen`;
    case "refresh":
      return value === null ? "" : `${value} Hz screen`;
    case "weight":
      return value === null ? "" : `${value} kg`;
    case "battery": {
      const published = specValue(product, ["battery", "battery life"]);
      return published ? shorten(published) : "";
    }
    case "vram":
      return value === null ? "" : `${value} GB video memory`;
    case "wattage":
      return value === null ? "" : `${value} W`;
  }
}

// ---------------------------------------------------------------------------
// The comparison table
// ---------------------------------------------------------------------------

export type CompareCell = { productId: number; value: string };

export type CompareRow = {
  label: string;
  cells: CompareCell[];
  /** True when the products do not all say the same thing here. */
  differs: boolean;
  /** Ids holding the best value, when the row can be ranked objectively. */
  winnerIds: number[];
};

/**
 * Rows that can be ranked. "Screen size" is deliberately absent: a bigger
 * screen is better for gaming and worse for carrying, so badging one as the
 * winner would be a judgement call, not a fact.
 */
const WINNER_ROWS: Record<string, MetricKey> = {
  Price: "price",
  Processor: "cpu",
  Graphics: "gpu",
  RAM: "ram",
  Storage: "storage",
  Capacity: "storage",
  Battery: "battery",
  Weight: "weight",
  "Refresh rate": "refresh",
  "Video memory": "vram",
  Wattage: "wattage",
};

function rowWinners(label: string, products: Product[]) {
  const metric = WINNER_ROWS[label];
  if (!metric) return [];

  const scored = products
    .map((product) => ({ id: product.id, value: metricValue(product, metric) }))
    .filter((entry): entry is { id: number; value: number } => entry.value !== null);

  if (scored.length < 2) return [];

  const values = scored.map((entry) => entry.value);
  const best = higherIsBetter(metric) ? Math.max(...values) : Math.min(...values);
  const winners = scored.filter((entry) => entry.value === best);

  // Everybody tying is not a win worth badging.
  return winners.length === scored.length ? [] : winners.map((entry) => entry.id);
}

function comparable(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Builds one aligned row per specification across all selected products.
 *
 * Labels come from getProductSpecifications, so a GPU comparison shows GPU
 * rows and a laptop comparison shows laptop rows -- the old page hardcoded
 * laptop keys and rendered "-" for everything else.
 */
export function buildCompareRows(products: Product[]): CompareRow[] {
  const order = ["Price"];
  const byLabel = new Map<string, Map<number, string>>([
    [
      "Price",
      new Map(products.map((product) => [product.id, formatProductPrice(effectiveProductPrice(product))])),
    ],
  ]);

  for (const product of products) {
    for (const row of getProductSpecifications(product).rows) {
      let values = byLabel.get(row.label);
      if (!values) {
        values = new Map();
        byLabel.set(row.label, values);
        order.push(row.label);
      }
      values.set(product.id, row.value);
    }
  }

  return order.map((label) => {
    const values = byLabel.get(label) ?? new Map<number, string>();
    const cells = products.map((product) => ({
      productId: product.id,
      value: values.get(product.id) ?? "",
    }));
    const present = cells.filter((cell) => cell.value);
    const distinct = new Set(present.map((cell) => comparable(cell.value)));

    return {
      label,
      cells,
      // Either they say different things, or one of them says nothing at all.
      differs: distinct.size > 1 || present.length !== cells.length,
      winnerIds: rowWinners(label, products),
    };
  });
}

// ---------------------------------------------------------------------------
// "Which one suits me?"
// ---------------------------------------------------------------------------

export type UseCaseId =
  | "office"
  | "school"
  | "gaming"
  | "programming"
  | "creative"
  | "travel";

export type UseCaseVerdict = {
  id: UseCaseId;
  title: string;
  blurb: string;
  /** null when the catalogue does not hold enough to answer honestly. */
  winnerId: number | null;
  reasons: string[];
  /** Set whenever the verdict comes with a caveat the shopper should read. */
  note: string | null;
};

export type UseCaseSpec = {
  id: UseCaseId;
  title: string;
  blurb: string;
  weights: Partial<Record<MetricKey, number>>;
  /** Without at least one of these, the verdict would be meaningless. */
  essential: MetricKey[];
  /**
   * A capability floor. Being the best of a bad bunch is not a recommendation
   * -- two office laptops with integrated graphics do not produce a "gaming
   * laptop" just because one scores higher. Below the floor we name the gap
   * instead of crowning a winner.
   */
  floor?: { metric: MetricKey; value: number; message: string };
};

/** Shared with the "Find my laptop" quiz, so the compare page and the quiz
 *  can never disagree about what matters for a given use. */
export const USE_CASES: UseCaseSpec[] = [
  {
    id: "office",
    title: "Office work",
    blurb: "Documents, email, spreadsheets and video calls.",
    weights: { cpu: 0.35, ram: 0.3, storage: 0.2, weight: 0.15 },
    essential: ["cpu", "ram"],
  },
  {
    id: "school",
    title: "School & study",
    blurb: "Lectures, assignments and a full day away from a socket.",
    weights: { battery: 0.3, weight: 0.25, cpu: 0.25, ram: 0.2 },
    essential: ["cpu", "ram", "battery"],
  },
  {
    id: "gaming",
    title: "Gaming",
    blurb: "Frame rates first: graphics card, then processor and screen.",
    weights: { gpu: 0.5, cpu: 0.22, ram: 0.16, refresh: 0.12 },
    essential: ["gpu"],
    floor: {
      metric: "gpu",
      value: 60,
      message:
        "None of these has a separate graphics card, so none of them is a gaming laptop. Look for a model with NVIDIA RTX or AMD RX graphics.",
    },
  },
  {
    id: "programming",
    title: "Programming",
    blurb: "Compilers, containers and a lot of browser tabs.",
    weights: { ram: 0.38, cpu: 0.32, storage: 0.2, screen: 0.1 },
    essential: ["cpu", "ram"],
    floor: {
      metric: "ram",
      value: 8,
      message:
        "None of these lists at least 8 GB of RAM, which is the practical minimum for development work.",
    },
  },
  {
    id: "creative",
    title: "Design & video",
    blurb: "Photo editing, video export and 3D work.",
    weights: { gpu: 0.3, cpu: 0.26, ram: 0.22, screen: 0.12, storage: 0.1 },
    essential: ["cpu", "gpu", "ram"],
    floor: {
      metric: "gpu",
      value: 50,
      message:
        "None of these has a separate graphics card, so photo editing, video export and 3D work will be slow.",
    },
  },
  {
    id: "travel",
    title: "Travel & carry",
    blurb: "Light in the bag, long unplugged days.",
    weights: { weight: 0.45, battery: 0.33, cpu: 0.22 },
    essential: ["weight", "battery"],
  },
];

/** Min-max scales one metric across candidates; nulls stay null. */
function normalize(values: (number | null)[], metric: MetricKey) {
  const present = values.filter((value): value is number => value !== null);
  if (present.length === 0) return values.map(() => null);

  const minimum = Math.min(...present);
  const maximum = Math.max(...present);

  return values.map((value) => {
    if (value === null) return null;
    if (maximum === minimum) return 1;
    const scaled = (value - minimum) / (maximum - minimum);
    return higherIsBetter(metric) ? scaled : 1 - scaled;
  });
}

function listPhrase(items: string[]) {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function verdictFor(useCase: UseCaseSpec, products: Product[]): UseCaseVerdict {
  const base = {
    id: useCase.id,
    title: useCase.title,
    blurb: useCase.blurb,
  };

  if (products.length < 2) {
    return {
      ...base,
      winnerId: null,
      reasons: [],
      note: "Pick at least two laptops to see a verdict here.",
    };
  }

  const metrics = Object.keys(useCase.weights) as MetricKey[];
  const readable = metrics.filter((metric) =>
    products.some((product) => metricValue(product, metric) !== null)
  );

  if (!useCase.essential.some((metric) => readable.includes(metric))) {
    return {
      ...base,
      winnerId: null,
      reasons: [],
      note: `The catalogue does not list ${listPhrase(
        useCase.essential.map((metric) => METRIC_LABELS[metric].toLowerCase())
      )} for these products, so we cannot rank them for this use.`,
    };
  }

  const normalized = new Map(
    readable.map((metric) => [
      metric,
      normalize(
        products.map((product) => metricValue(product, metric)),
        metric
      ),
    ])
  );
  const totalWeight = readable.reduce(
    (sum, metric) => sum + (useCase.weights[metric] ?? 0),
    0
  );
  const scores = products.map((_, index) =>
    readable.reduce(
      (sum, metric) =>
        sum + (useCase.weights[metric] ?? 0) * (normalized.get(metric)?.[index] ?? 0),
      0
    ) / (totalWeight || 1)
  );

  const best = Math.max(...scores);
  if (scores.every((score) => score === best)) {
    return {
      ...base,
      winnerId: null,
      reasons: [],
      note: "These are evenly matched on the specs that matter here.",
    };
  }

  const winnerIndex = scores.indexOf(best);
  const winner = products[winnerIndex];

  // Winning the ranking is not the same as being up to the job.
  if (useCase.floor) {
    const capability = metricValue(winner, useCase.floor.metric);
    if (capability === null || capability < useCase.floor.value) {
      return { ...base, winnerId: null, reasons: [], note: useCase.floor.message };
    }
  }

  // Quote only the metrics the winner actually leads on.
  const reasons = readable
    .filter((metric) => {
      const column = normalized.get(metric);
      if (!column) return false;
      const value = column[winnerIndex];
      if (value === null || value === undefined) return false;
      const others = column.filter((entry): entry is number => entry !== null);
      return others.length > 1 && value >= Math.max(...others);
    })
    .sort((left, right) => (useCase.weights[right] ?? 0) - (useCase.weights[left] ?? 0))
    .map((metric) => metricEvidence(winner, metric))
    .filter(Boolean)
    .slice(0, 3);

  const unreadable = useCase.essential.filter((metric) =>
    products.some((product) => metricValue(product, metric) === null)
  );

  return {
    ...base,
    winnerId: winner.id,
    reasons,
    note: unreadable.length
      ? `Based on what the catalogue lists -- ${listPhrase(
          unreadable.map((metric) => METRIC_LABELS[metric].toLowerCase())
        )} is missing for at least one of these.`
      : null,
  };
}

/**
 * Best pick per use case among the compared products.
 *
 * Intended for laptops; PC parts and accessories do not carry the specs these
 * rules read, so the page only shows this for a laptop comparison.
 */
export function recommendUseCases(products: Product[]): UseCaseVerdict[] {
  return USE_CASES.map((useCase) => verdictFor(useCase, products));
}
