import { NextResponse, type NextRequest } from "next/server";
import { authenticate, requestReturnReview } from "@/app/lib/backend";
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

    return NextResponse.json({
      request: await requestReturnReview(user, id, parsed.data.note),
    });
  } catch (error) {
    return handleRouteError("returns.review", error);
  }
}
