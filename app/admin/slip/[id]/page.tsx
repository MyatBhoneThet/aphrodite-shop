"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { authHeaders } from "@/app/lib/client-auth";
import { formatCurrency, formatDateTime } from "@/app/lib/format";
import { useCurrentUser } from "@/app/lib/useCurrentUser";

type SlipOrder = {
  id: string;
  po_number?: string | null;
  status: string;
  total_amount: number;
  payment_method?: string | null;
  payment_status?: string | null;
  shipping_name: string;
  shipping_phone: string;
  shipping_address: string;
  shipping_city?: string | null;
  notes?: string | null;
  admin_order_note?: string | null;
  courier_name?: string | null;
  delivery_tracking_number?: string | null;
  created_at: string;
  order_items?: { id: string; quantity: number; unit_price: number; product_id: number; product?: { name: string; brand?: string } | null }[];
};

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

  const code = order.id.slice(0, 8).toUpperCase();
  const collect = order.payment_method === "cash_on_delivery" && order.payment_status !== "collected" && order.payment_status !== "refunded";
  const units = (order.order_items ?? []).reduce((sum, item) => sum + item.quantity, 0);
  // Staff never see customer phone numbers elsewhere in the admin, so the slip follows the same rule.
  const phone = isAdmin ? order.shipping_phone : null;

  return (
    <main className="min-h-screen bg-zinc-100 px-4 py-8 print:bg-white print:p-0">
      <div className="mx-auto mb-4 flex max-w-3xl flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href="/admin?panel=orders" className="rounded-full border bg-white px-5 py-2 text-sm font-semibold">← Orders</Link>
        <div className="flex items-center gap-3">
          {!isAdmin && <span className="text-xs text-zinc-500">Phone number hidden for staff accounts</span>}
          <button type="button" onClick={() => window.print()} className="rounded-full bg-red-600 px-5 py-2 text-sm font-bold text-white">Print</button>
        </div>
      </div>

      <article className="mx-auto max-w-3xl space-y-6 bg-white p-6 shadow-sm print:max-w-none print:space-y-5 print:p-0 print:shadow-none sm:p-10">
        {/* Delivery label: stick this part on the parcel. */}
        <section aria-label="Delivery label" className="break-inside-avoid rounded-2xl border-4 border-zinc-950 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b-2 border-zinc-950 pb-3">
            <Image src="/brand/aphrodite-myanmar.png" alt="Aphrodite Myanmar" width={218} height={77} className="h-10 w-auto" />
            <div className="text-right">
              <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Order</p>
              <p className="font-mono text-2xl font-black">#{code}</p>
              {order.po_number && <p className="text-sm font-bold">PO {order.po_number}</p>}
            </div>
          </div>
          <p className="mt-4 text-xs font-bold uppercase tracking-widest text-zinc-500">Deliver to</p>
          <p className="mt-1 break-words text-3xl font-black leading-tight">{order.shipping_name}</p>
          {phone && <p className="mt-1 text-2xl font-bold">{phone}</p>}
          <p className="mt-2 whitespace-pre-wrap break-words text-xl leading-snug">{order.shipping_address}</p>
          {order.shipping_city && <p className="mt-1 text-lg font-bold">{order.shipping_city}</p>}
          <div className="mt-4 flex flex-wrap items-stretch gap-3">
            <div className={`flex-1 rounded-xl p-3 text-center ${collect ? "bg-zinc-950 text-white" : "border-2 border-zinc-950"}`}>
              <p className="text-xs font-bold uppercase tracking-widest">{collect ? "Collect cash on delivery" : "Already paid"}</p>
              <p className="text-3xl font-black">{collect ? formatCurrency(order.total_amount) : "DO NOT COLLECT"}</p>
            </div>
            <div className="rounded-xl border-2 border-zinc-300 p-3 text-center">
              <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Items</p>
              <p className="text-3xl font-black">{units}</p>
            </div>
          </div>
          {(order.courier_name || order.delivery_tracking_number) && (
            <p className="mt-3 text-sm font-semibold">{[order.courier_name, order.delivery_tracking_number && `Tracking ${order.delivery_tracking_number}`].filter(Boolean).join(" · ")}</p>
          )}
          {order.notes && <p className="mt-3 rounded-lg bg-zinc-100 p-2 text-sm"><span className="font-bold">Customer note:</span> {order.notes}</p>}
        </section>

        <p aria-hidden className="border-t-2 border-dashed border-zinc-300 pt-1 text-center text-xs text-zinc-400">✂ cut here</p>

        {/* Packing list: stays in the box or with the packer. */}
        <section aria-label="Packing list" className="break-inside-avoid">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <h1 className="text-2xl font-black">Packing slip</h1>
            <p className="text-sm text-zinc-500">Order #{code} · placed {formatDateTime(order.created_at)}</p>
          </div>
          <table className="mt-3 w-full border-collapse text-sm">
            <thead>
              <tr className="border-b-2 border-zinc-950 text-left text-xs uppercase tracking-wider">
                <th className="w-10 py-2">Packed</th><th className="py-2">Item</th><th className="w-14 py-2 text-center">Qty</th><th className="w-32 py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {(order.order_items ?? []).map((item) => (
                <tr key={item.id} className="border-b align-top">
                  <td className="py-3"><span className="inline-block h-5 w-5 rounded border-2 border-zinc-950" aria-hidden /></td>
                  <td className="py-3 font-semibold">{item.product?.name ?? `Product #${item.product_id}`}{item.product?.brand && <span className="block text-xs font-normal text-zinc-500">{item.product.brand}</span>}</td>
                  <td className="py-3 text-center font-black">{item.quantity}</td>
                  <td className="py-3 text-right">{formatCurrency(item.unit_price * item.quantity)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr><td colSpan={3} className="pt-3 text-right font-bold">Total</td><td className="pt-3 text-right text-lg font-black">{formatCurrency(order.total_amount)}</td></tr>
            </tfoot>
          </table>
          {order.admin_order_note && <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm"><span className="font-bold">Staff note:</span> {order.admin_order_note}</p>}
          <div className="mt-8 grid grid-cols-2 gap-8 text-xs text-zinc-500">
            <p className="border-t border-zinc-400 pt-1">Packed by</p>
            <p className="border-t border-zinc-400 pt-1">Checked by</p>
          </div>
        </section>
      </article>
    </main>
  );
}
