import { NextResponse, type NextRequest } from "next/server";
import { addCustomerNote, getCustomerDetail } from "@/app/lib/admin-ops";
import { authenticate } from "@/app/lib/backend";
import { handleRouteError } from "@/app/lib/errors";
import { readJsonBody } from "@/app/lib/request";

const headers = { "Cache-Control": "private, no-store" };

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await authenticate(request);
    const { id } = await context.params;
    return NextResponse.json(await getCustomerDetail(user, id), { headers });
  } catch (error) {
    return handleRouteError("admin.customers.detail", error);
  }
}

/** Add a private staff note to this customer. */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await authenticate(request);
    const { id } = await context.params;
    return NextResponse.json({ note: await addCustomerNote(user, id, await readJsonBody(request)) }, { status: 201, headers });
  } catch (error) {
    return handleRouteError("admin.customers.note", error);
  }
}
