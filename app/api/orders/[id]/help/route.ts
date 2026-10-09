import { NextResponse, type NextRequest } from "next/server";
import { authenticate, openOrderHelpCase } from "@/app/lib/backend";
import { handleRouteError } from "@/app/lib/errors";
import { readJsonBody } from "@/app/lib/request";
import { firstIssueMessage, helpCaseInputSchema } from "@/app/lib/validation";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await authenticate(request);
    const { id } = await context.params;
    const parsed = helpCaseInputSchema.safeParse(await readJsonBody(request));

    if (!parsed.success) {
      return NextResponse.json(
        { error: firstIssueMessage(parsed.error) },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { case: await openOrderHelpCase(user, id, parsed.data) },
      { status: 201 }
    );
  } catch (error) {
    return handleRouteError("orders.help.open", error);
  }
}
