import { NextResponse, type NextRequest } from "next/server";
import { authenticate } from "@/app/lib/backend";
import { fetchProductsSheet } from "@/app/lib/google-sheets";
import { mapProductRow, requireAdmin, upsertProducts } from "@/app/lib/supabase";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const user = await authenticate(request);
    requireAdmin(user);

    const body = (await request.json().catch(() => ({}))) as {
      dryRun?: boolean;
    };
    const { products, skippedRows } = await fetchProductsSheet();

    if (body.dryRun) {
      return NextResponse.json({
        dryRun: true,
        count: products.length,
        skippedRows,
        products,
      });
    }

    const syncedProducts = await upsertProducts(products);

    return NextResponse.json({
      ok: true,
      count: syncedProducts.length,
      skippedRows,
      products: syncedProducts.map(mapProductRow),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to sync Google Sheet.";
    const status =
      message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 400;

    return NextResponse.json({ error: message }, { status });
  }
}
