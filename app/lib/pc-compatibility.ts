import type { Product } from "../data/products";
import {
  classifyPcPart,
  extractMemoryType,
  extractSocket,
  extractSupportedSockets,
  type PcPartKind,
} from "./product-specifications";

export type BuildKind = Exclude<PcPartKind, "other">;
export type PcBuildSelection = Partial<Record<BuildKind, Product>>;

export const REQUIRED_BUILD_KINDS = new Set<BuildKind>(["cpu", "motherboard"]);

function sourceText(product: Product) {
  return [
    product.name,
    product.category,
    ...Object.values(product.specs ?? {}),
    ...Object.values(product.fullSpecs ?? {}),
  ]
    .filter((value): value is string | number => typeof value === "string" || typeof value === "number")
    .join(" ");
}

function formFactor(product: Product) {
  const text = sourceText(product).toUpperCase();
  if (/\b(?:MINI[- ]?ITX|MITX)\b/.test(text)) return "mini-itx";
  if (/\b(?:MICRO[- ]?ATX|M[- ]?ATX)\b/.test(text)) return "micro-atx";
  if (/\b(?:E[- ]?ATX)\b/.test(text)) return "e-atx";
  if (/\bATX\b/.test(text)) return "atx";
  // Motherboard chipsets ending in M are normally Micro-ATX models.
  if (classifyPcPart(product) === "motherboard" && /\b[A-Z]\d{3}M(?:[- ]|\b)/.test(text)) {
    return "micro-atx";
  }
  return "";
}

function caseSupportsBoard(pcCase: Product, board: Product) {
  const boardSize = formFactor(board);
  const caseSize = formFactor(pcCase);
  if (!boardSize || !caseSize) return true;
  const rank: Record<string, number> = {
    "mini-itx": 1,
    "micro-atx": 2,
    atx: 3,
    "e-atx": 4,
  };
  return rank[caseSize] >= rank[boardSize];
}

function wattage(product: Product) {
  const text = sourceText(product).toUpperCase();
  if (/\bRM85E\b/.test(text)) return 850;
  const candidates = Array.from(text.matchAll(/\b(\d{3,4})[A-Z]?\b/g))
    .map((match) => Number(match[1]))
    .filter((value) => value >= 350 && value <= 2000);
  return candidates.length > 0 ? Math.max(...candidates) : 0;
}

function recommendedGpuWattage(product: Product) {
  const text = sourceText(product).toUpperCase();
  const explicit = text.match(/(?:RECOMMENDED\s+PSU|POWER\s+SUPPLY)\D{0,12}(\d{3,4})\s*W/)?.[1];
  if (explicit) return Number(explicit);
  if (/\bRTX\s*5090\b/.test(text)) return 1000;
  if (/\bRTX\s*5080\b/.test(text)) return 850;
  if (/\b(?:RTX\s*5070\s*TI|RX\s*9070\s*XT)\b/.test(text)) return 750;
  if (/\b(?:RTX\s*3080|RTX\s*5070)\b/.test(text)) return 650;
  if (/\b(?:RTX\s*5060\s*TI|ARC\s*A?770)\b/.test(text)) return 600;
  if (/\b(?:RTX\s*5050|RTX\s*5060|RTX\s*4060\s*TI)\b/.test(text)) return 550;
  if (/\bRX\s*5500\s*XT\b/.test(text)) return 450;
  if (/\bGTX\s*950\b/.test(text)) return 350;
  return 0;
}

/** Rejects known incompatibilities; unknown optional-part metadata remains selectable. */
export function isCompatiblePcPart(
  kind: BuildKind,
  candidate: Product,
  selected: PcBuildSelection
) {
  const cpu = selected.cpu;
  const board = selected.motherboard;

  if (kind === "motherboard" && cpu) {
    const cpuSocket = extractSocket(cpu);
    const boardSocket = extractSocket(candidate);
    // A board with no identifiable platform cannot be promised compatible.
    return Boolean(cpuSocket && boardSocket && cpuSocket === boardSocket);
  }

  if (kind === "memory" && board) {
    const boardMemory = extractMemoryType(board);
    const memoryType = extractMemoryType(candidate);
    return !boardMemory || Boolean(memoryType && memoryType === boardMemory);
  }

  if (kind === "cooling" && cpu) {
    const cpuSocket = extractSocket(cpu);
    const supported = extractSupportedSockets(candidate);
    return !cpuSocket || supported.length === 0 || supported.includes(cpuSocket);
  }

  if (kind === "case" && board) return caseSupportsBoard(candidate, board);

  if (kind === "psu" && selected.gpu) {
    const required = recommendedGpuWattage(selected.gpu);
    const available = wattage(candidate);
    return !required || !available || available >= required;
  }

  if (kind === "gpu" && selected.psu) {
    const required = recommendedGpuWattage(candidate);
    const available = wattage(selected.psu);
    return !required || !available || available >= required;
  }

  return true;
}

export function normalizePcBuildSelection(selected: PcBuildSelection) {
  const next: PcBuildSelection = {};
  if (selected.cpu) next.cpu = selected.cpu;
  if (
    selected.motherboard &&
    next.cpu &&
    isCompatiblePcPart("motherboard", selected.motherboard, next)
  ) {
    next.motherboard = selected.motherboard;
  }

  if (!next.cpu || !next.motherboard) return next;

  for (const kind of ["memory", "gpu", "storage", "psu", "case", "cooling"] as const) {
    const product = selected[kind];
    if (product && isCompatiblePcPart(kind, product, next)) next[kind] = product;
  }
  return next;
}

export function pcBuildCompatibilityIssues(products: Product[]) {
  const issues: string[] = [];
  const selected: PcBuildSelection = {};

  for (const product of products) {
    const kind = classifyPcPart(product);
    if (kind === "other") {
      issues.push(`${product.name} is not a recognised PC component.`);
      continue;
    }
    if (selected[kind]) {
      issues.push(`Choose only one ${kind === "cpu" ? "processor" : kind} per PC build.`);
      continue;
    }
    selected[kind] = product;
  }

  if (!selected.cpu) issues.push("A processor is required for every PC build.");
  if (!selected.motherboard) issues.push("A motherboard is required for every PC build.");
  if (issues.length > 0) return issues;

  const normalized = normalizePcBuildSelection(selected);
  for (const [kind, product] of Object.entries(selected) as [BuildKind, Product][]) {
    if (!normalized[kind]) {
      issues.push(`${product.name} is not compatible with the selected processor and motherboard.`);
    }
  }
  return issues;
}
