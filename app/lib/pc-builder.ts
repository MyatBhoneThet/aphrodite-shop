import { effectiveProductPrice } from "./promotions";
import type { Product } from "../data/products";
import {
  classifyPcPart,
  extractMemoryType,
  extractSocket,
  getProductFamily,
  type PcPartKind,
} from "./product-specifications";

export type PcBuildPurpose =
  | "office"
  | "gaming"
  | "streaming"
  | "creative"
  | "development"
  | "3d_rendering";

export type PcBuildInput = {
  minimumBudget: number;
  maximumBudget: number;
  purpose: PcBuildPurpose;
};

export type PcBuildPart = {
  kind: Exclude<PcPartKind, "other">;
  label: string;
  product: Product;
};

export type PcBuildPlan = {
  id: string;
  label: string;
  targetBudget: number;
  total: number;
  parts: PcBuildPart[];
  missing: string[];
  warnings: string[];
  withinRequestedRange: boolean;
};

const partLabels: Record<Exclude<PcPartKind, "other">, string> = {
  cpu: "Processor",
  motherboard: "Motherboard",
  memory: "Memory",
  gpu: "Graphics card",
  storage: "Storage",
  psu: "Power supply",
  case: "PC case",
  cooling: "CPU cooling",
};

const baseKinds: Array<Exclude<PcPartKind, "other">> = [
  "cpu",
  "motherboard",
  "memory",
  "storage",
  "psu",
  "case",
  "cooling",
];

const allocations: Record<
  PcBuildPurpose,
  Partial<Record<Exclude<PcPartKind, "other">, number>>
> = {
  office: { cpu: 0.27, motherboard: 0.16, memory: 0.13, storage: 0.14, psu: 0.1, case: 0.1, cooling: 0.1 },
  gaming: { cpu: 0.2, motherboard: 0.1, memory: 0.08, gpu: 0.4, storage: 0.08, psu: 0.06, case: 0.05, cooling: 0.03 },
  streaming: { cpu: 0.23, motherboard: 0.1, memory: 0.1, gpu: 0.34, storage: 0.09, psu: 0.06, case: 0.05, cooling: 0.03 },
  creative: { cpu: 0.23, motherboard: 0.1, memory: 0.12, gpu: 0.3, storage: 0.11, psu: 0.06, case: 0.05, cooling: 0.03 },
  development: { cpu: 0.3, motherboard: 0.15, memory: 0.18, storage: 0.16, psu: 0.08, case: 0.07, cooling: 0.06 },
  "3d_rendering": { cpu: 0.22, motherboard: 0.09, memory: 0.11, gpu: 0.36, storage: 0.09, psu: 0.06, case: 0.04, cooling: 0.03 },
};

function needsDedicatedGpu(purpose: PcBuildPurpose) {
  return ["gaming", "streaming", "creative", "3d_rendering"].includes(purpose);
}

function candidateGroups(products: Product[]) {
  const groups = new Map<Exclude<PcPartKind, "other">, Product[]>();
  for (const product of products) {
    if (product.stock !== "In Stock" || !Number.isFinite(effectiveProductPrice(product)) || effectiveProductPrice(product) <= 0) continue;
    if (getProductFamily(product) !== "pc_part") continue;
    const kind = classifyPcPart(product);
    if (kind === "other") continue;
    if (
      kind === "memory" &&
      /\b(laptop|so[ -]?dimm)\b/i.test(`${product.category} ${product.name}`)
    ) {
      continue;
    }
    const list = groups.get(kind) ?? [];
    list.push(product);
    groups.set(kind, list);
  }
  for (const list of groups.values()) list.sort((left, right) => effectiveProductPrice(left) - effectiveProductPrice(right));
  return groups;
}

function compatibilityFiltered(
  kind: Exclude<PcPartKind, "other">,
  candidates: Product[],
  selected: PcBuildPart[],
  warnings: string[]
) {
  if (kind === "motherboard") {
    const cpu = selected.find((part) => part.kind === "cpu")?.product;
    const cpuSocket = cpu ? extractSocket(cpu) : "";
    if (cpuSocket) {
      const exact = candidates.filter((product) => extractSocket(product) === cpuSocket);
      if (exact.length) return exact;
      warnings.push(`No motherboard explicitly lists the ${cpuSocket} socket. Confirm CPU and motherboard compatibility with the store.`);
    }
  }
  if (kind === "memory") {
    const board = selected.find((part) => part.kind === "motherboard")?.product;
    const boardMemory = board ? extractMemoryType(board) : "";
    if (boardMemory) {
      const exact = candidates.filter((product) => extractMemoryType(product) === boardMemory);
      if (exact.length) return exact;
      warnings.push(`No memory item explicitly matches ${boardMemory}. Confirm motherboard memory support with the store.`);
    }
  }
  return candidates;
}

function makePlan(
  groups: ReturnType<typeof candidateGroups>,
  input: PcBuildInput,
  label: string,
  targetBudget: number
): PcBuildPlan {
  const weights = allocations[input.purpose];
  const kinds = [...baseKinds];
  if (needsDedicatedGpu(input.purpose)) kinds.splice(3, 0, "gpu");
  const parts: PcBuildPart[] = [];
  const missing: string[] = [];
  const warnings: string[] = [];
  let remaining = targetBudget;

  for (let index = 0; index < kinds.length; index += 1) {
    const kind = kinds[index];
    const available = compatibilityFiltered(kind, groups.get(kind) ?? [], parts, warnings);
    if (!available.length) {
      missing.push(partLabels[kind]);
      continue;
    }

    const remainingKinds = kinds.slice(index + 1);
    const reserve = remainingKinds.reduce((sum, nextKind) => {
      const cheapest = groups.get(nextKind)?.[0];
      return sum + (cheapest ? effectiveProductPrice(cheapest) : 0);
    }, 0);
    const maximumForPart = Math.max(0, remaining - reserve);
    const desired = targetBudget * (weights[kind] ?? 0.05);
    const affordable = available.filter((product) => effectiveProductPrice(product) <= maximumForPart);
    const pool = affordable.length ? affordable : available.slice(0, 1);
    const product = [...pool].sort(
      (left, right) => Math.abs(effectiveProductPrice(left) - desired) - Math.abs(effectiveProductPrice(right) - desired)
    )[0];

    if (product) {
      parts.push({ kind, label: partLabels[kind], product });
      remaining -= effectiveProductPrice(product);
    }
  }

  const total = parts.reduce((sum, part) => sum + effectiveProductPrice(part.product), 0);
  const cpu = parts.find((part) => part.kind === "cpu")?.product;
  const board = parts.find((part) => part.kind === "motherboard")?.product;
  const memory = parts.find((part) => part.kind === "memory")?.product;
  if (cpu && board && !extractSocket(cpu) && !extractSocket(board)) {
    warnings.push("CPU socket information is missing, so socket compatibility needs manual confirmation.");
  }
  if (board && memory && !extractMemoryType(board)) {
    warnings.push("Motherboard memory type is missing, so RAM generation needs manual confirmation.");
  }
  if (needsDedicatedGpu(input.purpose) && !parts.some((part) => part.kind === "gpu")) {
    warnings.push("This use requires a dedicated graphics card, but no in-stock GPU was available in the loaded catalogue.");
  }

  return {
    id: `${label.toLowerCase()}-${parts.map((part) => part.product.id).join("-")}`,
    label,
    targetBudget,
    total,
    parts,
    missing,
    warnings: Array.from(new Set(warnings)),
    withinRequestedRange: total >= input.minimumBudget && total <= input.maximumBudget && missing.length === 0,
  };
}

export function generatePcBuilds(products: Product[], input: PcBuildInput) {
  const minimumBudget = Math.max(0, Math.floor(input.minimumBudget));
  const maximumBudget = Math.max(minimumBudget, Math.floor(input.maximumBudget));
  const safeInput = { ...input, minimumBudget, maximumBudget };
  const groups = candidateGroups(products);
  const targets = [
    ["Value", minimumBudget],
    ["Balanced", Math.round((minimumBudget + maximumBudget) / 2)],
    ["Performance", maximumBudget],
  ] as const;
  const plans = targets.map(([label, target]) => makePlan(groups, safeInput, label, target));
  const seen = new Set<string>();
  return plans.filter((plan) => {
    const signature = plan.parts.map((part) => part.product.id).join(",");
    if (seen.has(signature)) return false;
    seen.add(signature);
    return true;
  });
}

export function countAvailablePcPartCategories(products: Product[]) {
  return candidateGroups(products).size;
}
