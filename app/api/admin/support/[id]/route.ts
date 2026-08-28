import { NextResponse, type NextRequest } from "next/server";
import {
  authenticate,
  getAdminSupportConversation,
  sendAdminSupportMessage,
  setAdminSupportConversationStatus,
} from "@/app/lib/backend";
import { handleRouteError } from "@/app/lib/errors";
import { checkRateLimit } from "@/app/lib/rate-limit";
import { readJsonBody } from "@/app/lib/request";
import {
  firstIssueMessage,
  supportConversationStatusSchema,
  supportMessageSchema,
} from "@/app/lib/validation";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await authenticate(request);
    const { id } = await context.params;

    return NextResponse.json(
      await getAdminSupportConversation(user, id)
    );
  } catch (error) {
    return handleRouteError("support.admin.get", error);
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const rateLimit = checkRateLimit(request, "chat");

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many messages. Please wait a moment and try again." },
      { status: 429 }
    );
  }

  try {
    const user = await authenticate(request);
    const { id } = await context.params;
    const parsed = supportMessageSchema.safeParse(await readJsonBody(request));

    if (!parsed.success) {
      return NextResponse.json(
        { error: firstIssueMessage(parsed.error) },
        { status: 400 }
      );
    }

    return NextResponse.json(
      await sendAdminSupportMessage(user, id, parsed.data.message),
      { status: 201 }
    );
  } catch (error) {
    return handleRouteError("support.admin.send", error);
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await authenticate(request);
    const { id } = await context.params;
    const parsed = supportConversationStatusSchema.safeParse(
      await readJsonBody(request)
    );

    if (!parsed.success) {
      return NextResponse.json(
        { error: firstIssueMessage(parsed.error) },
        { status: 400 }
      );
    }

    return NextResponse.json({
      conversation: await setAdminSupportConversationStatus(
        user,
        id,
        parsed.data.status
      ),
    });
  } catch (error) {
    return handleRouteError("support.admin.status", error);
  }
}
