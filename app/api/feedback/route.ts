import { NextResponse, type NextRequest } from "next/server";
import { authenticate } from "@/app/lib/backend";
import { notFound } from "@/app/lib/errors";
import { handleRouteError } from "@/app/lib/errors";
import { feedbackInputSchema } from "@/app/lib/feedback";
import { readJsonBody } from "@/app/lib/request";
import { firstIssueMessage } from "@/app/lib/validation";
import { upsertSiteFeedback } from "@/app/lib/supabase";

const headers = { "Cache-Control": "private, no-store" };

export async function POST(request: NextRequest) {
  try {
    const user = await authenticate(request);
    const parsed = feedbackInputSchema.safeParse(await readJsonBody(request));
    if (!parsed.success) {
      return NextResponse.json({ error: firstIssueMessage(parsed.error) }, { status: 400, headers });
    }
    const feedback = await upsertSiteFeedback(user.id, parsed.data);
    if (!feedback) throw notFound("Order not found.");
    return NextResponse.json({ feedback }, { status: 201, headers });
  } catch (error) {
    return handleRouteError("feedback.create", error);
  }
}
