"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { authHeaders } from "@/app/lib/client-auth";
import { formatCurrency, formatDateTime } from "@/app/lib/format";
import { useCurrentUser } from "@/app/lib/useCurrentUser";

type ReceiptOrder = {
  id: string;
  status: string;
  receipt_number?: string | null;
  total_amount: number;
  payment_status: "unpaid" | "collected" | "refunded";
  shipping_name: string;
  shipping_phone: string;
  shipping_address: string;
  confirmed_at?: string | null;
  created_at: string;
  order_items?: {
    id: string;
    quantity: number;
    unit_price: number;
    product_id: number;
    product?: { name: string } | null;
  }[];
};

export default function ReceiptPage() {
  const params = useParams<{ id: string }>();
  const { user, status } = useCurrentUser();
  const [order, setOrder] = useState<ReceiptOrder | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (status !== "ready" || !user || !params.id) return;
    async function loadReceipt() {
      const response = await fetch(`/api/orders/${params.id}`, {
        headers: authHeaders(),
        cache: "no-store",
      });
      const data = (await response.json().catch(() => null)) as
        | { order?: ReceiptOrder; error?: string }
        | null;
      if (!response.ok || !data?.order) {
        setError(data?.error ?? "Receipt not found.");
      } else if (!data.order.receipt_number) {
        setError("This receipt will be available after the order is confirmed.");
      } else {
        setOrder(data.order);
      }
    }
    void loadReceipt();
  }, [params.id, status, user]);

  if (status === "checking") {
    return <main className="flex min-h-screen items-center justify-center">Loading receipt...</main>;
  }
  if (!user) {
    return <main className="flex min-h-screen items-center justify-center px-5 text-center"><div><h1 className="text-2xl font-bold">Login to open this receipt</h1><Link href="/login" className="mt-5 inline-block rounded-full bg-red-600 px-6 py-3 font-semibold text-white">Login</Link></div></main>;
  }
  if (error) {
    return <main className="flex min-h-screen items-center justify-center px-5 text-center"><div><h1 className="text-2xl font-bold">Receipt unavailable</h1><p className="mt-2 text-zinc-500">{error}</p><Link href="/orders" className="mt-5 inline-block rounded-full border px-6 py-3 font-semibold">Back to orders</Link></div></main>;
  }
  if (!order) {
    return <main className="flex min-h-screen items-center justify-center">Loading receipt...</main>;
  }

  return (
    <main className="min-h-screen bg-zinc-100 px-4 py-8 print:bg-white print:p-0">
      <div className="mx-auto mb-4 flex max-w-3xl flex-wrap justify-between gap-3 print:hidden">
        <Link href="/orders" className="rounded-full border bg-white px-5 py-2 text-sm font-semibold">← Orders</Link>
        <button type="button" onClick={() => window.print()} className="rounded-full bg-red-600 px-5 py-2 text-sm font-bold text-white">Print / Save PDF</button>
      </div>
      <article className="mx-auto max-w-3xl bg-white p-4 shadow-sm print:max-w-none print:shadow-none sm:p-12">
        <header className="flex flex-wrap items-start justify-between gap-6 border-b pb-8">
          <Image src="/brand/aphrodite-myanmar.png" alt="Aphrodite Myanmar" width={218} height={77} className="h-16 w-auto" priority />
          <div className="text-right"><h1 className="text-3xl font-black">DIGITAL RECEIPT</h1><p className="mt-2 font-mono text-sm">{order.receipt_number}</p></div>
        </header>
        <section className="grid gap-6 border-b py-8 text-sm sm:grid-cols-2">
          <div><p className="text-xs font-bold uppercase tracking-wider text-zinc-400">Customer</p><p className="mt-2 font-bold">{order.shipping_name}</p><p>{order.shipping_phone}</p><p className="mt-1 text-zinc-600">{order.shipping_address}</p></div>
          <div className="sm:text-right"><p><span className="font-semibold">Order:</span> {order.id}</p><p><span className="font-semibold">Placed:</span> {formatDateTime(order.created_at)}</p><p><span className="font-semibold">Confirmed:</span> {formatDateTime(order.confirmed_at ?? order.created_at)}</p><p className="mt-2 capitalize"><span className="font-semibold">Status:</span> {order.status}</p></div>
        </section>
        <div className="my-8 overflow-x-auto" tabIndex={0} role="region" aria-label="Receipt items"><table className="w-full min-w-[480px] print:min-w-0 border-collapse text-left text-sm">
          <thead><tr className="border-b text-xs uppercase tracking-wider text-zinc-400"><th className="py-3">Item</th><th className="py-3 text-center">Qty</th><th className="py-3 text-right">Price</th><th className="py-3 text-right">Amount</th></tr></thead>
          <tbody>{(order.order_items ?? []).map((item) => <tr key={item.id} className="border-b"><td className="py-4 font-semibold">{item.product?.name ?? `Product #${item.product_id}`}</td><td className="py-4 text-center">{item.quantity}</td><td className="py-4 text-right">{formatCurrency(item.unit_price)}</td><td className="py-4 text-right font-semibold">{formatCurrency(item.unit_price * item.quantity)}</td></tr>)}</tbody>
        </table></div>
        <div className="ml-auto max-w-sm rounded-2xl bg-zinc-950 p-6 text-white"><div className="flex flex-wrap justify-between gap-2 text-xl font-black"><span>Total</span><span>{formatCurrency(order.total_amount)}</span></div><div className="mt-3 flex flex-wrap justify-between gap-2 text-sm text-zinc-300"><span>Payment</span><span>Cash on delivery</span></div><div className="mt-1 flex flex-wrap justify-between gap-2 text-sm text-zinc-300"><span>Payment status</span><span className="capitalize">{order.payment_status}</span></div></div>
        <footer className="mt-10 border-t pt-6 text-xs leading-5 text-zinc-500"><p>This document confirms the order. For cash-on-delivery orders it becomes proof of payment only after the payment status is marked collected.</p><p className="mt-2">Eligible wrong, damaged, or defective items may be requested for return within 7 days after delivery. See the return policy for the complete inspection, pickup, and refund process.</p></footer>
      </article>
    </main>
  );
}
