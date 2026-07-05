import { NextResponse, type NextRequest } from "next/server";
import { getProfile, loginUser } from "@/app/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      email?: string;
      password?: string;
    };

    if (!body.email || !body.password) {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 }
      );
    }

    const session = await loginUser(body.email, body.password);
    const profile = await getProfile(session.user.id);

    return NextResponse.json({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      profile,
      user: profile,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Login failed." },
      { status: 400 }
    );
  }
}
