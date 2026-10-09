import { NextResponse, type NextRequest } from "next/server";
import {
  authenticate,
  authenticateOptional,
  createProduct,
  getProductsForViewer,
} from "@/app/lib/backend";
import { handleRouteError } from "@/app/lib/errors";
import { readJsonBody } from "@/app/lib/request";
import { firstIssueMessage, productInputSchema } from "@/app/lib/validation";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = searchParams.get("limit");
    const offset = searchParams.get("offset");

    // Viewer-aware response: anonymous/normal viewers get retail data only;
    // approved wholesale accounts additionally get their own price tiers;
    // admins get the full record (legacy wholesale price + inventory count).
    const viewer = await authenticateOptional(request);

    const products = await getProductsForViewer(viewer, {
      search: searchParams.get("search") ?? searchParams.get("q"),
      type: searchParams.get("type"),
      category: searchParams.get("category"),
      sourceSheet: searchParams.get("sourceSheet"),
      stock:
        searchParams.get("stock") ??
        (searchParams.get("inStock") === "true" ? "In Stock" : null),
      limit: limit ? Number(limit) : null,
      offset: offset ? Number(offset) : null,
    });

    return NextResponse.json({ products });
  } catch (error) {
    return handleRouteError("products.list", error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await authenticate(request);
    const parsed = productInputSchema.safeParse(await readJsonBody(request));

    if (!parsed.success) {
      return NextResponse.json({ error: firstIssueMessage(parsed.error) }, { status: 400 });
    }

    const product = await createProduct(user, parsed.data);

    return NextResponse.json({ product }, { status: 201 });
  } catch (error) {
    return handleRouteError("products.create", error);
  }
}
