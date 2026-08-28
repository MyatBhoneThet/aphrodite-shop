import { NextResponse, type NextRequest } from "next/server";
import { authenticate } from "@/app/lib/backend";
import { handleRouteError } from "@/app/lib/errors";
import { fetchProductsSheet } from "@/app/lib/google-sheets";
import { requireAdmin, upsertProductionProducts } from "@/app/lib/supabase";
import { readJsonBody } from "@/app/lib/request";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const user = await authenticate(request);
    requireAdmin(user);

    const body = (await readJsonBody(request)) as {
      dryRun?: boolean;
    };
    const { products, skippedRows, summary, warnings } =
      await fetchProductsSheet();

    if (body.dryRun) {
      return NextResponse.json({
        dryRun: true,
        count: products.length,
        skippedRows,
        summary,
        warnings,
        preview: products.slice(0, 25),
      });
    }

    const syncedProducts = await upsertProductionProducts(products);

    return NextResponse.json({
      ok: true,
      count: syncedProducts.length,
      skippedRows,
      summary,
      warnings,
      productIds: syncedProducts.map((product) => product.id),
    });
  } catch (error) {
    return handleRouteError("admin.sync-products", error);
  }
}
