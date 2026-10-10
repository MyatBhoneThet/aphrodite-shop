import { NextResponse, type NextRequest } from "next/server";
import { authenticate } from "@/app/lib/backend";
import { handleRouteError } from "@/app/lib/errors";
import { readJsonBody } from "@/app/lib/request";
import { getOwnCompany, saveOwnCompany } from "@/app/lib/wholesale-b2b";

const headers = { "Cache-Control": "private, no-store" };

export async function GET(request: NextRequest) {
  try {
    return NextResponse.json(await getOwnCompany(await authenticate(request)), { headers });
  } catch (error) {
    return handleRouteError("company.get", error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await authenticate(request);
    return NextResponse.json(await saveOwnCompany(user, await readJsonBody(request)), { headers });
  } catch (error) {
    return handleRouteError("company.save", error);
  }
}
