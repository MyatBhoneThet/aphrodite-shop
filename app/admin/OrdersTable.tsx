"use client";

import { formatCurrency, formatDateTime } from "../lib/format";
import { useLanguage } from "../lib/language";
import { useAdminText } from "../lib/useAdminText";
import { orderTracking, trackingSteps } from "../lib/order-tracking";
import { orderNextStep, nextStepLabels } from "../lib/next-step";
import CustomerLocation from "./CustomerLocation";
import { OrderRequestControls, ReturnWorkflowControls } from "./OrderControls";
import {
  MAX_DELIVERY_ATTEMPTS,
  allowedDeliveryProgress,
  failedDeliveryAttempts,
  paymentMethodLabels,
} from "./order-helpers";
import type {
  AdminOrder,
  DeliveryProgressStage,
  OrderRequestDecision,
  OrderRequestType,
  OrderWorkflowAction,
} from "./types";

export default function OrdersTable({
  orders,
  filtered = false,
  staffMode,
  onStatusChange,
  onResolveRequest,
  onWorkflow,
  onDelivery,
  onCourier,
  onResendReceipt,
  resendingOrderId,
  selectedIds,
  onToggleSelect,
}: {
  orders: AdminOrder[];
  filtered?: boolean;
  staffMode: boolean;
  onStatusChange: (orderId: string, stage: DeliveryProgressStage) => void;
  onResolveRequest: (
    orderId: string,
    requestType: OrderRequestType,
    decision: OrderRequestDecision
  ) => void;
  onWorkflow: (order: AdminOrder, action: OrderWorkflowAction) => void;
  onDelivery: (order: AdminOrder) => void;
  onCourier: (order: AdminOrder) => void;
  onResendReceipt: (order: AdminOrder) => void;
  resendingOrderId: string | null;
  /** When both are given, each order gets a checkbox for batch actions. */
  selectedIds?: Set<string>;
  onToggleSelect?: (orderId: string) => void;
}) {
  const a = useAdminText();
  const { t } = useLanguage();

  if (orders.length === 0 && filtered) {
    return <p className="p-5 text-sm text-zinc-500">{a("No orders match these filters.")}</p>;
  }

  if (orders.length === 0) {
    return (
      <p className="p-5 text-sm text-zinc-500">
         {a("No orders yet. If you already have orders, login again and refresh.")} </p>
    );
  }

  return (
    <div className="overflow-x-auto" tabIndex={0} role="region" aria-label={a("Orders table")}>
      <table className="w-full min-w-[1180px] text-left text-sm max-lg:block max-lg:min-w-0">
        <thead className="bg-zinc-50 text-xs uppercase text-zinc-500 max-lg:hidden">
          <tr>
            <th className="p-4">{t("adminTable.order")}</th>
            <th className="p-4">{t("adminTable.customer")}</th>
            <th className="p-4">{t("adminTable.items")}</th>
            <th className="p-4">{t("adminTable.total")}</th>
            <th className="p-4">{t("adminTable.status")}</th>
            <th className="p-4">{t("adminTable.payment")}</th>
            {!staffMode && <th className="p-4">{t("adminTable.request")}</th>}
            {!staffMode && <th className="p-4">{t("adminTable.shipping")}</th>}
          </tr>
        </thead>

        <tbody className="divide-y max-lg:block max-lg:space-y-4 max-lg:divide-y-0 max-lg:p-3">
          {orders.map((order) => (
            <tr key={order.id} className="align-top max-lg:block max-lg:overflow-hidden max-lg:rounded-2xl max-lg:border max-lg:border-zinc-200 max-lg:bg-white max-lg:shadow-sm">
              <td data-label={t("adminTable.order")} className="p-4 max-lg:block max-lg:border-t max-lg:border-zinc-100 max-lg:px-4 max-lg:py-3 max-lg:first:border-t-0 max-lg:before:mb-1 max-lg:before:block max-lg:before:text-[10px] max-lg:before:font-bold max-lg:before:uppercase max-lg:before:tracking-wide max-lg:before:text-zinc-400 max-lg:before:content-[attr(data-label)]">
                {onToggleSelect && (
                  <label className="mb-2 flex min-h-11 cursor-pointer items-center gap-2 text-xs font-semibold text-zinc-600">
                    <input
                      type="checkbox"
                      checked={selectedIds?.has(order.id) ?? false}
                      onChange={() => onToggleSelect(order.id)}
                      aria-label={`${a("Select order")} #${order.id.slice(0, 8)}`}
                      className="h-5 w-5 accent-red-600"
                    />
                    {a("Select")}
                  </label>
                )}
                <p className="font-bold">#{order.id.slice(0, 8)}</p>
                {order.po_number && <p className="text-xs font-semibold text-blue-700">PO {order.po_number}</p>}
                <p className="text-xs text-zinc-500">
                  {formatDateTime(order.created_at)}
                </p>
                <a href={`/admin/slip/${order.id}`} target="_blank" rel="noreferrer" className="mt-2 inline-block rounded-full border px-3 py-1.5 text-xs font-bold hover:border-red-500 hover:text-red-600">🖨 {a("Packing slip")}</a>
              </td>

              <td data-label={t("adminTable.customer")} className="p-4 max-lg:block max-lg:border-t max-lg:border-zinc-100 max-lg:px-4 max-lg:py-3 max-lg:first:border-t-0 max-lg:before:mb-1 max-lg:before:block max-lg:before:text-[10px] max-lg:before:font-bold max-lg:before:uppercase max-lg:before:tracking-wide max-lg:before:text-zinc-400 max-lg:before:content-[attr(data-label)]">
                <p className="font-semibold">{order.shipping_name}</p>
                {!staffMode && <p className="text-xs text-zinc-500">
                  {order.profiles?.email ?? a("No email")}
                </p>}
                {!staffMode && <p className="text-xs text-zinc-500">{order.shipping_phone}</p>}
              </td>

              <td data-label={t("adminTable.items")} className="p-4 max-lg:block max-lg:border-t max-lg:border-zinc-100 max-lg:px-4 max-lg:py-3 max-lg:first:border-t-0 max-lg:before:mb-1 max-lg:before:block max-lg:before:text-[10px] max-lg:before:font-bold max-lg:before:uppercase max-lg:before:tracking-wide max-lg:before:text-zinc-400 max-lg:before:content-[attr(data-label)]">
                <div className="space-y-1">
                  {(order.order_items ?? []).map((item) => {
                    const product = item.product ?? item.products;

                    return (
                      <p key={item.id} className="text-xs">
                        {product?.name ?? `Product #${item.product_id}`} ×{" "}
                        {item.quantity}
                      </p>
                    );
                  })}
                </div>
              </td>

              <td data-label={t("adminTable.total")} className="p-4 font-bold max-lg:block max-lg:border-t max-lg:border-zinc-100 max-lg:px-4 max-lg:py-3 max-lg:first:border-t-0 max-lg:before:mb-1 max-lg:before:block max-lg:before:text-[10px] max-lg:before:font-bold max-lg:before:uppercase max-lg:before:tracking-wide max-lg:before:text-zinc-400 max-lg:before:content-[attr(data-label)]">
                {formatCurrency(order.total_amount)}
              </td>

              <td data-label={t("adminTable.status")} className="p-4 max-lg:block max-lg:border-t max-lg:border-zinc-100 max-lg:px-4 max-lg:py-3 max-lg:first:border-t-0 max-lg:before:mb-1 max-lg:before:block max-lg:before:text-[10px] max-lg:before:font-bold max-lg:before:uppercase max-lg:before:tracking-wide max-lg:before:text-zinc-400 max-lg:before:content-[attr(data-label)]">
                <p className="mb-2 text-xs font-bold text-blue-700">{a(orderTracking(order).label)}</p>
                <select
                  value={order.status === "cancelled" || order.status === "returned"
                    ? order.status
                    : trackingSteps[Math.max(0, orderTracking(order).step)]}
                  disabled={
                    order.status === "cancelled" ||
                    order.status === "returned" ||
                    order.cancellation_request_status === "requested"
                  }
                  onChange={(event) =>
                    onStatusChange(order.id, event.target.value as DeliveryProgressStage)
                  }
                  className="rounded-full border px-3 py-2 text-xs font-semibold capitalize outline-none focus:border-red-500 disabled:bg-zinc-100"
                >
                  {allowedDeliveryProgress(order).map((stage) => (
                    <option
                      key={stage}
                      value={stage}
                      disabled={
                        (staffMode && stage === "verified") ||
                        (stage !== "cancelled" &&
                          stage !== "returned" &&
                          trackingSteps.indexOf(stage) !== Math.max(0, orderTracking(order).step) &&
                          trackingSteps.indexOf(stage) !== Math.max(0, orderTracking(order).step) + 1)
                      }
                    >
                      {stage === "cancelled" || stage === "returned" ? a(stage) : t(`tracking.${stage}`)}
                    </option>
                  ))}
                </select>
                {staffMode && orderTracking(order).step < 1 && (
                  <p className="mt-1 max-w-[12rem] text-[10px] font-semibold text-amber-700">{a("Waiting for an administrator to verify this order.")}</p>
                )}
                {staffMode && (order.status === "confirmed" || order.status === "shipped") && (
                  <>
                    {(order.courier_name || order.delivery_tracking_number) && (
                      <p className="mt-2 text-xs font-semibold text-zinc-700">{[order.courier_name, order.delivery_tracking_number].filter(Boolean).join(" · ")}</p>
                    )}
                    <button
                      type="button"
                      onClick={() => onCourier(order)}
                      className="mt-2 block rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100"
                    >
                      🚚 {order.courier_name ? a("Edit courier & tracking") : a("Add courier & tracking")}
                    </button>
                  </>
                )}
                {!staffMode && (order.status === "pending" || order.status === "confirmed") && (
                  <button
                    type="button"
                    onClick={() => onWorkflow(order, "admin_cancel")}
                    disabled={order.payment_method !== "cash_on_delivery" && !["verified", "rejected"].includes(order.payment_verification_status ?? "pending")}
                    title={order.payment_method !== "cash_on_delivery" && !["verified", "rejected"].includes(order.payment_verification_status ?? "pending") ? a("Finish checking payment before cancelling") : undefined}
                    className="mt-2 block rounded-full bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400"
                  >
                     {a("Cancel / out of stock")} </button>
                )}
                {!staffMode && (order.status === "pending" || order.status === "confirmed") && order.payment_method !== "cash_on_delivery" && !["verified", "rejected"].includes(order.payment_verification_status ?? "pending") && (
                  <p className="mt-1 max-w-[11rem] text-[10px] font-semibold text-amber-700">{a("Finish checking payment before cancelling")}</p>
                )}
                {order.status === "shipped" && (
                  <button
                    type="button"
                    onClick={() => onWorkflow(order, "delivery_attempt")}
                    className="mt-2 block rounded-full bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800 hover:bg-amber-100"
                  >
                     {a("Delivery attempt failed")} </button>
                )}
                {failedDeliveryAttempts(order) > 0 && (
                  <p className="mt-2 text-[10px] font-bold uppercase text-amber-700">
                    {failedDeliveryAttempts(order)}  {a("of")} {MAX_DELIVERY_ATTEMPTS}  {a("attempts failed")} {failedDeliveryAttempts(order) >= MAX_DELIVERY_ATTEMPTS && a(" — consider cancelling")}
                  </p>
                )}
              </td>

              <td data-label={t("adminTable.payment")} className="p-4 max-lg:block max-lg:border-t max-lg:border-zinc-100 max-lg:px-4 max-lg:py-3 max-lg:first:border-t-0 max-lg:before:mb-1 max-lg:before:block max-lg:before:text-[10px] max-lg:before:font-bold max-lg:before:uppercase max-lg:before:tracking-wide max-lg:before:text-zinc-400 max-lg:before:content-[attr(data-label)]">
                <p className="font-semibold">
                  {paymentMethodLabels[order.payment_method ?? a("cash_on_delivery")] ?? a("Cash on delivery")}
                  {order.payment_account && ` · ${order.payment_account.toUpperCase()}`}
                </p>
                <span className="mt-1 inline-block rounded-full bg-zinc-100 px-2 py-1 text-xs font-semibold capitalize">
                  {a(order.payment_status)}
                </span>
                {/* The same sentence the customer is reading right now, from
                    the same helper, so staff never have to guess. */}
                <p className="mt-1 max-w-[11rem] text-[10px] text-zinc-500">
                   {a("Customer sees:")} <span className="font-semibold text-zinc-700">{a(nextStepLabels[orderNextStep(order).key])}</span>
                </p>
                {order.payment_method && order.payment_method !== "cash_on_delivery" && (
                  <div className="mt-2">
                    <p className={`text-[10px] font-bold uppercase ${
                      order.payment_verification_status === "verified" ? "text-emerald-700"
                        : order.payment_verification_status === "rejected" ? "text-red-700" : "text-amber-700"
                    }`}>
                       {a("Payment")} {a((order.payment_verification_status ?? "pending").replaceAll("_", " "))}
                    </p>
                    {order.payment_reference && (
                      <p className="max-w-[11rem] break-all text-[10px] text-zinc-500">{a("Ref:")} {order.payment_reference}</p>
                    )}
                    {order.payment_rejected_reason && (
                      <p className="max-w-[11rem] text-[10px] text-red-700">{order.payment_rejected_reason}</p>
                    )}
                    {typeof order.payment_amount_received === "number" && (
                      <p className="max-w-[11rem] text-[10px] font-semibold text-amber-800">
                         {a("Received")} {formatCurrency(order.payment_amount_received)}  {a("of")} {formatCurrency(order.total_amount)}
                        {order.payment_amount_received < order.total_amount &&
                          ` · ${formatCurrency(order.total_amount - order.payment_amount_received)} still owed`}
                        {order.payment_amount_received > order.total_amount &&
                          ` · ${formatCurrency(order.payment_amount_received - order.total_amount)} to refund`}
                      </p>
                    )}
                    {(order.payment_slips ?? []).map((slip, index) => (
                      <a key={slip.id} href={`/api/orders/${order.id}/payment-slip/${slip.id}`} target="_blank" rel="noreferrer"
                        className="mt-1 block text-[10px] font-bold text-blue-700 underline">
                         {a("Open slip")} {index + 1} · {formatDateTime(slip.created_at)}
                      </a>
                    ))}
                    {(order.payment_slips ?? []).length === 0 && (
                      <p className="text-[10px] text-zinc-500">{a("No slip uploaded yet")}</p>
                    )}
                    <button
                      type="button"
                      onClick={() => onWorkflow(order, "payment_review")}
                      className="mt-2 block rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100"
                    >
                       {a("Check payment")} </button>
                  </div>
                )}
                {order.receipt_number && (
                  <p className="mt-2 max-w-[11rem] break-all text-[10px] text-zinc-500">
                    {order.receipt_number}<br />{a("Email:")} {(order.receipt_email_status ?? a("not sent")).replaceAll("_", " ")}
                  </p>
                )}
                {order.receipt_email_status === "failed" && order.receipt_email_error && (
                  <p className="mt-1 max-w-[11rem] text-[10px] font-semibold text-red-700">
                    {order.receipt_email_error}
                  </p>
                )}
                {!staffMode && order.status === "delivered" && (
                  <button
                    type="button"
                    onClick={() => onResendReceipt(order)}
                    disabled={resendingOrderId === order.id}
                    className="mt-2 block rounded-full bg-zinc-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-zinc-700 disabled:bg-zinc-400"
                  >
                    {resendingOrderId === order.id
                      ? a("Sending…")
                      : order.receipt_email_status === "sent"
                        ? a("Send receipt again")
                        : a("Send receipt email")}
                  </button>
                )}
                {!staffMode && order.cancellation_refund_status === "details_required" && (
                  <p className="mt-2 max-w-[12rem] rounded-xl bg-amber-50 p-2 text-[10px] font-semibold text-amber-800">{a("Waiting for customer refund bank information")}</p>
                )}
                {!staffMode && order.cancellation_refund_status === "pending" && (
                  <div className="mt-2 max-w-[13rem] rounded-xl bg-blue-50 p-2 text-[10px] text-blue-950">
                    <p className="font-bold">{a("Refund pending")}</p>
                    <p>{order.cancellation_refund_bank_name} · {order.cancellation_refund_account_name}</p>
                    <p className="break-all font-mono font-bold">{order.cancellation_refund_account_number}</p>
                    <button type="button" onClick={() => onWorkflow(order, "complete_cancellation_refund")} className="mt-2 rounded-full bg-zinc-900 px-3 py-1.5 font-bold text-white">{a("Mark refund sent")}</button>
                  </div>
                )}
                {!staffMode && order.cancellation_refund_status === "sent" && (
                  <p className="mt-2 max-w-[12rem] rounded-xl bg-emerald-50 p-2 text-[10px] font-semibold text-emerald-800">{a("Refund sent")} {order.refund_reference ? `· ${order.refund_reference}` : ""}</p>
                )}
                <p className="mt-2 text-[10px] font-bold uppercase text-zinc-500">{a("Verification:")} {a((order.cod_verification_status ?? "pending").replaceAll("_", " "))}</p>
              </td>

              {!staffMode && <td data-label={t("adminTable.request")} className="p-4 max-lg:block max-lg:border-t max-lg:border-zinc-100 max-lg:px-4 max-lg:py-3 max-lg:first:border-t-0 max-lg:before:mb-1 max-lg:before:block max-lg:before:text-[10px] max-lg:before:font-bold max-lg:before:uppercase max-lg:before:tracking-wide max-lg:before:text-zinc-400 max-lg:before:content-[attr(data-label)]">
                {(order.item_return_requests?.length ?? 0) > 0 ? (
                  <div className="space-y-2 text-xs">
                    {order.item_return_requests
                      ?.slice()
                      .sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at))
                      .map((request) => (
                        <div key={request.id} className="rounded-xl bg-amber-50 p-2 text-amber-950">
                          <p className="font-bold capitalize">
                            {a("Item return:")} {a(request.status.replaceAll("_", " "))}
                          </p>
                          <p className="mt-1 text-[10px] text-amber-800">
                            {request.order_items?.products?.name ?? a("Product")} × {request.quantity}
                            {` · ${a(request.preferred_resolution)}`}
                          </p>
                        </div>
                      ))}
                  </div>
                ) : order.cancellation_request_status === "requested" ? (
                  <OrderRequestControls label="Cancellation"
                    reason={order.cancellation_reason}
                    onApprove={() => onResolveRequest(order.id, "cancellation", "approve")}
                    onReject={() => onResolveRequest(order.id, "cancellation", "reject")} />
                ) : order.return_request_status === "requested" ? (
                  <OrderRequestControls label="Return"
                    reason={order.return_reason}
                    onApprove={() => onResolveRequest(order.id, "return", "approve")}
                    onReject={() => onResolveRequest(order.id, "return", "reject")} />
                ) : order.return_request_status === "approved" ? (
                  <ReturnWorkflowControls
                    title={a("Return approved")}
                    detail={`${order.return_pickup_method?.replaceAll("_", " ") ?? a("Return")}${order.return_pickup_address ? ` · ${order.return_pickup_address}` : ""}`}
                    button="Schedule pickup"
                    onClick={() => onWorkflow(order, "schedule_pickup")}
                  />
                ) : order.return_request_status === "pickup_scheduled" ? (
                  <ReturnWorkflowControls
                    title={a("Pickup scheduled")}
                    detail={order.return_pickup_scheduled_for ? formatDateTime(order.return_pickup_scheduled_for) : a("Date set")}
                    button="Receive & inspect"
                    onClick={() => onWorkflow(order, "mark_received")}
                  />
                ) : order.return_request_status === "received" ? (
                  <ReturnWorkflowControls
                    title={a("Item received")}
                    detail={`Restock: ${order.return_restock_approved ? a("approved") : a("no")}`}
                    button="Record refund"
                    onClick={() => onWorkflow(order, "complete_refund")}
                  />
                ) : (
                  <div className="text-xs text-zinc-500">
                    {order.cancellation_request_status !== "none" && <p className="capitalize">{a("Cancellation:")} {order.cancellation_request_status}</p>}
                    {order.return_request_status !== "none" && <p className="capitalize">{a("Return:")} {order.return_request_status}</p>}
                    {order.cancellation_request_status === "none" && order.return_request_status === "none" && <p>{a("No customer request")}</p>}
                  </div>
                )}
              </td>}

              {!staffMode && <td data-label={t("adminTable.shipping")} className="p-4 max-lg:block max-lg:border-t max-lg:border-zinc-100 max-lg:px-4 max-lg:py-3 max-lg:first:border-t-0 max-lg:before:mb-1 max-lg:before:block max-lg:before:text-[10px] max-lg:before:font-bold max-lg:before:uppercase max-lg:before:tracking-wide max-lg:before:text-zinc-400 max-lg:before:content-[attr(data-label)]">
                <p className="max-w-xs text-xs text-zinc-600">
                  {order.shipping_address}
                </p>

                {order.notes && (
                  <p className="mt-1 max-w-xs text-xs text-zinc-400">
                     {a("Note:")} {order.notes}
                  </p>
                )}
                {order.admin_order_note && (
                  <p className="mt-1 max-w-xs text-xs font-semibold text-blue-600">
                     {a("Admin note:")} {order.admin_order_note}
                  </p>
                )}
                {order.courier_name && <p className="mt-2 text-xs font-semibold">{order.courier_name}{order.delivery_tracking_number ? ` · ${order.delivery_tracking_number}` : ""}</p>}
                {order.estimated_delivery_at && <p className="mt-1 text-xs text-zinc-500">{a("ETA")} {formatDateTime(order.estimated_delivery_at)}</p>}
                {order.delivery_location_consent && order.delivery_latitude != null && order.delivery_longitude != null && <a href={`https://www.google.com/maps?q=${order.delivery_latitude},${order.delivery_longitude}`} target="_blank" rel="noreferrer" className="mt-2 block text-xs font-bold text-blue-600 hover:underline">{a("Open customer-selected delivery pin")}{order.delivery_accuracy_m != null ? ` (device accuracy ±${Math.round(order.delivery_accuracy_m)} m; not identity proof)` : a(" (manually placed; not verified)")}</a>}
                <CustomerLocation userId={order.user_id} />
                <button type="button" onClick={() => onDelivery(order)} className="mt-3 rounded-full bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100">{a("Update tracking / COD")}</button>
              </td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
