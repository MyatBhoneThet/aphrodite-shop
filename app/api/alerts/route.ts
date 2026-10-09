import { NextResponse, after, type NextRequest } from "next/server";
import {
  addProductAlert,
  authenticate,
  getProductAlerts,
} from "@/app/lib/backend";
import { handleRouteError } from "@/app/lib/errors";
import { notifySubscribedProductAlert } from "@/app/lib/product-alert-email";
import { readJsonBody } from "@/app/lib/request";
import { firstIssueMessage, productAlertInputSchema } from "@/app/lib/validation";

export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);
    return NextResponse.json({ alerts: await getProductAlerts(user) });
  } catch (error) {
    return handleRouteError("alerts.list", error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await authenticate(request);
    const parsed = productAlertInputSchema.safeParse(await readJsonBody(request));

    if (!parsed.success) {
      return NextResponse.json(
        { error: firstIssueMessage(parsed.error) },
        { status: 400 }
      );
    }

    const alerts = await addProductAlert(user, parsed.data);
    const { product_id: productId, kind } = parsed.data;
    after(() => notifySubscribedProductAlert(user.id, productId, kind));

    return NextResponse.json({ alerts });
  } catch (error) {
    return handleRouteError("alerts.add", error);
  }
}
