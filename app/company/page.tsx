"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import BrandLogo from "../components/BrandLogo";
import { LiquidBackdrop, authButtonClass, authFieldClass, authLabelClass, glassCardClass } from "../components/AuthShell";
import { authHeaders } from "../lib/client-auth";
import { formatDateTime } from "../lib/format";
import { useCurrentUser } from "../lib/useCurrentUser";

type Company = {
  business_name: string | null;
  licence_required: boolean;
  tax_id: string | null;
  address: string | null;
  billing_name: string | null;
  billing_phone: string | null;
  billing_email: string | null;
  licence: { status: "none" | "pending" | "verified" | "rejected"; file_name: string | null; submitted_at: string | null; review_note: string | null };
};

const STATUS_TEXT = {
  none: { label: "Not uploaded", style: "bg-zinc-100 text-zinc-700" },
  pending: { label: "Waiting for review", style: "bg-amber-100 text-amber-800" },
  verified: { label: "Verified", style: "bg-emerald-100 text-emerald-800" },
  rejected: { label: "Needs another upload", style: "bg-red-100 text-red-700" },
} as const;

function Notice({ title, text, action }: { title: string; text: string; action?: { href: string; label: string } }) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-white px-5 text-center text-zinc-950">
      <LiquidBackdrop />
      <div className={`relative w-full max-w-md ${glassCardClass}`}>
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        <p className="mt-3 text-sm text-zinc-600">{text}</p>
        {action && <Link href={action.href} className={`mt-7 inline-block ${authButtonClass}`}>{action.label}</Link>}
      </div>
    </main>
  );
}

export default function CompanyPage() {
  const { user, status } = useCurrentUser();
  const [company, setCompany] = useState<Company | null>(null);
  const [form, setForm] = useState({ tax_id: "", address: "", billing_name: "", billing_phone: "", billing_email: "" });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const response = await fetch("/api/company", { headers: authHeaders(), cache: "no-store" });
    const data = (await response.json().catch(() => null)) as (Company & { error?: string }) | null;
    if (!response.ok || !data) throw new Error(data?.error ?? "Could not load your company details.");
    setCompany(data);
    setForm({
      tax_id: data.tax_id ?? "", address: data.address ?? "", billing_name: data.billing_name ?? "",
      billing_phone: data.billing_phone ?? "", billing_email: data.billing_email ?? "",
    });
  }, []);

  useEffect(() => {
    if (status !== "ready" || user?.role !== "wholesale") return;
    const timer = window.setTimeout(() => void load().catch((reason) => setError(reason instanceof Error ? reason.message : "Could not load.")), 0);
    return () => window.clearTimeout(timer);
  }, [status, user, load]);

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/company", {
        method: "PUT",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error ?? "Could not save.");
      setMessage("Company details saved. They will appear on your invoices.");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  async function upload(file: File | undefined) {
    if (!file) return;
    setUploading(true); setError(""); setMessage("");
    try {
      const body = new FormData();
      body.set("file", file);
      const response = await fetch("/api/company/licence", { method: "POST", headers: authHeaders(), body });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error ?? "Could not upload the file.");
      setMessage("Licence uploaded. The shop will review it soon.");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not upload the file.");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  if (status === "checking") return <Notice title="Loading" text="One moment while we open your account." />;
  if (!user) return <Notice title="Login to continue" text="Company details belong to your wholesale account." action={{ href: "/login", label: "Login" }} />;
  if (user.role !== "wholesale") return <Notice title="Wholesale accounts only" text="This page is for approved wholesale (B2B) customers." action={{ href: "/", label: "Back to store" }} />;

  const licence = company?.licence;
  const badge = licence ? STATUS_TEXT[licence.status] : null;

  return (
    <main className="relative min-h-screen overflow-hidden bg-white text-zinc-950">
      <LiquidBackdrop />
      <div className="relative mx-auto max-w-3xl px-5 py-10 sm:py-14">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/" aria-label="Aphrodite Myanmar home"><BrandLogo /></Link>
          <Link href="/orders" className="rounded-full border bg-white/70 px-4 py-2 text-sm font-semibold hover:border-red-500 hover:text-red-600">My orders</Link>
        </header>

        <h1 className="mt-8 text-3xl font-bold tracking-tight sm:text-4xl">Company details</h1>
        <p className="mt-2 text-sm text-zinc-600">
          {company?.business_name ? <><strong>{company.business_name}</strong> · </> : null}
          These appear on your proforma invoices and invoices. A tax or registration number is optional: add it only if your business has one.
        </p>

        {(message || error) && <p role={error ? "alert" : "status"} className={`mt-5 rounded-2xl p-4 text-sm font-semibold ${error ? "bg-red-50 text-red-700" : "bg-green-50 text-green-800"}`}>{error || message}</p>}

        <form onSubmit={save} className={`mt-6 space-y-5 ${glassCardClass}`}>
          <div>
            <label htmlFor="company-address" className={authLabelClass}>Company address *</label>
            <textarea id="company-address" required rows={3} maxLength={400} value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} className={authFieldClass} placeholder="Street, township, city" />
          </div>
          <div>
            <label htmlFor="company-tax" className={authLabelClass}>Tax / registration number <span className="font-normal text-zinc-500">(optional)</span></label>
            <input id="company-tax" maxLength={60} value={form.tax_id} onChange={(event) => setForm({ ...form, tax_id: event.target.value })} className={authFieldClass} />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="billing-name" className={authLabelClass}>Billing contact <span className="font-normal text-zinc-500">(optional)</span></label>
              <input id="billing-name" maxLength={160} value={form.billing_name} onChange={(event) => setForm({ ...form, billing_name: event.target.value })} className={authFieldClass} />
            </div>
            <div>
              <label htmlFor="billing-phone" className={authLabelClass}>Billing phone <span className="font-normal text-zinc-500">(optional)</span></label>
              <input id="billing-phone" maxLength={40} value={form.billing_phone} onChange={(event) => setForm({ ...form, billing_phone: event.target.value })} className={authFieldClass} />
            </div>
          </div>
          <div>
            <label htmlFor="billing-email" className={authLabelClass}>Billing email <span className="font-normal text-zinc-500">(optional)</span></label>
            <input id="billing-email" type="email" maxLength={200} value={form.billing_email} onChange={(event) => setForm({ ...form, billing_email: event.target.value })} className={authFieldClass} />
          </div>
          <button type="submit" disabled={saving} className={authButtonClass}>{saving ? "Saving…" : "Save company details"}</button>
        </form>

        <section className={`mt-6 ${glassCardClass}`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold">Business licence</h2>
              <p className="mt-1 text-sm text-zinc-600">
                {company?.licence_required
                  ? "Upload your business licence. Wholesale prices switch on once the shop has verified it."
                  : "Upload a photo or PDF of your business licence so the shop can verify your business."}
              </p>
            </div>
            {badge && <span className={`rounded-full px-3 py-1 text-xs font-bold ${badge.style}`}>{badge.label}</span>}
          </div>

          {licence?.file_name && <p className="mt-3 text-sm text-zinc-700">File: <strong className="break-all">{licence.file_name}</strong>{licence.submitted_at ? ` · sent ${formatDateTime(licence.submitted_at)}` : ""}</p>}
          {licence?.status === "rejected" && licence.review_note && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800"><strong>Why it was not accepted:</strong> {licence.review_note}</p>}

          {licence?.status === "verified" ? (
            <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">✓ Your business licence is verified.</p>
          ) : (
            <div className="mt-4">
              <input ref={fileInput} id="licence-file" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="sr-only" onChange={(event) => void upload(event.target.files?.[0])} />
              <label htmlFor="licence-file" className={`inline-block cursor-pointer ${authButtonClass} ${uploading ? "opacity-60" : ""}`}>{uploading ? "Uploading…" : licence?.status === "none" ? "Choose file to upload" : "Upload a different file"}</label>
              <p className="mt-2 text-xs text-zinc-500">JPG, PNG, WebP or PDF, up to 10 MB. Only the shop can see it.</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
