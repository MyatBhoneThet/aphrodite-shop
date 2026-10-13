import { NextResponse, type NextRequest } from "next/server";
import { authenticate, eraseDeletedProduct, restoreProduct } from "@/app/lib/backend";
import { handleRouteError } from "@/app/lib/errors";
import { requireTypedConfirmation } from "@/app/lib/typed-confirmation";
import { parseProductIdParam } from "@/app/lib/validation";

type Context = { params: Promise<{ id: string }> };

/** Restore: puts the product back on the shop with the stock it had. */
export async function POST(request: NextRequest, context: Context) {
  try {
    const user = await authenticate(request);
    const productId = parseProductIdParam((await context.params).id);
    if (productId === null) {
      return NextResponse.json({ error: "Product not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, product: await restoreProduct(user, productId) });
  } catch (error) {
    return handleRouteError("admin.deleted-products.restore", error);
  }
}

/** Delete forever. The request itself must carry the word ERASE. */
export async function DELETE(request: NextRequest, context: Context) {
  try {
    const user = await authenticate(request);
    const productId = parseProductIdParam((await context.params).id);
    if (productId === null) {
      return NextResponse.json({ error: "Product not found." }, { status: 404 });
    }
    await requireTypedConfirmation(request, "ERASE");
    const result = await eraseDeletedProduct(user, productId);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return handleRouteError("admin.deleted-products.erase", error);
  }
}
