import type { Product } from "../data/products";

export type SpecificationRow = { label: string; value: string };
export type ProductFamily = "laptop" | "pc_part" | "accessory";
export type PcPartKind =
  | "cpu"
  | "motherboard"
  | "memory"
  | "gpu"
  | "storage"
  | "psu"
  | "case"
  | "cooling"
  | "other";

function clean(value: unknown) {
  if (value === null || value === undefined || typeof value === "object") return "";
  const text = String(value).trim();
  return text === "-" || text.toLowerCase() === "n/a" ? "" : text;
}

function normalizedKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function specificationMap(product: Product) {
  const values = new Map<string, string>();
  for (const source of [product.specs, product.fullSpecs]) {
    for (const [key, rawValue] of Object.entries(source ?? {})) {
      const value = clean(rawValue);
      if (value) values.set(normalizedKey(key), value);
    }
  }
  return values;
}

function sourceText(product: Product) {
  return [
    product.name,
    product.brand,
    product.category,
    ...Object.values(product.specs ?? {}),
    ...Object.values(product.fullSpecs ?? {}),
  ]
    .filter(
      (value): value is string | number | boolean =>
        typeof value === "string" || typeof value === "number" || typeof value === "boolean"
    )
    .map(String)
    .join(" • ");
}

function firstValue(values: Map<string, string>, aliases: string[]) {
  for (const alias of aliases) {
    const value = values.get(normalizedKey(alias));
    if (value) return value;
  }
  return "";
}

function extracted(text: string, pattern: RegExp) {
  return clean(text.match(pattern)?.[0]);
}

function addRow(rows: SpecificationRow[], label: string, value: unknown) {
  const cleaned = clean(value);
  if (!cleaned || rows.some((row) => row.label === label || row.value === cleaned)) return;
  rows.push({ label, value: cleaned });
}

export function classifyPcPart(product: Product): PcPartKind {
  const text = `${product.category} ${product.name}`.toLowerCase();
  if (/\b(gpu converter|pc cable|power cable|display cable)\b/.test(text)) return "other";
  if (/\b(gpu|graphics card|video card)\b|geforce|radeon|\brtx\b|\bgtx\b/.test(text)) return "gpu";
  if (/motherboard|mainboard|\bmobo\b/.test(text)) return "motherboard";
  // A product named "CPU cooler" contains the word CPU, so cooling must be
  // detected before the processor rule.
  if (/\b(cpu cooler|cpu cooling|cpu fan|cooler|cooling|aio|heatsink)\b/.test(text)) return "cooling";
  if (/\b(cpu|processor)\b|\bryzen\b|\bcore i[3579]\b/.test(text)) return "cpu";
  if (/\b(ram|memory)\b|\bddr[345]\b/.test(text)) return "memory";
  if (/\b(ssd|hdd|nvme|storage|hard drive)\b/.test(text)) return "storage";
  if (/\b(psu|power supply)\b/.test(text)) return "psu";
  if (/\b(case|chassis)\b/.test(text)) return "case";
  return "other";
}

export function getProductFamily(product: Product): ProductFamily {
  if (product.type === "laptop" || product.sourceSheet === "Laptops") return "laptop";
  if (product.sourceSheet === "Accessories") return "accessory";
  if (product.sourceSheet === "PC Parts" || classifyPcPart(product) !== "other") return "pc_part";
  return "accessory";
}

export function extractSocket(product: Product) {
  const values = specificationMap(product);
  const explicit = (
    firstValue(values, ["socket", "cpu socket", "processor socket"]) ||
    extracted(sourceText(product), /\b(?:AM[345]|LGA\s?\d{3,4}|TRX40|sTRX4)\b/i).replace(/\s+/g, "") ||
    extracted(sourceText(product), /\((?:1151|1200|1700|1851)\)/).replace(/[()]/g, "")
  ).toUpperCase();

  if (explicit) return /^\d{4}$/.test(explicit) ? `LGA${explicit}` : explicit;

  const text = sourceText(product).toUpperCase();

  // The production sheet often contains only a model/chipset name. These
  // platform mappings let the builder reject clear Intel/AMD mismatches
  // without requiring every row to be manually enriched first.
  if (/\b(?:A620|B650E?|B840|B850|X670E?|X870E?)M?\b/.test(text)) return "AM5";
  if (/\b(?:A320|B350|X370|B450|X470|A520|B550|X570)M?\b/.test(text)) return "AM4";
  if (/\b(?:H810|B860|Z890)M?\b/.test(text)) return "LGA1851";
  if (/\b(?:H610|B660|H670|Z690|B760|H770|Z790)M?\b/.test(text)) return "LGA1700";
  if (/\b(?:H410|B460|H470|Z490|H510|B560|H570|Z590)M?\b/.test(text)) return "LGA1200";
  if (/\b(?:H310|B360|B365|H370|Z370|Z390)M?\b/.test(text)) return "LGA1151";

  const ryzenModel = text.match(/\bRYZEN\s+[3579]\s+(\d{4})/i)?.[1];
  if (ryzenModel) {
    const series = Number(ryzenModel[0]);
    if (series >= 7 && series <= 9) return "AM5";
    if (series >= 1 && series <= 5) return "AM4";
  }

  if (/\bCORE\s+ULT(?:RA|ER)\b/.test(text) && /\b2\d{2}K?F?\b/.test(text)) {
    return "LGA1851";
  }

  const intelGeneration = text.match(/\bCORE\s+I[3579][- ]?(\d{4,5})/i)?.[1];
  if (intelGeneration) {
    const generation = intelGeneration.length === 5
      ? Number(intelGeneration.slice(0, 2))
      : Number(intelGeneration[0]);
    if (generation >= 12 && generation <= 14) return "LGA1700";
    if (generation >= 10 && generation <= 11) return "LGA1200";
    if (generation >= 8 && generation <= 9) return "LGA1151";
  }

  return "";
}

export function extractMemoryType(product: Product) {
  const values = specificationMap(product);
  const explicit = (
    firstValue(values, ["memory type", "ram type", "supported memory"]) ||
    extracted(sourceText(product), /\bDDR[345](?:L|X)?\b/i)
  ).toUpperCase();

  if (explicit) return explicit;

  const socket = extractSocket(product);
  if (socket === "AM5" || socket === "LGA1851") return "DDR5";

  const speed = Number(sourceText(product).match(/\b(\d{4,5})\s*(?:MHZ|MT\/S)\b/i)?.[1]);
  if (speed >= 4800) return "DDR5";
  if (speed >= 1600 && speed <= 4400) return "DDR4";
  return "";
}

export function extractSupportedSockets(product: Product) {
  const sockets = sourceText(product)
    .toUpperCase()
    .match(/\b(?:AM[345]|LGA\s?\d{3,4}|TRX40|STRX4)\b/g)
    ?.map((socket) => socket.replace(/\s+/g, "")) ?? [];
  return Array.from(new Set(sockets));
}

function baseRows(product: Product) {
  return [
    { label: "Brand", value: product.brand },
    { label: "Category", value: product.category },
    { label: "Availability", value: product.stock },
  ];
}

function laptopRows(product: Product, values: Map<string, string>) {
  const rows = baseRows(product);
  addRow(rows, "Processor", firstValue(values, ["processor", "cpu"]));
  addRow(rows, "RAM", firstValue(values, ["ram", "memory"]));
  addRow(rows, "Storage", firstValue(values, ["storage", "ssd", "hard drive"]));
  addRow(rows, "Graphics", firstValue(values, ["graphics", "gpu"]));
  addRow(rows, "Display", firstValue(values, ["display", "screen"]));
  addRow(rows, "Battery", firstValue(values, ["battery", "battery life"]));
  addRow(rows, "Weight", firstValue(values, ["weight"]));
  addRow(rows, "Ports", firstValue(values, ["ports", "connectivity"]));
  addRow(rows, "Operating System", firstValue(values, ["operating system", "os"]));
  addRow(rows, "Colour", firstValue(values, ["color", "colour"]));
  addRow(rows, "Condition", firstValue(values, ["condition"]));
  addRow(rows, "Warranty", firstValue(values, ["warranty"]));
  addRow(rows, "Product details", firstValue(values, ["detail", "description"]));
  return rows;
}

function pcPartRows(product: Product, values: Map<string, string>) {
  const rows = baseRows(product);
  const text = sourceText(product);
  const kind = classifyPcPart(product);
  const value = (aliases: string[], pattern?: RegExp) =>
    firstValue(values, aliases) || (pattern ? extracted(text, pattern) : "");

  if (kind === "cpu") {
    addRow(rows, "Socket", extractSocket(product));
    addRow(rows, "Cores", value(["cores", "core count"], /\b\d+\s*cores?\b/i));
    addRow(rows, "Threads", value(["threads", "thread count"], /\b\d+\s*threads?\b/i));
    addRow(rows, "Clock speed", value(["clock", "clock speed", "boost clock"], /\b\d(?:\.\d+)?\s*GHz\b/i));
    addRow(rows, "Architecture", value(["architecture", "series"]));
    addRow(rows, "Integrated graphics", value(["integrated graphics", "graphics"]));
    addRow(rows, "Power / TDP", value(["tdp", "power"], /\b\d{2,3}\s*W\b/i));
  } else if (kind === "motherboard") {
    addRow(rows, "CPU socket", extractSocket(product));
    addRow(rows, "Chipset", value(["chipset"], /\b(?:A|B|H|X|Z)\d{3}[A-Z]*\b/i));
    addRow(rows, "Form factor", value(["form factor", "size"], /\b(?:E-ATX|ATX|Micro-ATX|M-ATX|Mini-ITX|ITX)\b/i));
    addRow(rows, "Memory support", extractMemoryType(product));
    addRow(rows, "Memory slots", value(["memory slots", "ram slots"]));
    addRow(rows, "Expansion slots", value(["expansion slots", "pcie slots"]));
    addRow(rows, "Storage connections", value(["storage", "m2 slots", "sata"]));
    addRow(rows, "Network", value(["network", "lan", "wifi"]));
  } else if (kind === "memory") {
    addRow(rows, "Capacity", value(["capacity", "memory capacity"], /\b\d+\s*GB\b/i));
    addRow(rows, "Memory type", extractMemoryType(product));
    addRow(rows, "Speed", value(["speed", "memory speed"], /\b\d{4,5}\s*(?:MHz|MT\/s)\b/i));
    addRow(rows, "Kit", value(["kit", "modules"], /\b\d\s*[x×]\s*\d+\s*GB\b/i));
    addRow(rows, "Latency", value(["latency", "cas latency"], /\bCL\d+\b/i));
  } else if (kind === "gpu") {
    addRow(rows, "Graphics processor", value(["gpu", "graphics processor", "chipset"]) || product.name);
    addRow(rows, "Video memory", value(["vram", "video memory", "memory"], /\b\d+\s*GB\s*GDDR\dX?\b/i));
    addRow(rows, "Memory type", value(["memory type"], /\bGDDR\dX?\b/i));
    addRow(rows, "Interface", value(["interface", "pcie"], /\bPCIe?\s*(?:Gen\s*)?\d(?:\.\d)?(?:\s*x\d+)?\b/i));
    addRow(rows, "Boost clock", value(["boost clock", "clock speed"]));
    addRow(rows, "Recommended PSU", value(["recommended psu", "power supply"], /\b\d{3,4}\s*W\s*(?:PSU|power supply)?\b/i));
    addRow(rows, "Display outputs", value(["display outputs", "ports", "outputs"]));
    addRow(rows, "Dimensions", value(["dimensions", "length"]));
  } else if (kind === "storage") {
    addRow(rows, "Capacity", value(["capacity", "storage"], /\b\d+(?:\.\d+)?\s*(?:TB|GB)\b/i));
    addRow(rows, "Drive type", value(["drive type", "type"], /\b(?:NVMe|SSD|HDD)\b/i));
    addRow(rows, "Interface", value(["interface"], /\b(?:PCIe\s*\d(?:\.\d)?|SATA\s*(?:III|3)?)\b/i));
    addRow(rows, "Form factor", value(["form factor", "size"], /\b(?:M\.2\s*\d{4}|2\.5-inch|3\.5-inch)\b/i));
    addRow(rows, "Read speed", value(["read speed", "sequential read"]));
    addRow(rows, "Write speed", value(["write speed", "sequential write"]));
  } else if (kind === "psu") {
    addRow(rows, "Wattage", value(["wattage", "power"], /\b\d{3,4}\s*W\b/i));
    addRow(rows, "Efficiency", value(["efficiency", "rating"], /\b80\s*Plus\s*(?:Bronze|Silver|Gold|Platinum|Titanium)?\b/i));
    addRow(rows, "Modularity", value(["modular", "modularity"], /\b(?:fully modular|semi-modular|non-modular)\b/i));
    addRow(rows, "Form factor", value(["form factor"]));
    addRow(rows, "Connectors", value(["connectors", "cables"]));
  } else if (kind === "case") {
    addRow(rows, "Supported motherboard", value(["motherboard support", "form factor"], /\b(?:E-ATX|ATX|Micro-ATX|M-ATX|Mini-ITX|ITX)\b/i));
    addRow(rows, "Case type", value(["case type", "type"], /\b(?:full tower|mid tower|mini tower|SFF)\b/i));
    addRow(rows, "GPU clearance", value(["gpu clearance", "max gpu length"]));
    addRow(rows, "Cooler clearance", value(["cooler clearance", "max cooler height"]));
    addRow(rows, "Included fans", value(["included fans", "fans"]));
    addRow(rows, "Colour", value(["color", "colour"]));
  } else if (kind === "cooling") {
    addRow(rows, "Cooler type", value(["cooler type", "type"], /\b(?:AIO|air cooler|liquid cooler)\b/i));
    addRow(rows, "Socket support", value(["socket support", "socket"]) || extractSocket(product));
    addRow(rows, "Radiator / fan size", value(["radiator size", "fan size"], /\b(?:120|140|240|280|360|420)\s*mm\b/i));
    addRow(rows, "Noise level", value(["noise", "noise level"]));
  }

  addRow(rows, "Warranty", firstValue(values, ["warranty"]));
  addRow(rows, "Product details", firstValue(values, ["detail", "description"]));
  return rows;
}

function accessoryRows(product: Product, values: Map<string, string>) {
  const rows = baseRows(product);
  const text = sourceText(product);
  const category = `${product.category} ${product.name}`.toLowerCase();
  const value = (aliases: string[], pattern?: RegExp) =>
    firstValue(values, aliases) || (pattern ? extracted(text, pattern) : "");

  if (/monitor|display/.test(category)) {
    addRow(rows, "Screen size", value(["screen size", "display size"], /\b\d{2}(?:\.\d)?\s*(?:inch|\")\b/i));
    addRow(rows, "Resolution", value(["resolution"], /\b(?:4K|UHD|QHD|WQHD|FHD|\d{3,4}\s*[x×]\s*\d{3,4})\b/i));
    addRow(rows, "Refresh rate", value(["refresh rate"], /\b\d{2,3}\s*Hz\b/i));
    addRow(rows, "Panel", value(["panel", "panel type"], /\b(?:OLED|Mini-LED|IPS|VA|TN)\b/i));
    addRow(rows, "Response time", value(["response time"], /\b\d(?:\.\d)?\s*ms\b/i));
    addRow(rows, "Ports", value(["ports", "connectivity"]));
  } else if (/mouse/.test(category)) {
    addRow(rows, "Connection", value(["connection", "connectivity", "interface"], /\b(?:wireless|wired|bluetooth|2\.4\s*GHz|USB-C?)\b/i));
    addRow(rows, "Sensor / DPI", value(["sensor", "dpi"], /\b\d{3,6}\s*DPI\b/i));
    addRow(rows, "Buttons", value(["buttons", "button count"]));
    addRow(rows, "Battery", value(["battery", "battery life"]));
  } else if (/keyboard/.test(category)) {
    addRow(rows, "Keyboard type", value(["keyboard type", "type"]));
    addRow(rows, "Switch", value(["switch", "switch type"]));
    addRow(rows, "Layout", value(["layout", "size"]));
    addRow(rows, "Connection", value(["connection", "connectivity", "interface"], /\b(?:wireless|wired|bluetooth|2\.4\s*GHz|USB-C?)\b/i));
    addRow(rows, "Backlight", value(["backlight", "lighting", "rgb"]));
  } else if (/headset|headphone|earphone|speaker/.test(category)) {
    addRow(rows, "Connection", value(["connection", "connectivity", "interface"]));
    addRow(rows, "Driver", value(["driver", "driver size"]));
    addRow(rows, "Microphone", value(["microphone", "mic"]));
    addRow(rows, "Battery", value(["battery", "battery life"]));
  } else {
    addRow(rows, "Model", firstValue(values, ["model", "model number"]));
    addRow(rows, "Connection", value(["connection", "connectivity", "interface"]));
    addRow(rows, "Compatibility", value(["compatibility", "supported devices"]));
    addRow(rows, "Dimensions", value(["dimensions", "size"]));
  }

  addRow(rows, "Colour", firstValue(values, ["color", "colour"]));
  addRow(rows, "Warranty", firstValue(values, ["warranty"]));
  addRow(rows, "Product details", firstValue(values, ["detail", "description"]));
  return rows;
}

export function getProductSpecifications(product: Product) {
  const family = getProductFamily(product);
  const values = specificationMap(product);
  const partKind = classifyPcPart(product);
  const kindLabels: Record<PcPartKind, string> = {
    cpu: "CPU",
    motherboard: "Motherboard",
    memory: "Memory",
    gpu: "Graphics Card",
    storage: "Storage",
    psu: "Power Supply",
    case: "PC Case",
    cooling: "Cooling",
    other: product.category || "PC Part",
  };

  return {
    family,
    title:
      family === "laptop"
        ? "Laptop Specifications"
        : family === "pc_part"
          ? `${kindLabels[partKind]} Specifications`
          : `${product.category || "Accessory"} Specifications`,
    rows:
      family === "laptop"
        ? laptopRows(product, values)
        : family === "pc_part"
          ? pcPartRows(product, values)
          : accessoryRows(product, values),
  };
}
