import { NextResponse, type NextRequest } from "next/server";
import { authenticate } from "@/app/lib/backend";
import { savedAddressInputSchema } from "@/app/lib/address-book";
import { handleRouteError } from "@/app/lib/errors";
import { readJsonBody } from "@/app/lib/request";
import { firstIssueMessage } from "@/app/lib/validation";
import { insertCustomerAddress, selectCustomerAddresses } from "@/app/lib/supabase";

const headers = { "Cache-Control": "private, no-store" };

export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);
    return NextResponse.json({ addresses: await selectCustomerAddresses(user.id) }, { headers });
  } catch (error) {
    return handleRouteError("addresses.list", error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await authenticate(request);
    const parsed = savedAddressInputSchema.safeParse(await readJsonBody(request));
    if (!parsed.success) {
      return NextResponse.json({ error: firstIssueMessage(parsed.error) }, { status: 400, headers });
    }
    const address = await insertCustomerAddress(user.id, parsed.data);
    return NextResponse.json({ address }, { status: 201, headers });
  } catch (error) {
    return handleRouteError("addresses.create", error);
  }
}
