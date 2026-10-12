"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { authHeaders } from "@/app/lib/client-auth";
import { useCurrentUser } from "@/app/lib/useCurrentUser";
import PackingSlip, { type SlipOrder } from "../PackingSlip";

export default function PackingSlipPage() {
  const params = useParams<{ id: string }>();
  const { user, status } = useCurrentUser();
  const [order, setOrder] = useState<SlipOrder | null>(null);
  const [error, setError] = useState("");
  const isAdmin = user?.role === "admin";
  const isBackoffice = isAdmin || user?.role === "staff";

  useEffect(() => {
    if (status !== "ready" || !isBackoffice || !params.id) return;
    fetch(`/api/orders/${params.id}`, { headers: authHeaders(), cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json().catch(() => null)) as { order?: SlipOrder; error?: string } | null;
        if (!response.ok || !data?.order) throw new Error(data?.error ?? "Order not found.");
        setOrder(data.order);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Order not found."));
  }, [params.id, status, isBackoffice]);

  const centered = "flex min-h-screen items-center justify-center px-5 text-center";
  if (status === "checking") return <main className={centered}>Loading…</main>;
  if (!user || !isBackoffice) {
    return <main className={centered}><div><h1 className="text-2xl font-bold">Admin sign-in required</h1><Link href="/admin/login" className="mt-4 inline-block rounded-full bg-red-600 px-6 py-3 font-semibold text-white">Sign in</Link></div></main>;
  }
  if (error) return <main className={centered}><div><h1 className="text-2xl font-bold">Packing slip unavailable</h1><p className="mt-2 text-zinc-500">{error}</p></div></main>;
  if (!order) return <main className={centered}>Loading…</main>;

  return (
    <main className="min-h-screen bg-zinc-100 px-4 py-8 print:bg-white print:p-0">
      <div className="mx-auto mb-4 flex max-w-3xl flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href="/admin?panel=orders" className="rounded-full border bg-white px-5 py-2 text-sm font-semibold">← Orders</Link>
        <div className="flex items-center gap-3">
          {!isAdmin && <span className="text-xs text-zinc-500">Phone number hidden for staff accounts</span>}
          <button type="button" onClick={() => window.print()} className="rounded-full bg-red-600 px-5 py-2 text-sm font-bold text-white">Print</button>
        </div>
      </div>

      <PackingSlip order={order} isAdmin={isAdmin} />
    </main>
  );
}
