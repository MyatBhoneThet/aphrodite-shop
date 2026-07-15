import { NextResponse, type NextRequest } from "next/server";
import { authenticate } from "@/app/lib/backend";
import { handleRouteError } from "@/app/lib/errors";

export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);
    return NextResponse.json({ profile: user.profile, user: user.profile });
  } catch (error) {
    return handleRouteError("auth.me", error);
  }
}
