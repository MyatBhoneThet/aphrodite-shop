import { NextResponse, type NextRequest } from "next/server";
import { authenticate } from "@/app/lib/backend";

export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);
    return NextResponse.json({ profile: user.profile, user: user.profile });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
