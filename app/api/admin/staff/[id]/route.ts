import { NextResponse, type NextRequest } from "next/server";
import { adminDeleteStaff, authenticate } from "@/app/lib/backend";
import { handleRouteError } from "@/app/lib/errors";

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await authenticate(request);
    const { id } = await context.params;
    await adminDeleteStaff(user, id);
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return handleRouteError("admin.staff.delete", error);
  }
}
