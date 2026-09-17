"use client";

/* eslint-disable @next/next/no-img-element */

import Image from "next/image";
import BrandLogo from "../components/BrandLogo";
import CustomerLocation from "./CustomerLocation";
import {
  PRODUCT_PLACEHOLDER,
  normalizeGallery,
  productPhotos,
  type ProductPhoto,
} from "../lib/product-gallery";
import ProductPhotoUploader from "./ProductPhotoUploader";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { Product, ProductType, UserRole } from "../data/products";
import { adminLogout, authHeaders } from "../lib/client-auth";
import { useLanguage } from "../lib/language";
import LanguageSwitcher from "../components/LanguageSwitcher";
import { formatCurrency, formatDateTime } from "../lib/format";
import { useCurrentUser } from "../lib/useCurrentUser";
import PricingPanel from "./PricingPanel";
import SupportPanel from "./SupportPanel";
import QueuePanel from "./QueuePanel";
import WholesalePanel from "./WholesalePanel";
import AdminOverviewPanel from "./AdminOverviewPanel";
import CustomerLocationsPanel from "./CustomerLocationsPanel";
import { orderTracking } from "../lib/order-tracking";
import { orderNextStep, nextStepLabels } from "../lib/next-step";
import CodDeliveryForm from "./CodDeliveryForm";

type OrderStatus =
  | "pending"
  | "confirmed"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "returned";
type OrderRequestStatus = "none" | "requested" | "approved" | "pickup_scheduled" | "received" | "refunded" | "rejected";
type OrderRequestType = "cancellation" | "return";
type OrderRequestDecision = "approve" | "reject";

type OrderResolutionDraft = {
  orderId: string;
  requestType: OrderRequestType;
  decision: OrderRequestDecision;
  adminNote: string;
};

type OrderWorkflowAction = "admin_cancel" | "schedule_pickup" | "mark_received" | "complete_refund" | "delivery_attempt" | "payment_review";
const paymentMethodLabels: Record<string, string> = {
  cash_on_delivery: "Cash on delivery",
  bank_transfer: "Bank transfer",
  mmqr: "MMQR",
};
type PaymentCorrectionReason =
  | "short_payment"
  | "overpaid"
  | "unclear_slip"
  | "wrong_account"
  | "other";
const paymentCorrectionReasons: Record<PaymentCorrectionReason, string> = {
  short_payment: "Less money arrived than the order total",
  overpaid: "More money arrived than the order total",
  unclear_slip: "The slip is unreadable or incomplete",
  wrong_account: "Sent to the wrong account",
  other: "Something else to correct",
};
type DeliveryAttemptReason = "no_answer" | "phone_off" | "address_problem" | "customer_rescheduled" | "nobody_home";
const MAX_DELIVERY_ATTEMPTS = 3;
const deliveryAttemptReasons: Record<DeliveryAttemptReason, string> = {
  no_answer: "No answer on the phone",
  phone_off: "Phone switched off or unreachable",
  address_problem: "Address could not be found",
  customer_rescheduled: "Customer asked to deliver later",
  nobody_home: "Nobody available to receive the order",
};

function failedDeliveryAttempts(order: AdminOrder) {
  return (order.delivery_events ?? []).filter((event) => event.stage === "delivery_failed").length;
}
type OrderWorkflowDraft = {
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
  adminNote: string;
};

type AdminOrderItem = {
  id: string;
  product_id: number;
  quantity: number;
  unit_price: number;
  product?: Product | null;
  products?: Product | null;
};

type AdminOrder = {
  id: string;
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
  order_items?: AdminOrderItem[];
};

type ProductFormState = {
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

type StockCorrectionView = {
  id: number | null;
  sourceKey: string;
  name: string;
  sourceSheet: string;
  websiteQuantity: number;
  sheetQuantity: number;
};

type SheetSyncReport = {
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

type AutoSyncStatus = {
  intervalMinutes: number | null;
  scheduled: boolean;
  running: boolean;
  lastCheckAt: string | null;
  lastResult: "synced" | "unchanged" | "failed" | null;
  lastSyncAt: string | null;
  lastSyncCount: number | null;
  lastError: string | null;
};

/** Informational only: null when the status cannot be loaded. */
async function fetchAutoSyncStatus(): Promise<AutoSyncStatus | null> {
  try {
    const response = await fetch("/api/admin/sync-products", {
      headers: authHeaders(),
      cache: "no-store",
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { automatic?: AutoSyncStatus };
    return data.automatic ?? null;
  } catch {
    return null;
  }
}

function describeAutoSync(status: AutoSyncStatus | null) {
  if (!status) return "Checking automatic sync…";

  const parts = [
    status.intervalMinutes
      ? `Automatic sync is on: this server checks the sheet every ${status.intervalMinutes} min and saves only when it changed.`
      : status.scheduled
        ? "Automatic sync is on: Google Cloud Scheduler checks the sheet and saves only when it changed."
        : "Automatic sync is off on this server. Click Sync Products after editing the sheet.",
  ];
  if (status.lastCheckAt) {
    const outcome =
      status.lastResult === "synced"
        ? "sheet changes saved"
        : status.lastResult === "unchanged"
          ? "no changes"
          : "failed";
    parts.push(`Last check ${formatDateTime(status.lastCheckAt)}: ${outcome}.`);
  }
  if (status.lastSyncAt) parts.push(`Last saved ${formatDateTime(status.lastSyncAt)}.`);

  return parts.join(" ");
}

function allowedOrderStatuses(order: AdminOrder) {
  if (order.status === "cancelled" || order.status === "returned") return [order.status];
  const next: Partial<Record<OrderStatus, OrderStatus>> = {
    pending: "confirmed",
    confirmed: "shipped",
    shipped: "delivered",
  };
  return next[order.status] ? [order.status, next[order.status]!] : [order.status];
}

function emptyProductForm(): ProductFormState {
  return {
    name: "",
    type: "laptop",
    category: "Laptop",
    brand: "",
    price: "",
    wholesalePrice: "",
    gallery: [],
    stock: "In Stock",
    stockQuantity: "100",
    specs: JSON.stringify(
      {
        cpu: "Intel Core i5",
        ram: "8GB",
        storage: "256GB SSD",
        display: "14 inch",
      },
      null,
      2
    ),
    fullSpecs: JSON.stringify(
      {
        processor: "Intel Core i5",
        ram: "8GB",
        storage: "256GB SSD",
        graphics: "Integrated Graphics",
        display: "14-inch FHD",
        battery: "Up to 8 hours",
        weight: "1.4 kg",
        ports: "USB-C, USB-A, HDMI",
        operatingSystem: "Windows 11",
        warranty: "1 year",
        condition: "New",
        color: "Black",
      },
      null,
      2
    ),
  };
}

function productToForm(product: Product): ProductFormState {
  return {
    id: product.id,
    name: product.name,
    type: product.type,
    category: product.category,
    brand: product.brand,
    price: String(product.price),
    wholesalePrice: product.wholesalePrice
      ? String(product.wholesalePrice)
      : "",
    gallery: productPhotos(product),
    stock: product.stock,
    stockQuantity:
      product.stockQuantity !== undefined ? String(product.stockQuantity) : "",
    specs: JSON.stringify(product.specs ?? {}, null, 2),
    fullSpecs: JSON.stringify(product.fullSpecs ?? {}, null, 2),
  };
}

async function getErrorMessage(response: Response) {
  const data = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;

  return data?.error ?? "Request failed.";
}

function parseJsonObject(value: string, label: string) {
  try {
    const parsed = JSON.parse(value || "{}");

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error();
    }

    return parsed;
  } catch {
    throw new Error(`${label} must be valid JSON object format.`);
  }
}

export default function AdminPage() {
  const { user: currentUser, status: userStatus } = useCurrentUser();
  const authStatus: "checking" | "ready" | "forbidden" =
    userStatus === "checking"
      ? "checking"
      : currentUser?.role === "admin"
      ? "ready"
      : "forbidden";

  const [activePanel, setActivePanel] = useState<
    "dashboard" | "products" | "orders" | "queue" | "locations" | "support" | "wholesale" | "pricing" | "sync"
  >("dashboard");

  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [deliveryOrder, setDeliveryOrder] = useState<AdminOrder | null>(null);
  const [productForm, setProductForm] =
    useState<ProductFormState>(emptyProductForm);
  // The add/edit form is hidden until requested so the product list gets the
  // full panel width by default.
  const [isProductFormOpen, setIsProductFormOpen] = useState(false);

  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isSavingProduct, setIsSavingProduct] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [sheetSyncReport, setSheetSyncReport] =
    useState<SheetSyncReport | null>(null);
  const [orderResolution, setOrderResolution] =
    useState<OrderResolutionDraft | null>(null);
  const [isResolvingOrder, setIsResolvingOrder] = useState(false);
  const [orderWorkflow, setOrderWorkflow] = useState<OrderWorkflowDraft | null>(null);
  const [isSavingWorkflow, setIsSavingWorkflow] = useState(false);

  // Dashboard quick actions deep-link straight into a panel (/admin?panel=…).
  // Scheduling the update avoids a synchronous state cascade inside the effect.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      const panel = params.get("panel");
      if (
        panel === "dashboard" ||
        panel === "products" ||
        panel === "orders" ||
        panel === "locations" ||
        panel === "queue" ||
        // Old deep links to the separate Help Cases panel still land somewhere.
        panel === "cases" ||
        panel === "support" ||
        panel === "wholesale" ||
        panel === "pricing" ||
        panel === "sync"
      ) {
        setActivePanel(panel === "cases" ? "queue" : panel);
      }
      if (panel === "products" && params.get("action") === "add") {
        setIsProductFormOpen(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const loadDashboardData = useCallback(async () => {
    setIsLoadingData(true);
    setError("");

    try {
      // Authenticated so the response includes admin-only fields
      // (legacy wholesale price + numeric inventory).
      const productsResponse = await fetch("/api/products?limit=100", {
        headers: authHeaders(),
        cache: "no-store",
      });

      if (!productsResponse.ok) {
        throw new Error(await getErrorMessage(productsResponse));
      }

      const productsData = (await productsResponse.json()) as {
        products: Product[];
      };

      setProducts(productsData.products ?? []);

      // Auth rides in the httpOnly admin session cookie (or a legacy
      // localStorage bearer token via authHeaders()).
      const ordersResponse = await fetch("/api/orders", {
        headers: authHeaders(),
        cache: "no-store",
      });

      if (ordersResponse.ok) {
        const ordersData = (await ordersResponse.json()) as {
          orders: AdminOrder[];
        };

        setOrders(ordersData.orders ?? []);
      } else {
        setOrders([]);
        setMessage(
          "Dashboard loaded, but orders could not load. Please login again if needed."
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load data.");
    } finally {
      setIsLoadingData(false);
    }
  }, []);

  useEffect(() => {
    async function loadOnMount() {
      if (authStatus === "ready") {
        await loadDashboardData();
      }
    }

    loadOnMount();
  }, [authStatus, loadDashboardData]);

  const filteredProducts = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    if (!keyword) return products;

    return products.filter((product) =>
      `${product.name} ${product.brand} ${product.category} ${product.stock}`
        .toLowerCase()
        .includes(keyword)
    );
  }, [products, search]);

  async function handleLogout() {
    await adminLogout();
    window.location.assign("/admin/login");
  }

  async function handleSaveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    setIsSavingProduct(true);

    try {
      const price = Number(productForm.price);
      const wholesalePrice = productForm.wholesalePrice
        ? Number(productForm.wholesalePrice)
        : undefined;

      if (!productForm.name.trim()) throw new Error("Product name is required.");
      if (!productForm.brand.trim()) throw new Error("Brand is required.");
      if (!productForm.category.trim()) {
        throw new Error("Category is required.");
      }

      if (!Number.isFinite(price) || price < 0) {
        throw new Error("Retail price must be a valid number.");
      }

      if (
        productForm.wholesalePrice &&
        (!Number.isFinite(wholesalePrice) || Number(wholesalePrice) < 0)
      ) {
        throw new Error("Wholesale price must be a valid number.");
      }

      const stockQuantity = productForm.stockQuantity
        ? Number(productForm.stockQuantity)
        : undefined;

      if (
        stockQuantity !== undefined &&
        (!Number.isInteger(stockQuantity) || stockQuantity < 0)
      ) {
        throw new Error("Stock quantity must be a whole number of 0 or more.");
      }

      const payload: Partial<Product> = {
        name: productForm.name.trim(),
        type: productForm.type,
        category: productForm.category.trim(),
        brand: productForm.brand.trim(),
        price,
        wholesalePrice,
        image: productForm.gallery[0]?.url ?? PRODUCT_PLACEHOLDER,
        stock: productForm.stock,
        stockQuantity,
        specs: parseJsonObject(productForm.specs, "Short specs"),
        fullSpecs: { ...parseJsonObject(productForm.fullSpecs, "Full specs"), gallery: normalizeGallery(productForm.gallery), galleryManagedBy: "admin" },
      };

      const response = await fetch(
        productForm.id ? `/api/products/${productForm.id}` : "/api/products",
        {
          method: productForm.id ? "PATCH" : "POST",
          headers: {
            ...authHeaders(),
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        throw new Error(await getErrorMessage(response));
      }

      const data = (await response.json().catch(() => null)) as {
        sheetStock?: {
          sheet: string;
          cells: { row: number; from: number; to: number }[];
          sheetQuantityBefore: number;
          sheetQuantityAfter: number;
          warning: string | null;
        } | null;
      } | null;
      const sheetStock = data?.sheetStock;

      setProductForm(emptyProductForm());
      setIsProductFormOpen(false);
      await loadDashboardData();

      if (sheetStock) {
        const changedRows = sheetStock.cells.length
          ? sheetStock.cells.map((cell) => `row ${cell.row}: ${cell.from} → ${cell.to}`).join(", ")
          : "the sheet already had this number";
        setMessage(
          `Product updated. Google Sheet "${sheetStock.sheet}" stock is now ${sheetStock.sheetQuantityAfter} (was ${sheetStock.sheetQuantityBefore}; ${changedRows}).`
        );
        if (sheetStock.warning) setError(sheetStock.warning);
      } else {
        setMessage(
          productForm.id
            ? "Product updated successfully."
            : "Product added successfully."
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save product.");
    } finally {
      setIsSavingProduct(false);
    }
  }

  async function handleDeleteProduct(product: Product) {
    const confirmed = window.confirm(`Delete ${product.name}?`);

    if (!confirmed) return;

    setMessage("");
    setError("");

    try {
      const response = await fetch(`/api/products/${product.id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });

      if (!response.ok) {
        throw new Error(await getErrorMessage(response));
      }

      await loadDashboardData();
      setMessage("Product deleted successfully.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to delete product."
      );
    }
  }

  // Same switch as the shop: the admin's choice is remembered too.
  const { t } = useLanguage();
  const [resendingOrderId, setResendingOrderId] = useState<string | null>(null);

  async function handleOrderStatusChange(orderId: string, status: OrderStatus) {
    setMessage("");
    setError("");

    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        throw new Error(await getErrorMessage(response));
      }

      await loadDashboardData();
      setMessage("Order status updated.");
    } catch (err) {
      // A failed request can still have saved the new status. Reload first so
      // the dropdown shows what the database really has -- otherwise it keeps
      // the old status and the admin clicks again. The reload clears the
      // error, so set it afterwards.
      await loadDashboardData();
      setError(err instanceof Error ? err.message : "Unable to update order.");
    }
  }

  async function handleResendReceipt(order: AdminOrder) {
    const recipient = order.profiles?.email ?? "the customer";
    if (!window.confirm(`Email the full receipt to ${recipient}?`)) return;

    setMessage("");
    setError("");
    setResendingOrderId(order.id);

    try {
      const response = await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "resend_receipt" }),
      });

      if (!response.ok) {
        throw new Error(await getErrorMessage(response));
      }

      const data = (await response.json()) as {
        email?: { status: string; recipient: string | null; error: string | null };
      };
      await loadDashboardData();

      const status = data.email?.status;
      if (status === "sent") {
        setMessage(`Receipt email sent to ${data.email?.recipient ?? recipient}.`);
      } else if (status === "not_sent") {
        setError("Not sent: this customer turned off order emails in Settings.");
      } else if (status === "not_configured") {
        setError("Not sent: Gmail is not set up on the server, or this customer has no email address.");
      } else {
        setError(data.email?.error ?? "The receipt email could not be sent.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send the receipt email.");
    } finally {
      setResendingOrderId(null);
    }
  }

  function handleDeliveryUpdate(order: AdminOrder) {
    setError(""); setMessage(""); setDeliveryOrder(order);
  }

  function openOrderRequestResolution(
    orderId: string,
    requestType: OrderRequestType,
    decision: OrderRequestDecision
  ) {
    setMessage("");
    setError("");
    setOrderResolution({
      orderId,
      requestType,
      decision,
      adminNote: "",
    });
  }

  async function handleOrderRequestResolution(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!orderResolution) return;

    const { orderId, requestType, decision, adminNote } = orderResolution;
    setMessage("");
    setError("");
    setIsResolvingOrder(true);

    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "resolve_request",
          request_type: requestType,
          decision,
          admin_note: adminNote.trim() || null,
        }),
      });
      if (!response.ok) throw new Error(await getErrorMessage(response));

      setOrderResolution(null);
      await loadDashboardData();
      setMessage(
        `${requestType === "cancellation" ? "Cancellation" : "Return"} request ${decision === "approve" ? "approved" : "rejected"}.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to resolve order request.");
    } finally {
      setIsResolvingOrder(false);
    }
  }

  function openOrderWorkflow(order: AdminOrder, action: OrderWorkflowAction) {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    tomorrow.setMinutes(tomorrow.getMinutes() - tomorrow.getTimezoneOffset());
    setMessage("");
    setError("");
    setOrderWorkflow({
      orderId: order.id,
      totalAmount: order.total_amount,
      action,
      reasonCode: "out_of_stock",
      reason: action === "admin_cancel" ? "Item is unavailable after stock verification." : "",
      scheduledFor: tomorrow.toISOString().slice(0, 16),
      instructions: "Please keep the machine, charger, accessories, and packaging together.",
      trackingNumber: "",
      inspectionNotes: "",
      restockApproved: "no",
      deliveryReason: "no_answer",
      nextAttemptAt: tomorrow.toISOString().slice(0, 16),
      failedAttempts: failedDeliveryAttempts(order),
      paymentDecision: "verified",
      paymentReference: order.payment_reference ?? "",
      amountReceived:
        typeof order.payment_amount_received === "number"
          ? String(order.payment_amount_received)
          : "",
      correctionReason: order.payment_correction_reason ?? "short_payment",
      refundMethod: "bank_transfer",
      refundReference: "",
      refundAmount: String(order.total_amount),
      adminNote: "",
    });
  }

  async function handleOrderWorkflow(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!orderWorkflow) return;

    let payload: Record<string, unknown>;
    if (orderWorkflow.action === "admin_cancel") {
      if (orderWorkflow.reason.trim().length < 3) {
        setError("Enter the reason for cancellation.");
        return;
      }
      payload = {
        action: "admin_cancel",
        reason_code: orderWorkflow.reasonCode,
        reason: orderWorkflow.reason.trim(),
        admin_note: orderWorkflow.adminNote.trim() || null,
      };
    } else if (orderWorkflow.action === "schedule_pickup") {
      const scheduled = new Date(orderWorkflow.scheduledFor);
      if (!orderWorkflow.scheduledFor || Number.isNaN(scheduled.getTime())) {
        setError("Choose a valid pickup or drop-off date.");
        return;
      }
      payload = {
        action: "advance_return",
        stage: "schedule_pickup",
        scheduled_for: scheduled.toISOString(),
        instructions: orderWorkflow.instructions.trim() || null,
        tracking_number: orderWorkflow.trackingNumber.trim() || null,
        admin_note: orderWorkflow.adminNote.trim() || null,
      };
    } else if (orderWorkflow.action === "mark_received") {
      payload = {
        action: "advance_return",
        stage: "mark_received",
        inspection_notes: orderWorkflow.inspectionNotes.trim() || null,
        restock_approved: orderWorkflow.restockApproved === "yes",
        admin_note: orderWorkflow.adminNote.trim() || null,
      };
    } else if (orderWorkflow.action === "payment_review") {
      if (orderWorkflow.paymentDecision === "rejected" && orderWorkflow.reason.trim().length < 3) {
        setError("Tell the customer why the payment could not be confirmed.");
        return;
      }

      const correction = orderWorkflow.paymentDecision === "correction_requested";
      const typed = orderWorkflow.amountReceived.trim();
      // Empty stays null: "not counted" and "nothing arrived" read differently
      // to the customer, so they must not collapse into 0 here.
      const counted = correction && typed !== "" ? Number(typed) : null;
      const needsAmount =
        orderWorkflow.correctionReason === "short_payment" ||
        orderWorkflow.correctionReason === "overpaid";

      if (correction && orderWorkflow.reason.trim().length < 10) {
        setError("Explain the correction so the customer knows exactly what to send.");
        return;
      }
      if (correction && needsAmount && typed === "") {
        setError("Enter how much actually arrived so the customer sees the exact amount.");
        return;
      }
      if (counted !== null && (!Number.isInteger(counted) || counted < 0)) {
        setError("The amount received must be a whole number of kyat, or empty.");
        return;
      }
      if (counted !== null && counted === orderWorkflow.totalAmount) {
        setError(
          "That is the full order total — verify the payment instead of asking for a correction."
        );
        return;
      }

      payload = {
        action: "verify_payment",
        decision: orderWorkflow.paymentDecision,
        payment_reference: orderWorkflow.paymentReference.trim() || null,
        reason: orderWorkflow.reason.trim() || null,
        ...(correction
          ? { amount_received: counted, correction_reason: orderWorkflow.correctionReason }
          : {}),
      };
    } else if (orderWorkflow.action === "delivery_attempt") {
      const nextAttempt = orderWorkflow.nextAttemptAt
        ? new Date(orderWorkflow.nextAttemptAt)
        : null;
      if (nextAttempt && Number.isNaN(nextAttempt.getTime())) {
        setError("Choose a valid date for the next delivery attempt, or leave it empty.");
        return;
      }
      payload = {
        action: "delivery_attempt_failed",
        reason: orderWorkflow.deliveryReason,
        next_attempt_at: nextAttempt ? nextAttempt.toISOString() : null,
        admin_note: orderWorkflow.adminNote.trim() || null,
      };
    } else {
      const amount = Number(orderWorkflow.refundAmount);
      if (!Number.isInteger(amount) || amount < 0 || amount > orderWorkflow.totalAmount) {
        setError("Refund amount must be a whole number between 0 and the order total.");
        return;
      }
      payload = {
        action: "advance_return",
        stage: "complete_refund",
        refund_method: orderWorkflow.refundMethod,
        refund_reference: orderWorkflow.refundReference.trim() || null,
        refund_amount: amount,
        admin_note: orderWorkflow.adminNote.trim() || null,
      };
    }

    setError("");
    setMessage("");
    setIsSavingWorkflow(true);
    try {
      const response = await fetch(`/api/orders/${orderWorkflow.orderId}`, {
        method: "PATCH",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(await getErrorMessage(response));
      const completedAction = orderWorkflow.action;
      setOrderWorkflow(null);
      await loadDashboardData();
      setMessage(
        completedAction === "admin_cancel"
          ? "Order cancelled and reserved inventory restored."
          : completedAction === "schedule_pickup"
            ? "Return pickup or drop-off scheduled."
            : completedAction === "mark_received"
              ? "Returned item inspected and received."
              : "Refund record completed."
      );
    } catch (workflowError) {
      setError(workflowError instanceof Error ? workflowError.message : "Unable to update the return workflow.");
    } finally {
      setIsSavingWorkflow(false);
    }
  }

  const [autoSync, setAutoSync] = useState<AutoSyncStatus | null>(null);

  // While the sync panel is open, refresh the automatic sync status every 30 s.
  useEffect(() => {
    if (activePanel !== "sync") return;
    let cancelled = false;

    async function refresh() {
      const status = await fetchAutoSyncStatus();
      if (!cancelled && status) setAutoSync(status);
    }

    void refresh();
    const timer = window.setInterval(() => void refresh(), 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [activePanel]);

  async function handleSyncProducts(dryRun: boolean) {
    setMessage("");
    setError("");
    setIsSyncing(true);

    try {
      const response = await fetch("/api/admin/sync-products", {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ dryRun }),
      });

      const data = (await response.json().catch(() => null)) as {
        dryRun?: boolean;
        count?: number;
        skippedRows?: unknown[];
        warnings?: string[];
        stockCorrections?: SheetSyncReport["stockCorrections"];
        summary?: { bySheet?: { sheet: string; products: number }[] };
        error?: string;
      } | null;

      if (!response.ok) {
        throw new Error(data?.error ?? "Unable to sync products.");
      }

      if (!dryRun) {
        await loadDashboardData();
        const status = await fetchAutoSyncStatus();
        if (status) setAutoSync(status);
      }

      const skippedCount = data?.skippedRows?.length ?? 0;
      const warningCount = data?.warnings?.length ?? 0;
      const stockCorrections = data?.stockCorrections ?? null;
      const correctionCount =
        (stockCorrections?.aboveSheet.length ?? 0) +
        (stockCorrections?.removedFromSheet.length ?? 0);
      const details = `${skippedCount} rows skipped; ${warningCount} warnings; ${correctionCount} stock ${
        dryRun ? "corrections to make" : "corrections made"
      }.`;

      setSheetSyncReport({
        dryRun,
        count: data?.count ?? 0,
        skippedCount,
        warnings: data?.warnings ?? [],
        bySheet: data?.summary?.bySheet ?? [],
        stockCorrections,
      });

      setMessage(
        dryRun
          ? `Dry run complete. ${data?.count ?? 0} products found; ${details}`
          : `Sync complete. ${data?.count ?? 0} products updated; ${details}`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sync products.");
    } finally {
      setIsSyncing(false);
    }
  }

  if (authStatus === "checking") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f4f6f9] text-zinc-700">
        Checking admin access...
      </main>
    );
  }

  if (authStatus === "forbidden") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f4f6f9] px-5 text-zinc-950">
        <div className="max-w-md rounded-3xl bg-white p-8 text-center shadow">
          <p className="text-5xl">🔒</p>
          <h1 className="mt-4 text-2xl font-bold">Admin access only</h1>
          <p className="mt-3 text-zinc-500">
            You need an admin account to view this page. Please login with
            your admin credentials.
          </p>

          <div className="mt-6 flex justify-center gap-3">
            <Link
              href="/admin/login"
              className="rounded-full bg-red-600 px-5 py-2 text-sm font-semibold text-white"
            >
              Go to Admin Login
            </Link>

            <Link href="/" className="rounded-full border px-5 py-2 text-sm">
              Back to Store
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f4f6f9] text-zinc-900">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 bg-[#343a40] text-white shadow-xl lg:block">
        <div className="flex h-20 items-center border-b border-white/10 bg-white px-5">
          <BrandLogo />
        </div>

        <div className="border-b border-white/10 p-5">
          <p className="font-semibold">
            {currentUser?.full_name || "Demo Admin"}
          </p>
          <p className="truncate text-xs text-white/50">
            {currentUser?.email}
          </p>
        </div>

        <div className="p-4">
          <input
            placeholder="Search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full rounded bg-[#2f3439] px-4 py-2 text-sm text-white outline-none placeholder:text-white/40"
          />
        </div>

        <nav className="space-y-1 px-3 text-sm">
          <SidebarButton
            active={activePanel === "dashboard"}
            icon="📊"
            label={t("admin.overview")}
            onClick={() => setActivePanel("dashboard")}
          />
          <SidebarButton
            active={activePanel === "products"}
            icon="💻"
            label={t("admin.products")}
            onClick={() => setActivePanel("products")}
          />
          <SidebarButton
            active={activePanel === "orders"}
            icon="🧾"
            label={t("admin.purchases")}
            onClick={() => setActivePanel("orders")}
          />
          <SidebarButton
            active={activePanel === "queue"}
            icon="📋"
            label={t("admin.queue")}
            onClick={() => setActivePanel("queue")}
          />
          <SidebarButton
            active={activePanel === "locations"}
            icon="📍"
            label={t("admin.locations")}
            onClick={() => setActivePanel("locations")}
          />
          <SidebarButton
            active={activePanel === "support"}
            icon="💬"
            label={t("admin.liveChat")}
            onClick={() => setActivePanel("support")}
          />
          <SidebarButton
            active={activePanel === "wholesale"}
            icon="🏢"
            label={t("admin.wholesale")}
            onClick={() => setActivePanel("wholesale")}
          />
          <SidebarButton
            active={activePanel === "pricing"}
            icon="🏷️"
            label={t("admin.priceLists")}
            onClick={() => setActivePanel("pricing")}
          />
          <SidebarButton
            active={activePanel === "sync"}
            icon="🔄"
            label={t("admin.sheetSync")}
            onClick={() => setActivePanel("sync")}
          />

          <div className="px-3 pb-2 pt-6 text-xs font-semibold uppercase text-white/40">
            {t("admin.shop")}
          </div>

          <Link
            href="/"
            className="flex items-center gap-3 rounded px-4 py-3 text-white/80 hover:bg-white/10"
          >
            <span>🏪</span>
            {t("admin.backToStore")}
          </Link>

          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded px-4 py-3 text-left text-white/80 hover:bg-white/10"
          >
            <span>🚪</span>
            {t("nav.logout")}
          </button>
        </nav>
      </aside>

      <section className="lg:pl-72">
        <header className="sticky top-0 z-30 border-b bg-white shadow-sm">
          <div className="flex min-h-16 items-center justify-between gap-4 px-5 py-3">
            <div>
              <h1 className="text-xl font-bold">{t("admin.manage")}</h1>
              <p className="text-xs text-zinc-500">
                {activePanel.replaceAll("_", " ")} / Aphrodite Admin Panel
              </p>
            </div>

            <div className="flex items-center gap-3">
              <LanguageSwitcher />

              <button
                onClick={loadDashboardData}
                disabled={isLoadingData}
                className="rounded-full border px-4 py-2 text-sm font-semibold disabled:bg-zinc-100"
              >
                {isLoadingData ? t("common.loading") : t("common.refresh")}
              </button>

              <button
                onClick={handleLogout}
                className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white"
              >
                {t("nav.logout")}
              </button>
            </div>
          </div>
        </header>

        <div className="p-5 lg:p-8">
          {(message || error) && (
            <div
              className={`mb-5 rounded-xl p-4 text-sm font-semibold ${
                error ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"
              }`}
            >
              {error || message}
            </div>
          )}

          {activePanel === "dashboard" && (
            <AdminOverviewPanel onNavigate={(panel) => setActivePanel(panel)} />
          )}

          {activePanel === "products" && (
            <section
              className={`mt-6 grid gap-6 ${
                isProductFormOpen ? "xl:grid-cols-[520px_1fr]" : ""
              }`}
            >
              {isProductFormOpen && (
              <div className="rounded-2xl bg-white shadow-sm ring-1 ring-zinc-100">
                <div className="flex items-start justify-between gap-3 border-b px-5 py-4">
                  <div>
                    <h2 className="font-bold">
                      {productForm.id ? "Edit Product" : "Add Product"}
                    </h2>
                    <p className="text-sm text-zinc-500">
                      Add laptops, accessories, price and stock.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsProductFormOpen(false);
                      setProductForm(emptyProductForm());
                    }}
                    aria-label="Close form"
                    className="rounded-full px-2 text-xl leading-none text-zinc-400 hover:text-zinc-700"
                  >
                    &times;
                  </button>
                </div>

                <form onSubmit={handleSaveProduct} className="space-y-4 p-5">
                  <div>
                    <label className="mb-1 block text-sm font-semibold">
                      Product Name
                    </label>
                    <input
                      value={productForm.name}
                      onChange={(event) =>
                        setProductForm({
                          ...productForm,
                          name: event.target.value,
                        })
                      }
                      className="w-full rounded-xl border px-4 py-3 outline-none focus:border-red-500"
                      placeholder="ASUS Vivobook 15"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-sm font-semibold">
                        Type
                      </label>
                      <select
                        value={productForm.type}
                        onChange={(event) =>
                          setProductForm({
                            ...productForm,
                            type: event.target.value as ProductType,
                            category:
                              event.target.value === "laptop"
                                ? "Laptop"
                                : "Accessories",
                          })
                        }
                        className="w-full rounded-xl border px-4 py-3 outline-none focus:border-red-500"
                      >
                        <option value="laptop">Laptop</option>
                        <option value="accessory">Accessory</option>
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-semibold">
                        Stock
                      </label>
                      <select
                        value={productForm.stock}
                        onChange={(event) =>
                          setProductForm({
                            ...productForm,
                            stock: event.target.value as Product["stock"],
                          })
                        }
                        className="w-full rounded-xl border px-4 py-3 outline-none focus:border-red-500"
                      >
                        <option value="In Stock">In Stock</option>
                        <option value="Out of Stock">Out of Stock</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-sm font-semibold">
                        Brand
                      </label>
                      <input
                        value={productForm.brand}
                        onChange={(event) =>
                          setProductForm({
                            ...productForm,
                            brand: event.target.value,
                          })
                        }
                        className="w-full rounded-xl border px-4 py-3 outline-none focus:border-red-500"
                        placeholder="Lenovo"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-semibold">
                        Category
                      </label>
                      <input
                        value={productForm.category}
                        onChange={(event) =>
                          setProductForm({
                            ...productForm,
                            category: event.target.value,
                          })
                        }
                        className="w-full rounded-xl border px-4 py-3 outline-none focus:border-red-500"
                        placeholder="Gaming Laptop"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-sm font-semibold">
                        Retail Price
                      </label>
                      <input
                        type="number"
                        value={productForm.price}
                        onChange={(event) =>
                          setProductForm({
                            ...productForm,
                            price: event.target.value,
                          })
                        }
                        className="w-full rounded-xl border px-4 py-3 outline-none focus:border-red-500"
                        placeholder="25000"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-semibold">
                        Wholesale Price (legacy)
                      </label>
                      <input
                        type="number"
                        value={productForm.wholesalePrice}
                        onChange={(event) =>
                          setProductForm({
                            ...productForm,
                            wholesalePrice: event.target.value,
                          })
                        }
                        className="w-full rounded-xl border px-4 py-3 outline-none focus:border-red-500"
                        placeholder="23000"
                      />
                      <p className="mt-1 text-xs text-zinc-400">
                        Not used for pricing — manage quantity tiers in
                        “Price Lists &amp; Tiers”.
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-semibold">
                      Stock Quantity
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={productForm.stockQuantity}
                      onChange={(event) =>
                        setProductForm({
                          ...productForm,
                          stockQuantity: event.target.value,
                        })
                      }
                      className="w-full rounded-xl border px-4 py-3 outline-none focus:border-red-500"
                      placeholder="100"
                    />
                    <p className="mt-1 text-xs text-zinc-400">
                      Authoritative inventory for checkout. The In/Out of Stock
                      label follows this number automatically. For products from
                      the Google Sheet, a new number is also written to the sheet.
                    </p>
                  </div>

                  <ProductPhotoUploader
                    photos={productForm.gallery}
                    onChange={(gallery) =>
                      setProductForm({ ...productForm, gallery })
                    }
                  />

                  <details className="rounded-xl border px-4 py-3">
                    <summary className="cursor-pointer text-sm font-semibold text-zinc-700">
                      Advanced: specifications (optional)
                    </summary>

                    <div className="mt-4 space-y-4">
                      <div>
                        <label className="mb-1 block text-sm font-semibold">
                          Short Specs JSON
                        </label>
                        <textarea
                          value={productForm.specs}
                          onChange={(event) =>
                            setProductForm({
                              ...productForm,
                              specs: event.target.value,
                            })
                          }
                          rows={5}
                          className="w-full rounded-xl border px-4 py-3 font-mono text-xs outline-none focus:border-red-500"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-sm font-semibold">
                          Full Specs JSON
                        </label>
                        <textarea
                          value={productForm.fullSpecs}
                          onChange={(event) =>
                            setProductForm({
                              ...productForm,
                              fullSpecs: event.target.value,
                            })
                          }
                          rows={7}
                          className="w-full rounded-xl border px-4 py-3 font-mono text-xs outline-none focus:border-red-500"
                        />
                      </div>
                    </div>
                  </details>

                  <div className="flex gap-3">
                    <button
                      type="submit"
                      disabled={isSavingProduct}
                      className="flex-1 rounded-full bg-red-600 px-5 py-3 font-semibold text-white disabled:bg-zinc-400"
                    >
                      {isSavingProduct
                        ? "Saving..."
                        : productForm.id
                        ? "Update Product"
                        : "Add Product"}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsProductFormOpen(false);
                        setProductForm(emptyProductForm());
                      }}
                      className="rounded-full border px-5 py-3 font-semibold hover:bg-zinc-100"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
              )}

              <div className="rounded-2xl bg-white shadow-sm ring-1 ring-zinc-100">
                <div className="flex flex-col gap-4 border-b px-5 py-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="font-bold">Product List</h2>
                    <p className="text-sm text-zinc-500">
                      Edit price, stock and product information.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      className="rounded-full border px-4 py-2 text-sm outline-none focus:border-red-500"
                      placeholder="Search products..."
                    />
                    {!isProductFormOpen && (
                      <button
                        onClick={() => {
                          setProductForm(emptyProductForm());
                          setIsProductFormOpen(true);
                        }}
                        className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700"
                      >
                        + Add Product
                      </button>
                    )}
                  </div>
                </div>

                <ProductsTable
                  products={filteredProducts}
                  onEdit={(product) => {
                    setProductForm(productToForm(product));
                    setIsProductFormOpen(true);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  onDelete={handleDeleteProduct}
                />
              </div>
            </section>
          )}

          {activePanel === "orders" && (
            <section className="mt-6 rounded-2xl bg-white shadow-sm ring-1 ring-zinc-100">
              <div className="border-b px-5 py-4">
                <h2 className="font-bold">Customer Purchases</h2>
                <p className="text-sm text-zinc-500">
                  Confirm COD purchases, manage delivery, and review
                  cancellation or return requests.
                </p>
              </div>

              {deliveryOrder && <CodDeliveryForm key={deliveryOrder.id} order={deliveryOrder}
                onClose={() => setDeliveryOrder(null)} onSaved={async () => {
                  await loadDashboardData(); setDeliveryOrder(null);
                  setMessage("COD verification and delivery details saved.");
                }} />}
              <OrdersTable
                orders={orders}
                onStatusChange={handleOrderStatusChange}
                onResolveRequest={openOrderRequestResolution}
                onWorkflow={openOrderWorkflow}
                onDelivery={handleDeliveryUpdate}
                onResendReceipt={handleResendReceipt}
                resendingOrderId={resendingOrderId}
              />
            </section>
          )}

          {activePanel === "queue" && <QueuePanel />}

          {activePanel === "locations" && <CustomerLocationsPanel />}

          {activePanel === "support" && <SupportPanel />}

          {activePanel === "wholesale" && <WholesalePanel />}

          {activePanel === "pricing" && <PricingPanel />}

          {activePanel === "sync" && (
            <section className="mt-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-zinc-100">
              <h2 className="text-xl font-bold">Google Sheet Product Sync</h2>
              <p className="mt-2 max-w-2xl text-sm text-zinc-500">
                Imports the production Laptops, Accessories, and PC Parts tabs.
                Dry run validates and groups inventory rows without saving. Real
                sync imports the resulting products into Supabase.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  onClick={() => handleSyncProducts(true)}
                  disabled={isSyncing}
                  className="rounded-full border px-5 py-3 font-semibold disabled:bg-zinc-100"
                >
                  Dry Run
                </button>

                <button
                  onClick={() => handleSyncProducts(false)}
                  disabled={isSyncing}
                  className="rounded-full bg-red-600 px-5 py-3 font-semibold text-white disabled:bg-zinc-400"
                >
                  Sync Products
                </button>
              </div>

              <p className="mt-4 max-w-2xl text-sm text-zinc-600">
                {describeAutoSync(autoSync)}
              </p>
              {autoSync?.lastResult === "failed" && autoSync.lastError && (
                <p className="mt-1 max-w-2xl text-sm font-semibold text-red-700">
                  Last automatic sync failed: {autoSync.lastError}
                </p>
              )}

              {sheetSyncReport && (
                <div className="mt-6 rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
                  <p className="font-bold">
                    {sheetSyncReport.dryRun ? "Dry-run result" : "Last sync"}: {" "}
                    {sheetSyncReport.count.toLocaleString()} products
                  </p>
                  {sheetSyncReport.bySheet.length > 0 && (
                    <ul className="mt-3 flex flex-wrap gap-2 text-sm">
                      {sheetSyncReport.bySheet.map((entry) => (
                        <li
                          key={entry.sheet}
                          className="rounded-full bg-white px-3 py-1 ring-1 ring-zinc-200"
                        >
                          {entry.sheet}: {entry.products.toLocaleString()}
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="mt-3 text-sm text-zinc-600">
                    {sheetSyncReport.skippedCount.toLocaleString()} source rows
                    skipped.
                  </p>
                  {sheetSyncReport.warnings.length > 0 && (
                    <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
                      <p className="font-bold">Review before syncing</p>
                      <ul className="mt-2 list-disc space-y-1 pl-5">
                        {sheetSyncReport.warnings.map((warning) => (
                          <li key={warning}>{warning}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {sheetSyncReport.stockCorrections &&
                    (sheetSyncReport.stockCorrections.aboveSheet.length > 0 ||
                      sheetSyncReport.stockCorrections.removedFromSheet.length > 0) && (
                      <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950">
                        <p className="font-bold">
                          {sheetSyncReport.dryRun
                            ? "Stock that will be corrected to match the sheet"
                            : "Stock corrected to match the sheet"}
                        </p>
                        <p className="mt-1 text-xs text-sky-800">
                          The website never shows more units than the Google Sheet.
                        </p>
                        <ul className="mt-2 list-disc space-y-1 pl-5">
                          {sheetSyncReport.stockCorrections.aboveSheet.map((item) => (
                            <li key={`above-${item.sourceKey}`}>
                              <span className="font-semibold">{item.name}</span> ({item.sourceSheet}):
                              website {item.websiteQuantity} → sheet {item.sheetQuantity}
                              {item.sheetQuantity === 0 ? " · Out of Stock" : ""}
                            </li>
                          ))}
                          {sheetSyncReport.stockCorrections.removedFromSheet.map((item) => (
                            <li key={`removed-${item.sourceKey}`}>
                              <span className="font-semibold">{item.name}</span> ({item.sourceSheet}):
                              no longer in the sheet → Out of Stock
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                </div>
              )}
            </section>
          )}
        </div>
      </section>

      {orderResolution && (
        <OrderResolutionDialog
          draft={orderResolution}
          isSubmitting={isResolvingOrder}
          onNoteChange={(adminNote) =>
            setOrderResolution((current) =>
              current ? { ...current, adminNote } : current
            )
          }
          onCancel={() => {
            if (!isResolvingOrder) setOrderResolution(null);
          }}
          onSubmit={handleOrderRequestResolution}
        />
      )}
      {orderWorkflow && (
        <OrderWorkflowDialog
          draft={orderWorkflow}
          isSubmitting={isSavingWorkflow}
          onChange={(update) =>
            setOrderWorkflow((current) => current ? { ...current, ...update } : current)
          }
          onCancel={() => { if (!isSavingWorkflow) setOrderWorkflow(null); }}
          onSubmit={handleOrderWorkflow}
        />
      )}
    </main>
  );
}

function SidebarButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left transition-colors ${
        active
          ? "bg-red-600 text-white"
          : "text-white/80 hover:bg-white/10 hover:text-white"
      }`}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

function ProductsTable({
  products,
  onEdit,
  onDelete,
}: {
  products: Product[];
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
}) {
  const { t } = useLanguage();

  if (products.length === 0) {
    return <p className="p-5 text-sm text-zinc-500">No products found.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[820px] text-left text-sm">
        <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
          <tr>
            <th className="p-4">{t("adminTable.product")}</th>
            <th className="p-4">{t("adminTable.type")}</th>
            <th className="p-4">{t("adminTable.price")}</th>
            <th className="p-4">{t("adminTable.stock")}</th>
            <th className="p-4">{t("adminTable.action")}</th>
          </tr>
        </thead>

        <tbody className="divide-y">
          {products.map((product) => (
            <tr key={product.id} className="align-top">
              <td className="p-4">
                <div className="flex items-center gap-3">
                  <img
                    src={product.image}
                    alt={product.name}
                    className="h-14 w-14 rounded-xl object-contain ring-1 ring-zinc-200"
                  />

                  <div>
                    <p className="font-bold">{product.name}</p>
                    <p className="text-xs text-zinc-500">
                      {product.brand} • {product.category}
                    </p>
                  </div>
                </div>
              </td>

              <td className="p-4 capitalize">{product.type}</td>

              <td className="p-4">
                <p className="font-bold">{product.price > 0 ? formatCurrency(product.price) : "Price pending"}</p>
                {product.wholesalePrice && (
                  <p className="text-xs text-zinc-500">
                    W/S {formatCurrency(product.wholesalePrice)}
                  </p>
                )}
              </td>

              <td className="p-4">
                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold ${
                    product.stock === "In Stock"
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {product.stock}
                </span>
                {product.stockQuantity !== undefined && (
                  <p className="mt-1 text-xs text-zinc-500">
                    {product.stockQuantity} unit(s)
                  </p>
                )}
              </td>

              <td className="p-4">
                <div className="flex gap-2">
                  <button
                    onClick={() => onEdit(product)}
                    className="rounded-full border px-3 py-2 text-xs font-semibold hover:bg-zinc-100"
                  >
                    Edit
                  </button>

                  <button
                    onClick={() => onDelete(product)}
                    className="rounded-full bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100"
                  >
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OrdersTable({
  orders,
  onStatusChange,
  onResolveRequest,
  onWorkflow,
  onDelivery,
  onResendReceipt,
  resendingOrderId,
}: {
  orders: AdminOrder[];
  onStatusChange: (orderId: string, status: OrderStatus) => void;
  onResolveRequest: (
    orderId: string,
    requestType: OrderRequestType,
    decision: OrderRequestDecision
  ) => void;
  onWorkflow: (order: AdminOrder, action: OrderWorkflowAction) => void;
  onDelivery: (order: AdminOrder) => void;
  onResendReceipt: (order: AdminOrder) => void;
  resendingOrderId: string | null;
}) {
  const { t } = useLanguage();

  if (orders.length === 0) {
    return (
      <p className="p-5 text-sm text-zinc-500">
        No orders yet. If you already have orders, login again and refresh.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1180px] text-left text-sm">
        <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
          <tr>
            <th className="p-4">{t("adminTable.order")}</th>
            <th className="p-4">{t("adminTable.customer")}</th>
            <th className="p-4">{t("adminTable.items")}</th>
            <th className="p-4">{t("adminTable.total")}</th>
            <th className="p-4">{t("adminTable.status")}</th>
            <th className="p-4">{t("adminTable.payment")}</th>
            <th className="p-4">{t("adminTable.request")}</th>
            <th className="p-4">{t("adminTable.shipping")}</th>
          </tr>
        </thead>

        <tbody className="divide-y">
          {orders.map((order) => (
            <tr key={order.id} className="align-top">
              <td className="p-4">
                <p className="font-bold">#{order.id.slice(0, 8)}</p>
                <p className="text-xs text-zinc-500">
                  {formatDateTime(order.created_at)}
                </p>
              </td>

              <td className="p-4">
                <p className="font-semibold">{order.shipping_name}</p>
                <p className="text-xs text-zinc-500">
                  {order.profiles?.email ?? "No email"}
                </p>
                <p className="text-xs text-zinc-500">{order.shipping_phone}</p>
              </td>

              <td className="p-4">
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

              <td className="p-4 font-bold">
                {formatCurrency(order.total_amount)}
              </td>

              <td className="p-4">
                <p className="mb-2 text-xs font-bold text-blue-700">{orderTracking(order).label}</p>
                <select
                  value={order.status}
                  disabled={
                    order.status === "cancelled" ||
                    order.status === "returned" ||
                    order.cancellation_request_status === "requested"
                  }
                  onChange={(event) =>
                    onStatusChange(order.id, event.target.value as OrderStatus)
                  }
                  className="rounded-full border px-3 py-2 text-xs font-semibold capitalize outline-none focus:border-red-500 disabled:bg-zinc-100"
                >
                  {allowedOrderStatuses(order).map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
                {(order.status === "pending" || order.status === "confirmed") && (
                  <button
                    type="button"
                    onClick={() => onWorkflow(order, "admin_cancel")}
                    className="mt-2 block rounded-full bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-100"
                  >
                    Cancel / out of stock
                  </button>
                )}
                {order.status === "shipped" && (
                  <button
                    type="button"
                    onClick={() => onWorkflow(order, "delivery_attempt")}
                    className="mt-2 block rounded-full bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800 hover:bg-amber-100"
                  >
                    Delivery attempt failed
                  </button>
                )}
                {failedDeliveryAttempts(order) > 0 && (
                  <p className="mt-2 text-[10px] font-bold uppercase text-amber-700">
                    {failedDeliveryAttempts(order)} of {MAX_DELIVERY_ATTEMPTS} attempts failed
                    {failedDeliveryAttempts(order) >= MAX_DELIVERY_ATTEMPTS && " — consider cancelling"}
                  </p>
                )}
              </td>

              <td className="p-4">
                <p className="font-semibold">
                  {paymentMethodLabels[order.payment_method ?? "cash_on_delivery"] ?? "Cash on delivery"}
                  {order.payment_account && ` · ${order.payment_account.toUpperCase()}`}
                </p>
                <span className="mt-1 inline-block rounded-full bg-zinc-100 px-2 py-1 text-xs font-semibold capitalize">
                  {order.payment_status}
                </span>
                {/* The same sentence the customer is reading right now, from
                    the same helper, so staff never have to guess. */}
                <p className="mt-1 max-w-[11rem] text-[10px] text-zinc-500">
                  Customer sees: <span className="font-semibold text-zinc-700">{nextStepLabels[orderNextStep(order).key]}</span>
                </p>
                {order.payment_method && order.payment_method !== "cash_on_delivery" && (
                  <div className="mt-2">
                    <p className={`text-[10px] font-bold uppercase ${
                      order.payment_verification_status === "verified" ? "text-emerald-700"
                        : order.payment_verification_status === "rejected" ? "text-red-700" : "text-amber-700"
                    }`}>
                      Payment {(order.payment_verification_status ?? "pending").replaceAll("_", " ")}
                    </p>
                    {order.payment_reference && (
                      <p className="max-w-[11rem] break-all text-[10px] text-zinc-500">Ref: {order.payment_reference}</p>
                    )}
                    {order.payment_rejected_reason && (
                      <p className="max-w-[11rem] text-[10px] text-red-700">{order.payment_rejected_reason}</p>
                    )}
                    {typeof order.payment_amount_received === "number" && (
                      <p className="max-w-[11rem] text-[10px] font-semibold text-amber-800">
                        Received {formatCurrency(order.payment_amount_received)} of {formatCurrency(order.total_amount)}
                        {order.payment_amount_received < order.total_amount &&
                          ` · ${formatCurrency(order.total_amount - order.payment_amount_received)} still owed`}
                        {order.payment_amount_received > order.total_amount &&
                          ` · ${formatCurrency(order.payment_amount_received - order.total_amount)} to refund`}
                      </p>
                    )}
                    {(order.payment_slips ?? []).map((slip, index) => (
                      <a key={slip.id} href={`/api/orders/${order.id}/payment-slip/${slip.id}`} target="_blank" rel="noreferrer"
                        className="mt-1 block text-[10px] font-bold text-blue-700 underline">
                        Open slip {index + 1} · {formatDateTime(slip.created_at)}
                      </a>
                    ))}
                    {(order.payment_slips ?? []).length === 0 && (
                      <p className="text-[10px] text-zinc-500">No slip uploaded yet</p>
                    )}
                    <button
                      type="button"
                      onClick={() => onWorkflow(order, "payment_review")}
                      className="mt-2 block rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100"
                    >
                      Check payment
                    </button>
                  </div>
                )}
                {order.receipt_number && (
                  <p className="mt-2 max-w-[11rem] break-all text-[10px] text-zinc-500">
                    {order.receipt_number}<br />Email: {(order.receipt_email_status ?? "not sent").replaceAll("_", " ")}
                  </p>
                )}
                {order.receipt_email_status === "failed" && order.receipt_email_error && (
                  <p className="mt-1 max-w-[11rem] text-[10px] font-semibold text-red-700">
                    {order.receipt_email_error}
                  </p>
                )}
                {order.status === "delivered" && (
                  <button
                    type="button"
                    onClick={() => onResendReceipt(order)}
                    disabled={resendingOrderId === order.id}
                    className="mt-2 block rounded-full bg-zinc-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-zinc-700 disabled:bg-zinc-400"
                  >
                    {resendingOrderId === order.id
                      ? "Sending…"
                      : order.receipt_email_status === "sent"
                        ? "Send receipt again"
                        : "Send receipt email"}
                  </button>
                )}
                <p className="mt-2 text-[10px] font-bold uppercase text-zinc-500">Verification: {(order.cod_verification_status ?? "pending").replaceAll("_", " ")}</p>
              </td>

              <td className="p-4">
                {order.cancellation_request_status === "requested" ? (
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
                    title="Return approved"
                    detail={`${order.return_pickup_method?.replaceAll("_", " ") ?? "Return"}${order.return_pickup_address ? ` · ${order.return_pickup_address}` : ""}`}
                    button="Schedule pickup"
                    onClick={() => onWorkflow(order, "schedule_pickup")}
                  />
                ) : order.return_request_status === "pickup_scheduled" ? (
                  <ReturnWorkflowControls
                    title="Pickup scheduled"
                    detail={order.return_pickup_scheduled_for ? formatDateTime(order.return_pickup_scheduled_for) : "Date set"}
                    button="Receive & inspect"
                    onClick={() => onWorkflow(order, "mark_received")}
                  />
                ) : order.return_request_status === "received" ? (
                  <ReturnWorkflowControls
                    title="Item received"
                    detail={`Restock: ${order.return_restock_approved ? "approved" : "no"}`}
                    button="Record refund"
                    onClick={() => onWorkflow(order, "complete_refund")}
                  />
                ) : (
                  <div className="text-xs text-zinc-500">
                    {order.cancellation_request_status !== "none" && <p className="capitalize">Cancellation: {order.cancellation_request_status}</p>}
                    {order.return_request_status !== "none" && <p className="capitalize">Return: {order.return_request_status}</p>}
                    {order.cancellation_request_status === "none" && order.return_request_status === "none" && <p>None</p>}
                  </div>
                )}
              </td>

              <td className="p-4">
                <p className="max-w-xs text-xs text-zinc-600">
                  {order.shipping_address}
                </p>

                {order.notes && (
                  <p className="mt-1 max-w-xs text-xs text-zinc-400">
                    Note: {order.notes}
                  </p>
                )}
                {order.admin_order_note && (
                  <p className="mt-1 max-w-xs text-xs font-semibold text-blue-600">
                    Admin note: {order.admin_order_note}
                  </p>
                )}
                {order.courier_name && <p className="mt-2 text-xs font-semibold">{order.courier_name}{order.delivery_tracking_number ? ` · ${order.delivery_tracking_number}` : ""}</p>}
                {order.estimated_delivery_at && <p className="mt-1 text-xs text-zinc-500">ETA {formatDateTime(order.estimated_delivery_at)}</p>}
                {order.delivery_location_consent && order.delivery_latitude != null && order.delivery_longitude != null && <a href={`https://www.google.com/maps?q=${order.delivery_latitude},${order.delivery_longitude}`} target="_blank" rel="noreferrer" className="mt-2 block text-xs font-bold text-blue-600 hover:underline">Open customer-selected delivery pin{order.delivery_accuracy_m != null ? ` (device accuracy ±${Math.round(order.delivery_accuracy_m)} m; not identity proof)` : " (manually placed; not verified)"}</a>}
                <CustomerLocation userId={order.user_id} />
                <button type="button" onClick={() => onDelivery(order)} className="mt-3 rounded-full bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100">Update tracking / COD</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OrderRequestControls({
  label, reason, onApprove, onReject,
}: {
  label: string;
  reason: string | null;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <div className="max-w-xs">
      <p className="font-bold text-red-600">{label} requested</p>
      <p className="mt-1 text-xs text-zinc-600">{reason ?? "No reason supplied."}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={onApprove}
          className="rounded-full bg-green-600 px-3 py-1.5 text-xs font-semibold text-white">
          {label === "Return" ? "Approve return" : "Approve"}
        </button>
        <button type="button" onClick={onReject}
          className="rounded-full border px-3 py-1.5 text-xs font-semibold">
          Reject
        </button>
      </div>
    </div>
  );
}

function ReturnWorkflowControls({
  title,
  detail,
  button,
  onClick,
}: {
  title: string;
  detail: string;
  button: string;
  onClick: () => void;
}) {
  return (
    <div className="max-w-xs">
      <p className="font-bold text-orange-700">{title}</p>
      <p className="mt-1 text-xs capitalize text-zinc-600">{detail}</p>
      <button type="button" onClick={onClick} className="mt-3 rounded-full bg-orange-600 px-3 py-1.5 text-xs font-bold text-white">
        {button}
      </button>
    </div>
  );
}

function OrderResolutionDialog({
  draft,
  isSubmitting,
  onNoteChange,
  onCancel,
  onSubmit,
}: {
  draft: OrderResolutionDraft;
  isSubmitting: boolean;
  onNoteChange: (value: string) => void;
  onCancel: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const isApproval = draft.decision === "approve";
  const requestLabel =
    draft.requestType === "cancellation" ? "cancellation" : "return";

  const explanation = isApproval
    ? draft.requestType === "cancellation"
      ? "The order will be cancelled and every ordered item will be restored to inventory."
      : "The return will be approved so pickup or drop-off can be scheduled. Inventory and payment stay unchanged until staff receives, inspects, and refunds the item."
    : `The ${requestLabel} request will be rejected. The order status and inventory will not change.`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
      role="presentation"
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="order-resolution-title"
        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
      >
        <h2 id="order-resolution-title" className="text-xl font-bold">
          {isApproval ? "Approve" : "Reject"} {requestLabel} request
        </h2>

        <p className="mt-2 text-sm leading-6 text-zinc-600">{explanation}</p>

        <form onSubmit={onSubmit} className="mt-5">
          <label
            htmlFor="admin-order-note"
            className="mb-2 block text-sm font-semibold"
          >
            Note for the customer (optional)
          </label>
          <textarea
            id="admin-order-note"
            value={draft.adminNote}
            onChange={(event) => onNoteChange(event.target.value)}
            disabled={isSubmitting}
            maxLength={500}
            rows={4}
            autoFocus
            className="w-full rounded-xl border px-4 py-3 text-sm outline-none focus:border-red-500 disabled:bg-zinc-100"
            placeholder={
              isApproval
                ? "Example: Your request was approved."
                : "Example: The order has already been shipped."
            }
          />
          <p className="mt-1 text-right text-xs text-zinc-400">
            {draft.adminNote.length}/500
          </p>

          <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              className="rounded-full border px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
            >
              Go back
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`rounded-full px-5 py-2.5 text-sm font-semibold text-white disabled:bg-zinc-400 ${
                isApproval ? "bg-green-600" : "bg-red-600"
              }`}
            >
              {isSubmitting
                ? "Saving..."
                : `${isApproval ? "Confirm approval" : "Confirm rejection"}`}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function OrderWorkflowDialog({
  draft,
  isSubmitting,
  onChange,
  onCancel,
  onSubmit,
}: {
  draft: OrderWorkflowDraft;
  isSubmitting: boolean;
  onChange: (update: Partial<OrderWorkflowDraft>) => void;
  onCancel: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const titles: Record<OrderWorkflowAction, string> = {
    admin_cancel: "Cancel order",
    schedule_pickup: "Schedule return handover",
    mark_received: "Receive and inspect item",
    complete_refund: "Record completed refund",
    delivery_attempt: "Delivery attempt failed",
    payment_review: "Check the transfer slip",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4">
      <section role="dialog" aria-modal="true" aria-labelledby="workflow-title" className="my-auto w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl">
        <h2 id="workflow-title" className="text-2xl font-black">{titles[draft.action]}</h2>
        <p className="mt-1 text-sm text-zinc-500">Order #{draft.orderId.slice(0, 8)} · {formatCurrency(draft.totalAmount)}</p>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          {draft.action === "admin_cancel" && <>
            <label className="block text-sm font-semibold">Reason category<select value={draft.reasonCode} onChange={(event) => onChange({ reasonCode: event.target.value as OrderWorkflowDraft["reasonCode"] })} className="mt-2 w-full rounded-xl border bg-white px-4 py-3 font-normal"><option value="out_of_stock">Item out of stock</option><option value="pricing_error">Pricing error</option><option value="customer_request">Customer requested</option><option value="other">Other</option></select></label>
            <label className="block text-sm font-semibold">Reason shown in order<textarea value={draft.reason} onChange={(event) => onChange({ reason: event.target.value })} rows={3} maxLength={500} className="mt-2 w-full rounded-xl border px-4 py-3 font-normal" /></label>
            <p className="rounded-xl bg-red-50 p-3 text-xs leading-5 text-red-800">Only pending or confirmed orders can be cancelled. Reserved product quantities are restored automatically.</p>
          </>}

          {draft.action === "schedule_pickup" && <>
            <label className="block text-sm font-semibold">Pickup or drop-off date and time<input type="datetime-local" value={draft.scheduledFor} onChange={(event) => onChange({ scheduledFor: event.target.value })} className="mt-2 w-full rounded-xl border px-4 py-3 font-normal" /></label>
            <label className="block text-sm font-semibold">Customer instructions<textarea value={draft.instructions} onChange={(event) => onChange({ instructions: event.target.value })} rows={3} maxLength={500} className="mt-2 w-full rounded-xl border px-4 py-3 font-normal" /></label>
            <label className="block text-sm font-semibold">Courier / tracking number (optional)<input value={draft.trackingNumber} onChange={(event) => onChange({ trackingNumber: event.target.value })} maxLength={120} className="mt-2 w-full rounded-xl border px-4 py-3 font-normal" /></label>
          </>}

          {draft.action === "mark_received" && <>
            <label className="block text-sm font-semibold">Inspection notes<textarea value={draft.inspectionNotes} onChange={(event) => onChange({ inspectionNotes: event.target.value })} rows={4} maxLength={500} placeholder="Model, serial, condition, accessories, fault test..." className="mt-2 w-full rounded-xl border px-4 py-3 font-normal" /></label>
            <label className="block text-sm font-semibold">Can this item be returned to sellable inventory?<select value={draft.restockApproved} onChange={(event) => onChange({ restockApproved: event.target.value as "yes" | "no" })} className="mt-2 w-full rounded-xl border bg-white px-4 py-3 font-normal"><option value="no">No — damaged, defective, or not sellable</option><option value="yes">Yes — inspected and sellable</option></select></label>
            <p className="rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900">Inventory is restored only when “Yes” is selected. This avoids selling a faulty returned machine.</p>
          </>}

          {draft.action === "payment_review" && <>
            <label className="block text-sm font-semibold">Decision<select value={draft.paymentDecision} onChange={(event) => onChange({ paymentDecision: event.target.value as OrderWorkflowDraft["paymentDecision"] })} className="mt-2 w-full rounded-xl border bg-white px-4 py-3 font-normal"><option value="verified">Payment received — verified</option><option value="correction_requested">Ask the customer to correct it</option><option value="rejected">Cannot confirm — rejected</option></select></label>

            {draft.paymentDecision === "correction_requested" && <>
              <label className="block text-sm font-semibold">What needs correcting?<select value={draft.correctionReason} onChange={(event) => onChange({ correctionReason: event.target.value as PaymentCorrectionReason })} className="mt-2 w-full rounded-xl border bg-white px-4 py-3 font-normal">{Object.entries(paymentCorrectionReasons).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label className="block text-sm font-semibold">How much actually arrived?<input type="number" min={0} step={1} value={draft.amountReceived} onChange={(event) => onChange({ amountReceived: event.target.value })} placeholder="Leave empty if you could not read the slip" className="mt-2 w-full rounded-xl border px-4 py-3 font-normal" /><span className="mt-1 block text-xs font-normal text-zinc-500">The customer is shown this against the {formatCurrency(draft.totalAmount)} total, so they see the exact amount still to pay. Leave it empty if the slip is unreadable — an empty box is not the same as zero.</span></label>
            </>}

            <label className="block text-sm font-semibold">Bank / transaction reference (optional)<input value={draft.paymentReference} onChange={(event) => onChange({ paymentReference: event.target.value })} maxLength={200} placeholder="Reference you matched against your bank statement" className="mt-2 w-full rounded-xl border px-4 py-3 font-normal" /></label>
            <label className="block text-sm font-semibold">{draft.paymentDecision === "rejected" ? "Why can it not be confirmed?" : draft.paymentDecision === "correction_requested" ? "What should the customer do? (shown to them)" : "Note (optional)"}<textarea value={draft.reason} onChange={(event) => onChange({ reason: event.target.value })} rows={2} maxLength={500} placeholder={draft.paymentDecision === "correction_requested" ? "Example: We received 300,000 by KBZ on 16 Sept. Please send the rest to the same account and upload the new slip." : ""} className="mt-2 w-full rounded-xl border px-4 py-3 font-normal" /></label>
            <p className="rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900">Check the slip against your own bank or MMQR record before verifying. Verifying marks the money as collected and lets the order move to confirmed and shipped. Asking for a correction keeps the order and the money already received, and shows the customer exactly what is still owed — use it for a short payment or an unclear slip. Reject only when the payment cannot be used at all.</p>
          </>}

          {draft.action === "delivery_attempt" && <>
            <label className="block text-sm font-semibold">What happened?<select value={draft.deliveryReason} onChange={(event) => onChange({ deliveryReason: event.target.value as DeliveryAttemptReason })} className="mt-2 w-full rounded-xl border bg-white px-4 py-3 font-normal">{Object.entries(deliveryAttemptReasons).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label className="block text-sm font-semibold">Next attempt (optional)<input type="datetime-local" value={draft.nextAttemptAt} onChange={(event) => onChange({ nextAttemptAt: event.target.value })} className="mt-2 w-full rounded-xl border px-4 py-3 font-normal" /><span className="mt-1 block text-xs font-normal text-zinc-500">Shown to the customer as the new estimated arrival. Clear it if you do not have a date yet.</span></label>
            <p className="rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900">
              This is attempt {draft.failedAttempts + 1} of {MAX_DELIVERY_ATTEMPTS}. The order stays shipped and waits for the next attempt; nothing is cancelled and no stock is returned. The customer sees the update in English and Burmese, and gets an email if they have order emails switched on.
              {draft.failedAttempts + 1 >= MAX_DELIVERY_ATTEMPTS && " This is the last planned attempt — after this, consider cancelling the order so the stock goes back."}
            </p>
          </>}

          {draft.action === "complete_refund" && <>
            <label className="block text-sm font-semibold">Refund method<select value={draft.refundMethod} onChange={(event) => onChange({ refundMethod: event.target.value as OrderWorkflowDraft["refundMethod"] })} className="mt-2 w-full rounded-xl border bg-white px-4 py-3 font-normal"><option value="bank_transfer">Bank transfer</option><option value="mobile_wallet">Mobile wallet</option><option value="cash">Cash</option><option value="store_credit">Store credit</option></select></label>
            <label className="block text-sm font-semibold">Refund amount<input type="number" min={0} max={draft.totalAmount} step={1} value={draft.refundAmount} onChange={(event) => onChange({ refundAmount: event.target.value })} className="mt-2 w-full rounded-xl border px-4 py-3 font-normal" /></label>
            <label className="block text-sm font-semibold">Payment reference (recommended)<input value={draft.refundReference} onChange={(event) => onChange({ refundReference: event.target.value })} maxLength={200} placeholder="Transfer ID, wallet reference, or cash voucher" className="mt-2 w-full rounded-xl border px-4 py-3 font-normal" /></label>
            <p className="rounded-xl bg-blue-50 p-3 text-xs leading-5 text-blue-900">Complete the real cash, bank, or wallet payment first. This button records the completed refund; it does not move money by itself.</p>
          </>}

          <label className="block text-sm font-semibold">Note for customer (optional)<textarea value={draft.adminNote} onChange={(event) => onChange({ adminNote: event.target.value })} rows={2} maxLength={500} className="mt-2 w-full rounded-xl border px-4 py-3 font-normal" /></label>
          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end"><button type="button" onClick={onCancel} disabled={isSubmitting} className="rounded-full border px-5 py-3 text-sm font-bold disabled:opacity-50">Go back</button><button type="submit" disabled={isSubmitting} className="rounded-full bg-red-600 px-6 py-3 text-sm font-bold text-white disabled:bg-zinc-400">{isSubmitting ? "Saving..." : "Confirm and save"}</button></div>
        </form>
      </section>
    </div>
  );
}
