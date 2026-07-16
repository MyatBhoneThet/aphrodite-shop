import { NextResponse, type NextRequest } from "next/server";
import {
  authenticate,
  authenticateOptional,
  getProductForViewer,
  patchProduct,
  removeProduct,
} from "@/app/lib/backend";
import { handleRouteError } from "@/app/lib/errors";
import { firstIssueMessage, productUpdateSchema } from "@/app/lib/validation";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const viewer = await authenticateOptional(request);
  const quantityParam = Number(request.nextUrl.searchParams.get("quantity") ?? 1);
  const quantity =
    Number.isFinite(quantityParam) && quantityParam > 0 ? quantityParam : 1;

  const result = await getProductForViewer(viewer, Number(id), quantity);

  if (!result) {
    return NextResponse.json({ error: "Product not found." }, { status: 404 });
  }

  return NextResponse.json(result);
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
