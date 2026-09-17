import { NextResponse, type NextRequest } from "next/server";
import {
  authenticate,
  getCustomerSupportConversation,
  sendCustomerSupportMessage,
} from "@/app/lib/backend";
import { handleRouteError } from "@/app/lib/errors";
import { checkRateLimit } from "@/app/lib/rate-limit";
import { readJsonBody } from "@/app/lib/request";
import {
  firstIssueMessage,
  supportMessageSchema,
} from "@/app/lib/validation";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);
    return NextResponse.json(await getCustomerSupportConversation(user));
  } catch (error) {
    return handleRouteError("support.customer.get", error);
  }
}

export async function POST(request: NextRequest) {
  const rateLimit = checkRateLimit(request, "chat");

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many messages. Please wait a moment and try again." },
      { status: 429 }
    );
  }

  try {
    const user = await authenticate(request);

    // Two shapes are accepted: plain JSON for a text message, and multipart
    // when the customer attaches a photo or asks about a specific product.
    if (request.headers.get("content-type")?.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      const productValue = form.get("product_id");
      const message = String(form.get("message") ?? "");

      const productId =
        typeof productValue === "string" && productValue.trim()
          ? Number(productValue)
          : null;

      if (productId !== null && !Number.isInteger(productId)) {
        return NextResponse.json({ error: "That product is not valid." }, { status: 400 });
      }

      const attachment =
        file instanceof File
          ? {
              bytes: await file.arrayBuffer(),
              contentType: file.type,
              fileName: file.name,
            }
          : null;

      if (!attachment && !productId && !message.trim()) {
        return NextResponse.json(
          { error: "Type a message, attach a photo, or choose a product." },
          { status: 400 }
        );
      }

      return NextResponse.json(
        await sendCustomerSupportMessage(user, message, { attachment, productId }),
        { status: 201 }
      );
    }

    const parsed = supportMessageSchema.safeParse(await readJsonBody(request));

    if (!parsed.success) {
      return NextResponse.json(
        { error: firstIssueMessage(parsed.error) },
        { status: 400 }
      );
    }

    return NextResponse.json(
      await sendCustomerSupportMessage(user, parsed.data.message),
      { status: 201 }
    );
  } catch (error) {
    return handleRouteError("support.customer.send", error);
  }
}
