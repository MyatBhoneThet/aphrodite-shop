import { NextResponse, type NextRequest } from "next/server";
import {
  advanceItemReturn,
  authenticate,
  decideReturnRequest,
  updateRefundPlan,
} from "@/app/lib/backend";
import { handleRouteError } from "@/app/lib/errors";
import { readJsonBody } from "@/app/lib/request";
import {
  adminReturnRequestMutationSchema,
  firstIssueMessage,
} from "@/app/lib/validation";

export const runtime = "nodejs";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await authenticate(request);
    const { id } = await context.params;
    const parsed = adminReturnRequestMutationSchema.safeParse(
      await readJsonBody(request)
    );

    if (!parsed.success) {
      return NextResponse.json(
        { error: firstIssueMessage(parsed.error) },
        { status: 400 }
      );
    }

    const updated =
      parsed.data.action === "decide"
        ? await decideReturnRequest(user, id, parsed.data)
        : parsed.data.action === "advance"
          ? await advanceItemReturn(user, id, parsed.data)
          : await updateRefundPlan(user, id, parsed.data);

    return NextResponse.json({ request: updated });
  } catch (error) {
    return handleRouteError("admin.returns.update", error);
  }
}
