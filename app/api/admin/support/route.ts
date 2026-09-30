import { NextResponse, type NextRequest } from "next/server";
import {
  authenticate,
  listAdminSupportConversations,
} from "@/app/lib/backend";
import { handleRouteError } from "@/app/lib/errors";

export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);

    return NextResponse.json({
      conversations: await listAdminSupportConversations(user),
    });
  } catch (error) {
    return handleRouteError("support.admin.list", error);
  }
}
