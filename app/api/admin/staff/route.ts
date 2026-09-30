import { NextResponse, type NextRequest } from "next/server";
import { adminGrantStaff, adminListStaff, authenticate } from "@/app/lib/backend";
import { badRequest, handleRouteError } from "@/app/lib/errors";
import { readJsonBody } from "@/app/lib/request";

export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);
    return NextResponse.json({ staff: await adminListStaff(user) });
  } catch (error) {
    return handleRouteError("admin.staff.list", error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await authenticate(request);
    const body = (await readJsonBody(request)) as { email?: unknown } | null;
    const email = typeof body?.email === "string" ? body.email.trim() : "";
    if (!/^\S+@\S+\.\S+$/.test(email)) throw badRequest("Enter a valid account email.");
    return NextResponse.json({ staff: await adminGrantStaff(user, email) }, { status: 201 });
  } catch (error) {
    return handleRouteError("admin.staff.grant", error);
  }
}
