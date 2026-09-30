import { describe, expect, it } from "vitest";
import type { Product } from "../app/data/products";
import {
  buildCompareRows,
  COMPARE_LIMIT,
  metricValue,
  recommendUseCases,
} from "../app/lib/compare";

function product(overrides: Partial<Product>): Product {
  return {
    id: 1,
    name: "Test laptop",
    type: "laptop",
    sourceSheet: "Laptops",
    category: "Laptop",
    brand: "Test",
    price: 0,
    image: "/products/production-placeholder.svg",
    stock: "In Stock",
    specs: {},
    fullSpecs: {},
    ...overrides,
  };
}

const gamingLaptop = product({
  id: 10,
  name: "Nitro V 15 Gaming",
  price: 3_000_000,
  fullSpecs: {
    processor: "Intel Core i7-13620H",
    ram: "16GB DDR5",
    storage: "512GB NVMe SSD",
    graphics: "NVIDIA GeForce RTX 4060 8GB GDDR6",
    display: "15.6 inch FHD 165Hz",
    weight: "2.1 kg",
    battery: "57Wh",
  },
});

const ultrabook = product({
  id: 11,
  name: "Swift Go 14",
  price: 2_400_000,
  fullSpecs: {
    processor: "Intel Core i5-1335U",
    ram: "8GB LPDDR5",
    storage: "1TB NVMe SSD",
    graphics: "Intel Iris Xe Graphics",
    display: "14 inch FHD 60Hz",
    weight: "1.3 kg",
    battery: "65Wh",
  },
});

describe("spec parsing from sheet free text", () => {
  it("reads RAM, storage, screen and weight", () => {
    expect(metricValue(gamingLaptop, "ram")).toBe(16);
    expect(metricValue(ultrabook, "storage")).toBe(1024);
    expect(metricValue(gamingLaptop, "storage")).toBe(512);
    expect(metricValue(gamingLaptop, "screen")).toBe(15.6);
    expect(metricValue(gamingLaptop, "refresh")).toBe(165);
    expect(metricValue(ultrabook, "weight")).toBe(1.3);
  });

  it("ranks processor and graphics tiers, not exact benchmarks", () => {
    const cpuBetter = metricValue(gamingLaptop, "cpu") ?? 0;
    const cpuWorse = metricValue(ultrabook, "cpu") ?? 0;
    expect(cpuBetter).toBeGreaterThan(cpuWorse);

    const gpuBetter = metricValue(gamingLaptop, "gpu") ?? 0;
    const gpuWorse = metricValue(ultrabook, "gpu") ?? 0;
    expect(gpuBetter).toBeGreaterThan(gpuWorse);
  });

  it("treats a pending price as unknown rather than free", () => {
    expect(metricValue(product({ price: 0 }), "price")).toBeNull();
    expect(metricValue(product({ price: 950_000 }), "price")).toBe(950_000);
  });

  it("returns null instead of guessing when nothing is published", () => {
    const bare = product({ id: 12, name: "Unknown notebook" });
    expect(metricValue(bare, "ram")).toBeNull();
    expect(metricValue(bare, "gpu")).toBeNull();
    expect(metricValue(bare, "battery")).toBeNull();
  });

  it("does not read an M.2 SSD as Apple silicon", () => {
    const withM2Ssd = product({
      id: 13,
      name: "Vivobook 15 with M.2 SSD",
      fullSpecs: { processor: "Intel Core i3-1215U", storage: "512GB M.2 SSD" },
    });
    expect(metricValue(withM2Ssd, "cpu")).toBe(47);
  });
});

describe("comparison rows", () => {
  const rows = buildCompareRows([gamingLaptop, ultrabook]);
  const row = (label: string) => rows.find((entry) => entry.label === label);

  it("puts price first and keeps one cell per product", () => {
    expect(rows[0].label).toBe("Price");
    expect(rows[0].cells.map((cell) => cell.productId)).toEqual([10, 11]);
  });

  it("flags rows that differ and rows that match", () => {
    expect(row("RAM")?.differs).toBe(true);
    expect(row("Availability")?.differs).toBe(false);
  });

  it("counts a value only one product publishes as a difference", () => {
    const sparse = buildCompareRows([
      gamingLaptop,
      product({ id: 14, name: "No specs listed" }),
    ]);
    expect(sparse.find((entry) => entry.label === "RAM")?.differs).toBe(true);
  });

  it("badges the objectively better cell, cheaper winning on price", () => {
    expect(row("RAM")?.winnerIds).toEqual([10]);
    expect(row("Storage")?.winnerIds).toEqual([11]);
    expect(row("Weight")?.winnerIds).toEqual([11]);
    expect(row("Price")?.winnerIds).toEqual([11]);
  });

  it("badges nobody when every product ties", () => {
    const twins = buildCompareRows([
      gamingLaptop,
      product({ ...gamingLaptop, id: 15 }),
    ]);
    expect(twins.find((entry) => entry.label === "RAM")?.winnerIds).toEqual([]);
  });

  it("never badges screen size, where bigger is not simply better", () => {
    expect(row("Display")?.winnerIds).toEqual([]);
  });

  it("uses the right spec vocabulary for PC parts", () => {
    const gpuRows = buildCompareRows([
      product({
        id: 20,
        type: "accessory",
        sourceSheet: "PC Parts",
        name: "ZOTAC GeForce RTX 4070 12GB GDDR6X",
        category: "GPU",
        specs: { detail: "12GB GDDR6X PCIe 4.0" },
      }),
      product({
        id: 21,
        type: "accessory",
        sourceSheet: "PC Parts",
        name: "ZOTAC GeForce RTX 4060 8GB GDDR6",
        category: "GPU",
        specs: { detail: "8GB GDDR6 PCIe 4.0" },
      }),
    ]);
    const labels = gpuRows.map((entry) => entry.label);
    expect(labels).toContain("Video memory");
    expect(labels).not.toContain("Operating System");
    expect(gpuRows.find((entry) => entry.label === "Video memory")?.winnerIds).toEqual([20]);
  });
});

describe("use case verdicts", () => {
  it("caps the comparison at four products", () => {
    expect(COMPARE_LIMIT).toBe(4);
  });

  it("sends gaming to the discrete GPU and travel to the lighter machine", () => {
    const verdicts = recommendUseCases([gamingLaptop, ultrabook]);
    const verdict = (id: string) => verdicts.find((entry) => entry.id === id);

    expect(verdict("gaming")?.winnerId).toBe(10);
    expect(verdict("travel")?.winnerId).toBe(11);
    expect(verdict("gaming")?.reasons.join(" ")).toContain("RTX 4060");
  });

  it("refuses to crown a gaming pick when nothing has a real graphics card", () => {
    const officeLaptopA = product({
      id: 40,
      name: "HP EliteBook 830 G7",
      fullSpecs: {
        processor: "Intel Core i5-10310U",
        ram: "16 GB DDR4-2666 MHz",
        graphics: "Integrated Intel UHD Graphics",
      },
    });
    const officeLaptopB = product({
      id: 41,
      name: "ASUS-EXPERTBOOK P2",
      fullSpecs: {
        processor: "Intel Core i5-10210U",
        ram: "8GB DDR4",
        graphics: "Intel UHD Graphics (Integrated)",
      },
    });

    const verdicts = recommendUseCases([officeLaptopA, officeLaptopB]);
    const verdict = (id: string) => verdicts.find((entry) => entry.id === id);

    expect(verdict("gaming")?.winnerId).toBeNull();
    expect(verdict("gaming")?.note).toContain("separate graphics card");
    expect(verdict("creative")?.winnerId).toBeNull();

    // Office work is still a fair question to answer for these two.
    expect(verdict("office")?.winnerId).toBe(40);
  });

  it("asks for a second product instead of declaring a winner of one", () => {
    const verdicts = recommendUseCases([gamingLaptop]);
    expect(verdicts.every((entry) => entry.winnerId === null)).toBe(true);
    expect(verdicts[0].note).toContain("at least two");
  });

  it("declines to rank when the essential specs are missing", () => {
    const verdicts = recommendUseCases([
      product({ id: 30, name: "Notebook A" }),
      product({ id: 31, name: "Notebook B" }),
    ]);
    const gaming = verdicts.find((entry) => entry.id === "gaming");
    expect(gaming?.winnerId).toBeNull();
    expect(gaming?.note).toContain("cannot rank");
  });

  it("flags a verdict built on incomplete data", () => {
    const verdicts = recommendUseCases([
      gamingLaptop,
      product({
        id: 32,
        name: "Partial specs laptop",
        fullSpecs: { processor: "Intel Core i9-13900H", ram: "32GB DDR5" },
      }),
    ]);
    const travel = verdicts.find((entry) => entry.id === "travel");
    expect(travel?.note).toContain("missing");
  });

  it("says so when two laptops are evenly matched", () => {
    const verdicts = recommendUseCases([
      gamingLaptop,
      product({ ...gamingLaptop, id: 33, name: "Same specs, different box" }),
    ]);
    const office = verdicts.find((entry) => entry.id === "office");
    expect(office?.winnerId).toBeNull();
    expect(office?.note).toContain("evenly matched");
  });
});
