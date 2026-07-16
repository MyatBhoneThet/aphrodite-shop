import { NextResponse, type NextRequest } from "next/server";
import { adminDeleteTier, adminUpdateTier, authenticate } from "@/app/lib/backend";
import { handleRouteError } from "@/app/lib/errors";
import { firstIssueMessage, tierUpdateSchema } from "@/app/lib/validation";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await authenticate(request);
    const { id } = await context.params;
    const parsed = tierUpdateSchema.safeParse(
      await request.json().catch(() => ({}))
    );

    if (!parsed.success) {
      return NextResponse.json(
        { error: firstIssueMessage(parsed.error) },
        { status: 400 }
      );
    }

    const tier = await adminUpdateTier(user, id, parsed.data);

    return NextResponse.json({ tier });
  } catch (error) {
    return handleRouteError("admin.tiers.update", error);
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await authenticate(request);
    const { id } = await context.params;

    await adminDeleteTier(user, id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError("admin.tiers.delete", error);
  }
}
