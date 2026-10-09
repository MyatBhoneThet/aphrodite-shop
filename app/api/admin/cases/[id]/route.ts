import { NextResponse, type NextRequest } from "next/server";
import { authenticate, getAdminHelpCase, updateHelpCase } from "@/app/lib/backend";
import { handleRouteError } from "@/app/lib/errors";
import { readJsonBody } from "@/app/lib/request";
import { adminHelpCaseUpdateSchema, firstIssueMessage } from "@/app/lib/validation";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await authenticate(request);
    const { id } = await context.params;
    return NextResponse.json(await getAdminHelpCase(user, id));
  } catch (error) {
    return handleRouteError("admin.cases.get", error);
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await authenticate(request);
    const { id } = await context.params;
    const parsed = adminHelpCaseUpdateSchema.safeParse(await readJsonBody(request));

    if (!parsed.success) {
      return NextResponse.json(
        { error: firstIssueMessage(parsed.error) },
        { status: 400 }
      );
    }

    return NextResponse.json({
      case: await updateHelpCase(user, id, parsed.data),
    });
  } catch (error) {
    return handleRouteError("admin.cases.update", error);
  }
}
