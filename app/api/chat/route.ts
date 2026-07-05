import { NextResponse, type NextRequest } from "next/server";
import { getProducts } from "@/app/lib/backend";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as {
    message?: string;
  };
  const message = body.message?.toLowerCase() ?? "";
  const wantsGaming = message.includes("game") || message.includes("rtx");
  const wantsApple = message.includes("apple") || message.includes("mac");
  const wantsAccessory =
    message.includes("mouse") ||
    message.includes("keyboard") ||
    message.includes("bag") ||
    message.includes("accessory");

  const products = (
    await getProducts({
    type: wantsAccessory ? "accessory" : "laptop",
    query: wantsGaming ? "gaming" : wantsApple ? "macbook" : undefined,
    inStock: true,
    })
  ).slice(0, 3);

  const reply =
    products.length > 0
      ? `I found ${products
          .map((product) => product.name)
          .join(", ")}. These are currently in stock.`
      : "I could not find an in-stock match. Try a different budget, brand, or category.";

  return NextResponse.json({ reply, products });
}
