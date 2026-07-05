import { NextResponse, type NextRequest } from "next/server";
import { authenticate, createProduct, getProducts } from "@/app/lib/backend";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const products = await getProducts({
    search: searchParams.get("search") ?? searchParams.get("q"),
    type: searchParams.get("type"),
    category: searchParams.get("category"),
    stock:
      searchParams.get("stock") ??
      (searchParams.get("inStock") === "true" ? "In Stock" : null),
  });

  return NextResponse.json({ products });
}

export async function POST(request: NextRequest) {
  try {
    const user = await authenticate(request);
    const product = await createProduct(user, await request.json());

    return NextResponse.json({ product }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create product.";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 400;

    return NextResponse.json({ error: message }, { status });
  }
}
