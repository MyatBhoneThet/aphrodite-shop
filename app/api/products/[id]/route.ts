import { NextResponse, type NextRequest } from "next/server";
import {
  authenticate,
  authenticateOptional,
  getProductForViewer,
  patchProduct,
  removeProduct,
} from "@/app/lib/backend";
import { handleRouteError } from "@/app/lib/errors";
import { readJsonBody } from "@/app/lib/request";
import {
  firstIssueMessage,
  parseProductIdParam,
  productUpdateSchema,
} from "@/app/lib/validation";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const productId = parseProductIdParam(id);

    if (productId === null) {
      return NextResponse.json({ error: "Product not found." }, { status: 404 });
    }

    const viewer = await authenticateOptional(request);
    const quantityParam = Number(request.nextUrl.searchParams.get("quantity") ?? 1);
    const quantity =
      Number.isFinite(quantityParam) && quantityParam > 0 ? quantityParam : 1;

    const result = await getProductForViewer(viewer, productId, quantity);

    if (!result) {
      return NextResponse.json({ error: "Product not found." }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    return handleRouteError("products.get", error);
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await authenticate(request);
    const { id } = await context.params;
    const productId = parseProductIdParam(id);

    if (productId === null) {
      return NextResponse.json({ error: "Product not found." }, { status: 404 });
    }

    const parsed = productUpdateSchema.safeParse(await readJsonBody(request));

    if (!parsed.success) {
      return NextResponse.json({ error: firstIssueMessage(parsed.error) }, { status: 400 });
    }

    const product = await patchProduct(user, productId, parsed.data);

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
    const productId = parseProductIdParam(id);

    if (productId === null) {
      return NextResponse.json({ error: "Product not found." }, { status: 404 });
    }

    await removeProduct(user, productId);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError("products.delete", error);
  }
}
