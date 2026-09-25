import { NextResponse, after, type NextRequest } from "next/server";
import {
  authenticate,
  notifyReturnProgress,
  requestReturnReview,
} from "@/app/lib/backend";
import { handleRouteError } from "@/app/lib/errors";
import { readJsonBody } from "@/app/lib/request";
import { firstIssueMessage, returnReviewRequestSchema } from "@/app/lib/validation";

export const runtime = "nodejs";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await authenticate(request);
    const { id } = await context.params;
    const parsed = returnReviewRequestSchema.safeParse(await readJsonBody(request));

    if (!parsed.success) {
      return NextResponse.json(
        { error: firstIssueMessage(parsed.error) },
        { status: 400 }
      );
    }

    const updated = await requestReturnReview(user, id, parsed.data.note);
    if (updated) {
      after(() => notifyReturnProgress(id, "requested", "review-requested"));
    }

    return NextResponse.json({ request: updated });
  } catch (error) {
    return handleRouteError("returns.review", error);
  }
}
