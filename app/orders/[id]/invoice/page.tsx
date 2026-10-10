"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { authHeaders } from "@/app/lib/client-auth";
import { formatCurrency, formatDateTime } from "@/app/lib/format";
import { useCurrentUser } from "@/app/lib/useCurrentUser";

type Invoice = {
  kind: "proforma" | "invoice";
  number: string;
  issued_at: string;
  seller: { name: string; address: string; phones: string[]; taxId: string | null; email: string | null };
  buyer: { name: string; tax_id: string | null; address: string | null; billing_name: string | null; billing_phone: string | null; billing_email: string | null };
  order: {
    id: string; created_at: string; po_number: string | null; total_amount: number; payment_method: string | null;
    shipping_name: string; shipping_phone: string; shipping_address: string;
    items: { name: string; quantity: number; unit_price: number }[];
  };
  pay_to: { label: string; holder: string; account_number: string | null }[];
};

export default function InvoicePage() {
  const params = useParams<{ id: string }>();
  const { user, status } = useCurrentUser();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [error, setError] = useState("");
  const isAdmin = user?.role === "admin";
  const backHref = isAdmin ? "/admin?panel=orders" : "/orders";

  useEffect(() => {
    if (status !== "ready" || !user || !params.id) return;
    fetch(`/api/orders/${params.id}/invoice`, { headers: authHeaders(), cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json().catch(() => null)) as (Invoice & { error?: string }) | null;
        if (!response.ok || !data) throw new Error(data?.error ?? "Invoice not found.");
        setInvoice(data);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Invoice not found."));
  }, [status, user, params.id]);

  const centered = "flex min-h-screen items-center justify-center px-5 text-center";
  if (status === "checking") return <main className={centered}>Loading…</main>;
  if (!user) return <main className={centered}><div><h1 className="text-2xl font-bold">Login to open this invoice</h1><Link href="/login" className="mt-4 inline-block rounded-full bg-red-600 px-6 py-3 font-semibold text-white">Login</Link></div></main>;
  if (error) return <main className={centered}><div><h1 className="text-2xl font-bold">Invoice unavailable</h1><p className="mt-2 text-zinc-500">{error}</p><Link href={backHref} className="mt-4 inline-block rounded-full border px-5 py-2 font-semibold">Back</Link></div></main>;
  if (!invoice) return <main className={centered}>Loading…</main>;

  const proforma = invoice.kind === "proforma";
  const { seller, buyer, order } = invoice;

  return (
    <main className="min-h-screen bg-zinc-100 px-4 py-8 print:bg-white print:p-0">
      <div className="mx-auto mb-4 flex max-w-3xl flex-wrap justify-between gap-3 print:hidden">
        <Link href={backHref} className="rounded-full border bg-white px-5 py-2 text-sm font-semibold">← Orders</Link>
        <button type="button" onClick={() => window.print()} className="rounded-full bg-red-600 px-5 py-2 text-sm font-bold text-white">Print / Save PDF</button>
      </div>

      <article className="mx-auto max-w-3xl bg-white p-6 shadow-sm print:max-w-none print:shadow-none sm:p-12">
        <header className="flex flex-wrap items-start justify-between gap-6 border-b pb-8">
          <div>
            <Image src="/brand/aphrodite-myanmar.png" alt="Aphrodite Myanmar" width={218} height={77} className="h-14 w-auto" priority />
            <p className="mt-3 text-sm font-bold">{seller.name}</p>
            <p className="max-w-xs text-xs leading-5 text-zinc-600">{seller.address}</p>
            <p className="text-xs text-zinc-600">{seller.phones.join(" · ")}</p>
            {seller.email && <p className="text-xs text-zinc-600">{seller.email}</p>}
            {seller.taxId && <p className="text-xs font-semibold text-zinc-700">Tax / registration no.: {seller.taxId}</p>}
          </div>
          <div className="text-right">
            <h1 className="text-3xl font-black uppercase tracking-tight">{proforma ? "Proforma invoice" : "Invoice"}</h1>
            <p className="mt-2 font-mono text-sm font-semibold">{invoice.number}</p>
            <p className="mt-1 text-xs text-zinc-500">Date: {formatDateTime(invoice.issued_at)}</p>
            <p className="text-xs text-zinc-500">Order: #{order.id.slice(0, 8).toUpperCase()}</p>
            {order.po_number && <p className="text-xs font-bold text-zinc-800">Customer PO: {order.po_number}</p>}
          </div>
        </header>

        <section className="grid gap-6 border-b py-8 text-sm sm:grid-cols-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">Bill to</p>
            <p className="mt-2 text-base font-bold">{buyer.name}</p>
            {buyer.address && <p className="whitespace-pre-wrap text-zinc-700">{buyer.address}</p>}
            {buyer.tax_id && <p className="mt-1 text-zinc-700">Tax / registration no.: <strong>{buyer.tax_id}</strong></p>}
            {(buyer.billing_name || buyer.billing_phone) && <p className="mt-1 text-zinc-700">{[buyer.billing_name, buyer.billing_phone].filter(Boolean).join(" · ")}</p>}
            {buyer.billing_email && <p className="text-zinc-700">{buyer.billing_email}</p>}
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">Deliver to</p>
            <p className="mt-2 font-bold">{order.shipping_name}</p>
            <p className="whitespace-pre-wrap text-zinc-700">{order.shipping_address}</p>
            <p className="text-zinc-700">{order.shipping_phone}</p>
          </div>
        </section>

        <div className="my-8" role="region" aria-label="Invoice items">
          <table className="w-full border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="border-b-2 border-zinc-950 text-left text-xs uppercase tracking-wider">
                <th className="py-3 pr-2">Item</th><th className="py-3 text-center">Qty</th><th className="hidden py-3 text-right sm:table-cell print:table-cell">Unit price</th><th className="py-3 pl-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item, index) => (
                <tr key={`${item.name}-${index}`} className="border-b align-top">
                  <td className="py-3 pr-2 font-semibold">{item.name}<span className="block text-[11px] font-normal text-zinc-500 sm:hidden print:hidden">{formatCurrency(item.unit_price)} each</span></td>
                  <td className="py-3 text-center">{item.quantity}</td>
                  <td className="hidden py-3 text-right sm:table-cell print:table-cell">{formatCurrency(item.unit_price)}</td>
                  <td className="py-3 pl-2 text-right">{formatCurrency(item.unit_price * item.quantity)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="sm:hidden print:hidden"><td colSpan={2} className="pt-4 text-right text-sm font-bold">Total (MMK)</td><td className="pt-4 pl-2 text-right text-base font-black">{formatCurrency(order.total_amount)}</td></tr>
              <tr className="hidden sm:table-row print:table-row"><td colSpan={3} className="pt-4 text-right text-base font-bold">Total (MMK)</td><td className="pt-4 pl-2 text-right text-xl font-black">{formatCurrency(order.total_amount)}</td></tr>
            </tfoot>
          </table>
        </div>

        {proforma ? (
          <section className="rounded-2xl border-2 border-zinc-950 p-5 text-sm break-inside-avoid">
            <p className="text-xs font-bold uppercase tracking-wider">How to pay</p>
            <p className="mt-2">This is a request for payment, not a receipt. Please pay <strong>{formatCurrency(order.total_amount)}</strong> by bank transfer, then upload your transfer slip on the order page. We ship once the payment is checked.</p>
            <ul className="mt-3 space-y-2">
              {invoice.pay_to.map((account) => (
                <li key={account.label}>
                  <span className="font-bold">{account.label}</span> · {account.holder}
                  {account.account_number && <span className="ml-2 font-mono text-base font-bold">{account.account_number}</span>}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-zinc-500">Please quote order #{order.id.slice(0, 8).toUpperCase()}{order.po_number ? ` (your PO ${order.po_number})` : ""} when you transfer.</p>
          </section>
        ) : (
          <p className="rounded-2xl bg-zinc-50 p-4 text-sm text-zinc-700 break-inside-avoid">Payment received with thanks. Please keep this invoice for your records.</p>
        )}

        <div className="mt-12 grid grid-cols-2 gap-6 text-xs text-zinc-500 break-inside-avoid sm:gap-10">
          <p className="border-t border-zinc-400 pt-1">Authorised signature</p>
          <p className="border-t border-zinc-400 pt-1">Company stamp</p>
        </div>

        <footer className="mt-10 border-t pt-4 text-xs leading-5 text-zinc-500">
          <p>All prices are in Myanmar kyats (MMK). {proforma ? "Prices and availability are confirmed when your payment has been checked." : "Returns follow the shop's 7-day return policy."}</p>
        </footer>
      </article>
    </main>
  );
}
