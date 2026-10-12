import { orderTracking, trackingLabels, trackingSteps } from "../lib/order-tracking";
import type { AdminOrder } from "./types";

/**
 * Batch actions on the orders list.
 *
 * Selecting several orders and moving them one step is only a convenience: the
 * server still applies every rule to every order (steps in order, verification
 * first, nothing for a cancelled order). This module decides *up front* which
 * selected orders can take the step, so the admin hears "3 skipped, and why"
 * before anything is sent, and it sends one request per order.
 */

export type BatchStage = "packed" | "handed_to_courier";

/** Printing and shipping a screenful at a time is plenty; more is a mistake. */
export const MAX_BATCH_ORDERS = 50;

export type BatchSkip = { orderId: string; reason: string };

export const batchStageLabels: Record<BatchStage, string> = {
  packed: "packed",
  handed_to_courier: "handed to the courier",
};

const shortId = (orderId: string) => orderId.slice(0, 8);

/** Which of these orders can take `stage` next, and why the others cannot. */
export function planBatchAdvance(orders: AdminOrder[], stage: BatchStage) {
  const targetStep = trackingSteps.indexOf(stage);
  const eligible: AdminOrder[] = [];
  const skipped: BatchSkip[] = [];

  for (const order of orders) {
    const step = orderTracking(order).step;
    const skip = (reason: string) => skipped.push({ orderId: order.id, reason });

    if (order.status === "cancelled" || order.status === "returned") {
      skip("The order is closed.");
    } else if (order.cancellation_request_status === "requested") {
      skip("The customer asked to cancel. Resolve the request first.");
    } else if (step === targetStep) {
      skip(`Already ${trackingLabels[stage].toLowerCase()}.`);
    } else if (step > targetStep) {
      skip("Already past this step.");
    } else if (step < targetStep - 1 || order.status !== "confirmed") {
      skip(stage === "packed" ? "Not verified yet." : "Not packed yet.");
    } else {
      eligible.push(order);
    }
  }

  return { eligible, skipped };
}

export type BatchOutcome = {
  done: string[];
  failed: { orderId: string; error: string }[];
};

/**
 * Sends the step for each order, one after another (so a failure stops
 * nothing, and the server sees ordinary single-order requests). Network
 * failures are reported per order rather than thrown.
 */
export async function runBatchAdvance(
  orders: AdminOrder[],
  stage: BatchStage,
  headers: Record<string, string>,
  fetchImpl: typeof fetch = fetch
): Promise<BatchOutcome> {
  const outcome: BatchOutcome = { done: [], failed: [] };

  for (const order of orders) {
    try {
      const response = await fetchImpl(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "advance_delivery_progress", stage }),
      });

      if (response.ok) {
        outcome.done.push(order.id);
        continue;
      }

      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      outcome.failed.push({ orderId: order.id, error: body?.error ?? "Request failed." });
    } catch (reason) {
      outcome.failed.push({
        orderId: order.id,
        error: reason instanceof Error ? reason.message : "Request failed.",
      });
    }
  }

  return outcome;
}

/** One plain sentence for the message bar after a batch. */
export function describeBatch(stage: BatchStage, outcome: BatchOutcome, skipped: BatchSkip[]) {
  const parts: string[] = [];
  const done = outcome.done.length;

  if (done > 0) {
    parts.push(`${done} order${done === 1 ? "" : "s"} marked ${batchStageLabels[stage]}.`);
  }
  if (skipped.length > 0) {
    parts.push(
      `${skipped.length} skipped: ${skipped.map((entry) => `#${shortId(entry.orderId)} (${entry.reason})`).join(" ")}`
    );
  }
  if (outcome.failed.length > 0) {
    parts.push(
      `${outcome.failed.length} failed: ${outcome.failed.map((entry) => `#${shortId(entry.orderId)} (${entry.error})`).join(" ")}`
    );
  }
  if (parts.length === 0) parts.push("Nothing to do.");

  return { text: parts.join(" "), isProblem: outcome.failed.length > 0 || done === 0 };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Order ids from a `?ids=a,b,c` link: only well-formed, unique ones, capped. */
export function parseSlipIds(value: string | null) {
  return [...new Set((value ?? "").split(",").map((id) => id.trim()).filter((id) => UUID.test(id)))].slice(
    0,
    MAX_BATCH_ORDERS
  );
}
