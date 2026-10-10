import { NextResponse, type NextRequest } from "next/server";
import { authenticate } from "@/app/lib/backend";
import { badRequest, handleRouteError } from "@/app/lib/errors";
import { checkRateLimit } from "@/app/lib/rate-limit";
import { uploadOwnLicence } from "@/app/lib/wholesale-b2b";

export const runtime = "nodejs";

/** The buyer uploads a scan or photo of their business licence for the shop to review. */
export async function POST(request: NextRequest) {
  try {
    if (!checkRateLimit(request, "register").allowed) throw badRequest("Too many uploads. Please wait a minute and try again.");
    const user = await authenticate(request);
    const file = (await request.formData()).get("file");
    if (!(file instanceof File)) throw badRequest("Choose a photo or PDF of your business licence.");
    return NextResponse.json({ licence: await uploadOwnLicence(user, file) }, { status: 201 });
  } catch (error) {
    return handleRouteError("company.licence.upload", error);
  }
}
