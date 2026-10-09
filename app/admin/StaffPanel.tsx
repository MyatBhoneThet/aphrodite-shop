"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { authHeaders } from "../lib/client-auth";
import { formatDateTime } from "../lib/format";

type StaffAccount = {
  id: string;
  email: string;
  full_name: string | null;
  created_at?: string;
};

async function responseError(response: Response) {
  const data = (await response.json().catch(() => null)) as { error?: string } | null;
  return data?.error ?? "Request failed.";
}

export default function StaffPanel() {
  const [staff, setStaff] = useState<StaffAccount[]>([]);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/staff", { headers: authHeaders(), cache: "no-store" });
    if (!response.ok) throw new Error(await responseError(response));
    const data = (await response.json()) as { staff: StaffAccount[] };
    setStaff(data.staff ?? []);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load().catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to load staff."));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function grant(event: FormEvent) {
    event.preventDefault();
    setBusy("grant"); setError(""); setMessage("");
    try {
      const response = await fetch("/api/admin/staff", {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!response.ok) throw new Error(await responseError(response));
      setEmail("");
      setMessage("Staff access granted. The account can use the staff dashboard on its next request.");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to grant staff access.");
    } finally { setBusy(""); }
  }

  async function remove(account: StaffAccount) {
    if (!window.confirm(`Delete staff account ${account.email}? This removes the login permanently.`)) return;
    setBusy(account.id); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/admin/staff/${account.id}`, { method: "DELETE", headers: authHeaders() });
      if (!response.ok) throw new Error(await responseError(response));
      setMessage("Staff account deleted.");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to delete staff account.");
    } finally { setBusy(""); }
  }

  return <section className="mt-6 space-y-6">
    <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-zinc-100">
      <h2 className="text-xl font-bold">Staff access</h2>
      <p className="mt-2 text-sm text-zinc-500">Grant an existing customer account the restricted staff role. Staff cannot manage roles.</p>
      {(message || error) && <p className={`mt-4 rounded-xl p-3 text-sm font-semibold ${error ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>{error || message}</p>}
      <form onSubmit={grant} className="mt-5 flex flex-col gap-3 sm:flex-row">
        <input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="existing-account@example.com" className="min-w-0 flex-1 rounded-xl border px-4 py-3" />
        <button disabled={busy === "grant"} className="rounded-full bg-red-600 px-6 py-3 font-bold text-white disabled:opacity-50">{busy === "grant" ? "Granting…" : "Grant staff access"}</button>
      </form>
    </div>
    <div className="rounded-2xl bg-white shadow-sm ring-1 ring-zinc-100">
      <div className="border-b px-6 py-4"><h3 className="font-bold">Current staff</h3></div>
      {staff.length === 0 ? <p className="p-6 text-sm text-zinc-500">No staff accounts yet.</p> : <ul className="divide-y">
        {staff.map((account) => <li key={account.id} className="flex flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div><p className="font-semibold">{account.full_name || "Staff member"}</p><p className="text-sm text-zinc-500">{account.email}{account.created_at ? ` · joined ${formatDateTime(account.created_at)}` : ""}</p></div>
          <button type="button" disabled={busy === account.id} onClick={() => void remove(account)} className="rounded-full bg-red-50 px-4 py-2 text-sm font-bold text-red-700 disabled:opacity-50">Delete account</button>
        </li>)}
      </ul>}
    </div>
  </section>;
}
