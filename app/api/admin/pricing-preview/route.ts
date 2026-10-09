import { NextResponse, type NextRequest } from "next/server";
import { adminPricePreview, authenticate } from "@/app/lib/backend";
import { handleRouteError } from "@/app/lib/errors";

// Preview what a given customer type pays: pass price_list_id for a
// wholesale account on that list; omit it for a retail customer.
export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);
    const params = request.nextUrl.searchParams;
    const productId = Number(params.get("product_id"));
    const quantity = Number(params.get("quantity") ?? 1);

    if (!Number.isInteger(productId) || productId <= 0) {
      return NextResponse.json({ error: "product_id is required." }, { status: 400 });
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      return NextResponse.json(
        { error: "quantity must be a positive whole number." },
        { status: 400 }
      );
    }

    const pricing = await adminPricePreview(user, {
      productId,
      quantity,
      priceListId: params.get("price_list_id"),
    });

    return NextResponse.json({ pricing });
  } catch (error) {
    return handleRouteError("admin.pricing-preview", error);
  }
}
