"use client";

export function SidebarIcon({ icon }: { icon: string }) {
  const paths: Record<string, string> = {
    "📊": "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
    "💻": "M4 4h16v12H4zM2 20h20M8 16v4m8-4v4",
    "🧾": "M6 3h12v18l-3-2-3 2-3-2-3 2V3Zm3 5h6m-6 4h6",
    "📋": "M9 4H5v17h14V4h-4M9 2h6v4H9zM8 11l2 2 5-4M8 17h8",
    "📍": "M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0ZM9 10a3 3 0 1 0 6 0 3 3 0 0 0-6 0",
    "💬": "M21 4H3v13h5l4 4v-4h9V4ZM7 9h10M7 13h6",
    "🏢": "M4 21V7h9v14M13 3h7v18M2 21h20M7 11h3m-3 4h3m6-8h1m-1 4h1m-1 4h1",
    "🏷️": "m3 3 9 0 9 9-9 9-9-9V3Zm4 4h.01",
    "🔄": "M20 8a8 8 0 0 0-14-3L3 8m0-5v5h5M4 16a8 8 0 0 0 14 3l3-3m0 5v-5h-5",
    "🖼️": "M3 4h18v16H3zM3 16l5-5 5 5 3-3 5 5M8.5 9h.01",
    "🧑": "M17 20v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M10 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM21 20v-2a4 4 0 0 0-3-3.9M15 2.1a4 4 0 0 1 0 7.8",
    "⭐": "m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3Z",
    "📜": "M12 7v5l3 2M3 12a9 9 0 1 0 3-6.7M3 4v5h5",
    "🔐": "M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3ZM9 12l2 2 4-4",
    "👤": "M20 21a8 8 0 0 0-16 0M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
    store: "M3 10h18l-2-7H5l-2 7Zm2 0v11h14V10M9 21v-7h6v7",
    logout: "M9 4H4v16h5M10 12h11m-4-4 4 4-4 4",
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px] shrink-0"><path d={paths[icon]} /></svg>;
}

export function SidebarButton({
  active,
  icon,
  label,
  badge = 0,
  onClick,
}: {
  active: boolean;
  icon: string;
  label: string;
  badge?: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      type="button"
      aria-current={active ? "page" : undefined}
      className={`group relative flex min-h-10 w-full items-center gap-3 rounded-xl border px-3 py-1.5 text-left transition motion-reduce:transition-none ${
        active
          ? "border-red-500/25 bg-gradient-to-r from-red-500/20 to-red-500/5 text-white shadow-[inset_3px_0_0_#ef4444]"
          : "border-transparent text-zinc-400 hover:border-white/5 hover:bg-white/5 hover:text-white"
      }`}
    >
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition ${active ? "bg-red-500 text-white shadow-lg shadow-red-950/30" : "bg-white/[0.03] text-zinc-500 group-hover:text-zinc-200"}`}><SidebarIcon icon={icon} /></span>
      <span className="text-xs font-medium">{label}</span>
      {badge > 0 && <span className="ml-auto min-w-5 rounded-full bg-red-500 px-1.5 py-0.5 text-center text-[10px] font-black leading-none text-white" aria-label={`${badge} new`}>{badge > 99 ? "99+" : badge}</span>}
      {active && badge === 0 && <span aria-hidden="true" className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />}
    </button>
  );
}
