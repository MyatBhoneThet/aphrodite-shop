import { NextResponse, type NextRequest } from "next/server";
import {
  authenticate,
  listAdminHelpCases,
  listAdminReturnRequests,
} from "@/app/lib/backend";
import { handleRouteError } from "@/app/lib/errors";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);
    // Both lists in one response: the inbox shows cases and the open return
    // requests side by side, and they refresh together.
    const [cases, requests] = await Promise.all([
      listAdminHelpCases(user),
      listAdminReturnRequests(user),
    ]);

    return NextResponse.json({ cases, requests });
  } catch (error) {
    return handleRouteError("admin.cases.list", error);
  }
}
