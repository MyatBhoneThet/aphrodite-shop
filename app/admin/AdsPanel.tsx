"use client";

/* eslint-disable @next/next/no-img-element */

import { ChangeEvent, FormEvent, useCallback, useEffect, useState } from "react";
import { authHeaders } from "../lib/client-auth";
import { useAdminText } from "../lib/useAdminText";

type AdminAd = {
  id: string;
  title: string;
  alt_text: string;
  image_url: string;
  href: string;
  width: number | null;
  height: number | null;
  is_active: boolean;
  sort_order: number;
};

type Draft = Pick<AdminAd, "title" | "alt_text" | "href">;

async function responseError(response: Response) {
  const body = await response.json().catch(() => ({})) as { error?: string };
  return body.error || "Unable to save the advertisement.";
}

export default function AdsPanel() {
  const a = useAdminText();
  const [ads, setAds] = useState<AdminAd[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [file, setFile] = useState<File | null>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  const [preview, setPreview] = useState("");
  const [title, setTitle] = useState("");
  const [altText, setAltText] = useState("");
  const [href, setHref] = useState("/catalog/laptops");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const response = await fetch("/api/admin/home-ads", { headers: authHeaders(), cache: "no-store" });
      if (!response.ok) { setError(await responseError(response)); return; }
      const data = await response.json() as { ads: AdminAd[] };
      const next = (data.ads ?? []).sort((left, right) => left.sort_order - right.sort_order);
      setAds(next);
      setDrafts(Object.fromEntries(next.map((ad) => [ad.id, { title: ad.title, alt_text: ad.alt_text, href: ad.href }])));
    } catch {
      setError("Unable to load advertisements. Check the Supabase storage configuration and try again.");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;
    if (preview) URL.revokeObjectURL(preview);
    setFile(selected); setDimensions(null); setPreview(""); setError("");
    if (!selected) return;
    const url = URL.createObjectURL(selected);
    setPreview(url);
    const image = new window.Image();
    image.onload = () => setDimensions({ width: image.naturalWidth, height: image.naturalHeight });
    image.src = url;
  }

  async function create(event: FormEvent) {
    event.preventDefault();
    if (!file) { setError("Choose a JPG, PNG or WebP banner."); return; }
    setBusy("create"); setError(""); setMessage("");
    try {
      const form = new FormData();
      form.set("file", file); form.set("title", title); form.set("alt_text", altText); form.set("href", href);
      if (dimensions) { form.set("width", String(dimensions.width)); form.set("height", String(dimensions.height)); }
      const response = await fetch("/api/admin/home-ads", { method: "POST", headers: authHeaders(), body: form });
      if (!response.ok) throw new Error(await responseError(response));
      setTitle(""); setAltText(""); setHref("/catalog/laptops"); setFile(null); setDimensions(null);
      if (preview) URL.revokeObjectURL(preview); setPreview("");
      setMessage("Advertisement added to the homepage."); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to add advertisement."); }
    finally { setBusy(""); }
  }

  async function patch(id: string, fields: Record<string, unknown>, success: string) {
    setBusy(id); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/admin/home-ads/${id}`, {
        method: "PATCH", headers: { ...authHeaders(), "Content-Type": "application/json" }, body: JSON.stringify(fields),
      });
      if (!response.ok) throw new Error(await responseError(response));
      setMessage(success); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to update advertisement."); }
    finally { setBusy(""); }
  }

  async function move(index: number, amount: number) {
    const otherIndex = index + amount;
    if (!ads[index] || !ads[otherIndex]) return;
    const current = ads[index]; const other = ads[otherIndex];
    setBusy(current.id); setError("");
    try {
      const headers = { ...authHeaders(), "Content-Type": "application/json" };
      const [first, second] = await Promise.all([
        fetch(`/api/admin/home-ads/${current.id}`, { method: "PATCH", headers, body: JSON.stringify({ sort_order: other.sort_order }) }),
        fetch(`/api/admin/home-ads/${other.id}`, { method: "PATCH", headers, body: JSON.stringify({ sort_order: current.sort_order }) }),
      ]);
      if (!first.ok) throw new Error(await responseError(first));
      if (!second.ok) throw new Error(await responseError(second));
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to reorder advertisements."); }
    finally { setBusy(""); }
  }

  async function remove(ad: AdminAd) {
    if (!window.confirm(`Delete “${ad.title}”? This cannot be undone.`)) return;
    setBusy(ad.id); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/admin/home-ads/${ad.id}`, { method: "DELETE", headers: authHeaders() });
      if (!response.ok) throw new Error(await responseError(response));
      setMessage("Advertisement deleted."); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to delete advertisement."); }
    finally { setBusy(""); }
  }

  const ratio = dimensions ? dimensions.width / dimensions.height : null;

  return <section className="space-y-6">
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-100 sm:p-6">
      <p className="text-sm font-bold uppercase tracking-wider text-red-600">{a("Homepage advertisements")}</p>
      <h2 className="mt-1 text-2xl font-black">{a("Add a custom banner")}</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
        {a("Recommended size: 1800 × 600 px (3:1 ratio), JPG, PNG or WebP, up to 8 MB. Keep important text away from the edges. Every image automatically fills the complete banner; other ratios are centre-cropped.")}
      </p>
      {(message || error) && <p className={`mt-4 rounded-xl p-3 text-sm font-semibold ${error ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>{error || message}</p>}

      <form onSubmit={create} className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,.75fr)]">
        <div className="space-y-4">
          <label className="block text-sm font-semibold">{a("Banner image")}
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={chooseFile} className="mt-2 block w-full rounded-xl border p-3 text-sm" />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold">{a("Internal title")}
              <input required maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="September laptop sale" className="mt-2 w-full rounded-xl border px-4 py-3 font-normal" />
            </label>
            <label className="text-sm font-semibold">{a("Click destination")}
              <input required value={href} onChange={(event) => setHref(event.target.value)} placeholder="/catalog/laptops" className="mt-2 w-full rounded-xl border px-4 py-3 font-normal" />
            </label>
          </div>
          <label className="block text-sm font-semibold">{a("Image description for accessibility")}
            <input required maxLength={240} value={altText} onChange={(event) => setAltText(event.target.value)} placeholder="Aphrodite laptop promotion" className="mt-2 w-full rounded-xl border px-4 py-3 font-normal" />
          </label>
          <button disabled={busy === "create"} className="rounded-full bg-red-600 px-6 py-3 font-bold text-white disabled:opacity-50">{busy === "create" ? a("Uploading…") : a("Add advertisement")}</button>
        </div>
        <div>
          <p className="mb-2 text-sm font-semibold">{a("3:1 storefront preview")}</p>
          <div className="aspect-[3/1] overflow-hidden rounded-2xl bg-zinc-100 ring-1 ring-zinc-200">
            {preview ? <img src={preview} alt="New advertisement preview" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-sm text-zinc-400">1800 × 600</div>}
          </div>
          {dimensions && <p className={`mt-2 text-xs font-semibold ${ratio && Math.abs(ratio - 3) <= .15 ? "text-green-700" : "text-amber-700"}`}>{dimensions.width} × {dimensions.height}px · {ratio?.toFixed(2)}:1 {ratio && Math.abs(ratio - 3) > .15 ? "— the sides or top and bottom will be cropped" : "— excellent fit"}</p>}
        </div>
      </form>
    </div>

    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-100 sm:p-6">
      <div className="flex items-end justify-between gap-3"><div><h2 className="text-xl font-bold">{a("Uploaded advertisements")}</h2><p className="mt-1 text-sm text-zinc-500">{a("Active banners appear before the built-in store slides.")}</p></div><button type="button" onClick={() => void load()} className="rounded-full border px-4 py-2 text-sm font-semibold">{a("Refresh")}</button></div>
      {ads.length === 0 ? <p className="mt-5 rounded-xl bg-zinc-50 p-5 text-sm text-zinc-500">{a("No custom advertisements yet.")}</p> : <div className="mt-5 space-y-5">
        {ads.map((ad, index) => {
          const draft = drafts[ad.id] ?? { title: ad.title, alt_text: ad.alt_text, href: ad.href };
          return <article key={ad.id} className="grid gap-4 rounded-2xl border p-4 xl:grid-cols-[320px_minmax(0,1fr)]">
            <div><div className="aspect-[3/1] overflow-hidden rounded-xl bg-zinc-100"><img src={ad.image_url} alt={ad.alt_text} className="h-full w-full object-cover" /></div><p className="mt-2 text-xs text-zinc-500">{ad.width && ad.height ? `${ad.width} × ${ad.height}px` : "Dimensions unavailable"}</p></div>
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2"><input aria-label="Advertisement title" value={draft.title} onChange={(event) => setDrafts((all) => ({ ...all, [ad.id]: { ...draft, title: event.target.value } }))} className="rounded-xl border px-3 py-2 text-sm" /><input aria-label="Advertisement link" value={draft.href} onChange={(event) => setDrafts((all) => ({ ...all, [ad.id]: { ...draft, href: event.target.value } }))} className="rounded-xl border px-3 py-2 text-sm" /></div>
              <input aria-label="Advertisement image description" value={draft.alt_text} onChange={(event) => setDrafts((all) => ({ ...all, [ad.id]: { ...draft, alt_text: event.target.value } }))} className="w-full rounded-xl border px-3 py-2 text-sm" />
              <div className="flex flex-wrap gap-2">
                <button disabled={busy === ad.id} onClick={() => void patch(ad.id, draft, "Advertisement updated.")} className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{a("Save")}</button>
                <button disabled={busy === ad.id} onClick={() => void patch(ad.id, { is_active: !ad.is_active }, ad.is_active ? "Advertisement hidden." : "Advertisement published.")} className={`rounded-full px-4 py-2 text-sm font-semibold ${ad.is_active ? "border" : "bg-green-600 text-white"}`}>{ad.is_active ? a("Hide") : a("Publish")}</button>
                <button disabled={index === 0 || busy === ad.id} onClick={() => void move(index, -1)} className="rounded-full border px-4 py-2 text-sm disabled:opacity-40">↑ {a("Earlier")}</button>
                <button disabled={index === ads.length - 1 || busy === ad.id} onClick={() => void move(index, 1)} className="rounded-full border px-4 py-2 text-sm disabled:opacity-40">↓ {a("Later")}</button>
                <button disabled={busy === ad.id} onClick={() => void remove(ad)} className="rounded-full bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-50">{a("Delete")}</button>
              </div>
            </div>
          </article>;
        })}
      </div>}
    </div>
  </section>;
}
