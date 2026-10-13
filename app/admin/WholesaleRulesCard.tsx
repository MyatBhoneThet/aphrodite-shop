"use client";

import { FormEvent, useEffect, useState } from "react";
import { authHeaders } from "@/app/lib/client-auth";
import { formatCurrency } from "@/app/lib/format";
import { confirmAction } from "./confirm";

type Rules = { minAmount: number; minUnits: number; prepayRequired: boolean };

/** The shop's wholesale terms: smallest order, and whether buyers must pay by bank transfer first. */
export default function WholesaleRulesCard() {
  const [rules, setRules] = useState<Rules | null>(null);
  const [amount, setAmount] = useState("0");
  const [units, setUnits] = useState("0");
  const [prepay, setPrepay] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/wholesale-rules", { headers: authHeaders(), cache: "no-store" })
      .then(async (response) => {
        const body = (await response.json().catch(() => null)) as ({ rules: Rules } & { error?: string }) | null;
        if (!response.ok || !body) throw new Error(body?.error ?? "Could not load wholesale terms.");
        if (cancelled) return;
        setRules(body.rules);
        setAmount(String(body.rules.minAmount));
        setUnits(String(body.rules.minUnits));
        setPrepay(body.rules.prepayRequired);
      })
      .catch((reason) => !cancelled && setError(reason instanceof Error ? reason.message : "Could not load wholesale terms."));
    return () => { cancelled = true; };
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    setError(""); setMessage("");

    const next = { min_amount: Number(amount), min_units: Number(units), prepay_required: prepay };
    if (rules) {
      const changes: string[] = [];
      if (rules.minAmount !== next.min_amount) {
        changes.push(`Minimum order amount: ${formatCurrency(rules.minAmount)} → ${formatCurrency(next.min_amount)}`);
      }
      if (rules.minUnits !== next.min_units) {
        changes.push(`Minimum number of items: ${rules.minUnits} → ${next.min_units}`);
      }
      if (rules.prepayRequired !== next.prepay_required) {
        changes.push(`Pay by bank transfer first: ${rules.prepayRequired ? "on" : "off"} → ${next.prepay_required ? "on" : "off"}`);
      }
      if (changes.length === 0) {
        setMessage("Nothing changed.");
        return;
      }
      // These terms apply to every wholesale order from the next one on.
      const confirmed = await confirmAction({
        title: "Change the wholesale terms?",
        message: "They apply to every wholesale order from the next one on.",
        consequences: changes,
        confirmLabel: "Save terms",
        tone: "caution",
        requireText: "CHANGE",
      });
      if (!confirmed) return;
    }

    setBusy(true);
    try {
      const response = await fetch("/api/admin/wholesale-rules", {
        method: "PUT",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ ...next, confirm: "CHANGE" }),
      });
      const body = (await response.json().catch(() => null)) as ({ rules: Rules } & { error?: string }) | null;
      if (!response.ok || !body) throw new Error(body?.error ?? "Could not save.");
      setRules(body.rules);
      setMessage("Wholesale terms saved. They apply to new orders straight away.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  const field = "mt-1 w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:border-red-500";
  return (
    <form onSubmit={save} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-100 sm:p-6">
      <h2 className="text-lg font-black">Wholesale terms</h2>
      <p className="mt-1 text-sm text-zinc-600">Apply to every wholesale (B2B) order. Retail customers are not affected. Use 0 for no minimum.</p>
      {!rules && !error && <p className="mt-3 text-sm text-zinc-400">Loading…</p>}
      {(rules || error) && (
        <>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold">Minimum order amount (MMK)
              <input type="number" min={0} step={1000} inputMode="numeric" value={amount} onChange={(event) => setAmount(event.target.value)} className={field} />
            </label>
            <label className="text-sm font-semibold">Minimum number of items
              <input type="number" min={0} step={1} inputMode="numeric" value={units} onChange={(event) => setUnits(event.target.value)} className={field} />
            </label>
          </div>
          <label className="mt-4 flex items-start gap-3 text-sm">
            <input type="checkbox" checked={prepay} onChange={(event) => setPrepay(event.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-red-600" />
            <span><strong>Wholesale orders must be paid by bank transfer first.</strong> Cash on delivery is hidden for wholesale buyers. Turn this off later for customers you trust.</span>
          </label>
          {error && <p role="alert" className="mt-3 text-sm font-semibold text-red-600">{error}</p>}
          {message && <p role="status" className="mt-3 text-sm font-semibold text-green-700">{message}</p>}
          <button type="submit" disabled={busy || !rules} className="mt-4 rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">{busy ? "Saving…" : "Save wholesale terms"}</button>
        </>
      )}
    </form>
  );
}
