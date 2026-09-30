import { NextResponse, type NextRequest } from "next/server";
import { authenticate, getMonthlySalesReport } from "@/app/lib/backend";
import { handleRouteError } from "@/app/lib/errors";

function csvCell(value: unknown) {
  let text = value == null ? "" : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

function row(values: unknown[]) {
  return values.map(csvCell).join(",");
}

export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);
    const fallback = new Date().toISOString().slice(0, 7);
    const report = await getMonthlySalesReport(
      user,
      request.nextUrl.searchParams.get("month") ?? fallback
    );
    const lines = [
      row(["Aphrodite Myanmar Monthly Sales Report"]),
      row(["Month", report.label]),
      row(["Generated at", report.generatedAt]),
      "",
      row(["Summary", "Value"]),
      row(["Sales revenue (MMK)", report.summary.revenue]),
      row(["Sales orders", report.summary.orders]),
      row(["Average order value (MMK)", report.summary.averageOrderValue]),
      row(["Items sold", report.summary.itemsSold]),
      row(["Cancelled orders", report.summary.cancelled]),
      row(["Returned orders", report.summary.returned]),
      "",
      row(["Order ID", "Date", "Status", "Payment method", "Payment status", "Items", "Products", "Total (MMK)"]),
      ...report.orders.map((order) => row([
        order.id,
        order.created_at,
        order.status,
        order.payment_method,
        order.payment_status,
        (order.order_items ?? []).reduce((sum, item) => sum + item.quantity, 0),
        (order.order_items ?? []).map((item) => `${item.products?.name ?? "Product"} x${item.quantity}`).join("; "),
        order.total_amount,
      ])),
    ];
    return new NextResponse(`\uFEFF${lines.join("\r\n")}`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="aphrodite-sales-${report.month}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return handleRouteError("admin.reports.monthly", error);
  }
}
