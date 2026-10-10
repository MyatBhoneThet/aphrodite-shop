import { isPrepaidMethod } from "./payment-accounts";

/**
 * Customer-facing rules for "I have a problem with this order": how long a
 * return can still be requested, whether a cancellation can happen instantly,
 * and which choices to offer. Pure, so the Orders page, the help panel and the
 * tests all agree.
 */

export const RETURN_WINDOW_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

export type HelpOrder = {
  status: string;
  delivered_at?: string | null;
  cancellation_request_status?: string | null;
  payment_method?: string | null;
  payment_verification_status?: string | null;
  payment_slips?: unknown[] | null;
};

export type ReturnWindow = {
  open: boolean;
  /** Whole days left, rounded up (2.1 days left shows as 3). 0 when closed. */
  daysLeft: number;
  hoursLeft: number;
  endsAt: Date | null;
};

export function returnWindow(order: Pick<HelpOrder, "status" | "delivered_at">, now = new Date()): ReturnWindow {
  if (order.status !== "delivered" || !order.delivered_at) return { open: false, daysLeft: 0, hoursLeft: 0, endsAt: null };
  const endsAt = new Date(Date.parse(order.delivered_at) + RETURN_WINDOW_DAYS * DAY_MS);
  const left = endsAt.getTime() - now.getTime();
  if (left <= 0) return { open: false, daysLeft: 0, hoursLeft: 0, endsAt };
  return { open: true, daysLeft: Math.ceil(left / DAY_MS), hoursLeft: Math.ceil(left / (60 * 60 * 1000)), endsAt };
}

export function returnWindowText(window: ReturnWindow) {
  if (!window.endsAt) return "";
  if (!window.open) return "The 7-day return window has ended.";
  if (window.daysLeft <= 1) return `Less than a day left to request a return (${window.hoursLeft} hour${window.hoursLeft === 1 ? "" : "s"}).`;
  return `${window.daysLeft} days left to request a return.`;
}

/**
 * Cancelling at once is only possible before the shop has checked the order
 * and while no money can have changed hands. After that the customer sends a
 * request and the shop decides (it may involve a refund).
 */
export function canCancelInstantly(order: HelpOrder) {
  if (order.status !== "pending") return false;
  if (order.cancellation_request_status === "requested" || order.cancellation_request_status === "approved") return false;
  if (isPrepaidMethod(order.payment_method)) {
    if ((order.payment_slips?.length ?? 0) > 0) return false; // a transfer may already be on its way
    if (order.payment_verification_status === "verified") return false;
  }
  return true;
}

export function canRequestCancellation(order: HelpOrder) {
  return (
    (order.status === "pending" || order.status === "confirmed") &&
    !["requested", "approved"].includes(order.cancellation_request_status ?? "none")
  );
}

export type HelpChoiceId = "cancel" | "return" | "not_arrived" | "payment" | "warranty";

export type HelpChoice = {
  id: HelpChoiceId;
  title: string;
  detail: string;
  enabled: boolean;
  /** Why it is unavailable, shown instead of hiding the choice. */
  unavailable?: string;
};

/** The few things a customer can need, with only the ones that make sense for this order's stage enabled. */
export function helpChoices(order: HelpOrder, now = new Date()): HelpChoice[] {
  const window = returnWindow(order, now);
  const delivered = order.status === "delivered";
  const closed = order.status === "cancelled" || order.status === "returned";
  const cancellable = canRequestCancellation(order);

  return [
    {
      id: "cancel",
      title: "Cancel this order",
      detail: canCancelInstantly(order)
        ? "The shop has not checked your order yet, so it is cancelled straight away."
        : "Send a cancellation request. The shop answers it, and arranges any refund.",
      enabled: cancellable,
      unavailable: closed ? "This order is already closed." : delivered ? "A delivered order can be returned instead." : "A cancellation request is already with the shop.",
    },
    {
      id: "return",
      title: "Return or exchange an item",
      detail: window.open ? returnWindowText(window) : "Wrong, damaged or faulty item? Return it within 7 days of delivery.",
      enabled: window.open,
      unavailable: delivered ? "The 7-day return window has ended. For a fault, use Warranty help." : "You can return an item after it has been delivered.",
    },
    {
      id: "not_arrived",
      title: "My order has not arrived",
      detail: "Late or missing delivery, or a courier problem.",
      enabled: !closed,
      unavailable: "This order is closed.",
    },
    {
      id: "payment",
      title: "Payment problem",
      detail: "A transfer, slip, amount or receipt question.",
      enabled: !closed || order.status === "cancelled",
    },
    {
      id: "warranty",
      title: "Warranty help",
      detail: "Something stopped working after you received it.",
      enabled: delivered,
      unavailable: "Available once the order is delivered.",
    },
  ];
}

/** Maps a help choice to the support-case topic the shop sees. */
export const HELP_TOPIC: Record<Exclude<HelpChoiceId, "cancel" | "return">, "delivery" | "payment" | "warranty"> = {
  not_arrived: "delivery",
  payment: "payment",
  warranty: "warranty",
};

// ---------------------------------------------------------------------------
// Return evidence files
// ---------------------------------------------------------------------------

export const EVIDENCE_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const EVIDENCE_VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"] as const;
export const MAX_EVIDENCE_PHOTO_BYTES = 10 * 1024 * 1024;
export const MAX_EVIDENCE_VIDEO_BYTES = 25 * 1024 * 1024;

const megabytes = (bytes: number) => Math.round((bytes / (1024 * 1024)) * 10) / 10;

/** A friendly reason a chosen evidence file cannot be sent, or null when it is fine. */
export function evidenceFileProblem(file: { name: string; type: string; size: number }) {
  const isPhoto = (EVIDENCE_PHOTO_TYPES as readonly string[]).includes(file.type);
  const isVideo = (EVIDENCE_VIDEO_TYPES as readonly string[]).includes(file.type);
  if (!isPhoto && !isVideo) return `"${file.name}" is not a photo (JPG, PNG, WebP) or video (MP4, MOV, WebM).`;
  if (file.size <= 0) return `"${file.name}" is empty.`;
  if (isPhoto && file.size > MAX_EVIDENCE_PHOTO_BYTES) {
    return `"${file.name}" is ${megabytes(file.size)} MB. Photos can be up to 10 MB.`;
  }
  if (isVideo && file.size > MAX_EVIDENCE_VIDEO_BYTES) {
    return `"${file.name}" is ${megabytes(file.size)} MB. Videos can be up to 25 MB, which is about 30 seconds. Record a shorter clip, or paste a link to a longer video instead.`;
  }
  return null;
}
