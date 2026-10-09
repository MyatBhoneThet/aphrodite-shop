import { NextResponse, type NextRequest } from "next/server";
import { addStaffNote, authenticate, listStaffNotes } from "@/app/lib/backend";
import { handleRouteError } from "@/app/lib/errors";
import { readJsonBody } from "@/app/lib/request";
import { adminStaffNoteSchema, firstIssueMessage } from "@/app/lib/validation";
import type { QueueSubjectType } from "@/app/lib/supabase";

export const runtime = "nodejs";

const SUBJECT_TYPES = new Set<QueueSubjectType>([
  "order",
  "help_case",
  "return_request",
]);

export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);
    const subjectType = request.nextUrl.searchParams.get("subject_type") ?? "";
    const subjectId = request.nextUrl.searchParams.get("subject_id") ?? "";

    if (!SUBJECT_TYPES.has(subjectType as QueueSubjectType) || !subjectId) {
      return NextResponse.json({ error: "Choose a valid case." }, { status: 400 });
    }

    return NextResponse.json({
      notes: await listStaffNotes(user, subjectType as QueueSubjectType, subjectId),
    });
  } catch (error) {
    return handleRouteError("admin.notes.list", error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await authenticate(request);
    const parsed = adminStaffNoteSchema.safeParse(await readJsonBody(request));

    if (!parsed.success) {
      return NextResponse.json(
        { error: firstIssueMessage(parsed.error) },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { note: await addStaffNote(user, parsed.data) },
      { status: 201 }
    );
  } catch (error) {
    return handleRouteError("admin.notes.create", error);
  }
}
