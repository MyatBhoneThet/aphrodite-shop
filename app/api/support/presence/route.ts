import { NextResponse } from "next/server";
import { getAdminPresence } from "@/app/lib/backend";
import { handleRouteError } from "@/app/lib/errors";

export const runtime = "nodejs";

// Deliberately public: a visitor should be able to see "Admin is online" or
// "Back in 20 minutes" BEFORE deciding to start a conversation or log in.
// It exposes only the shop's own availability -- no customer data.
export async function GET() {
  try {
    return NextResponse.json({ presence: await getAdminPresence() });
  } catch (error) {
    return handleRouteError("support.presence", error);
  }
}
