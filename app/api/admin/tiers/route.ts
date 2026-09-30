import { NextResponse, type NextRequest } from "next/server";
import { adminCreateTier, adminListTiers, authenticate } from "@/app/lib/backend";
import { handleRouteError } from "@/app/lib/errors";
import { readJsonBody } from "@/app/lib/request";
import { firstIssueMessage, tierInputSchema } from "@/app/lib/validation";

export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);
    const priceListId = request.nextUrl.searchParams.get("price_list_id");
    const productIdParam = request.nextUrl.searchParams.get("product_id");
    const productId = productIdParam ? Number(productIdParam) : null;

    const tiers = await adminListTiers(user, {
      priceListId,
      productId: Number.isFinite(productId) ? productId : null,
    });

    return NextResponse.json({ tiers });
  } catch (error) {
    return handleRouteError("admin.tiers.list", error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await authenticate(request);
    const parsed = tierInputSchema.safeParse(await readJsonBody(request));

    if (!parsed.success) {
      return NextResponse.json(
        { error: firstIssueMessage(parsed.error) },
        { status: 400 }
      );
    }

    const tier = await adminCreateTier(user, parsed.data);

    return NextResponse.json({ tier }, { status: 201 });
  } catch (error) {
    return handleRouteError("admin.tiers.create", error);
  }
}
