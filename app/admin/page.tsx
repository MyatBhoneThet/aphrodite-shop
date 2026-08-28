"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { Product, ProductType, UserRole } from "../data/products";
import { adminLogout, authHeaders } from "../lib/client-auth";
import { formatCurrency, formatDateTime } from "../lib/format";
import { useCurrentUser } from "../lib/useCurrentUser";
import PricingPanel from "./PricingPanel";
import SupportPanel from "./SupportPanel";
import WholesalePanel from "./WholesalePanel";

type OrderStatus =
  | "pending"
  | "confirmed"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "returned";
type OrderRequestStatus = "none" | "requested" | "approved" | "rejected";
type OrderRequestType = "cancellation" | "return";
type OrderRequestDecision = "approve" | "reject";

type OrderResolutionDraft = {
  orderId: string;
  requestType: OrderRequestType;
  decision: OrderRequestDecision;
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
  payment_method: "cash_on_delivery";
  payment_status: "unpaid" | "collected" | "refunded";
  cancellation_request_status: OrderRequestStatus;
  cancellation_reason: string | null;
  return_request_status: OrderRequestStatus;
  return_reason: string | null;
  admin_order_note: string | null;
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
  image: string;
  model3D: string;
  stock: Product["stock"];
  stockQuantity: string;
  specs: string;
  fullSpecs: string;
};

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
    image: "/products/macbook-air.png",
    model3D: "",
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
    image: product.image,
    model3D: product.model3D ?? "",
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
    "products" | "orders" | "support" | "wholesale" | "pricing" | "sync"
  >("products");

  // Dashboard quick actions deep-link straight into a panel (/admin?panel=…);
  // ?action=add additionally opens the blank product form.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const panel = params.get("panel");
    if (
      panel === "products" ||
      panel === "orders" ||
      panel === "support" ||
      panel === "wholesale" ||
      panel === "pricing" ||
      panel === "sync"
    ) {
      setActivePanel(panel);
    }
    if (panel === "products" && params.get("action") === "add") {
      setIsProductFormOpen(true);
    }
  }, []);

  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
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
  const [orderResolution, setOrderResolution] =
    useState<OrderResolutionDraft | null>(null);
  const [isResolvingOrder, setIsResolvingOrder] = useState(false);

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
        image: productForm.image.trim() || "/products/macbook-air.png",
        model3D: productForm.model3D.trim() || undefined,
        stock: productForm.stock,
        stockQuantity,
        specs: parseJsonObject(productForm.specs, "Short specs"),
        fullSpecs: parseJsonObject(productForm.fullSpecs, "Full specs"),
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

      setProductForm(emptyProductForm());
      setIsProductFormOpen(false);
      await loadDashboardData();

      setMessage(
        productForm.id
          ? "Product updated successfully."
          : "Product added successfully."
      );
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
      setError(err instanceof Error ? err.message : "Unable to update order.");
    }
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
        count?: number;
        skippedRows?: unknown[];
        warnings?: string[];
        error?: string;
      } | null;

      if (!response.ok) {
        throw new Error(data?.error ?? "Unable to sync products.");
      }

      if (!dryRun) await loadDashboardData();

      const skippedCount = data?.skippedRows?.length ?? 0;
      const warningCount = data?.warnings?.length ?? 0;
      const details = `${skippedCount} rows skipped; ${warningCount} mapping warnings.`;

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
        <div className="flex h-16 items-center gap-3 border-b border-white/10 px-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-600 text-lg font-bold">
            A
          </div>

          <div>
            <p className="text-lg font-bold">Aphrodite</p>
            <p className="text-xs text-white/60">Admin Panel</p>
          </div>
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
          <Link
            href="/admin/dashboard"
            className="flex items-center gap-3 rounded px-4 py-3 text-white/80 hover:bg-white/10"
          >
            <span>📊</span>
            Overview
          </Link>
          <SidebarButton
            active={activePanel === "products"}
            icon="💻"
            label="Products"
            onClick={() => setActivePanel("products")}
          />
          <SidebarButton
            active={activePanel === "orders"}
            icon="🧾"
            label="Customer Purchases"
            onClick={() => setActivePanel("orders")}
          />
          <SidebarButton
            active={activePanel === "support"}
            icon="💬"
            label="Live Chat"
            onClick={() => setActivePanel("support")}
          />
          <SidebarButton
            active={activePanel === "wholesale"}
            icon="🏢"
            label="Wholesale"
            onClick={() => setActivePanel("wholesale")}
          />
          <SidebarButton
            active={activePanel === "pricing"}
            icon="🏷️"
            label="Price Lists & Tiers"
            onClick={() => setActivePanel("pricing")}
          />
          <SidebarButton
            active={activePanel === "sync"}
            icon="🔄"
            label="Google Sheet Sync"
            onClick={() => setActivePanel("sync")}
          />

          <div className="px-3 pb-2 pt-6 text-xs font-semibold uppercase text-white/40">
            Shop
          </div>

          <Link
            href="/"
            className="flex items-center gap-3 rounded px-4 py-3 text-white/80 hover:bg-white/10"
          >
            <span>🏪</span>
            Back to Store
          </Link>

          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded px-4 py-3 text-left text-white/80 hover:bg-white/10"
          >
            <span>🚪</span>
            Logout
          </button>
        </nav>
      </aside>

      <section className="lg:pl-72">
        <header className="sticky top-0 z-30 border-b bg-white shadow-sm">
          <div className="flex min-h-16 items-center justify-between gap-4 px-5 py-3">
            <div>
              <h1 className="text-xl font-bold">Manage</h1>
              <p className="text-xs text-zinc-500">
                <Link href="/admin/dashboard" className="hover:underline">
                  Overview
                </Link>{" "}
                / Aphrodite Admin Panel
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={loadDashboardData}
                disabled={isLoadingData}
                className="rounded-full border px-4 py-2 text-sm font-semibold disabled:bg-zinc-100"
              >
                {isLoadingData ? "Refreshing..." : "Refresh"}
              </button>

              <button
                onClick={handleLogout}
                className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white"
              >
                Logout
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

          {activePanel === "products" && (
            <section
              className={`mt-6 grid gap-6 ${
                isProductFormOpen ? "xl:grid-cols-[420px_1fr]" : ""
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
                      label follows this number automatically.
                    </p>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-semibold">
                      Image Path
                    </label>
                    <input
                      value={productForm.image}
                      onChange={(event) =>
                        setProductForm({
                          ...productForm,
                          image: event.target.value,
                        })
                      }
                      className="w-full rounded-xl border px-4 py-3 outline-none focus:border-red-500"
                      placeholder="/products/macbook-air.png"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-semibold">
                      Model 3D Path
                    </label>
                    <input
                      value={productForm.model3D}
                      onChange={(event) =>
                        setProductForm({
                          ...productForm,
                          model3D: event.target.value,
                        })
                      }
                      className="w-full rounded-xl border px-4 py-3 outline-none focus:border-red-500"
                      placeholder="/models/laptop.glb"
                    />
                  </div>

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

              <OrdersTable
                orders={orders}
                onStatusChange={handleOrderStatusChange}
                onResolveRequest={openOrderRequestResolution}
              />
            </section>
          )}

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
  if (products.length === 0) {
    return <p className="p-5 text-sm text-zinc-500">No products found.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[820px] text-left text-sm">
        <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
          <tr>
            <th className="p-4">Product</th>
            <th className="p-4">Type</th>
            <th className="p-4">Price</th>
            <th className="p-4">Stock</th>
            <th className="p-4">Action</th>
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
                <p className="font-bold">{formatCurrency(product.price)}</p>
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
}: {
  orders: AdminOrder[];
  onStatusChange: (orderId: string, status: OrderStatus) => void;
  onResolveRequest: (
    orderId: string,
    requestType: OrderRequestType,
    decision: OrderRequestDecision
  ) => void;
}) {
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
            <th className="p-4">Order</th>
            <th className="p-4">Customer</th>
            <th className="p-4">Items</th>
            <th className="p-4">Total</th>
            <th className="p-4">Status</th>
            <th className="p-4">COD Payment</th>
            <th className="p-4">Customer Request</th>
            <th className="p-4">Shipping</th>
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
              </td>

              <td className="p-4">
                <p className="font-semibold">Cash on delivery</p>
                <span className="mt-1 inline-block rounded-full bg-zinc-100 px-2 py-1 text-xs font-semibold capitalize">
                  {order.payment_status}
                </span>
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
          {label === "Return" ? "Accept & refund" : "Approve"}
        </button>
        <button type="button" onClick={onReject}
          className="rounded-full border px-3 py-1.5 text-xs font-semibold">
          Reject
        </button>
      </div>
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
      : "The order will be marked returned, the COD payment will be marked refunded, and every ordered item will be restored to inventory."
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
