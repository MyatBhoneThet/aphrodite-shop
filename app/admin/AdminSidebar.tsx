"use client";

import Link from "next/link";
import BrandLogo from "../components/BrandLogo";
import { useLanguage } from "../lib/language";
import type { CurrentUser } from "../lib/useCurrentUser";
import { useAdminText } from "../lib/useAdminText";
import { SidebarButton, SidebarIcon } from "./SidebarParts";
import type { AdminPanelId } from "./types";

type Props = {
  currentUser: CurrentUser | null;
  activePanel: AdminPanelId;
  setActivePanel: (panel: AdminPanelId) => void;
  isAdmin: boolean;
  search: string;
  setSearch: (value: string) => void;
  newOrderCount: number;
  onOrdersOpened: () => void;
  onLogout: () => void;
};

/** The dark left-hand navigation (large screens). */
export default function AdminSidebar({
  currentUser,
  activePanel,
  setActivePanel,
  isAdmin,
  search,
  setSearch,
  newOrderCount,
  onOrdersOpened,
  onLogout: handleLogout,
}: Props) {
  const a = useAdminText();
  const { t } = useLanguage();

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-zinc-800 bg-[#111115] text-white lg:flex">
      <div className="flex h-16 shrink-0 items-center bg-white px-4">
        <BrandLogo />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4 [scrollbar-width:thin]">
      <div className="my-3 flex items-center gap-3 rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.08] to-white/[0.02] p-2.5">
        <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-500/15 text-xs font-bold text-red-300">{(currentUser?.full_name || a("Admin")).split(" ").slice(0, 2).map(part => part[0]).join("").toUpperCase()}</span>
        <div className="min-w-0"><p className="truncate text-sm font-semibold">{currentUser?.full_name || a("Admin")}</p><p className="mt-1 truncate text-[11px] text-zinc-400" title={currentUser?.email}>{currentUser?.email}</p></div>
      </div>
      <label className="mb-3 flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 transition focus-within:border-red-400/60 focus-within:ring-2 focus-within:ring-red-500/15">
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-4 w-4 shrink-0 text-zinc-500"><circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/></svg>
        <span className="sr-only">{a("Search admin products and orders")}</span>
        <input placeholder={a("Search products & orders")} value={search} onChange={event => setSearch(event.target.value)} className="min-w-0 w-full bg-transparent py-2.5 text-xs text-white outline-none placeholder:text-zinc-500" />
      </label>

      <nav aria-label={a("Admin navigation")} className="space-y-1 text-sm">
        <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">{t("admin.manage")}</p>
        <SidebarButton
          active={activePanel === "dashboard"}
          icon="📊"
          label={t("admin.overview")}
          onClick={() => setActivePanel("dashboard")}
        />
        <SidebarButton
          active={activePanel === "products"}
          icon="💻"
          label={t("admin.products")}
          onClick={() => setActivePanel("products")}
        />
        <SidebarButton
          active={activePanel === "orders"}
          icon="🧾"
          label={t("admin.purchases")}
          badge={newOrderCount}
          onClick={() => { setActivePanel("orders"); onOrdersOpened(); }}
        />
        <SidebarButton
          active={activePanel === "queue"}
          icon="📋"
          label={t("admin.queue")}
          onClick={() => setActivePanel("queue")}
        />
        <p className="px-3 pb-2 pt-3 text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">{a("Customer care")}</p>
        {isAdmin && <SidebarButton
          active={activePanel === "locations"}
          icon="📍"
          label={t("admin.locations")}
          onClick={() => setActivePanel("locations")}
        />}
        <SidebarButton
          active={activePanel === "support"}
          icon="💬"
          label={t("admin.liveChat")}
          onClick={() => setActivePanel("support")}
        />
        <p className="px-3 pb-2 pt-3 text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">{a("Business tools")}</p>
        <SidebarButton
          active={activePanel === "ads"}
          icon="🖼️"
          label={a("Homepage Ads")}
          onClick={() => setActivePanel("ads")}
        />
        {isAdmin && <SidebarButton
          active={activePanel === "wholesale"}
          icon="🏢"
          label={t("admin.wholesale")}
          onClick={() => setActivePanel("wholesale")}
        />}
        {isAdmin && <SidebarButton
          active={activePanel === "pricing"}
          icon="🏷️"
          label={t("admin.priceLists")}
          onClick={() => setActivePanel("pricing")}
        />}
        <SidebarButton
          active={activePanel === "sync"}
          icon="🔄"
          label={t("admin.sheetSync")}
          onClick={() => setActivePanel("sync")}
        />
        {isAdmin && <SidebarButton
          active={activePanel === "customers"}
          icon="🧑"
          label={a("Customers")}
          onClick={() => setActivePanel("customers")}
        />}
        {isAdmin && <SidebarButton
          active={activePanel === "feedback"}
          icon="⭐"
          label={a("Customer feedback")}
          onClick={() => setActivePanel("feedback")}
        />}
        {isAdmin && <SidebarButton
          active={activePanel === "activity"}
          icon="📜"
          label={a("Activity log")}
          onClick={() => setActivePanel("activity")}
        />}
        <SidebarButton
          active={activePanel === "security"}
          icon="🔐"
          label={a("Security")}
          onClick={() => setActivePanel("security")}
        />
        {isAdmin && <SidebarButton
          active={activePanel === "staff"}
          icon="👤"
          label={a("Staff access")}
          onClick={() => setActivePanel("staff")}
        />}

      </nav>
      </div>
      <div className="shrink-0 border-t border-white/10 bg-white/[0.02] p-3">
        <Link href="/" className="group flex min-h-10 items-center gap-3 rounded-xl px-3 py-1.5 text-sm font-medium text-zinc-300 transition hover:bg-white/5 hover:text-white">
          <SidebarIcon icon="store" />{t("admin.backToStore")}<span aria-hidden="true" className="ml-auto text-zinc-500 transition group-hover:translate-x-0.5">↗</span>
        </Link>
        <button type="button" onClick={handleLogout} className="flex min-h-10 w-full items-center gap-3 rounded-xl px-3 py-1.5 text-sm font-medium text-zinc-500 transition hover:bg-red-500/10 hover:text-red-300"><SidebarIcon icon="logout" />{t("nav.logout")}</button>
      </div>
    </aside>
  );
}
