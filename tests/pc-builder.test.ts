import { describe, expect, it } from "vitest";
import type { Product } from "../app/data/products";
import { generatePcBuilds } from "../app/lib/pc-builder";

function part(id: number, category: string, name: string, price: number): Product {
  return {
    id,
    sourceSheet: "PC Parts",
    name,
    type: "accessory",
    category,
    brand: "Demo",
    price,
    image: "/products/production-placeholder.svg",
    stock: "In Stock",
    specs: { detail: name },
    fullSpecs: { detail: name },
  };
}

const completeCatalog = [
  part(1, "CPU", "Ryzen 5 7600 AM5", 12_000),
  part(2, "Motherboard", "B650 ATX AM5 DDR5 Motherboard", 7_000),
  part(3, "RAM", "32GB DDR5 6000MHz Memory", 4_000),
  part(4, "GPU", "GeForce RTX 4060 8GB GDDR6", 20_000),
  part(5, "Storage", "1TB NVMe SSD PCIe 4.0", 4_000),
  part(6, "PSU", "750W 80 Plus Gold Power Supply", 4_000),
  part(7, "Case", "ATX Mid Tower Case", 4_000),
  part(8, "Cooling", "240mm AIO CPU Cooler AM5", 2_000),
];

describe("PC Build Planner", () => {
  it("excludes products with pending prices", () => {
    const plans = generatePcBuilds([part(99, "CPU", "Ryzen 5 AM5", 0)], { minimumBudget: 0, maximumBudget: 6000000, purpose: "gaming" });
    expect(plans.every(plan => plan.parts.every(item => item.product.price > 0))).toBe(true);
  });
  it("generates a complete gaming build inside a 50k–60k range", () => {
    const plans = generatePcBuilds(completeCatalog, {
      minimumBudget: 50_000,
      maximumBudget: 60_000,
      purpose: "gaming",
    });
    expect(plans.length).toBeGreaterThan(0);
    expect(plans[0].parts.map((item) => item.kind)).toEqual(
      expect.arrayContaining(["cpu", "motherboard", "memory", "gpu", "storage", "psu", "case", "cooling"])
    );
    expect(plans[0].total).toBe(57_000);
    expect(plans[0].withinRequestedRange).toBe(true);
  });

  it("explains missing product categories instead of inventing parts", () => {
    const plans = generatePcBuilds(completeCatalog.slice(0, 2), {
      minimumBudget: 50_000,
      maximumBudget: 60_000,
      purpose: "gaming",
    });
    expect(plans[0].missing).toContain("Graphics card");
    expect(plans[0].withinRequestedRange).toBe(false);
  });

  it("does not add a dedicated GPU to an office build", () => {
    const plans = generatePcBuilds(completeCatalog, {
      minimumBudget: 20_000,
      maximumBudget: 50_000,
      purpose: "office",
    });
    expect(plans[0].parts.some((item) => item.kind === "gpu")).toBe(false);
  });

  it("never treats a laptop with a processor name as a standalone CPU", () => {
    const laptop = {
      ...part(50, "Gaming Laptop", "Ryzen 7 RTX Gaming Laptop", 45_000),
      sourceSheet: "Laptops",
      type: "laptop" as const,
    };
    const plans = generatePcBuilds([laptop], {
      minimumBudget: 50_000,
      maximumBudget: 60_000,
      purpose: "gaming",
    });
    expect(plans[0].parts).toHaveLength(0);
    expect(plans[0].missing).toContain("Processor");
  });

  it("does not use laptop SO-DIMM memory in a desktop build", () => {
    const desktopWithoutRam = completeCatalog.filter(
      (product) => product.category !== "RAM"
    );
    const laptopRam = part(
      60,
      "Laptop - RAM",
      "16GB DDR5 SO-DIMM Laptop Memory",
      2_000
    );
    const plans = generatePcBuilds([...desktopWithoutRam, laptopRam], {
      minimumBudget: 50_000,
      maximumBudget: 60_000,
      purpose: "gaming",
    });

    expect(plans[0].missing).toContain("Memory");
    expect(plans[0].parts.some((item) => item.product.id === 60)).toBe(false);
  });
});
