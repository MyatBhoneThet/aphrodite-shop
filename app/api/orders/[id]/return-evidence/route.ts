import { NextResponse, type NextRequest } from "next/server";
import { addReturnEvidence, authenticate } from "@/app/lib/backend";
import { handleRouteError } from "@/app/lib/errors";
import type { ReturnEvidenceKind } from "@/app/lib/supabase";

const allowedKinds = new Set<ReturnEvidenceKind>([
  "product_photo",
  "shipping_damage_photo",
  "unboxing_video",
  "serial_photo",
  "other",
]);

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await authenticate(request);
    const { id } = await context.params;
    const form = await request.formData();
    const file = form.get("file");
    const kind = String(form.get("evidence_kind") ?? "other") as ReturnEvidenceKind;

    if (!(file instanceof File) || !allowedKinds.has(kind)) {
      return NextResponse.json(
        { error: "Choose a valid photo or unboxing video." },
        { status: 400 }
      );
    }

    const evidence = await addReturnEvidence(user, id, file, kind);
    return NextResponse.json({ evidence }, { status: 201 });
  } catch (error) {
    return handleRouteError("orders.return-evidence.upload", error);
  }
}
