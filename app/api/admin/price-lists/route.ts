import { NextResponse, type NextRequest } from "next/server";
import {
  adminCreatePriceList,
  adminListPriceLists,
  authenticate,
} from "@/app/lib/backend";
import { handleRouteError } from "@/app/lib/errors";
import { readJsonBody } from "@/app/lib/request";
import { firstIssueMessage, priceListInputSchema } from "@/app/lib/validation";

export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);
    return NextResponse.json({ priceLists: await adminListPriceLists(user) });
  } catch (error) {
    return handleRouteError("admin.price-lists.list", error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await authenticate(request);
    const parsed = priceListInputSchema.safeParse(await readJsonBody(request));

    if (!parsed.success) {
      return NextResponse.json(
        { error: firstIssueMessage(parsed.error) },
        { status: 400 }
      );
    }

    const priceList = await adminCreatePriceList(user, parsed.data);

    return NextResponse.json({ priceList }, { status: 201 });
  } catch (error) {
    return handleRouteError("admin.price-lists.create", error);
  }
}
