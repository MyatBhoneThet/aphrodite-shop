import { NextResponse, type NextRequest } from "next/server";
import { adminUpdatePriceList, authenticate } from "@/app/lib/backend";
import { handleRouteError } from "@/app/lib/errors";
import { readJsonBody } from "@/app/lib/request";
import { firstIssueMessage, priceListUpdateSchema } from "@/app/lib/validation";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await authenticate(request);
    const { id } = await context.params;
    const parsed = priceListUpdateSchema.safeParse(await readJsonBody(request));

    if (!parsed.success) {
      return NextResponse.json(
        { error: firstIssueMessage(parsed.error) },
        { status: 400 }
      );
    }

    const priceList = await adminUpdatePriceList(user, id, parsed.data);

    return NextResponse.json({ priceList });
  } catch (error) {
    return handleRouteError("admin.price-lists.update", error);
  }
}
