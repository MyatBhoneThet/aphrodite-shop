import { NextResponse, type NextRequest } from "next/server";
import { authenticate } from "@/app/lib/backend";
import { savedAddressInputSchema } from "@/app/lib/address-book";
import { handleRouteError } from "@/app/lib/errors";
import { readJsonBody } from "@/app/lib/request";
import { firstIssueMessage } from "@/app/lib/validation";
import { deleteCustomerAddress, updateCustomerAddress } from "@/app/lib/supabase";

const headers = { "Cache-Control": "private, no-store" };

export async function PATCH(request: NextRequest, context: RouteContext<"/api/addresses/[id]">) {
  try {
    const user = await authenticate(request);
    const { id } = await context.params;
    const parsed = savedAddressInputSchema.safeParse(await readJsonBody(request));
    if (!parsed.success) {
      return NextResponse.json({ error: firstIssueMessage(parsed.error) }, { status: 400, headers });
    }
    const address = await updateCustomerAddress(user.id, id, parsed.data);
    if (!address) return NextResponse.json({ error: "Address not found." }, { status: 404, headers });
    return NextResponse.json({ address }, { headers });
  } catch (error) {
    return handleRouteError("addresses.update", error);
  }
}

export async function DELETE(request: NextRequest, context: RouteContext<"/api/addresses/[id]">) {
  try {
    const user = await authenticate(request);
    const { id } = await context.params;
    const deleted = await deleteCustomerAddress(user.id, id);
    if (!deleted) return NextResponse.json({ error: "Address not found." }, { status: 404, headers });
    return NextResponse.json({ ok: true }, { headers });
  } catch (error) {
    return handleRouteError("addresses.delete", error);
  }
}
