import { NextResponse, type NextRequest } from "next/server";
import { authenticate } from "@/app/lib/backend";
import { handleRouteError } from "@/app/lib/errors";
import { readJsonBody } from "@/app/lib/request";
import { adminGetCompany, adminReviewLicence } from "@/app/lib/wholesale-b2b";

const headers = { "Cache-Control": "private, no-store" };

export async function GET(request: NextRequest, context: { params: Promise<{ userId: string }> }) {
  try {
    const user = await authenticate(request);
    const { userId } = await context.params;
    return NextResponse.json(await adminGetCompany(user, userId), { headers });
  } catch (error) {
    return handleRouteError("admin.company.get", error);
  }
}

/** Verify or reject the licence this account uploaded. */
export async function POST(request: NextRequest, context: { params: Promise<{ userId: string }> }) {
  try {
    const user = await authenticate(request);
    const { userId } = await context.params;
    const body = ((await readJsonBody(request)) ?? {}) as { decision?: unknown; note?: unknown };
    return NextResponse.json({ licence: await adminReviewLicence(user, userId, body) }, { headers });
  } catch (error) {
    return handleRouteError("admin.company.review", error);
  }
}
