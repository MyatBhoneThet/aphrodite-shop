import { NextResponse, type NextRequest } from "next/server";
import {
  authenticate,
  createItemReturnRequest,
  listCustomerReturnRequests,
} from "@/app/lib/backend";
import { handleRouteError } from "@/app/lib/errors";
import { readJsonBody } from "@/app/lib/request";
import { firstIssueMessage, returnRequestInputSchema } from "@/app/lib/validation";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);
    return NextResponse.json({ requests: await listCustomerReturnRequests(user) });
  } catch (error) {
    return handleRouteError("returns.list", error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await authenticate(request);
    const parsed = returnRequestInputSchema.safeParse(await readJsonBody(request));

    if (!parsed.success) {
      return NextResponse.json(
        { error: firstIssueMessage(parsed.error) },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { request: await createItemReturnRequest(user, parsed.data) },
      { status: 201 }
    );
  } catch (error) {
    return handleRouteError("returns.create", error);
  }
}
