"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import DeliveryPinPicker, { type DeliveryPin } from "../components/DeliveryPinPicker";
import type { SavedAddress } from "../lib/address-book";
import { authHeaders } from "../lib/client-auth";
import { YANGON_TOWNSHIPS } from "../lib/delivery-country";
import { useCurrentUser } from "../lib/useCurrentUser";

type AddressDraft = {
  label: string;
  recipient_name: string;
  phone: string;
  address_line1: string;
  address_line2: string;
  township: string;
  postal_code: string;
  is_default: boolean;
};

const emptyDraft: AddressDraft = {
  label: "Home", recipient_name: "", phone: "", address_line1: "",
  address_line2: "", township: "", postal_code: "", is_default: false,
};

export default function AddressesPage() {
  const { user, status } = useCurrentUser();
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [draft, setDraft] = useState<AddressDraft>(emptyDraft);
  const [pin, setPin] = useState<DeliveryPin | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editorKey, setEditorKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadAddresses() {
    const response = await fetch("/api/addresses", { headers: authHeaders(), cache: "no-store" });
    const data = await response.json().catch(() => null) as { addresses?: SavedAddress[]; error?: string } | null;
    if (!response.ok) throw new Error(data?.error ?? "Unable to load your addresses.");
    setAddresses(data?.addresses ?? []);
  }

  useEffect(() => {
    if (status !== "ready") return;
    if (!user || user.role === "admin" || user.role === "staff") { queueMicrotask(() => setLoading(false)); return; }
    const timeout = window.setTimeout(() => {
      void loadAddresses().catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to load your addresses.")).finally(() => setLoading(false));
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [status, user]);

  function resetEditor() {
    setEditingId(null);
    setDraft({ ...emptyDraft, recipient_name: user?.full_name ?? "", phone: user?.phone ?? "", is_default: addresses.length === 0 });
    setPin(null);
    setEditorKey((value) => value + 1);
    setError("");
  }

  function editAddress(address: SavedAddress) {
    setEditingId(address.id);
    setDraft({
      label: address.label, recipient_name: address.recipient_name, phone: address.phone,
      address_line1: address.address_line1, address_line2: address.address_line2 ?? "",
      township: address.township, postal_code: address.postal_code ?? "", is_default: address.is_default,
    });
    setPin({ latitude: address.latitude, longitude: address.longitude, accuracy_m: address.accuracy_m, captured_at: new Date().toISOString() });
    setEditorKey((value) => value + 1);
    setMessage("");
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function resolvePinAddress(pinValue: DeliveryPin) {
    setResolving(true);
    setMessage("");
    try {
      const response = await fetch(`/api/geocode/reverse?lat=${encodeURIComponent(pinValue.latitude)}&lng=${encodeURIComponent(pinValue.longitude)}`, { headers: authHeaders(), cache: "no-store" });
      const data = await response.json().catch(() => null) as { address?: { address_line2?: string | null; township?: string | null; postal_code?: string | null }; error?: string } | null;
      if (!response.ok) throw new Error(data?.error ?? "Could not find an address for that pin.");
      if (data?.address) setDraft((current) => ({
        ...current,
        address_line2: data.address?.address_line2 || current.address_line2,
        township: data.address?.township || current.township,
        postal_code: data.address?.postal_code || current.postal_code,
      }));
      const autofilled = [
        data?.address?.address_line2,
        data?.address?.township ? `${data.address.township} Township` : null,
        data?.address?.postal_code,
      ].filter(Boolean).join(" · ");
      setMessage(autofilled
        ? `Autofilled: ${autofilled}. Add your house or building details.`
        : "The pin is confirmed, but this map location has no street details. Choose the township and type the street manually.");
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Choose the township and type the street manually.");
    } finally {
      setResolving(false);
    }
  }

  function handlePin(pinValue: DeliveryPin | null) {
    setPin(pinValue);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pin) { setError("Place and confirm the delivery pin."); return; }
    setSaving(true); setError(""); setMessage("");
    try {
      const response = await fetch(editingId ? `/api/addresses/${editingId}` : "/api/addresses", {
        method: editingId ? "PATCH" : "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, address_line2: draft.address_line2 || null, postal_code: draft.postal_code || null, latitude: pin.latitude, longitude: pin.longitude, accuracy_m: pin.accuracy_m }),
      });
      const data = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error ?? "Unable to save this address.");
      await loadAddresses();
      setMessage(editingId ? "Address updated." : "Address saved.");
      setEditingId(null); setDraft({ ...emptyDraft, recipient_name: user?.full_name ?? "", phone: user?.phone ?? "" }); setPin(null); setEditorKey((value) => value + 1);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save this address.");
    } finally { setSaving(false); }
  }

  async function makeDefault(address: SavedAddress) {
    setError("");
    const response = await fetch(`/api/addresses/${address.id}`, {
      method: "PATCH", headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ ...address, is_default: true }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => null) as { error?: string } | null;
      setError(data?.error ?? "Unable to set the default address."); return;
    }
    await loadAddresses(); setMessage(`${address.label} is now your default address.`);
  }

  async function remove(address: SavedAddress) {
    if (!window.confirm(`Delete your ${address.label} address?`)) return;
    const response = await fetch(`/api/addresses/${address.id}`, { method: "DELETE", headers: authHeaders() });
    if (!response.ok) { setError("Unable to delete this address."); return; }
    await loadAddresses(); setMessage("Address deleted.");
  }

  if (status === "checking" || loading) return <main className="flex min-h-screen items-center justify-center">Loading your addresses…</main>;
  if (!user || user.role === "admin" || user.role === "staff") return <main className="flex min-h-screen items-center justify-center px-5 text-center"><div><h1 className="text-3xl font-bold">Sign in with a customer account to manage addresses</h1><Link href="/login" className="mt-5 inline-block rounded-full bg-red-600 px-6 py-3 font-bold text-white">Login</Link></div></main>;

  return <main className="min-h-screen bg-zinc-50 text-zinc-950">
    <header className="border-b bg-white"><div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-4 sm:px-5 sm:py-5"><Link href="/" className="text-xl font-bold text-red-600 sm:text-2xl">Aphrodite</Link><Link href="/cart" className="shrink-0 rounded-full border px-3 py-2 text-xs font-semibold sm:px-5 sm:text-sm">Back to cart</Link></div></header>
    <section className="mx-auto grid max-w-5xl gap-8 px-5 py-10 lg:grid-cols-[1fr_0.9fr]">
      <div>
        <p className="text-sm font-bold uppercase tracking-widest text-red-600">Account</p>
        <h1 className="mt-2 text-4xl font-bold">My addresses</h1>
        <p className="mt-3 text-zinc-600">Save your Yangon delivery locations. Your first saved address becomes the default automatically.</p>
        {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
        {message && <p role="status" className="mt-4 rounded-xl bg-green-50 p-3 text-sm font-semibold text-green-800">{message}</p>}
        <form onSubmit={save} className="mt-6 space-y-4 rounded-3xl border bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3"><h2 className="text-xl font-bold">{editingId ? "Edit address" : "Add an address"}</h2>{editingId && <button type="button" onClick={resetEditor} className="text-sm font-semibold text-red-600">Cancel</button>}</div>
          <label className="block text-sm font-semibold">Label<input required value={draft.label} onChange={(event) => setDraft({ ...draft, label: event.target.value })} placeholder="Home or Office" className="mt-1 w-full rounded-xl border px-4 py-3 font-normal" /></label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-semibold">Recipient name<input required value={draft.recipient_name} onChange={(event) => setDraft({ ...draft, recipient_name: event.target.value })} className="mt-1 w-full rounded-xl border px-4 py-3 font-normal" /></label>
            <label className="block text-sm font-semibold">Phone<input required type="tel" value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} className="mt-1 w-full rounded-xl border px-4 py-3 font-normal" /></label>
          </div>
          <label className="block text-sm font-semibold">House number / building details<input required value={draft.address_line1} onChange={(event) => setDraft({ ...draft, address_line1: event.target.value })} placeholder="House, building, floor, or room" className="mt-1 w-full rounded-xl border px-4 py-3 font-normal" /></label>
          <label className="block text-sm font-semibold">Street / ward / landmark<input value={draft.address_line2} onChange={(event) => setDraft({ ...draft, address_line2: event.target.value })} placeholder="Filled from your pin; you can edit it" className="mt-1 w-full rounded-xl border px-4 py-3 font-normal" /></label>
          <div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm font-semibold">Yangon township<select required value={draft.township} onChange={(event) => setDraft({ ...draft, township: event.target.value })} className="mt-1 w-full rounded-xl border bg-white px-4 py-3 font-normal"><option value="">Select township</option>{YANGON_TOWNSHIPS.map((township) => <option key={township}>{township}</option>)}</select></label><label className="block text-sm font-semibold">Postal code (optional)<input value={draft.postal_code} onChange={(event) => setDraft({ ...draft, postal_code: event.target.value })} className="mt-1 w-full rounded-xl border px-4 py-3 font-normal" /></label></div>
          <DeliveryPinPicker key={editorKey} value={pin} onChange={handlePin} onPinPlaced={resolvePinAddress} addressLookupStatus={resolving ? "Finding the street and township from your pin…" : message} showDeliveryEstimate />
          {resolving && <p className="text-sm text-blue-700">Finding the street and township from your pin…</p>}
          {addresses.length > 0 && <label className="flex items-center gap-3 text-sm font-semibold"><input type="checkbox" checked={draft.is_default} onChange={(event) => setDraft({ ...draft, is_default: event.target.checked })} className="h-4 w-4 accent-red-600" />Use as my default address</label>}
          <button disabled={saving || resolving} className="w-full rounded-full bg-red-600 px-5 py-3 font-bold text-white disabled:bg-zinc-400">{saving ? "Saving…" : editingId ? "Update address" : "Save address"}</button>
        </form>
      </div>
      <aside className="lg:pt-24"><h2 className="text-xl font-bold">Saved locations</h2><div className="mt-4 space-y-4">{addresses.length === 0 ? <div className="rounded-3xl border border-dashed bg-white p-8 text-center text-zinc-500">No saved addresses yet.</div> : addresses.map((address) => <article key={address.id} className={`rounded-3xl border bg-white p-5 shadow-sm ${address.is_default ? "border-red-300" : "border-zinc-200"}`}><div className="flex items-start justify-between gap-3"><div><h3 className="text-lg font-bold">{address.label}</h3>{address.is_default && <span className="mt-1 inline-block rounded-full bg-red-50 px-2 py-1 text-xs font-bold text-red-700">Default</span>}</div><span className="text-sm font-semibold text-zinc-500">Yangon</span></div><p className="mt-4 font-semibold">{address.recipient_name} · {address.phone}</p><p className="mt-2 text-sm leading-6 text-zinc-600">{address.address_line1}{address.address_line2 ? `, ${address.address_line2}` : ""}<br />{address.township} Township{address.postal_code ? `, ${address.postal_code}` : ""}</p><div className="mt-5 flex flex-wrap gap-2"><button type="button" onClick={() => editAddress(address)} className="rounded-full border px-4 py-2 text-sm font-semibold">Edit</button>{!address.is_default && <button type="button" onClick={() => void makeDefault(address)} className="rounded-full border px-4 py-2 text-sm font-semibold">Set default</button>}<button type="button" onClick={() => void remove(address)} className="rounded-full px-4 py-2 text-sm font-semibold text-red-600">Delete</button></div></article>)}</div></aside>
    </section>
  </main>;
}
