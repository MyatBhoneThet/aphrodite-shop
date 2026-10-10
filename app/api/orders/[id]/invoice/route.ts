import { NextResponse, type NextRequest } from "next/server";
import { authenticate } from "@/app/lib/backend";
import { handleRouteError } from "@/app/lib/errors";
import { getInvoice } from "@/app/lib/wholesale-b2b";

/** Proforma invoice (before payment is checked) or invoice (after), for a wholesale order. */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await authenticate(request);
    const { id } = await context.params;
    return NextResponse.json(await getInvoice(user, id), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return handleRouteError("orders.invoice", error);
  }
}
