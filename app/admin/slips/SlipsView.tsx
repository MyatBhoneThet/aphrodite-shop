"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { authHeaders } from "@/app/lib/client-auth";
import { useCurrentUser } from "@/app/lib/useCurrentUser";
import { parseSlipIds } from "../batch-orders";
import PackingSlip, { type SlipOrder } from "../slip/PackingSlip";

const PARALLEL = 4;

type Loaded = { id: string; order: SlipOrder | null; error?: string };

/** Several packing slips in one print job: each order starts on a new page. */
export default function SlipsView() {
  const searchParams = useSearchParams();
  const ids = useMemo(() => parseSlipIds(searchParams.get("ids")), [searchParams]);
  const { user, status } = useCurrentUser();
  const isAdmin = user?.role === "admin";
  const isBackoffice = isAdmin || user?.role === "staff";
  const [loaded, setLoaded] = useState<Record<string, Loaded>>({});

  useEffect(() => {
    if (status !== "ready" || !isBackoffice || ids.length === 0) return;
    let cancelled = false;
    const queue = [...ids];

    async function worker() {
      while (queue.length > 0 && !cancelled) {
        const id = queue.shift() as string;
        let result: Loaded;
        try {
          const response = await fetch(`/api/orders/${id}`, { headers: authHeaders(), cache: "no-store" });
          const data = (await response.json().catch(() => null)) as { order?: SlipOrder; error?: string } | null;
          result =
            response.ok && data?.order
              ? { id, order: data.order }
              : { id, order: null, error: data?.error ?? "Order not found." };
        } catch {
          result = { id, order: null, error: "Could not load this order." };
        }
        if (!cancelled) setLoaded((current) => ({ ...current, [id]: result }));
      }
    }

    void Promise.all(Array.from({ length: Math.min(PARALLEL, ids.length) }, () => worker()));
    return () => {
      cancelled = true;
    };
  }, [ids, status, isBackoffice]);

  const centered = "flex min-h-screen items-center justify-center px-5 text-center";
  if (status === "checking") return <main className={centered}>Loading…</main>;
  if (!user || !isBackoffice) {
    return (
      <main className={centered}>
        <div>
          <h1 className="text-2xl font-bold">Admin sign-in required</h1>
          <Link href="/admin/login" className="mt-4 inline-block rounded-full bg-red-600 px-6 py-3 font-semibold text-white">Sign in</Link>
        </div>
      </main>
    );
  }
  if (ids.length === 0) {
    return (
      <main className={centered}>
        <div>
          <h1 className="text-2xl font-bold">No orders selected</h1>
          <p className="mt-2 text-zinc-500">Go back to the orders list, tick the orders to pack, and press “Print packing slips”.</p>
          <Link href="/admin?panel=orders" className="mt-4 inline-block rounded-full bg-red-600 px-6 py-3 font-semibold text-white">Back to orders</Link>
        </div>
      </main>
    );
  }

  const results = ids.map((id) => loaded[id]).filter((entry): entry is Loaded => Boolean(entry));
  const slips = results.filter((entry): entry is Loaded & { order: SlipOrder } => entry.order !== null);
  const failures = results.filter((entry) => entry.order === null);
  const waiting = ids.length - results.length;

  return (
    <main className="min-h-screen bg-zinc-100 px-4 py-8 print:bg-white print:p-0">
      <div className="mx-auto mb-4 flex max-w-3xl flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href="/admin?panel=orders" className="rounded-full border bg-white px-5 py-2 text-sm font-semibold">← Orders</Link>
        <div className="flex flex-wrap items-center gap-3">
          <span role="status" className="text-sm text-zinc-600">
            {waiting > 0 ? `Loading ${results.length} of ${ids.length}…` : `${slips.length} slip${slips.length === 1 ? "" : "s"} ready`}
          </span>
          {!isAdmin && <span className="text-xs text-zinc-500">Phone numbers hidden for staff accounts</span>}
          <button
            type="button"
            disabled={waiting > 0 || slips.length === 0}
            onClick={() => window.print()}
            className="rounded-full bg-red-600 px-5 py-2 text-sm font-bold text-white disabled:bg-zinc-400"
          >
            Print {slips.length > 0 ? slips.length : ""}
          </button>
        </div>
      </div>

      {failures.length > 0 && (
        <div role="alert" className="mx-auto mb-4 max-w-3xl rounded-2xl bg-red-50 p-4 text-sm text-red-800 print:hidden">
          <p className="font-bold">{failures.length} order{failures.length === 1 ? "" : "s"} could not be loaded and will not be printed:</p>
          <ul className="mt-1 list-disc pl-5">
            {failures.map((entry) => (
              <li key={entry.id}>#{entry.id.slice(0, 8).toUpperCase()} — {entry.error}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-8 print:space-y-0">
        {slips.map((entry, index) => (
          <div key={entry.id} className={index < slips.length - 1 ? "break-after-page" : ""}>
            <PackingSlip order={entry.order} isAdmin={isAdmin} />
          </div>
        ))}
      </div>
    </main>
  );
}
