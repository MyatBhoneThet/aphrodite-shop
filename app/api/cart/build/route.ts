import { NextResponse, type NextRequest } from "next/server";
import { addPcBuildToCart, authenticate } from "@/app/lib/backend";
import { handleRouteError } from "@/app/lib/errors";
import { readJsonBody } from "@/app/lib/request";
import { firstIssueMessage, pcBuildCartInputSchema } from "@/app/lib/validation";

export async function POST(request: NextRequest) {
  try {
    const user = await authenticate(request);
    const parsed = pcBuildCartInputSchema.safeParse(await readJsonBody(request));
    if (!parsed.success) {
      return NextResponse.json(
        { error: firstIssueMessage(parsed.error) },
        { status: 400 }
      );
    }
    return NextResponse.json(
      await addPcBuildToCart(user, parsed.data.product_ids, parsed.data.quantity)
    );
  } catch (error) {
    return handleRouteError("cart.build.add", error);
  }
}
