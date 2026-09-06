import { NextResponse, type NextRequest } from "next/server";
import { authenticate } from "@/app/lib/backend";
import { handleRouteError, serviceUnavailable } from "@/app/lib/errors";
import { fetchProductsSheet } from "@/app/lib/google-sheets";
import { requireAdmin, upsertProductionProducts, syncSheetWholesale } from "@/app/lib/supabase";
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

    let syncedProducts: Awaited<ReturnType<typeof upsertProductionProducts>>;
    let wholesale: Awaited<ReturnType<typeof syncSheetWholesale>> | null = null;
    try {
      syncedProducts = await upsertProductionProducts(products);
      const managed = products.filter(product => product.sheetWholesale !== undefined);
      if (managed.length) wholesale = await syncSheetWholesale(managed.map(product => ({
        source_key: product.sourceKey,
        unit_price: product.sheetWholesale?.unitPrice ?? null,
        min_quantity: product.sheetWholesale?.minQuantity ?? null,
      })));
    } catch (syncError) {
      if (
        syncError instanceof Error &&
        syncError.message.trim().toLowerCase() === "unauthorized"
      ) {
        throw serviceUnavailable(
          "Supabase rejected the sync credential. Save the correct SUPABASE_SERVICE_ROLE_KEY in .env.local, stop the development server, and run npm run dev again."
        );
      }

      throw syncError;
    }

    return NextResponse.json({
      ok: true,
      wholesale,
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
