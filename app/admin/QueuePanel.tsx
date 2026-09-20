"use client";

import { useAdminText } from "../lib/useAdminText";

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useState } from "react";
import { authHeaders } from "../lib/client-auth";
import { formatCurrency, formatDateTime } from "../lib/format";
import { useLanguage } from "../lib/language";
import RefundTracker from "../components/RefundTracker";
import { defaultNextAction, queueLanes, type QueueLane } from "../lib/work-queue";

/**
 * One panel for everything that needs attention.
 *
 * This replaced two panels that listed the same work twice: a "Work Queue"
 * that sorted cases into lanes, and a "Help Cases" inbox that held the detail
 * and the decision buttons. Staff had to guess which one to open, and a case
 * looked unfinished in one while being finished in the other.
 *
 * Now the lanes ARE the list and the case opens beside them: triage on the
 * left, act on the right, one place where a case is done.
 */

type SubjectType = "order" | "help_case" | "return_request";

type QueueItem = {
  subject_type: SubjectType;
  subject_id: string;
  lane: QueueLane;
  title: string;
  detail: string;
  customer: string;
  order_id: string | null;
  created_at: string;
  owner_id: string | null;
  owner_email: string | null;
  next_action: string | null;
  due_at: string | null;
  overdue: boolean;
};

type AdminProfile = { id: string; email: string; full_name: string | null };

type StaffNote = {
  id: string;
  body: string;
  created_at: string;
  profiles?: { email?: string | null; full_name?: string | null } | null;
};

type HelpCase = {
  id: string;
  order_id: string;
  customer_id: string;
  topic: "payment" | "delivery" | "faulty_item" | "cancel_order" | "warranty";
  status: "open" | "waiting_customer" | "resolved" | "closed";
  summary: string;
  admin_note: string | null;
  created_at: string;
  profiles?: { email?: string | null; full_name?: string | null } | null;
};

type ReturnRequest = {
  id: string;
  order_id: string;
  order_item_id: string;
  quantity: number;
  reason_code: string;
  description: string;
  preferred_resolution: "replacement" | "refund" | "repair";
  resolution_granted: "replacement" | "refund" | "repair" | null;
  collection_method: string;
  pickup_address: string | null;
  status: string;
  unboxing_video_confirmed: boolean;
  admin_decision_note: string | null;
  review_requested_at: string | null;
  review_request_note: string | null;
  refund_amount?: number | null;
  refund_reference?: string | null;
  refund_sent_at?: string | null;
  expected_refund_at?: string | null;
  delay_reason?: string | null;
  created_at: string;
  order_items?: {
    quantity: number;
    unit_price: number;
    products?: { name?: string | null } | null;
  } | null;
  profiles?: { email?: string | null; full_name?: string | null } | null;
  return_evidence?: {
    id: string;
    evidence_kind: string;
    file_name: string | null;
    external_url: string | null;
  }[];
};

type CaseDetail = {
  case: HelpCase;
  order: {
    id: string;
    total_amount: number;
    status: string;
    shipping_address: string;
    payment_method?: string;
    payment_status?: string;
    payment_verification_status?: string;
    payment_slips?: { id: string; created_at: string }[];
    delivery_events?: { id: string; stage: string; title: string; happened_at: string }[];
    return_evidence?: { id: string; evidence_kind: string; file_name: string | null }[];
  } | null;
  return_requests: ReturnRequest[];
  messages: {
    id: string;
    sender_role: "customer" | "admin";
    body: string;
    created_at: string;
    attachment_url?: string | null;
  }[];
};

type Draft = { owner: string; nextAction: string; due: string };

const humanize = (value: string) => value.replaceAll("_", " ");

const keyOf = (item: Pick<QueueItem, "subject_type" | "subject_id">) =>
  `${item.subject_type}:${item.subject_id}`;

/** datetime-local needs a local wall-clock string, not an ISO instant. */
function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

async function responseError(response: Response) {
  const data = (await response.json().catch(() => null)) as { error?: string } | null;
  return data?.error ?? "Request failed.";
}

export default function QueuePanel() {
  const a = useAdminText();
  const { t } = useLanguage();

  // The spine: lanes + assignment.
  const [items, setItems] = useState<QueueItem[]>([]);
  const [admins, setAdmins] = useState<AdminProfile[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});

  // The bodies: full objects the queue rows only summarise.
  const [cases, setCases] = useState<HelpCase[]>([]);
  const [requests, setRequests] = useState<ReturnRequest[]>([]);
  const [detail, setDetail] = useState<CaseDetail | null>(null);

  const [notes, setNotes] = useState<Record<string, StaffNote[]>>({});
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [decisionNotes, setDecisionNotes] = useState<Record<string, string>>({});
  const [planDrafts, setPlanDrafts] = useState<
    Record<string, { date: string; amount: string; reason: string }>
  >({});

  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [busyRequestId, setBusyRequestId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setIsLoading(true);

    try {
      // Both lists together: the queue decides what is open and which lane it
      // is in, the inbox carries the full case and return objects to act on.
      const [queueResponse, inboxResponse] = await Promise.all([
        fetch("/api/admin/queue", { headers: authHeaders(), cache: "no-store" }),
        fetch("/api/admin/cases", { headers: authHeaders(), cache: "no-store" }),
      ]);

      const queueData = (await queueResponse.json().catch(() => null)) as
        | { items?: QueueItem[]; admins?: AdminProfile[]; error?: string }
        | null;
      if (!queueResponse.ok) throw new Error(queueData?.error ?? "Unable to load the queue.");

      const inboxData = (await inboxResponse.json().catch(() => null)) as
        | { cases?: HelpCase[]; requests?: ReturnRequest[]; error?: string }
        | null;
      if (!inboxResponse.ok) throw new Error(inboxData?.error ?? "Unable to load the cases.");

      const nextItems = queueData?.items ?? [];
      setItems(nextItems);
      setAdmins(queueData?.admins ?? []);
      setCases(inboxData?.cases ?? []);
      setRequests(inboxData?.requests ?? []);

      // Seed the editable fields without discarding anything half-typed.
      setDrafts((current) => {
        const next = { ...current };
        for (const item of nextItems) {
          const key = keyOf(item);
          if (!next[key]) {
            next[key] = {
              owner: item.owner_id ?? "",
              nextAction: item.next_action ?? "",
              due: toLocalInput(item.due_at),
            };
          }
        }
        return next;
      });

      // Keep the open case open; otherwise start at the top of the queue.
      setSelectedKey((current) =>
        current && nextItems.some((item) => keyOf(item) === current)
          ? current
          : nextItems.length > 0
            ? keyOf(nextItems[0])
            : null
      );

      if (!quiet) setError("");
    } catch (loadError) {
      if (!quiet) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load the queue.");
      }
    } finally {
      if (!quiet) setIsLoading(false);
    }
  }, []);

  const loadDetail = useCallback(async (caseId: string) => {
    try {
      const response = await fetch(`/api/admin/cases/${encodeURIComponent(caseId)}`, {
        headers: authHeaders(),
        cache: "no-store",
      });
      const data = (await response.json().catch(() => null)) as
        | (CaseDetail & { error?: string })
        | null;

      if (!response.ok || !data?.case) {
        throw new Error(data?.error ?? "Unable to open this case.");
      }

      setDetail(data);
    } catch (detailError) {
      setError(detailError instanceof Error ? detailError.message : "Unable to open this case.");
    }
  }, []);

  const loadNotes = useCallback(async (subjectType: SubjectType, subjectId: string) => {
    try {
      const response = await fetch(
        `/api/admin/notes?subject_type=${subjectType}&subject_id=${encodeURIComponent(subjectId)}`,
        { headers: authHeaders(), cache: "no-store" }
      );
      const data = (await response.json().catch(() => null)) as
        | { notes?: StaffNote[]; error?: string }
        | null;

      if (!response.ok) throw new Error(data?.error ?? "Unable to load notes.");

      setNotes((current) => ({ ...current, [`${subjectType}:${subjectId}`]: data?.notes ?? [] }));
    } catch (notesError) {
      setError(notesError instanceof Error ? notesError.message : "Unable to load notes.");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const selected = items.find((item) => keyOf(item) === selectedKey) ?? null;
  const selectedType = selected?.subject_type ?? null;
  const selectedId = selected?.subject_id ?? null;

  useEffect(() => {
    if (!selectedType || !selectedId) return;
    const timer = window.setTimeout(() => {
      void loadNotes(selectedType, selectedId);
      if (selectedType === "help_case") void loadDetail(selectedId);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadDetail, loadNotes, selectedType, selectedId]);

  async function save(item: QueueItem) {
    const key = keyOf(item);
    const draft = drafts[key] ?? { owner: "", nextAction: "", due: "" };

    setBusyKey(key);
    setError("");

    try {
      const response = await fetch("/api/admin/queue", {
        method: "PATCH",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          subject_type: item.subject_type,
          subject_id: item.subject_id,
          owner_id: draft.owner || null,
          next_action: draft.nextAction.trim() || null,
          due_at: draft.due ? new Date(draft.due).toISOString() : null,
        }),
      });

      if (!response.ok) throw new Error(await responseError(response));

      await load(true);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save.");
    } finally {
      setBusyKey(null);
    }
  }

  async function addNote(item: QueueItem) {
    const key = keyOf(item);
    const body = noteDrafts[key]?.trim() ?? "";
    if (!body) return;

    setBusyKey(key);
    setError("");

    try {
      const response = await fetch("/api/admin/notes", {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          subject_type: item.subject_type,
          subject_id: item.subject_id,
          body,
        }),
      });

      if (!response.ok) throw new Error(await responseError(response));

      setNoteDrafts((current) => ({ ...current, [key]: "" }));
      await loadNotes(item.subject_type, item.subject_id);
    } catch (noteError) {
      setError(noteError instanceof Error ? noteError.message : "Unable to save the note.");
    } finally {
      setBusyKey(null);
    }
  }

  /**
   * Finish a help case. Resolved, never deleted: the case keeps its history and
   * can be reopened. Orders and returns have no button here because they leave
   * the queue when the real work lands — the lane is derived.
   */
  async function setCaseStatus(caseId: string, status: HelpCase["status"]) {
    setBusyKey(`help_case:${caseId}`);
    setError("");

    try {
      const response = await fetch(`/api/admin/cases/${encodeURIComponent(caseId)}`, {
        method: "PATCH",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) throw new Error(await responseError(response));

      await load(true);
      await loadDetail(caseId);
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : "Unable to update the case.");
    } finally {
      setBusyKey(null);
    }
  }

  async function decide(
    requestId: string,
    decision: "approve" | "more_info" | "decline",
    resolution?: ReturnRequest["preferred_resolution"]
  ) {
    const note = decisionNotes[requestId]?.trim() ?? "";

    // The server enforces this too; saying it here avoids a pointless round trip.
    if (decision !== "approve" && note.length < 10) {
      setError("Explain your decision so the customer knows what to do next.");
      return;
    }

    setBusyRequestId(requestId);
    setError("");

    try {
      const response = await fetch(`/api/admin/returns/${encodeURIComponent(requestId)}`, {
        method: "PATCH",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "decide",
          decision,
          resolution_granted: decision === "approve" ? resolution ?? null : null,
          note: note || null,
        }),
      });

      if (!response.ok) throw new Error(await responseError(response));

      setDecisionNotes((current) => ({ ...current, [requestId]: "" }));
      await load(true);
      if (selectedType === "help_case" && selectedId) await loadDetail(selectedId);
    } catch (decideError) {
      setError(decideError instanceof Error ? decideError.message : "Unable to save the decision.");
    } finally {
      setBusyRequestId(null);
    }
  }

  async function advance(
    requestId: string,
    stage: "collected" | "inspected" | "refund_approved" | "completed"
  ) {
    const draft = planDrafts[requestId];
    setBusyRequestId(requestId);
    setError("");

    try {
      const response = await fetch(`/api/admin/returns/${encodeURIComponent(requestId)}`, {
        method: "PATCH",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "advance",
          stage,
          // Authorising the refund is where the agreed amount is recorded.
          refund_amount:
            stage === "refund_approved" && draft?.amount ? Number(draft.amount) : null,
        }),
      });

      if (!response.ok) throw new Error(await responseError(response));

      await load(true);
      if (selectedType === "help_case" && selectedId) await loadDetail(selectedId);
    } catch (advanceError) {
      setError(
        advanceError instanceof Error ? advanceError.message : "Unable to update the return."
      );
    } finally {
      setBusyRequestId(null);
    }
  }

  /** Promises (or corrects) the date the customer sees, with the reason. */
  async function savePlan(requestId: string) {
    const draft = planDrafts[requestId] ?? { date: "", amount: "", reason: "" };

    setBusyRequestId(requestId);
    setError("");

    try {
      const response = await fetch(`/api/admin/returns/${encodeURIComponent(requestId)}`, {
        method: "PATCH",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "refund_plan",
          // datetime-local carries no zone, so send a real instant.
          expected_refund_at: draft.date ? new Date(draft.date).toISOString() : null,
          delay_reason: draft.reason.trim() || null,
        }),
      });

      if (!response.ok) throw new Error(await responseError(response));

      await load(true);
      if (selectedType === "help_case" && selectedId) await loadDetail(selectedId);
    } catch (planError) {
      setError(planError instanceof Error ? planError.message : "Unable to save the refund date.");
    } finally {
      setBusyRequestId(null);
    }
  }

  function updateDraft(key: string, update: Partial<Draft>) {
    setDrafts((current) => {
      // A card nobody has touched yet has no draft, so start empty.
      const base = current[key] ?? { owner: "", nextAction: "", due: "" };
      return { ...current, [key]: { ...base, ...update } };
    });
  }

  function renderRequest(request: ReturnRequest) {
    const isBusy = busyRequestId === request.id;
    const decided = [
      "approved",
      "declined",
      "collected",
      "inspected",
      "refund_approved",
      "completed",
    ].includes(request.status);

    return (
      <article key={request.id} className="rounded-2xl border bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-bold">
              {request.order_items?.products?.name ?? a("Item")} × {request.quantity}
            </p>
            <p className="text-xs text-zinc-500">
              {humanize(request.reason_code)}  {a("· wants")} {humanize(request.preferred_resolution)} ·{" "}
              {humanize(request.collection_method)}
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-zinc-100 px-3 py-1 text-xs font-bold capitalize">
            {humanize(request.status)}
          </span>
        </div>

        <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-700">{request.description}</p>

        {/* Exactly what the customer sees on their own orders page. */}
        <RefundTracker request={request} />

        <p className="mt-2 text-xs font-semibold">
          {request.unboxing_video_confirmed ? (
            <span className="text-emerald-700">{a("✓ Customer confirms an unboxing video")}</span>
          ) : (
            <span className="text-amber-700">{a("No unboxing video confirmed")}</span>
          )}
        </p>

        {request.pickup_address && (
          <p className="mt-1 text-xs text-zinc-500">{a("Pickup:")} {request.pickup_address}</p>
        )}

        {(request.return_evidence ?? []).length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {(request.return_evidence ?? []).map((evidence) => (
              <a
                key={evidence.id}
                href={`/api/orders/${request.order_id}/return-evidence/${evidence.id}`}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border px-3 py-1.5 text-xs font-bold hover:border-red-500"
              >
                {humanize(evidence.evidence_kind)}
              </a>
            ))}
          </div>
        )}

        {request.review_requested_at && (
          <p className="mt-2 rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-900">
            {t("adminCase.reviewRequested")}
            {request.review_request_note ? `: ${request.review_request_note}` : ""}
          </p>
        )}

        {request.admin_decision_note && (
          <p className="mt-2 rounded-xl bg-blue-50 p-3 text-xs text-blue-900">
            {request.admin_decision_note}
          </p>
        )}

        {!["completed", "cancelled"].includes(request.status) && (
          <div className="mt-3">
            <label className="block text-xs font-semibold">
              {t("adminCase.decisionNote")}
              <textarea
                rows={2}
                maxLength={1000}
                value={decisionNotes[request.id] ?? ""}
                onChange={(event) =>
                  setDecisionNotes((current) => ({
                    ...current,
                    [request.id]: event.target.value,
                  }))
                }
                className="mt-1 w-full rounded-xl border px-3 py-2 text-sm font-normal outline-none focus:border-red-500"
              />
            </label>

            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={isBusy}
                onClick={() => decide(request.id, "approve", request.preferred_resolution)}
                className="rounded-full bg-green-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
              >
                {t("adminCase.approve")} ({humanize(request.preferred_resolution)})
              </button>
              <button
                type="button"
                disabled={isBusy}
                onClick={() => decide(request.id, "more_info")}
                className="rounded-full border px-4 py-2 text-xs font-bold disabled:opacity-50"
              >
                {t("adminCase.moreInfo")}
              </button>
              <button
                type="button"
                disabled={isBusy}
                onClick={() => decide(request.id, "decline")}
                className="rounded-full bg-red-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
              >
                {t("adminCase.decline")}
              </button>
            </div>

            {decided && request.status !== "declined" && (
              <div className="mt-3 rounded-xl bg-zinc-50 p-3">
                <div className="flex flex-wrap gap-2">
                  {request.status === "approved" && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => advance(request.id, "collected")}
                      className="rounded-full bg-orange-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
                    >
                       {a("Mark collected")} </button>
                  )}
                  {request.status === "collected" && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => advance(request.id, "inspected")}
                      className="rounded-full bg-orange-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
                    >
                       {a("Mark inspected")} </button>
                  )}
                  {request.status === "inspected" && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => advance(request.id, "refund_approved")}
                      className="rounded-full bg-emerald-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
                    >
                      {t("refund.approveRefund")}
                    </button>
                  )}
                  {request.status === "refund_approved" && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => advance(request.id, "completed")}
                      className="rounded-full bg-zinc-900 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
                    >
                      {t("refund.markSent")}
                    </button>
                  )}
                </div>

                {/* The promise the customer sees. Moving a date they already
                    have is refused server-side unless a reason is given. */}
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <label className="text-xs font-semibold">
                    {t("refund.setExpected")}
                    <input
                      type="datetime-local"
                      value={planDrafts[request.id]?.date ?? ""}
                      onChange={(event) =>
                        setPlanDrafts((current) => ({
                          ...current,
                          [request.id]: {
                            date: event.target.value,
                            amount: current[request.id]?.amount ?? "",
                            reason: current[request.id]?.reason ?? "",
                          },
                        }))
                      }
                      className="mt-1 w-full rounded-lg border px-2 py-1.5 text-xs font-normal"
                    />
                  </label>
                  <label className="text-xs font-semibold">
                    {t("refund.amount")}
                    <input
                      type="number"
                      min={0}
                      value={planDrafts[request.id]?.amount ?? ""}
                      onChange={(event) =>
                        setPlanDrafts((current) => ({
                          ...current,
                          [request.id]: {
                            date: current[request.id]?.date ?? "",
                            amount: event.target.value,
                            reason: current[request.id]?.reason ?? "",
                          },
                        }))
                      }
                      className="mt-1 w-full rounded-lg border px-2 py-1.5 text-xs font-normal"
                    />
                  </label>
                  <label className="text-xs font-semibold">
                    {t("refund.setDelayReason")}
                    <input
                      value={planDrafts[request.id]?.reason ?? ""}
                      maxLength={500}
                      onChange={(event) =>
                        setPlanDrafts((current) => ({
                          ...current,
                          [request.id]: {
                            date: current[request.id]?.date ?? "",
                            amount: current[request.id]?.amount ?? "",
                            reason: event.target.value,
                          },
                        }))
                      }
                      className="mt-1 w-full rounded-lg border px-2 py-1.5 text-xs font-normal"
                    />
                  </label>
                </div>

                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => savePlan(request.id)}
                  className="mt-2 rounded-full border px-4 py-2 text-xs font-bold disabled:opacity-50"
                >
                  {t("refund.savePlan")}
                </button>
              </div>
            )}
          </div>
        )}
      </article>
    );
  }

  function renderDetail(item: QueueItem) {
    const key = keyOf(item);
    const draft = drafts[key] ?? { owner: "", nextAction: "", due: "" };
    const isBusy = busyKey === key;
    const helpCase =
      item.subject_type === "help_case"
        ? cases.find((row) => row.id === item.subject_id) ?? null
        : null;
    const request =
      item.subject_type === "return_request"
        ? requests.find((row) => row.id === item.subject_id) ?? null
        : null;
    // Detail is fetched per case, so ignore it until it is THIS case's.
    const freshReturns =
      detail?.case.id === item.subject_id ? detail.return_requests : [];

    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-lg font-black">{item.title}</h3>
            <p className="text-xs text-zinc-500">
              {item.customer} · {formatDateTime(item.created_at)} · {t(`queue.lane.${item.lane}`)}
            </p>
          </div>
          {helpCase ? (
            <button
              type="button"
              disabled={isBusy}
              onClick={() =>
                setCaseStatus(helpCase.id, helpCase.status === "resolved" ? "open" : "resolved")
              }
              className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold disabled:opacity-50 ${
                helpCase.status === "resolved"
                  ? "bg-zinc-900 text-white"
                  : "bg-emerald-700 text-white"
              }`}
            >
              {helpCase.status === "resolved"
                ? t("adminCase.reopen")
                : isBusy
                  ? t("queue.markingDone")
                  : t("queue.markDone")}
            </button>
          ) : (
            <span className="max-w-full sm:max-w-[16rem] sm:text-right text-xs text-zinc-500">
              {item.subject_type === "order"
                ? t("queue.clears.order")
                : t("queue.clears.return")}
            </span>
          )}
        </div>

        {/* Who owns it, what is next, when it is due — the triage half. */}
        <div className="rounded-2xl border p-4">
          <div className="grid gap-2 md:grid-cols-3">
            <label className="text-xs font-semibold">
              {t("queue.owner")}
              <select
                value={draft.owner}
                onChange={(event) => updateDraft(key, { owner: event.target.value })}
                className="mt-1 w-full rounded-lg border bg-white px-2 py-1.5 text-xs font-normal"
              >
                <option value="">{t("queue.unassigned")}</option>
                {admins.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.full_name || profile.email}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-xs font-semibold">
              {t("queue.nextAction")}
              <input
                value={draft.nextAction}
                maxLength={300}
                placeholder={defaultNextAction[item.lane]}
                onChange={(event) => updateDraft(key, { nextAction: event.target.value })}
                className="mt-1 w-full rounded-lg border px-2 py-1.5 text-xs font-normal"
              />
            </label>

            <label className="text-xs font-semibold">
              {t("queue.dueDate")}
              <input
                type="datetime-local"
                value={draft.due}
                onChange={(event) => updateDraft(key, { due: event.target.value })}
                className="mt-1 w-full rounded-lg border px-2 py-1.5 text-xs font-normal"
              />
            </label>
          </div>

          <button
            type="button"
            disabled={isBusy}
            onClick={() => save(item)}
            className="mt-3 rounded-full bg-zinc-900 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
          >
            {t("queue.save")}
          </button>
        </div>

        {helpCase && (
          <div className="rounded-2xl bg-zinc-50 p-4">
            <p className="text-xs font-bold uppercase text-zinc-500">
              {t("adminCase.customerSays")}
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm">{helpCase.summary}</p>
          </div>
        )}

        {detail?.order && detail.case.id === item.subject_id && (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border p-4">
              <p className="text-xs font-bold uppercase text-zinc-500">{t("adminCase.order")}</p>
              <p className="mt-1 font-bold">
                #{detail.order.id.slice(0, 8).toUpperCase()} ·{" "}
                {formatCurrency(detail.order.total_amount)}
              </p>
              <p className="text-xs capitalize text-zinc-500">{detail.order.status}</p>
              <p className="mt-2 text-xs text-zinc-600">{detail.order.shipping_address}</p>
            </div>

            <div className="rounded-2xl border p-4">
              <p className="text-xs font-bold uppercase text-zinc-500">{t("adminCase.payments")}</p>
              <p className="mt-1 text-sm font-semibold capitalize">
                {humanize(detail.order.payment_method ?? a("cash_on_delivery"))} ·{" "}
                {detail.order.payment_status}
              </p>
              {detail.order.payment_verification_status && (
                <p className="text-xs capitalize text-zinc-500">
                  {humanize(detail.order.payment_verification_status)}
                </p>
              )}
              {(detail.order.payment_slips ?? []).map((slip, index) => (
                <a
                  key={slip.id}
                  href={`/api/orders/${detail.order!.id}/payment-slip/${slip.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 block text-xs font-bold text-blue-700 underline"
                >
                   {a("Slip")} {index + 1} · {formatDateTime(slip.created_at)}
                </a>
              ))}
            </div>
          </div>
        )}

        {item.subject_type === "order" && (
          <div className="rounded-2xl border p-4">
            <p className="text-xs font-bold uppercase text-zinc-500">{t("adminCase.order")}</p>
            <p className="mt-1 text-sm capitalize text-zinc-700">{item.detail}</p>
            <a
              href="/admin?panel=orders"
              className="mt-2 inline-block text-xs font-bold text-blue-700 underline"
            >
              {t("queue.openOrder")}
            </a>
          </div>
        )}

        {detail?.case.id === item.subject_id && (detail.order?.delivery_events ?? []).length > 0 && (
          <div className="rounded-2xl border p-4">
            <p className="text-xs font-bold uppercase text-zinc-500">{t("adminCase.delivery")}</p>
            <ol className="mt-2 space-y-1">
              {(detail?.order?.delivery_events ?? []).map((event) => (
                <li key={event.id} className="text-xs">
                  <span className="font-semibold">{event.title}</span> ·{" "}
                  {formatDateTime(event.happened_at)}
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* The returns: every one on this order for a help case, or just the
            one row when a return itself is what needs attention. */}
        {(request || item.subject_type === "help_case") && (
          <div>
            <p className="mb-2 text-xs font-bold uppercase text-zinc-500">
              {t("adminCase.returns")}
            </p>
            {request ? (
              <div className="space-y-3">{renderRequest(request)}</div>
            ) : freshReturns.length === 0 ? (
              <p className="text-sm text-zinc-500">{a("No return requests on this order.")}</p>
            ) : (
              <div className="space-y-3">{freshReturns.map(renderRequest)}</div>
            )}
          </div>
        )}

        {detail?.case.id === item.subject_id && detail.messages.length > 0 && (
          <div className="rounded-2xl border p-4">
            <p className="text-xs font-bold uppercase text-zinc-500">
              {t("adminCase.conversation")}
            </p>
            <div className="mt-2 max-h-64 space-y-2 overflow-y-auto">
              {(detail?.messages ?? []).map((message) => (
                <div
                  key={message.id}
                  className={`rounded-xl p-2 text-xs ${
                    message.sender_role === "admin" ? "bg-zinc-900 text-white" : "bg-zinc-100"
                  }`}
                >
                  {message.attachment_url && (
                    <a href={message.attachment_url} target="_blank" rel="noreferrer">
                      <img
                        src={message.attachment_url}
                        alt="Customer attachment"
                        className="mb-1 max-h-40 w-auto rounded-lg border"
                      />
                    </a>
                  )}
                  <p className="whitespace-pre-wrap break-words">{message.body}</p>
                  <p className="mt-1 opacity-60">{formatDateTime(message.created_at)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Internal only. Customer-facing words belong in the chat. */}
        <div className="rounded-2xl bg-zinc-50 p-4">
          <p className="text-[11px] font-bold uppercase text-zinc-500">
            {t("queue.internalOnly")}
          </p>

          <div className="mt-2 space-y-2">
            {(notes[key] ?? []).map((note) => (
              <div key={note.id} className="rounded-lg bg-white p-2 text-xs">
                <p className="whitespace-pre-wrap break-words">{note.body}</p>
                <p className="mt-1 text-[10px] text-zinc-400">
                  {note.profiles?.full_name || note.profiles?.email || a("Staff")} ·{" "}
                  {formatDateTime(note.created_at)}
                </p>
              </div>
            ))}
            {(notes[key] ?? []).length === 0 && (
              <p className="text-xs text-zinc-500">{a("No notes yet.")}</p>
            )}
          </div>

          <textarea
            rows={2}
            maxLength={2000}
            value={noteDrafts[key] ?? ""}
            placeholder={t("queue.notePlaceholder")}
            onChange={(event) =>
              setNoteDrafts((current) => ({ ...current, [key]: event.target.value }))
            }
            className="mt-2 w-full rounded-lg border px-2 py-1.5 text-xs outline-none focus:border-red-500"
          />
          <button
            type="button"
            disabled={isBusy || !(noteDrafts[key] ?? "").trim()}
            onClick={() => addNote(item)}
            className="mt-1 rounded-full bg-red-600 px-4 py-2 text-xs font-bold text-white disabled:bg-zinc-400"
          >
            {t("queue.addNote")}
          </button>
        </div>
      </div>
    );
  }

  const overdueCount = items.filter((item) => item.overdue).length;

  return (
    <section className="mt-6 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-zinc-100">
      <div className="flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-bold">{t("queue.title")}</h2>
          <p className="text-sm text-zinc-500">
             {a("Lanes are worked out from each case, so they are always current.")} </p>
        </div>
        <div className="flex items-center gap-2">
          {overdueCount > 0 && (
            <span className="rounded-full bg-red-600 px-3 py-1.5 text-xs font-bold text-white">
              {overdueCount} {t("queue.overdue")}
            </span>
          )}
          <span className="rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-semibold">
            {items.length}  {a("open")} </span>
          <button
            type="button"
            onClick={() => load()}
            disabled={isLoading}
            className="rounded-full border px-4 py-2 text-xs font-semibold disabled:opacity-50"
          >
            {t("common.refresh")}
          </button>
        </div>
      </div>

      {error && (
        <p className="border-b bg-red-50 px-5 py-3 text-sm font-semibold text-red-700">{a(error)}</p>
      )}

      {isLoading ? (
        <p className="p-6 text-sm text-zinc-500">{t("common.loading")}</p>
      ) : items.length === 0 ? (
        <p className="p-10 text-center text-sm text-zinc-500">{t("queue.none")}</p>
      ) : (
        <div className="grid min-h-[600px] xl:grid-cols-[340px_minmax(0,1fr)]">
          <aside className="border-b bg-zinc-50 xl:border-b-0 xl:border-r">
            <div className="max-h-80 overflow-y-auto xl:max-h-[720px] p-3">
              {queueLanes.map((lane) => {
                const laneItems = items.filter((item) => item.lane === lane);
                if (laneItems.length === 0) return null;

                return (
                  <div key={lane} className="mb-4">
                    <div className="mb-1 flex items-center gap-2 px-2">
                      <h3 className="text-[11px] font-black uppercase tracking-wide text-zinc-500">
                        {t(`queue.lane.${lane}`)}
                      </h3>
                      <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] font-bold">
                        {laneItems.length}
                      </span>
                    </div>

                    <div className="space-y-1">
                      {laneItems.map((item) => {
                        const key = keyOf(item);
                        const isSelected = selectedKey === key;

                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setSelectedKey(key)}
                            className={`w-full rounded-xl p-3 text-left transition ${
                              isSelected
                                ? "bg-white shadow-[inset_4px_0_0_#dc2626]"
                                : "hover:bg-white"
                            } ${item.overdue ? "ring-1 ring-red-300" : ""}`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className="min-w-0 truncate text-sm font-semibold">
                                {item.title}
                              </p>
                              {item.overdue && (
                                <span className="shrink-0 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white">
                                  {t("queue.overdue")}
                                </span>
                              )}
                            </div>
                            <p className="mt-0.5 truncate text-[11px] text-zinc-500">
                              {item.customer}
                            </p>
                            {item.owner_email && (
                              <p className="mt-1 truncate text-[10px] font-semibold text-zinc-400">
                                {item.owner_email}
                              </p>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </aside>

          <div className="p-5">
            {selected ? (
              renderDetail(selected)
            ) : (
              <p className="text-sm text-zinc-500">{t("queue.none")}</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
