import { NextResponse, type NextRequest } from "next/server";
import {
  authenticate,
  clearRecentlyViewedProducts,
  getRecentlyViewedProducts,
  recordRecentlyViewedProduct,
} from "@/app/lib/backend";
import { handleRouteError } from "@/app/lib/errors";
import { readJsonBody } from "@/app/lib/request";
import {
  firstIssueMessage,
  recentlyViewedInputSchema,
} from "@/app/lib/validation";

export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);

    return NextResponse.json({
      items: await getRecentlyViewedProducts(user),
    });
  } catch (error) {
    return handleRouteError("recently-viewed.list", error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await authenticate(request);
    const parsed = recentlyViewedInputSchema.safeParse(
      await readJsonBody(request)
    );

    if (!parsed.success) {
      return NextResponse.json(
        { error: firstIssueMessage(parsed.error) },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        items: await recordRecentlyViewedProduct(
          user,
          parsed.data.product_id
        ),
      },
      { status: 201 }
    );
  } catch (error) {
    return handleRouteError("recently-viewed.record", error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await authenticate(request);
    return NextResponse.json(await clearRecentlyViewedProducts(user));
  } catch (error) {
    return handleRouteError("recently-viewed.clear", error);
  }
}
