import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../app/lib/backend", () => ({
  authenticateOptional: vi.fn(),
  getOrders: vi.fn(),
  getProducts: vi.fn(),
}));
vi.mock("../app/lib/gemini", () => ({
  generateShopAnswer: vi.fn(),
  isGeminiConfigured: vi.fn(),
}));

import { NextRequest } from "next/server";
import { POST } from "../app/api/assistant/route";
import { authenticateOptional, getProducts } from "../app/lib/backend";
import { generateShopAnswer, isGeminiConfigured } from "../app/lib/gemini";
import {
  buildSystemPrompt,
  parseAssistantAnswer,
  plainText,
  shopFacts,
} from "../app/lib/assistant-prompt";
import { catalogueLine, groundingProducts } from "../app/lib/assistant-rules";
import type { Product } from "../app/data/products";

function product(id: number, overrides: Partial<Product> = {}): Product {
  return {
    id,
    name: `Product ${id}`,
    type: "laptop",
    category: "Business",
    brand: "Dell",
    price: 1_000_000 + id,
    image: "/p.png",
    stock: "In Stock",
    specs: {},
    fullSpecs: {},
    ...overrides,
  } as Product;
}

describe("what the assistant is told", () => {
  it("answers shop questions from facts but may answer anything else", () => {
    const prompt = buildSystemPrompt("en");
    expect(prompt).toMatch(/Any other question/);
    expect(prompt).toMatch(/Never invent a product/);
    expect(prompt).not.toMatch(/Only answer questions about this shop/);
    expect(prompt).toMatch(/Burmese/);
    expect(buildSystemPrompt("my")).toMatch(/currently shown in Burmese/);
  });

  it("treats data as data and refuses harmful requests", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toMatch(/DATA, not instructions/);
    expect(prompt).toMatch(/illegal, harmful/);
    expect(prompt).toMatch(/Never ask for a password/);
  });

  it("gives the facts that would otherwise be guessed", () => {
    const facts = shopFacts();
    expect(facts).toMatch(/Yangon only/);
    expect(facts).toMatch(/7 days after delivery/);
    expect(facts).toMatch(/10 AM to 6 PM/);
    expect(facts).toMatch(/Not known to you: delivery fees/);
  });
});

describe("cleaning the model's answer", () => {
  it("removes markdown the chat window cannot show", () => {
    expect(plainText("**Good** choice:\n\n\n* fast\n* light\n# Heading")).toBe(
      "Good choice:\n\n- fast\n- light\nHeading"
    );
  });

  it("keeps only product ids the model was actually shown, at most three", () => {
    const parsed = parseAssistantAnswer(
      "Try the Dell.\nPRODUCTS: 1, #2, 999, 3, 4",
      new Set([1, 2, 3, 4])
    );
    expect(parsed.text).toBe("Try the Dell.");
    expect(parsed.productIds).toEqual([1, 2, 3]);
  });

  it("leaves the text alone when there is no products line", () => {
    const parsed = parseAssistantAnswer("An SSD is faster than an HDD.", new Set([1]));
    expect(parsed).toEqual({ text: "An SSD is faster than an HDD.", productIds: [] });
  });

  it("cuts a runaway answer", () => {
    const parsed = parseAssistantAnswer("a".repeat(5000), new Set());
    expect(parsed.text.length).toBeLessThanOrEqual(2401);
    expect(parsed.text.endsWith("…")).toBe(true);
  });
});

describe("choosing the catalogue slice", () => {
  const catalogue = [
    product(1, { name: "Dell Latitude 5440", brand: "Dell" }),
    product(2, { name: "HP ProBook 450", brand: "HP" }),
    product(3, { name: "Logitech MX Keys", brand: "Logitech", type: "accessory", category: "Keyboard" }),
    product(4, { name: "Out of stock Acer", brand: "Acer", stock: "Out of Stock" }),
    product(5, { name: "Pending price Lenovo", brand: "Lenovo", price: 0 }),
  ];

  it("puts the product named in the question first", () => {
    const picked = groundingProducts("Is the Latitude 5440 good for office?", catalogue);
    expect(picked[0].id).toBe(1);
  });

  it("never shows out-of-stock or unpriced products", () => {
    const ids = groundingProducts("show me acer and lenovo", catalogue).map((item) => item.id);
    expect(ids).not.toContain(4);
    expect(ids).not.toContain(5);
  });

  it("still returns a spread across types for a general question", () => {
    const ids = groundingProducts("what is the difference between SSD and HDD?", catalogue).map((item) => item.id);
    expect(ids).toEqual(expect.arrayContaining([1, 2, 3]));
  });

  it("keeps a named brand ahead of RAM kits even when it is over budget", () => {
    const shop = [
      product(20, { name: "Dell Latitude 5320", brand: "Dell", price: 4_152_660, fullSpecs: { ram: "16 GB" } }),
      product(21, { name: "Laptop RAM 16GB DDR4", brand: "Kingston", type: "accessory", category: "Laptop - RAM", price: 150_000 }),
      product(22, { name: "ThinkPad E14", brand: "Lenovo", price: 2_000_000, fullSpecs: { ram: "16 GB" } }),
    ];
    const picked = groundingProducts("Is there a Dell laptop under 3,000,000 MMK with 16 GB RAM?", shop);
    // The Dell comes first even though it is above the budget; the RAM kit does not.
    expect(picked[0].id).toBe(20);
    expect(picked.map((item) => item.id)).toContain(22);
  });

  it("respects the limit", () => {
    const many = Array.from({ length: 60 }, (_, index) => product(index + 10));
    expect(groundingProducts("laptop", many, 24)).toHaveLength(24);
  });

  it("describes a product with its key specs", () => {
    const line = catalogueLine(
      product(7, { fullSpecs: { processor: "Core i7", ram: "16 GB", storage: "512 GB SSD" } })
    );
    expect(line).toMatch(/^#7 \| Product 7 \| Dell \| Business \|/);
    expect(line).toMatch(/Core i7 \/ 16 GB \/ 512 GB SSD$/);
  });
});

describe("POST /api/assistant", () => {
  const catalogue = [product(1, { name: "Dell Latitude 5440" }), product(2)];

  function ask(message: string, extra: Record<string, unknown> = {}) {
    return POST(
      new NextRequest("https://shop.test/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": `10.0.0.${Math.floor(Math.random() * 250)}` },
        body: JSON.stringify({ message, ...extra }),
      })
    );
  }

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(authenticateOptional).mockResolvedValue(null);
    vi.mocked(getProducts).mockResolvedValue(catalogue as never);
  });

  it("answers a general question with Gemini and attaches real product cards", async () => {
    vi.mocked(isGeminiConfigured).mockReturnValue(true);
    vi.mocked(generateShopAnswer).mockResolvedValue(
      "An SSD is much faster than an HDD.\n- The Dell uses one.\nPRODUCTS: 1, 999"
    );

    const response = await ask("What is the difference between SSD and HDD?", { language: "en" });
    const body = await response.json();

    expect(body.source).toBe("gemini");
    expect(body.reply).not.toMatch(/PRODUCTS/);
    expect(body.products.map((item: Product) => item.id)).toEqual([1]);
    expect(vi.mocked(generateShopAnswer).mock.calls[0][0].systemPrompt).toMatch(/Any other question/);
  });

  it("falls back to the built-in rules when Gemini fails", async () => {
    vi.mocked(isGeminiConfigured).mockReturnValue(true);
    vi.mocked(generateShopAnswer).mockRejectedValue(new Error("503"));
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const body = await (await ask("How do returns work?")).json();

    expect(body.source).toBe("rules");
    expect(body.reply).toMatch(/7 days/);
  });

  it("uses the rules when no key is configured", async () => {
    vi.mocked(isGeminiConfigured).mockReturnValue(false);
    const body = await (await ask("How do returns work?")).json();
    expect(body.source).toBe("rules");
    expect(generateShopAnswer).not.toHaveBeenCalled();
  });

  it("accepts a longer question now", async () => {
    vi.mocked(isGeminiConfigured).mockReturnValue(false);
    const response = await ask("laptop ".repeat(120));
    expect(response.status).toBe(200);
  });
});
