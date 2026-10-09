import { NextResponse, type NextRequest } from "next/server";
import { adminListWholesaleAccounts, authenticate } from "@/app/lib/backend";
import { handleRouteError } from "@/app/lib/errors";

export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);
    const searchParams = request.nextUrl.searchParams;

    const profiles = await adminListWholesaleAccounts(user, {
      search: searchParams.get("search"),
      wholesaleOnly: searchParams.get("filter") === "wholesale",
    });

    return NextResponse.json({
      accounts: profiles.map((profile) => ({
        id: profile.id,
        email: profile.email,
        full_name: profile.full_name,
        role: profile.role,
        wholesale_status: profile.wholesale_status,
        price_list_id: profile.price_list_id,
        created_at: profile.created_at,
      })),
    });
  } catch (error) {
    return handleRouteError("admin.wholesale.accounts.list", error);
  }
}
