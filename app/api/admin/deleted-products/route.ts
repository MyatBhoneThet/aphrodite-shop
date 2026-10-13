import { NextResponse, type NextRequest } from "next/server";
import { authenticate, listDeletedProducts } from "@/app/lib/backend";
import { DELETED_PRODUCT_DAYS } from "@/app/lib/deleted-products";
import { handleRouteError } from "@/app/lib/errors";

/** The "Recently deleted" list: products an admin deleted, still restorable. */
export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);
    const products = await listDeletedProducts(user);
    return NextResponse.json(
      { products, keepDays: DELETED_PRODUCT_DAYS },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    return handleRouteError("admin.deleted-products.list", error);
  }
}
