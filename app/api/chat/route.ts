import { NextResponse, type NextRequest } from "next/server";
import {
  authenticate,
  getCustomerSupportConversation,
  sendCustomerSupportMessage,
} from "@/app/lib/backend";
import { handleRouteError } from "@/app/lib/errors";
import { checkRateLimit } from "@/app/lib/rate-limit";
import { readJsonBody } from "@/app/lib/request";
import {
  firstIssueMessage,
  supportMessageSchema,
} from "@/app/lib/validation";

export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);
    return NextResponse.json(await getCustomerSupportConversation(user));
  } catch (error) {
    return handleRouteError("support.customer.get", error);
  }
}

export async function POST(request: NextRequest) {
  const rateLimit = checkRateLimit(request, "chat");

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many messages. Please wait a moment and try again." },
      { status: 429 }
    );
  }

  try {
    const user = await authenticate(request);
    const parsed = supportMessageSchema.safeParse(await readJsonBody(request));

    if (!parsed.success) {
      return NextResponse.json(
        { error: firstIssueMessage(parsed.error) },
        { status: 400 }
      );
    }

    return NextResponse.json(
      await sendCustomerSupportMessage(user, parsed.data.message),
      { status: 201 }
    );
  } catch (error) {
    return handleRouteError("support.customer.send", error);
  }
}
