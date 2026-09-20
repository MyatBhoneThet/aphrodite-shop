import { NextResponse, type NextRequest } from "next/server";
import { authenticate, getReturnEvidenceUrl } from "@/app/lib/backend";
import { handleRouteError } from "@/app/lib/errors";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string; evidenceId: string }> }
) {
  try {
    const user = await authenticate(request);
    const { id, evidenceId } = await context.params;
    const url = await getReturnEvidenceUrl(user, id, evidenceId);
    return NextResponse.redirect(url);
  } catch (error) {
    return handleRouteError("orders.return-evidence.open", error);
  }
}
