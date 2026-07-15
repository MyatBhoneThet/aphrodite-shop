import { NextResponse, type NextRequest } from "next/server";
import {
  authenticate,
  getProductById,
  getRelatedProducts,
  patchProduct,
  removeProduct,
} from "@/app/lib/backend";
import { handleRouteError } from "@/app/lib/errors";
import { firstIssueMessage, productUpdateSchema } from "@/app/lib/validation";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const product = await getProductById(Number(id));

  if (!product) {
    return NextResponse.json({ error: "Product not found." }, { status: 404 });
  }

  return NextResponse.json({
    product,
    relatedProducts: await getRelatedProducts(product),
  });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await authenticate(request);
    const { id } = await context.params;
    const parsed = productUpdateSchema.safeParse(await request.json().catch(() => ({})));

    if (!parsed.success) {
      return NextResponse.json({ error: firstIssueMessage(parsed.error) }, { status: 400 });
    }

    const product = await patchProduct(user, Number(id), parsed.data);

    if (!product) {
      return NextResponse.json({ error: "Product not found." }, { status: 404 });
    }

    return NextResponse.json({ product });
  } catch (error) {
    return handleRouteError("products.update", error);
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await authenticate(request);
    const { id } = await context.params;

    await removeProduct(user, Number(id));

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError("products.delete", error);
  }
}
