/**
 * Hardware terms remain in English in Myanmar UI copy. They are more useful
 * to customers when they match product boxes, specification sheets, and the
 * labels used by manufacturers. Only the surrounding explanation is
 * translated into Myanmar.
 */
const ENGLISH_SPECIFICATION_LABELS = new Set([
  "Processor",
  "RAM",
  "Storage",
  "Graphics",
  "Display",
  "Operating System",
  "Socket",
  "Cores",
  "Threads",
  "Clock speed",
  "Architecture",
  "Integrated graphics",
  "Power / TDP",
  "CPU socket",
  "Chipset",
  "Form factor",
  "Memory support",
  "Memory slots",
  "Expansion slots",
  "Storage connections",
  "Network",
  "Capacity",
  "Memory type",
  "Speed",
  "Kit",
  "Latency",
  "Graphics processor",
  "Video memory",
  "Interface",
  "Boost clock",
  "Recommended PSU",
  "Display outputs",
  "Dimensions",
  "Drive type",
  "Read speed",
  "Write speed",
  "Wattage",
  "Efficiency",
  "Modularity",
  "Connectors",
  "Supported motherboard",
  "Case type",
  "GPU clearance",
  "Motherboard",
  "Memory",
  "Graphics Card",
  "Power Supply",
  "PC Case",
  "Cooling",
  "PC Part",
  "Cooler clearance",
  "Included fans",
  "Cooler type",
  "Socket support",
  "Radiator / fan size",
  "Noise level",
  "Screen size",
  "Resolution",
  "Refresh rate",
  "Panel",
  "Response time",
  "Connection",
  "Sensor / DPI",
  "Buttons",
  "Keyboard type",
  "Switch",
  "Layout",
  "Backlight",
  "Driver",
  "Microphone",
  "Model",
  "Compatibility",
]);

const MYANMAR_TECHNICAL_TERMS: Array<[RegExp, string]> = [
  [/ဂရပ်ဖစ် ပရိုဆက်ဆာ/g, "Graphics processor"],
  [/ဂရပ်ဖစ်ကတ်/g, "Graphics card"],
  [/ပါဝါထောက်ပံ့ကိရိယာ/g, "Power supply"],
  [/ကွန်ပျူတာအခွံ/g, "PC case"],
  [/အအေးပေးစနစ်/g, "Cooling"],
  [/သိုလှောင်ကိရိယာ/g, "Storage"],
  [/သိုလှောင်မှု/g, "Storage"],
  [/ပရိုဆက်ဆာ/g, "Processor"],
  [/မားသားဘုတ်/g, "Motherboard"],
  [/မမ်မိုရီ(?:\s*\(RAM\))?/g, "Memory"],
];

export function keepTechnicalTermsEnglish(value: string, source = ""): string {
  if (ENGLISH_SPECIFICATION_LABELS.has(source)) return source;

  const translated = MYANMAR_TECHNICAL_TERMS.reduce(
    (result, [pattern, replacement]) => result.replace(pattern, replacement),
    value
  );

  // Myanmar does not normally use spaces between every word, but a boundary
  // around an English hardware term keeps mixed-language labels readable.
  return translated
    .replace(/([A-Za-z0-9)])([\u1000-\u109f])/g, "$1 $2")
    .replace(/([\u1000-\u109f])([A-Za-z0-9])/g, "$1 $2");
}
