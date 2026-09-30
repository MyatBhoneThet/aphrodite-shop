import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/app/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const ready = isSupabaseConfigured({ requireServiceRole: true });

  return NextResponse.json(
    { status: ready ? "ok" : "unavailable" },
    {
      status: ready ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    }
  );
}
