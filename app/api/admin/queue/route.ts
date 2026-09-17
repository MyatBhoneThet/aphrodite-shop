import { NextResponse, type NextRequest } from "next/server";
import { assignWorkItem, authenticate, getAdminWorkQueue } from "@/app/lib/backend";
import { handleRouteError } from "@/app/lib/errors";
import { readJsonBody } from "@/app/lib/request";
import { adminQueueAssignmentSchema, firstIssueMessage } from "@/app/lib/validation";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);
    return NextResponse.json(await getAdminWorkQueue(user));
  } catch (error) {
    return handleRouteError("admin.queue.list", error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await authenticate(request);
    const parsed = adminQueueAssignmentSchema.safeParse(await readJsonBody(request));

    if (!parsed.success) {
      return NextResponse.json(
        { error: firstIssueMessage(parsed.error) },
        { status: 400 }
      );
    }

    return NextResponse.json({ item: await assignWorkItem(user, parsed.data) });
  } catch (error) {
    return handleRouteError("admin.queue.assign", error);
  }
}
