"use client";

import Link from "next/link";
import LanguageSwitcher from "../components/LanguageSwitcher";
import { formatCurrency } from "../lib/format";
import { useLanguage } from "../lib/language";
import { useAdminText } from "../lib/useAdminText";
import type { useNewOrderAlerts } from "./useNewOrderAlerts";
import type { AdminPanelId } from "./types";

type Props = {
  activePanel: AdminPanelId;
  setActivePanel: (panel: AdminPanelId) => void;
  isAdmin: boolean;
  search: string;
  setSearch: (value: string) => void;
  newOrders: ReturnType<typeof useNewOrderAlerts>;
  isLoadingData: boolean;
  loadDashboardData: () => Promise<void>;
  onLogout: () => void;
};

/** Top bar, the "new orders" banner, and the panel picker used on phones. */
export default function AdminHeader({
  activePanel,
  setActivePanel,
  isAdmin,
  search,
  setSearch,
  newOrders,
  isLoadingData,
  loadDashboardData,
  onLogout: handleLogout,
}: Props) {
  const a = useAdminText();
  const { t } = useLanguage();

  return (
    <>
      <header className="sticky top-0 z-30 border-b bg-white shadow-sm">
        <div className="flex min-h-14 flex-wrap items-center justify-between gap-3 px-4 py-2">
          <div>
            <h1 className="text-lg font-bold">{t("admin.manage")}</h1>
            <p className="text-xs text-zinc-500">
              {a(activePanel.replaceAll("_", " "))}  {a("/ Aphrodite Admin Panel")} </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <LanguageSwitcher />

            <button
              type="button"
              onClick={newOrders.toggleSound}
              aria-pressed={newOrders.soundOn}
              title={newOrders.soundOn ? a("New-order sound is on") : a("Play a sound for new orders")}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${newOrders.soundOn ? "border-emerald-300 bg-emerald-50 text-emerald-800" : ""}`}
            >
              {newOrders.soundOn ? "🔔 " : "🔕 "}{a("Order alert sound")}
            </button>

            <button
              onClick={loadDashboardData}
              disabled={isLoadingData}
              className="rounded-full border px-3 py-1.5 text-xs font-semibold disabled:bg-zinc-100"
            >
              {isLoadingData ? t("common.loading") : t("common.refresh")}
            </button>

            <button
              onClick={handleLogout}
              className="rounded-full bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white"
            >
              {t("nav.logout")}
            </button>
          </div>
        </div>
      </header>

      {newOrders.count > 0 && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-3 border-b border-red-200 bg-red-50 px-4 py-3 text-sm">
          <p className="font-bold text-red-800">
            🔔 {newOrders.count}{newOrders.capped ? "+" : ""} {newOrders.count === 1 ? a("new order") : a("new orders")}
            <span className="ml-2 font-normal text-red-700">
              {newOrders.preview.map((order) => `${order.shipping_name} (${formatCurrency(order.total_amount)})`).join(" · ")}
            </span>
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={() => { void loadDashboardData(); setActivePanel("orders"); newOrders.markSeen(); }} className="rounded-full bg-red-600 px-4 py-1.5 font-bold text-white">{a("View orders")}</button>
            <button type="button" onClick={newOrders.markSeen} className="rounded-full border border-red-300 bg-white px-4 py-1.5 font-semibold text-red-800">{a("Dismiss")}</button>
          </div>
        </div>
      )}

      <nav aria-label={a("Admin panels")} className="space-y-3 border-b bg-white p-4 lg:hidden">
        <label className="block text-sm font-semibold">
          {t("admin.manage")}
          <select value={activePanel} onChange={(event) => setActivePanel(event.target.value as typeof activePanel)} className="mt-2 w-full rounded-xl border bg-white px-3 py-3">
            {([
              ["dashboard", "admin.overview"], ["products", "admin.products"],
              ["orders", "admin.purchases"], ["queue", "admin.queue"],
              ...(isAdmin ? [["locations", "admin.locations"]] as const : []), ["support", "admin.liveChat"],
              ["ads", "admin.homepageAds"],
              ...(isAdmin ? [["wholesale", "admin.wholesale"], ["pricing", "admin.priceLists"]] as const : []),
              ["sync", "admin.sheetSync"],
            ] as const).map(([value, label]) => <option key={value} value={value}>{t(label)}</option>)}
            {isAdmin && <option value="customers">{a("Customers")}</option>}
            {isAdmin && <option value="feedback">{a("Customer feedback")}</option>}
            {isAdmin && <option value="activity">{a("Activity log")}</option>}
            <option value="security">{a("Security")}</option>
            {isAdmin && <option value="staff">{a("Staff access")}</option>}
          </select>
        </label>
        <input aria-label={a("Search admin products and orders")} placeholder={a("Search")} value={search} onChange={(event) => setSearch(event.target.value)} className="w-full rounded-xl border px-3 py-3" />
        <Link href="/" className="inline-flex min-h-11 items-center text-sm font-semibold text-red-700">{t("admin.backToStore")}</Link>
      </nav>
    </>
  );
}
