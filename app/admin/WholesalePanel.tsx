"use client";

import { useAdminText } from "../lib/useAdminText";

import { useCallback, useEffect, useState } from "react";
import { authHeaders } from "../lib/client-auth";
import { formatDateTime } from "../lib/format";
import { useDebouncedValue } from "../lib/useDebouncedValue";

type PriceList = {
  id: string;
  name: string;
  is_active: boolean;
};

type Account = {
  id: string;
  email: string;
  full_name: string | null;
  role: "normal" | "wholesale" | "admin";
  wholesale_status: "not_applied" | "approved" | "suspended";
  price_list_id: string | null;
  created_at?: string;
  business_name?: string | null;
  business_verified_at?: string | null;
};

type InviteCode = {
  id: string;
  code_hint: string;
  label: string | null;
  price_list_id: string | null;
  max_uses: number;
  use_count: number;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
  last_used_at: string | null;
};

type AuditEntry = {
  id: string;
  actor_id: string | null;
  action: string;
  target_type: string;
  target_id: string;
  previous_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  created_at: string;
};

const FILTERS = ["all", "wholesale"] as const;

async function readError(response: Response) {
  const data = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;
  return data?.error ?? "Request failed.";
}

export default function WholesalePanel() {
  const a = useAdminText();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [priceLists, setPriceLists] = useState<PriceList[]>([]);
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [selectedPriceList, setSelectedPriceList] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showAudit, setShowAudit] = useState(false);
  const [businessDraft, setBusinessDraft] = useState<{ account: Account; priceListId: string; name: string; note: string; verified: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  const [inviteCodes, setInviteCodes] = useState<InviteCode[]>([]);
  const [inviteLabel, setInviteLabel] = useState("");
  const [inviteUses, setInviteUses] = useState("1");
  const [inviteDays, setInviteDays] = useState("30");
  const [freshCode, setFreshCode] = useState("");
  const [creatingCode, setCreatingCode] = useState(false);

  const loadInviteCodes = useCallback(async () => {
    const response = await fetch("/api/admin/wholesale/invite-codes", {
      headers: authHeaders(),
      cache: "no-store",
    });

    if (response.ok) {
      const data = (await response.json()) as { codes: InviteCode[] };
      setInviteCodes(data.codes ?? []);
    }
  }, []);

  async function createInviteCode() {
    setMessage("");
    setError("");
    setFreshCode("");
    setCreatingCode(true);

    try {
      const response = await fetch("/api/admin/wholesale/invite-codes", {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          label: inviteLabel.trim() || undefined,
          max_uses: Number(inviteUses) || 1,
          expires_in_days: Number(inviteDays) || undefined,
        }),
      });

      if (!response.ok) throw new Error(await readError(response));

      const data = (await response.json()) as { code: string };
      setFreshCode(data.code);
      setInviteLabel("");
      await loadInviteCodes();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create code.");
    } finally {
      setCreatingCode(false);
    }
  }

  async function deactivateInviteCode(id: string) {
    setMessage("");
    setError("");

    try {
      const response = await fetch(`/api/admin/wholesale/invite-codes/${id}`, {
        method: "PATCH",
        headers: authHeaders(),
      });

      if (!response.ok) throw new Error(await readError(response));

      setMessage("Registration code turned off.");
      await loadInviteCodes();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update code.");
    }
  }

  const load = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();
      if (filter === "wholesale") params.set("filter", "wholesale");
      if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());

      const query = params.toString();
      const [accountsResponse, listsResponse] = await Promise.all([
        fetch(`/api/admin/wholesale/accounts${query ? `?${query}` : ""}`, {
          headers: authHeaders(),
          cache: "no-store",
        }),
        fetch("/api/admin/price-lists", {
          headers: authHeaders(),
          cache: "no-store",
        }),
      ]);

      if (!accountsResponse.ok) throw new Error(await readError(accountsResponse));
      if (!listsResponse.ok) throw new Error(await readError(listsResponse));

      const accountsData = (await accountsResponse.json()) as {
        accounts: Account[];
      };
      const listsData = (await listsResponse.json()) as {
        priceLists: PriceList[];
      };

      setAccounts(accountsData.accounts ?? []);
      setPriceLists(listsData.priceLists ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load data.");
    } finally {
      setIsLoading(false);
    }
  }, [filter, debouncedSearch]);

  useEffect(() => {
    async function loadOnMount() {
      await load();
      await loadInviteCodes();
    }

    loadOnMount();
  }, [load, loadInviteCodes]);

  async function loadAudit() {
    const response = await fetch("/api/admin/audit-log?limit=50", {
      headers: authHeaders(),
      cache: "no-store",
    });

    if (response.ok) {
      const data = (await response.json()) as { entries: AuditEntry[] };
      setAuditEntries(data.entries ?? []);
    }
  }

  async function updateAccount(
    account: Account,
    update:
      | { action: "grant"; price_list_id?: string; business_name: string; business_review_note: string; business_verified: true }
      | { action: "revoke" }
      | { action: "suspend" }
      | { action: "reactivate" }
      | { action: "assign_price_list"; price_list_id: string }
  ) {
    setMessage("");
    setError("");
    setSaving(true);

    try {
      const response = await fetch(`/api/admin/wholesale/accounts/${account.id}`, {
        method: "PATCH",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(update),
      });

      if (!response.ok) throw new Error(await readError(response));

      setMessage(
        update.action === "grant"
          ? `${account.email} is now a wholesale account.`
          : update.action === "revoke"
          ? `Wholesale access removed for ${account.email}.`
          : "Account updated."
      );
      await load();
      setBusinessDraft(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update account.");
    } finally { setSaving(false); }
  }

  function handleRevoke(account: Account) {
    // Reversible action, no unsupported browser confirmation dialog.
    updateAccount(account, { action: "revoke" });
  }

  return (
    <section className="mt-6 space-y-6">
      {businessDraft && <form onSubmit={event => {
        event.preventDefault();
        if (!businessDraft.verified || saving) return;
        void updateAccount(businessDraft.account, { action: "grant", price_list_id: businessDraft.priceListId || undefined,
          business_name: businessDraft.name, business_review_note: businessDraft.note, business_verified: true });
      }} className="space-y-4 rounded-2xl border border-blue-200 bg-white p-5">
        <h3 className="text-lg font-bold">{a("Verify B2B business:")} {businessDraft.account.email}</h3>
        <p className="text-sm text-zinc-600">{a("Call the business contact, check the shop/business address and reseller purpose. A shared signup code alone does not qualify a customer.")}</p>
        <fieldset disabled={saving} className="space-y-3">
          <label className="block text-sm font-semibold">{a("Business / shop name")}<input required minLength={2} maxLength={160} value={businessDraft.name} onChange={e => setBusinessDraft({ ...businessDraft, name: e.target.value })} className="mt-1 w-full rounded-xl border p-3" /></label>
          <label className="block text-sm font-semibold">{a("Private verification note")}<textarea required minLength={10} maxLength={500} value={businessDraft.note} onChange={e => setBusinessDraft({ ...businessDraft, note: e.target.value })} className="mt-1 w-full rounded-xl border p-3" placeholder={a("Business contact called, shop/address checked, reseller purpose confirmed. Do not store national ID or bank credentials.")} /></label>
          <label className="flex gap-3 text-sm"><input type="checkbox" required checked={businessDraft.verified} onChange={e => setBusinessDraft({ ...businessDraft, verified: e.target.checked })} />{a("I completed these business checks and approve B2B pricing.")}</label>
          <div className="flex gap-3"><button className="rounded-full bg-green-700 px-5 py-2 text-white">{saving ? a("Saving…") : a("Approve business")}</button><button type="button" onClick={() => setBusinessDraft(null)} className="rounded-full border px-5 py-2">{a("Cancel")}</button></div>
        </fieldset>
      </form>}
      {(message || error) && (
        <div
          className={`rounded-xl p-4 text-sm font-semibold ${
            error ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"
          }`}
        >
          {error || message}
        </div>
      )}

      <div className="rounded-2xl bg-white shadow-sm ring-1 ring-zinc-100">
        <div className="border-b px-5 py-4">
          <h2 className="font-bold">{a("Wholesale registration codes")}</h2>
          <p className="text-sm text-zinc-500">
             {a("Give a code to a business customer. They type it on the &ldquo;Business&rdquo; tab of the signup page to create a wholesale account. The full code is shown once, here, and is never stored — so copy it before you leave this page.")} </p>
        </div>

        <div className="space-y-4 px-5 py-4">
          {freshCode && (
            <div className="rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                 {a("New code — copy it now, it cannot be shown again")} </p>
              <p className="mt-2 select-all font-mono text-2xl font-bold tracking-[0.2em] text-emerald-900">
                {freshCode}
              </p>
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-[1fr_120px_140px_auto] md:items-end">
            <label className="block text-sm font-semibold">
               {a("Label (who is it for?)")} <input
                value={inviteLabel}
                onChange={(event) => setInviteLabel(event.target.value)}
                placeholder={a("Mandalay Computer Shop")}
                className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-red-500"
              />
            </label>

            <label className="block text-sm font-semibold">
               {a("How many uses")} <input
                type="number"
                min={1}
                max={500}
                value={inviteUses}
                onChange={(event) => setInviteUses(event.target.value)}
                className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-red-500"
              />
            </label>

            <label className="block text-sm font-semibold">
               {a("Expires in (days)")} <input
                type="number"
                min={1}
                max={365}
                value={inviteDays}
                onChange={(event) => setInviteDays(event.target.value)}
                className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-red-500"
              />
            </label>

            <button
              type="button"
              onClick={createInviteCode}
              disabled={creatingCode}
              className="rounded-full bg-red-600 px-5 py-2.5 text-sm font-semibold text-white disabled:bg-zinc-400"
            >
              {creatingCode ? a("Creating...") : a("Create code")}
            </button>
          </div>

          {inviteCodes.length === 0 ? (
            <p className="text-sm text-zinc-500">{a("No codes yet.")}</p>
          ) : (
            <ul className="divide-y rounded-xl border">
              {inviteCodes.map((code) => {
                const expired =
                  code.expires_at !== null &&
                  new Date(code.expires_at) <= new Date();
                const usedUp = code.use_count >= code.max_uses;
                const live = code.is_active && !expired && !usedUp;

                return (
                  <li
                    key={code.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold">
                        <span className="font-mono">••••-{code.code_hint}</span>
                        {code.label ? (
                          <span className="ml-2 text-zinc-600">{code.label}</span>
                        ) : null}
                      </p>
                      <p className="text-xs text-zinc-500">
                         {a("Used")} {code.use_count}  {a("of")} {code.max_uses}
                        {code.expires_at
                          ? ` · expires ${formatDateTime(code.expires_at)}`
                          : a(" · no expiry")}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          live
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-zinc-100 text-zinc-500"
                        }`}
                      >
                        {live
                          ? a("Active")
                          : usedUp
                          ? a("Used up")
                          : expired
                          ? a("Expired")
                          : a("Turned off")}
                      </span>

                      {live && (
                        <button
                          type="button"
                          onClick={() => deactivateInviteCode(code.id)}
                          className="rounded-full border px-4 py-1.5 text-xs font-semibold hover:bg-zinc-100"
                        >
                           {a("Turn off")} </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <div className="rounded-2xl bg-white shadow-sm ring-1 ring-zinc-100">
        <div className="flex flex-col gap-4 border-b px-5 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-bold">{a("Wholesale Accounts")}</h2>
            <p className="text-sm text-zinc-500">
               {a("Verify business customers before granting wholesale access. Assign price lists, suspend or revoke. Wholesale customers log in like any other customer and automatically see tier prices.")} </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={a("Search email or name...")}
              className="rounded-full border px-4 py-2 text-xs outline-none focus:border-red-500"
            />
            {FILTERS.map((value) => (
              <button
                key={value}
                onClick={() => setFilter(value)}
                className={`rounded-full px-4 py-2 text-xs font-semibold capitalize ${
                  filter === value
                    ? "bg-red-600 text-white"
                    : "border hover:bg-zinc-100"
                }`}
              >
                {value === "all" ? a("All customers") : a("Wholesale only")}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <p className="p-5 text-sm text-zinc-500">{a("Loading customers...")}</p>
        ) : accounts.length === 0 ? (
          <p className="p-5 text-sm text-zinc-500">{a("No customers found.")}</p>
        ) : (
          <div className="divide-y">
            {accounts.map((account) => {
              const status = account.wholesale_status;
              const assignedList = priceLists.find(
                (list) => list.id === account.price_list_id
              );
              const chosenList =
                selectedPriceList[account.id] ??
                account.price_list_id ??
                priceLists.find((list) => list.name === "Sheet B2B (MMK)" && list.is_active)?.id ??
                priceLists.find((list) => list.is_active)?.id ??
                "";

              return (
                <div key={account.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-bold">{account.email}</p>
                      <p className="text-xs text-zinc-500">
                        {account.full_name || a("No name")}
                        {account.created_at
                          ? ` · joined ${formatDateTime(account.created_at)}`
                          : ""}
                        {assignedList ? ` · ${assignedList.name}` : ""}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold ${
                          status === "approved"
                            ? "bg-green-100 text-green-700"
                            : status === "suspended"
                            ? "bg-orange-100 text-orange-700"
                            : "bg-zinc-100 text-zinc-600"
                        }`}
                      >
                        {status === "approved"
                          ? account.business_verified_at ? a("Verified B2B") : a("Needs business verification")
                          : status === "suspended"
                          ? a("Wholesale (suspended)")
                          : a("Retail")}
                      </span>

                      {(status === "not_applied" || !account.business_verified_at) && (
                        <>
                          <select
                            value={chosenList}
                            onChange={(event) =>
                              setSelectedPriceList({
                                ...selectedPriceList,
                                [account.id]: event.target.value,
                              })
                            }
                            className="rounded-full border px-3 py-2 text-xs font-semibold outline-none focus:border-red-500"
                          >
                            {priceLists.map((list) => (
                              <option key={list.id} value={list.id} disabled={!list.is_active}>
                                {a(list.name)}
                                {list.is_active ? "" : a(" (inactive)")}
                              </option>
                            ))}
                          </select>

                          <button
                            disabled={saving || !chosenList}
                            onClick={() =>
                              setBusinessDraft({ account, priceListId: chosenList, name: account.business_name ?? "", note: "", verified: false })
                            }
                            className="rounded-full bg-green-600 px-4 py-2 text-xs font-semibold text-white hover:bg-green-700"
                          >
                             {a("Verify business / grant B2B")} </button>
                        </>
                      )}

                      {status === "approved" && (
                        <>
                          <select
                            value={chosenList}
                            onChange={(event) => {
                              const value = event.target.value;
                              setSelectedPriceList({
                                ...selectedPriceList,
                                [account.id]: value,
                              });

                              if (value && value !== account.price_list_id) {
                                updateAccount(account, {
                                  action: "assign_price_list",
                                  price_list_id: value,
                                });
                              }
                            }}
                            className="rounded-full border px-3 py-2 text-xs font-semibold outline-none focus:border-red-500"
                          >
                            {priceLists.map((list) => (
                              <option key={list.id} value={list.id}>
                                 {a("Price list:")} {a(list.name)}
                              </option>
                            ))}
                          </select>

                          <button
                            onClick={() =>
                              updateAccount(account, { action: "suspend" })
                            }
                            className="rounded-full bg-orange-50 px-4 py-2 text-xs font-semibold text-orange-700 hover:bg-orange-100"
                          >
                             {a("Suspend")} </button>

                          <button
                            onClick={() => handleRevoke(account)}
                            className="rounded-full bg-red-50 px-4 py-2 text-xs font-semibold text-red-700 hover:bg-red-100"
                          >
                             {a("Revoke")} </button>
                        </>
                      )}

                      {status === "suspended" && (
                        <>
                          <button
                            onClick={() =>
                              updateAccount(account, { action: "reactivate" })
                            }
                            className="rounded-full bg-green-50 px-4 py-2 text-xs font-semibold text-green-700 hover:bg-green-100"
                          >
                             {a("Reactivate")} </button>

                          <button
                            onClick={() => handleRevoke(account)}
                            className="rounded-full bg-red-50 px-4 py-2 text-xs font-semibold text-red-700 hover:bg-red-100"
                          >
                             {a("Revoke")} </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded-2xl bg-white shadow-sm ring-1 ring-zinc-100">
        <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
          <div>
            <h2 className="font-bold">{a("Audit Trail")}</h2>
            <p className="text-sm text-zinc-500">
               {a("Grants, revocations, suspensions and pricing changes.")} </p>
          </div>

          <button
            onClick={() => {
              const next = !showAudit;
              setShowAudit(next);
              if (next) loadAudit();
            }}
            className="shrink-0 rounded-full border px-4 py-2 text-xs font-semibold hover:bg-zinc-100"
          >
            {showAudit ? a("Hide") : a("Show")}
          </button>
        </div>

        {showAudit && (
          <div className="max-h-96 overflow-y-auto divide-y text-sm">
            {auditEntries.length === 0 ? (
              <p className="p-5 text-zinc-500">{a("No audit entries yet.")}</p>
            ) : (
              auditEntries.map((entry) => (
                <div key={entry.id} className="px-5 py-3">
                  <p className="font-semibold">{entry.action}</p>
                  <p className="text-xs text-zinc-500">
                    {entry.target_type} {entry.target_id.slice(0, 8)} ·{" "}
                    {formatDateTime(entry.created_at)}  {a("· by admin")}{" "}
                    {entry.actor_id ? entry.actor_id.slice(0, 8) : a("unknown")}
                  </p>
                  {(entry.previous_data || entry.new_data) && (
                    <p className="mt-1 break-all font-mono text-[11px] text-zinc-400">
                      {entry.previous_data
                        ? `from ${JSON.stringify(entry.previous_data)} `
                        : ""}
                      {entry.new_data ? `to ${JSON.stringify(entry.new_data)}` : ""}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </section>
  );
}
