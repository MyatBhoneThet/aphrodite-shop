import { NextResponse, type NextRequest } from "next/server";
import { authenticate } from "@/app/lib/backend";
import { estimateDelivery } from "@/app/lib/delivery-estimate";
import { handleRouteError } from "@/app/lib/errors";
import { selectCustomerAddresses } from "@/app/lib/supabase";

const headers = { "Cache-Control": "private, no-store" };

export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);
    if (user.role === "admin") {
      return NextResponse.json({ estimate: null }, { headers });
    }
    const addresses = await selectCustomerAddresses(user.id);
    const defaultAddress = addresses.find((address) => address.is_default);
    if (!defaultAddress) {
      return NextResponse.json({ estimate: null }, { headers });
    }
    return NextResponse.json({
      estimate: estimateDelivery(
        defaultAddress.latitude,
        defaultAddress.longitude,
        defaultAddress.township
      ),
    }, { headers });
  } catch (error) {
    return handleRouteError("delivery-estimate.get", error);
  }
}
