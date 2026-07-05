import { NextResponse, type NextRequest } from "next/server";
import { getProfile, registerUser } from "@/app/lib/supabase";
import type { UserRole } from "@/app/data/products";

const allowedRoles = new Set<UserRole>(["normal", "wholesale"]);

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      email?: string;
      password?: string;
      full_name?: string;
      role?: UserRole;
    };

    if (!body.email || !body.password) {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 }
      );
    }

    const role = body.role && allowedRoles.has(body.role) ? body.role : "normal";
    const user = await registerUser({
      email: body.email,
      password: body.password,
      fullName: body.full_name,
      role,
    });
    const profile = await getProfile(user.id);

    return NextResponse.json({ profile, user: profile }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Registration failed." },
      { status: 400 }
    );
  }
}
