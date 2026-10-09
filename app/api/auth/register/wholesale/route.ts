import { NextResponse, type NextRequest } from "next/server";
import { registerWholesaleAccount } from "@/app/lib/backend";
import { handleRouteError } from "@/app/lib/errors";
import { checkRateLimit } from "@/app/lib/rate-limit";
import { firstIssueMessage, wholesaleRegisterInputSchema } from "@/app/lib/validation";
import { readJsonBody } from "@/app/lib/request";

export const runtime = "nodejs";

// Wholesale (B2B) signup. The client still never sends a role: the one-time
// invite code is the only thing that can grant wholesale pricing, and it is
// verified and consumed server-side.
export async function POST(request: NextRequest) {
  const rateLimit = checkRateLimit(request, "register");

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many registration attempts. Please try again later." },
      { status: 429 }
    );
  }

  try {
    const parsed = wholesaleRegisterInputSchema.safeParse(await readJsonBody(request));

    if (!parsed.success) {
      return NextResponse.json(
        { error: firstIssueMessage(parsed.error) },
        { status: 400 }
      );
    }

    const result = await registerWholesaleAccount(parsed.data);

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleRouteError("auth.register.wholesale", error);
  }
}
