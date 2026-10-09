"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from "react";
import type { AdminStats, SalesPeriod } from "@/app/lib/backend";
import { authHeaders } from "@/app/lib/client-auth";
import type { UserRole } from "@/app/data/products";
import { formatCurrency, formatDateTime } from "@/app/lib/format";
import { useAdminText } from "@/app/lib/useAdminText";

type AdminPanel = "dashboard" | "products" | "orders" | "queue" | "locations" | "support" | "ads" | "wholesale" | "pricing" | "sync" | "staff";

type AdminOverviewPanelProps = {
  role: UserRole;
  onNavigate: (section: AdminPanel) => void;
};

const periods: Array<{ value: SalesPeriod; label: string }> = [
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "quarter", label: "This quarter" },
  { value: "year", label: "This year" },
];

function changeLabel(value: number | null) {
  if (value === null) return "New activity";
  if (value === 0) return "No change";
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function Trend({ value }: { value: number | null }) {
  const positive = value === null || value >= 0;
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
        positive ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
      }`}
    >
      {changeLabel(value)} vs previous
    </span>
  );
}

function MetricCard({
  title,
  value,
  change,
  accent,
}: {
  title: string;
  value: string;
  change: number | null;
  accent: "red" | "violet" | "emerald" | "amber";
}) {
  const styles = {
    red: "from-red-50/80 text-red-600",
    violet: "from-violet-50/80 text-violet-600",
    emerald: "from-emerald-50/80 text-emerald-600",
    amber: "from-amber-50/80 text-amber-600",
  }[accent];

  return (
    <article className={`rounded-3xl border border-black/5 bg-gradient-to-br ${styles} to-white p-5 shadow-sm`}>
      <p className="text-sm font-semibold text-slate-500">{title}</p>
      <p className="mt-3 break-words text-2xl font-black tracking-tight text-slate-950 xl:text-3xl">{value}</p>
      <div className="mt-5">
        <Trend value={change} />
      </div>
    </article>
  );
}

function SalesChart({ series }: { series: AdminStats["salesSeries"] }) {
  const width = 760;
  const height = 250;
  const paddingX = 24;
  const paddingTop = 24;
  const paddingBottom = 42;
  const chartHeight = height - paddingTop - paddingBottom;
  const maxValue = Math.max(...series.map((item) => item.value), 1);
  const points = series.map((item, index) => {
    const x = series.length === 1 ? width / 2 : paddingX + (index / (series.length - 1)) * (width - paddingX * 2);
    const y = paddingTop + chartHeight - (item.value / maxValue) * chartHeight;
    return { ...item, x, y };
  });
  const line = points.map((point) => `${point.x},${point.y}`).join(" ");
  const area = points.length
    ? `${points[0].x},${height - paddingBottom} ${line} ${points[points.length - 1].x},${height - paddingBottom}`
    : "";
  const labelEvery = Math.max(1, Math.ceil(series.length / 7));

  return (
    <div className="overflow-x-auto">
      <svg className="min-w-[680px]" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Sales trend chart">
        <defs>
          <linearGradient id="sales-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ef233c" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#ef233c" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map((level) => {
          const y = paddingTop + chartHeight * level;
          return <line key={level} x1={paddingX} y1={y} x2={width - paddingX} y2={y} stroke="#e5e7eb" strokeDasharray="4 6" />;
        })}
        {area ? <polygon points={area} fill="url(#sales-area)" /> : null}
        {line ? <polyline points={line} fill="none" stroke="#ef233c" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" /> : null}
        {points.map((point, index) => (
          <g key={`${point.label}-${index}`}>
            <circle cx={point.x} cy={point.y} r="4" fill="#fff" stroke="#ef233c" strokeWidth="3">
              <title>{`${point.label}: ${formatCurrency(point.value)} from ${point.orders} orders`}</title>
            </circle>
            {index % labelEvery === 0 || index === points.length - 1 ? (
              <text x={point.x} y={height - 14} textAnchor="middle" className="fill-slate-500 text-[11px] font-semibold">
                {point.label}
              </text>
            ) : null}
          </g>
        ))}
      </svg>
    </div>
  );
}

export default function AdminOverviewPanel({ role, onNavigate }: AdminOverviewPanelProps) {
  const a = useAdminText();
  const [period, setPeriod] = useState<SalesPeriod>("month");
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reportMonth, setReportMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/admin/stats?period=${period}`, { headers: authHeaders() });
        if (!response.ok) throw new Error("Could not load sales overview");
        const payload = (await response.json()) as { stats: AdminStats };
        if (!cancelled) setStats(payload.stats);
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Could not load sales overview");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [period]);

  const liveDate = useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(new Date()),
    [],
  );

  async function downloadMonthlyReport() {
    setDownloading(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/reports/monthly?month=${reportMonth}`, { headers: authHeaders() });
      if (!response.ok) throw new Error("Could not generate monthly report");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `sales-report-${reportMonth}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (reportError) {
      setError(reportError instanceof Error ? reportError.message : "Could not generate monthly report");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-[2rem] border border-black/5 bg-gradient-to-br from-lime-50 via-white to-violet-50 p-5 shadow-sm sm:p-7">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">{a("Sales overview")}</h1>
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_0_5px_rgba(16,185,129,0.12)]" />
                Live · {liveDate}
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-500">
              {role === "staff" ? "Your permitted store operations and sales performance." : "Store performance, orders, and reporting in one place."}
            </p>
          </div>
          <div className="grid grid-cols-2 rounded-2xl bg-white/80 p-1.5 shadow-sm ring-1 ring-black/5 sm:grid-cols-4">
            {periods.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setPeriod(item.value)}
                className={`rounded-xl px-4 py-2.5 text-sm font-bold transition ${
                  period === item.value ? "bg-slate-950 text-white shadow" : "text-slate-500 hover:bg-slate-100 hover:text-slate-950"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div> : null}

      {loading && !stats ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center text-sm font-semibold text-slate-500">Loading sales overview…</div>
      ) : stats ? (
        <>
          <section className={`grid gap-4 transition-opacity ${loading ? "opacity-60" : "opacity-100"} sm:grid-cols-2 xl:grid-cols-4`}>
            <MetricCard title="Sales revenue" value={formatCurrency(stats.revenue.total)} change={stats.revenue.changePercent} accent="red" />
            <MetricCard title="Sales orders" value={stats.orders.total.toLocaleString()} change={stats.orders.changePercent} accent="violet" />
            <MetricCard title="Average order value" value={formatCurrency(stats.averageOrderValue.total)} change={stats.averageOrderValue.changePercent} accent="emerald" />
            <MetricCard title="Items sold" value={stats.itemsSold.total.toLocaleString()} change={stats.itemsSold.changePercent} accent="amber" />
          </section>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.75fr)]">
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-black text-slate-950">Sales trend</h2>
                  <p className="mt-1 text-sm text-slate-500">{stats.range.label} · non-cancelled and non-returned order value</p>
                </div>
                <p className="text-lg font-black text-red-600">{formatCurrency(stats.revenue.total)}</p>
              </div>
              <div className="mt-4">
                <SalesChart series={stats.salesSeries} />
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-black text-slate-950">Recent purchases</h2>
                  <p className="mt-1 text-xs text-slate-500">Latest customer orders</p>
                </div>
                <button type="button" onClick={() => onNavigate("orders")} className="text-sm font-bold text-red-600 hover:text-red-700">
                  View all →
                </button>
              </div>
              <div className="mt-4 space-y-3">
                {stats.recentOrders.length ? (
                  stats.recentOrders.slice(0, 6).map((order) => (
                    <button
                      type="button"
                      key={order.id}
                      onClick={() => onNavigate("orders")}
                      className="flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-100 p-3 text-left transition hover:border-red-100 hover:bg-red-50/30"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-bold text-slate-900">{order.shipping_name || `Order #${order.id.slice(0, 8)}`}</span>
                        <span className="mt-0.5 block text-xs text-slate-500">{formatDateTime(order.created_at)} · {order.status}</span>
                      </span>
                      <span className="shrink-0 text-sm font-black text-slate-950">{formatCurrency(order.total_amount)}</span>
                    </button>
                  ))
                ) : (
                  <div className="grid min-h-48 place-items-center rounded-2xl bg-slate-50 text-center text-sm font-semibold text-slate-400">No recent purchases</div>
                )}
              </div>
            </section>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <h2 className="text-lg font-black text-slate-950">Store health</h2>
              <div className="mt-4 grid grid-cols-2 gap-3">
                {[
                  ["Customers", stats.customers.total],
                  ["Products", stats.products.total],
                  ["Out of stock", stats.products.outOfStock],
                  ["Returns", stats.returns.total],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs font-semibold text-slate-500">{label}</p>
                    <p className="mt-1 text-2xl font-black text-slate-950">{Number(value).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <h2 className="text-lg font-black text-slate-950">Top products</h2>
              <p className="mt-1 text-xs text-slate-500">By units sold in this period</p>
              <div className="mt-4 space-y-3">
                {stats.topProducts.length ? (
                  stats.topProducts.slice(0, 5).map((product, index) => (
                    <div key={product.productId} className="flex items-center gap-3">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-slate-950 text-xs font-black text-white">{index + 1}</span>
                      {product.image ? <img src={product.image} alt="" className="h-10 w-10 rounded-xl object-cover" /> : null}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-slate-900">{product.name || "Product"}</p>
                        <p className="text-xs text-slate-500">{product.quantitySold.toLocaleString()} sold</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="rounded-2xl bg-slate-50 p-5 text-center text-sm font-semibold text-slate-400">No product sales in this period</p>
                )}
              </div>
            </section>

            <section className="rounded-3xl bg-slate-950 p-5 text-white shadow-sm sm:p-6">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-red-400">Reports</p>
              <h2 className="mt-2 text-xl font-black">Monthly sales report</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">Download a CSV summary with order lines, products, payments, and totals. Customer contact details are excluded.</p>
              <label className="mt-5 block text-xs font-bold text-slate-300" htmlFor="report-month">Report month</label>
              <input
                id="report-month"
                type="month"
                value={reportMonth}
                onChange={(event) => setReportMonth(event.target.value)}
                className="mt-2 w-full rounded-xl border border-white/15 bg-white/10 px-3 py-2.5 text-sm font-semibold text-white [color-scheme:dark]"
              />
              <button
                type="button"
                onClick={downloadMonthlyReport}
                disabled={downloading || !reportMonth}
                className="mt-3 w-full rounded-xl bg-red-600 px-4 py-3 text-sm font-black text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {downloading ? "Generating report…" : "Download monthly CSV"}
              </button>
              <p className="mt-3 text-xs leading-5 text-slate-500">Revenue is order value and does not subtract business expenses, because expense and cost data is not currently tracked.</p>
            </section>
          </div>
        </>
      ) : null}
    </div>
  );
}
