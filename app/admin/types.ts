import type { Product, ProductType, UserRole } from "../data/products";
import type { ProductPhoto } from "../lib/product-gallery";
import type { trackingSteps } from "../lib/order-tracking";

/**
 * Shapes shared by the admin screens. They describe what the admin API sends
 * and what the admin forms hold; nothing here does any work.
 */

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "returned";
export type OrderRequestStatus = "none" | "requested" | "approved" | "pickup_scheduled" | "received" | "refunded" | "rejected";
export type OrderRequestType = "cancellation" | "return";
export type OrderRequestDecision = "approve" | "reject";

export type OrderResolutionDraft = {
  orderId: string;
  requestType: OrderRequestType;
  decision: OrderRequestDecision;
  adminNote: string;
};

export type OrderWorkflowAction = "admin_cancel" | "schedule_pickup" | "mark_received" | "complete_refund" | "complete_cancellation_refund" | "delivery_attempt" | "payment_review";
export type PaymentCorrectionReason =
  | "short_payment"
  | "overpaid"
  | "unclear_slip"
  | "wrong_account"
  | "other";

export type DeliveryAttemptReason = "no_answer" | "phone_off" | "address_problem" | "customer_rescheduled" | "nobody_home";

export type OrderWorkflowDraft = {
  orderId: string;
  totalAmount: number;
  action: OrderWorkflowAction;
  reasonCode: "out_of_stock" | "pricing_error" | "customer_request" | "other";
  reason: string;
  scheduledFor: string;
  instructions: string;
  trackingNumber: string;
  inspectionNotes: string;
  restockApproved: "yes" | "no";
  deliveryReason: DeliveryAttemptReason;
  nextAttemptAt: string;
  failedAttempts: number;
  paymentDecision: "verified" | "rejected" | "correction_requested";
  paymentReference: string;
  /** Kept as text: an empty box means "not counted", which is not zero. */
  amountReceived: string;
  correctionReason: PaymentCorrectionReason;
  refundMethod: "cash" | "bank_transfer" | "mobile_wallet" | "store_credit";
  refundReference: string;
  refundAmount: string;
  refundBankName: string;
  refundAccountName: string;
  refundAccountNumber: string;
  adminNote: string;
};

export type AdminOrderItem = {
  id: string;
  product_id: number;
  quantity: number;
  unit_price: number;
  product?: Product | null;
  products?: Product | null;
};

export type AdminOrder = {
  id: string;
  po_number?: string | null;
  user_id: string;
  status: OrderStatus;
  total_amount: number;
  shipping_name: string;
  shipping_phone: string;
  shipping_address: string;
  shipping_address_line1: string | null;
  shipping_address_line2: string | null;
  shipping_city: string | null;
  shipping_state: string | null;
  shipping_postal_code: string | null;
  shipping_country: string | null;
  payment_method: "cash_on_delivery" | "bank_transfer" | "mmqr";
  payment_status: "unpaid" | "collected" | "refunded";
  cancellation_request_status: OrderRequestStatus;
  cancellation_reason: string | null;
  return_request_status: OrderRequestStatus;
  return_reason: string | null;
  return_reason_code?: string | null;
  return_pickup_method?: string | null;
  return_pickup_address?: string | null;
  return_pickup_scheduled_for?: string | null;
  return_pickup_instructions?: string | null;
  return_pickup_tracking_number?: string | null;
  return_received_at?: string | null;
  return_inspection_notes?: string | null;
  return_restock_approved?: boolean | null;
  refund_method?: string | null;
  refund_reference?: string | null;
  refund_amount?: number | null;
  refund_completed_at?: string | null;
  cancellation_refund_status?: "none" | "details_required" | "pending" | "sent";
  cancellation_refund_bank_name?: string | null;
  cancellation_refund_account_name?: string | null;
  cancellation_refund_account_number?: string | null;
  receipt_number?: string | null;
  payment_account?: "kbz" | "aya" | "mmqr" | null;
  payment_verification_status?:
    | "not_required"
    | "pending"
    | "verified"
    | "rejected"
    | "correction_requested";
  payment_reference?: string | null;
  payment_rejected_reason?: string | null;
  payment_amount_received?: number | null;
  payment_correction_reason?: PaymentCorrectionReason | null;
  payment_slips?: { id: string; file_name?: string | null; created_at: string; note?: string | null }[];
  receipt_email_status?: string;
  receipt_email_error?: string | null;
  receipt_sent_at?: string | null;
  admin_order_note: string | null;
  cod_verification_status?: "pending" | "phone_verified" | "deposit_verified" | "approved" | "rejected" | null;
  cod_verification_method?: "phone_callback" | "cod_deposit" | "admin_review" | null;
  delivery_latitude?: number | null;
  delivery_longitude?: number | null;
  delivery_accuracy_m?: number | null;
  delivery_location_consent?: boolean;
  courier_name?: string | null;
  delivery_tracking_number?: string | null;
  estimated_delivery_at?: string | null;
  delivery_status_detail?: string | null;
  delivery_events?: { stage: string; happened_at: string }[];
  notes: string | null;
  created_at: string;
  updated_at: string;
  profiles?: {
    email?: string | null;
    full_name?: string | null;
    role?: UserRole | null;
  } | null;
  item_return_requests?: {
    id: string;
    status: string;
    quantity: number;
    preferred_resolution: string;
    created_at: string;
    order_items?: { products?: { name?: string | null } | null } | null;
  }[];
  order_items?: AdminOrderItem[];
};

export type ProductFormState = {
  id?: number;
  name: string;
  type: ProductType;
  category: string;
  brand: string;
  price: string;
  wholesalePrice: string;
  stock: Product["stock"];
  stockQuantity: string;
  specs: string;
  fullSpecs: string;
  gallery: ProductPhoto[];
};

export type StockCorrectionView = {
  id: number | null;
  sourceKey: string;
  name: string;
  sourceSheet: string;
  websiteQuantity: number;
  sheetQuantity: number;
};

export type SheetSyncReport = {
  /** Products the sync brings back in line with the sheet (null if unknown). */
  stockCorrections: {
    aboveSheet: StockCorrectionView[];
    removedFromSheet: StockCorrectionView[];
    heldBack: StockCorrectionView[];
  } | null;
  dryRun: boolean;
  count: number;
  skippedCount: number;
  warnings: string[];
  bySheet: { sheet: string; products: number }[];
};

export type AutoSyncStatus = {
  intervalMinutes: number | null;
  scheduled: boolean;
  running: boolean;
  lastCheckAt: string | null;
  lastResult: "synced" | "unchanged" | "failed" | null;
  lastSyncAt: string | null;
  lastSyncCount: number | null;
  lastError: string | null;
};

export type DeliveryProgressStage = (typeof trackingSteps)[number];

export type AdminPanelId =
  | "dashboard"
  | "products"
  | "orders"
  | "queue"
  | "locations"
  | "support"
  | "ads"
  | "wholesale"
  | "pricing"
  | "sync"
  | "staff"
  | "feedback"
  | "customers"
  | "activity"
  | "security";
