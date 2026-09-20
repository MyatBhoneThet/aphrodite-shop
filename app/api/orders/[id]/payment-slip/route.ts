import { NextResponse, type NextRequest } from "next/server";
import { addPaymentSlip, authenticate } from "@/app/lib/backend";
import { handleRouteError } from "@/app/lib/errors";

/**
 * The customer uploads a photo or screenshot of their bank / MMQR transfer.
 * The file itself goes to a private bucket; only an admin-signed link can
 * open it afterwards.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await authenticate(request);
    const { id } = await context.params;
    const form = await request.formData();
    const file = form.get("file");
    const note = form.get("note");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Choose a photo or screenshot of your transfer slip." },
        { status: 400 }
      );
    }

    const slip = await addPaymentSlip(
      user,
      id,
      file,
      typeof note === "string" ? note : null
    );

    return NextResponse.json({ slip }, { status: 201 });
  } catch (error) {
    return handleRouteError("orders.payment-slip.upload", error);
  }
}
