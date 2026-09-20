import { NextResponse, type NextRequest } from "next/server";
import {
  authenticate,
  getCustomerSettings,
  updateCustomerSettings,
} from "@/app/lib/backend";
import { handleRouteError } from "@/app/lib/errors";
import { readJsonBody } from "@/app/lib/request";
import {
  customerSettingsSchema,
  firstIssueMessage,
} from "@/app/lib/validation";

export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);
    return NextResponse.json({ settings: await getCustomerSettings(user) });
  } catch (error) {
    return handleRouteError("settings.get", error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await authenticate(request);
    const parsed = customerSettingsSchema.safeParse(await readJsonBody(request));

    if (!parsed.success) {
      return NextResponse.json(
        { error: firstIssueMessage(parsed.error) },
        { status: 400 }
      );
    }

    return NextResponse.json({
      settings: await updateCustomerSettings(user, parsed.data),
    });
  } catch (error) {
    return handleRouteError("settings.update", error);
  }
}
