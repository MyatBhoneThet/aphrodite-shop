"use client";

import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { ORDER_PAGE_SIZE, type OrderFilters } from "@/app/lib/admin-order-filter";
import { authHeaders } from "../lib/client-auth";
import { useAdminText } from "../lib/useAdminText";
import {
  MAX_BATCH_ORDERS,
  batchStageLabels,
  describeBatch,
  planBatchAdvance,
  runBatchAdvance,
  type BatchStage,
} from "./batch-orders";
import CodDeliveryForm from "./CodDeliveryForm";
import { confirmAction } from "./confirm";
import CourierForm from "./CourierForm";
import OrderFilterBar from "./OrderFilterBar";
import OrdersTable from "./OrdersTable";
import type {
  AdminOrder,
  DeliveryProgressStage,
  OrderRequestDecision,
  OrderRequestType,
  OrderWorkflowAction,
} from "./types";

type Props = {
  /** Every loaded order: batch actions look selected orders up here, whatever page they are on. */
  allOrders: AdminOrder[];
  /** The current page of the filtered list. */
  pageOrders: AdminOrder[];
  filteredCount: number;
  filters: OrderFilters;
  onFilters: (next: OrderFilters) => void;
  page: number;
  onPage: (page: number) => void;
  isAdmin: boolean;
  isStaff: boolean;

  courierOrder: AdminOrder | null;
  setCourierOrder: (order: AdminOrder | null) => void;
  deliveryOrder: AdminOrder | null;
  setDeliveryOrder: (order: AdminOrder | null) => void;
  resendingOrderId: string | null;

  onStatusChange: (orderId: string, stage: DeliveryProgressStage) => void;
  onResolveRequest: (orderId: string, requestType: OrderRequestType, decision: OrderRequestDecision) => void;
  onWorkflow: (order: AdminOrder, action: OrderWorkflowAction) => void;
  onDelivery: (order: AdminOrder) => void;
  onResendReceipt: (order: AdminOrder) => void;

  loadDashboardData: () => Promise<void>;
  setMessage: Dispatch<SetStateAction<string>>;
  setError: Dispatch<SetStateAction<string>>;
};

/**
 * "Customer Purchases": filters, the orders table, and batch actions.
 *
 * Batch actions work on any selection, across pages: print packing slips for
 * all of them at once, or move them one step along (packed, handed to the
 * courier). Each order is still checked by the server on its own.
 */
export default function OrdersPanel(props: Props) {
  const a = useAdminText();
  const {
    allOrders,
    pageOrders,
    filteredCount,
    filters,
    onFilters,
    page,
    onPage,
    isAdmin,
    isStaff,
    courierOrder,
    setCourierOrder,
    deliveryOrder,
    setDeliveryOrder,
    loadDashboardData,
    setMessage,
    setError,
  } = props;

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<BatchStage | null>(null);

  const selectedOrders = useMemo(
    () => allOrders.filter((order) => selected.has(order.id)),
    [allOrders, selected]
  );
  const pageIds = pageOrders.map((order) => order.id);
  const allOnPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));

  function toggle(orderId: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(orderId)) next.delete(orderId);
      else if (next.size < MAX_BATCH_ORDERS) next.add(orderId);
      else setError(`You can select up to ${MAX_BATCH_ORDERS} orders at a time.`);
      return next;
    });
  }

  function togglePage() {
    setSelected((current) => {
      const next = new Set(current);
      if (allOnPageSelected) {
        pageIds.forEach((id) => next.delete(id));
      } else {
        for (const id of pageIds) {
          if (next.size >= MAX_BATCH_ORDERS) {
            setError(`You can select up to ${MAX_BATCH_ORDERS} orders at a time.`);
            break;
          }
          next.add(id);
        }
      }
      return next;
    });
  }

  function printSlips() {
    if (selectedOrders.length === 0) return;
    const ids = selectedOrders.map((order) => order.id).join(",");
    window.open(`/admin/slips?ids=${encodeURIComponent(ids)}`, "_blank", "noopener");
  }

  async function advance(stage: BatchStage) {
    if (busy || selectedOrders.length === 0) return;
    setMessage("");
    setError("");

    const plan = planBatchAdvance(selectedOrders, stage);
    if (plan.eligible.length === 0) {
      setError(describeBatch(stage, { done: [], failed: [] }, plan.skipped).text);
      return;
    }

    const count = plan.eligible.length;
    const confirmed = await confirmAction({
      title: `Mark ${count} order${count === 1 ? "" : "s"} as ${batchStageLabels[stage]}?`,
      message: "Each order moves to the next step.",
      consequences:
        stage === "handed_to_courier"
          ? ["Each customer is told their order is on its way."]
          : plan.skipped.length > 0
            ? [`${plan.skipped.length} selected order${plan.skipped.length === 1 ? " is" : "s are"} not ready and will be skipped.`]
            : [],
      confirmLabel: "Yes, update orders",
      tone: "caution",
    });
    if (!confirmed) return;

    setBusy(stage);
    try {
      const outcome = await runBatchAdvance(plan.eligible, stage, authHeaders());
      await loadDashboardData();
      const summary = describeBatch(stage, outcome, plan.skipped);
      // Whatever was changed is no longer something to act on again.
      setSelected((current) => {
        const next = new Set(current);
        outcome.done.forEach((id) => next.delete(id));
        return next;
      });
      if (summary.isProblem) setError(summary.text);
      else setMessage(summary.text);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="mt-6 rounded-2xl bg-white shadow-sm ring-1 ring-zinc-100">
      <div className="border-b px-5 py-4">
        <h2 className="font-bold">{a("Customer Purchases")}</h2>
        <p className="text-sm text-zinc-500">
          {a("Confirm COD purchases, manage delivery, and review cancellation or return requests.")}{" "}
        </p>
      </div>

      {courierOrder && (
        <CourierForm
          key={courierOrder.id}
          order={courierOrder}
          onClose={() => setCourierOrder(null)}
          onSaved={async () => {
            await loadDashboardData();
            setCourierOrder(null);
            setMessage("Courier and tracking saved.");
          }}
        />
      )}
      {isAdmin && deliveryOrder && (
        <CodDeliveryForm
          key={deliveryOrder.id}
          order={deliveryOrder}
          onClose={() => setDeliveryOrder(null)}
          onSaved={async () => {
            await loadDashboardData();
            setDeliveryOrder(null);
            setMessage("COD verification and delivery details saved.");
          }}
        />
      )}
      <OrderFilterBar
        filters={filters}
        onFilters={onFilters}
        page={page}
        onPage={onPage}
        shown={filteredCount}
        total={allOrders.length}
        pageSize={ORDER_PAGE_SIZE}
        searchHint={isStaff ? a("Order number or customer name") : a("Order number, name, phone or email")}
      />

      {pageOrders.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3 text-sm">
          <label className="flex min-h-11 cursor-pointer items-center gap-2 font-semibold text-zinc-700">
            <input
              type="checkbox"
              checked={allOnPageSelected}
              onChange={togglePage}
              className="h-5 w-5 accent-red-600"
            />
            {a("Select all on this page")}
          </label>
          <p className="text-xs text-zinc-500">
            {a("Tick orders to print their packing slips together or move them to the next step.")}
          </p>
        </div>
      )}

      <OrdersTable
        orders={pageOrders}
        filtered={filteredCount === 0 && allOrders.length > 0}
        staffMode={isStaff}
        onStatusChange={props.onStatusChange}
        onResolveRequest={props.onResolveRequest}
        onWorkflow={props.onWorkflow}
        onDelivery={props.onDelivery}
        onCourier={(order) => {
          setError("");
          setMessage("");
          setCourierOrder(order);
        }}
        onResendReceipt={props.onResendReceipt}
        resendingOrderId={props.resendingOrderId}
        selectedIds={selected}
        onToggleSelect={toggle}
      />

      {selected.size > 0 && (
        <div
          role="region"
          aria-label={a("Batch actions")}
          className="sticky bottom-0 z-20 flex flex-wrap items-center gap-2 rounded-b-2xl border-t bg-zinc-950 px-4 py-3 text-white shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.5)]"
        >
          <p className="mr-auto text-sm font-bold">
            {selected.size} {a("selected")}
          </p>
          <button
            type="button"
            onClick={printSlips}
            className="min-h-11 rounded-full bg-white px-4 py-2 text-sm font-bold text-zinc-950 hover:bg-zinc-200"
          >
            🖨 {a("Print packing slips")}
          </button>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void advance("packed")}
            className="min-h-11 rounded-full bg-white/10 px-4 py-2 text-sm font-bold hover:bg-white/20 disabled:opacity-50"
          >
            {busy === "packed" ? a("Working…") : `📦 ${a("Mark packed")}`}
          </button>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void advance("handed_to_courier")}
            className="min-h-11 rounded-full bg-red-600 px-4 py-2 text-sm font-bold hover:bg-red-500 disabled:opacity-50"
          >
            {busy === "handed_to_courier" ? a("Working…") : `🚚 ${a("Mark shipped")}`}
          </button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="min-h-11 rounded-full border border-white/25 px-4 py-2 text-sm font-semibold hover:bg-white/10"
          >
            {a("Clear")}
          </button>
        </div>
      )}
    </section>
  );
}
