import { NextResponse, type NextRequest } from "next/server";
import {
  authenticate,
  getProductById,
  getRelatedProducts,
  patchProduct,
  removeProduct,
} from "@/app/lib/backend";

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
    const product = await patchProduct(user, Number(id), await request.json());

    if (!product) {
      return NextResponse.json({ error: "Product not found." }, { status: 404 });
    }

    return NextResponse.json({ product });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update product.";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 400;

    return NextResponse.json({ error: message }, { status });
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
    const message = error instanceof Error ? error.message : "Unable to delete product.";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 400;

    return NextResponse.json({ error: message }, { status });
  }
}
