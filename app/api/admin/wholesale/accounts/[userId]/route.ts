import { NextResponse, type NextRequest } from "next/server";
import { adminUpdateWholesaleAccount, authenticate } from "@/app/lib/backend";
import { handleRouteError } from "@/app/lib/errors";
import { readJsonBody } from "@/app/lib/request";
import {
  firstIssueMessage,
  wholesaleAccountUpdateSchema,
} from "@/app/lib/validation";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ userId: string }> }
) {
  try {
    const user = await authenticate(request);
    const { userId } = await context.params;
    const parsed = wholesaleAccountUpdateSchema.safeParse(await readJsonBody(request));

    if (!parsed.success) {
      return NextResponse.json(
        { error: firstIssueMessage(parsed.error) },
        { status: 400 }
      );
    }

    const profile = await adminUpdateWholesaleAccount(user, userId, parsed.data);

    return NextResponse.json({
      profile: profile
        ? {
            id: profile.id,
            email: profile.email,
            role: profile.role,
            wholesale_status: profile.wholesale_status,
            price_list_id: profile.price_list_id,
          }
        : null,
    });
  } catch (error) {
    return handleRouteError("admin.wholesale.accounts.update", error);
  }
}
