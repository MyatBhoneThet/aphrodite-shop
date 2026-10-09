import { NextResponse, type NextRequest } from "next/server";
import {
  authenticate,
  changeCustomerPassword,
} from "@/app/lib/backend";
import { handleRouteError } from "@/app/lib/errors";
import { checkRateLimit } from "@/app/lib/rate-limit";
import { readJsonBody } from "@/app/lib/request";
import {
  firstIssueMessage,
  passwordChangeSchema,
} from "@/app/lib/validation";

export async function PATCH(request: NextRequest) {
  const rateLimit = checkRateLimit(request, "login");

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many password attempts. Please try again later." },
      { status: 429 }
    );
  }

  try {
    const user = await authenticate(request);
    const parsed = passwordChangeSchema.safeParse(await readJsonBody(request));

    if (!parsed.success) {
      return NextResponse.json(
        { error: firstIssueMessage(parsed.error) },
        { status: 400 }
      );
    }

    return NextResponse.json(
      await changeCustomerPassword(
        user,
        parsed.data.current_password,
        parsed.data.new_password
      )
    );
  } catch (error) {
    return handleRouteError("settings.password", error);
  }
}
