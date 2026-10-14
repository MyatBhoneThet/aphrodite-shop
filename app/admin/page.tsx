"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { emptyOrderFilters, filterOrders, paginate, type OrderFilters } from "@/app/lib/admin-order-filter";
import type { Product } from "../data/products";
import { adminLogout, authHeaders } from "../lib/client-auth";
import { useCurrentUser } from "../lib/useCurrentUser";
import { useAdminText } from "../lib/useAdminText";
import ActivityPanel from "./ActivityPanel";
import AdminHeader from "./AdminHeader";
import AdminOverviewPanel from "./AdminOverviewPanel";
import AdminSidebar from "./AdminSidebar";
import AdsPanel from "./AdsPanel";
import CustomerLocationsPanel from "./CustomerLocationsPanel";
import CustomersPanel from "./CustomersPanel";
import FeedbackPanel from "./FeedbackPanel";
import MfaGate from "./MfaGate";
import OrderResolutionDialog from "./OrderResolutionDialog";
import OrdersPanel from "./OrdersPanel";
import OrderWorkflowDialog from "./OrderWorkflowDialog";
import PricingPanel from "./PricingPanel";
import { getErrorMessage } from "./product-form";
import ProductsPanel from "./ProductsPanel";
import QueuePanel from "./QueuePanel";
import ConfirmDialogHost from "./ConfirmDialogHost";
import NewOrderPopups from "./NewOrderPopups";
import ReauthDialog from "./ReauthDialog";
import SecurityPanel from "./SecurityPanel";
import SheetSyncPanel from "./SheetSyncPanel";
import StaffPanel from "./StaffPanel";
import SupportPanel from "./SupportPanel";
import type { AdminOrder, AdminPanelId } from "./types";
import { useNewOrderAlerts } from "./useNewOrderAlerts";
import { useOrderActions } from "./useOrderActions";
import { useProductAdmin } from "./useProductAdmin";
import { useSheetSync } from "./useSheetSync";
import WholesalePanel from "./WholesalePanel";

/**
 * The admin / staff back office.
 *
 * This file only decides what is on screen and loads the shared data (products
 * and orders). The work itself lives next to it: one panel component per
 * screen, and one hook each for the product form, the order actions and the
 * sheet sync.
 */
export default function AdminPage() {
  const a = useAdminText();
  const { user: currentUser, status: userStatus } = useCurrentUser();
  const authStatus: "checking" | "ready" | "forbidden" =
    userStatus === "checking"
      ? "checking"
      : currentUser?.role === "admin" || currentUser?.role === "staff"
      ? "ready"
      : "forbidden";
  const isAdmin = currentUser?.role === "admin";
  const isStaff = currentUser?.role === "staff";
  const newOrders = useNewOrderAlerts(authStatus === "ready");

  const [activePanel, setActivePanel] = useState<AdminPanelId>("dashboard");

  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [orderFilters, setOrderFilters] = useState<OrderFilters>(emptyOrderFilters);
  const [orderPage, setOrderPage] = useState(1);

  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoadingData, setIsLoadingData] = useState(false);

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

  const filteredOrders = useMemo(
    () => filterOrders(orders, orderFilters, { includeContact: !isStaff }),
    [orders, orderFilters, isStaff]
  );
  const pagedOrders = useMemo(() => paginate(filteredOrders, orderPage), [filteredOrders, orderPage]);

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

  const productAdmin = useProductAdmin({ loadDashboardData, setMessage, setError });
  const { setIsProductFormOpen } = productAdmin;
  const orderActions = useOrderActions({ loadDashboardData, setMessage, setError });
  const sheetSync = useSheetSync({
    active: activePanel === "sync",
    loadDashboardData,
    setMessage,
    setError,
  });

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
        panel === "ads" ||
        panel === "wholesale" ||
        panel === "pricing" ||
        panel === "sync" ||
        panel === "staff" ||
        panel === "feedback" ||
        panel === "customers" ||
        panel === "activity" ||
        panel === "security"
      ) {
        const requested = panel === "cases" ? "queue" : panel;
        const adminOnly = requested === "locations" || requested === "wholesale" || requested === "pricing" || requested === "staff" || requested === "feedback" || requested === "customers" || requested === "activity";
        setActivePanel(!isAdmin && adminOnly ? "dashboard" : requested);
      }
      if (isAdmin && panel === "products" && params.get("action") === "add") {
        setIsProductFormOpen(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [isAdmin, setIsProductFormOpen]);

  // Signed in, but a two-step code is still owed (or must be set up): show only that.
  if (currentUser?.mfa?.pending) {
    return <MfaGate pending={currentUser.mfa.pending} onLogout={handleLogout} />;
  }

  if (authStatus === "checking") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f4f6f9] text-zinc-700">
         {a("Checking admin access...")} </main>
    );
  }

  if (authStatus === "forbidden") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f4f6f9] px-5 text-zinc-950">
        <div className="max-w-md rounded-3xl bg-white p-8 text-center shadow">
          <p className="text-5xl">🔒</p>
          <h1 className="mt-4 text-2xl font-bold">{a("Back-office access only")}</h1>
          <p className="mt-3 text-zinc-500">
             {a("You need an admin or staff account to view this page.")} </p>

          <div className="mt-6 flex justify-center gap-3">
            <Link
              href="/admin/login"
              className="rounded-full bg-red-600 px-5 py-2 text-sm font-semibold text-white"
            >
               {a("Go to staff login")} </Link>

            <Link href="/" className="rounded-full border px-5 py-2 text-sm">
               {a("Back to Store")} </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f4f6f9] text-zinc-900">
      <ReauthDialog />
      <ConfirmDialogHost />
      <NewOrderPopups
        popups={newOrders.popups}
        onClose={newOrders.dismissPopup}
        onView={() => {
          void loadDashboardData();
          setActivePanel("orders");
          newOrders.markSeen();
        }}
      />
      <AdminSidebar
        currentUser={currentUser}
        activePanel={activePanel}
        setActivePanel={setActivePanel}
        isAdmin={isAdmin}
        search={search}
        setSearch={setSearch}
        newOrderCount={newOrders.count}
        onOrdersOpened={newOrders.markSeen}
        onLogout={handleLogout}
      />

      <section className="lg:pl-64">
        <AdminHeader
          activePanel={activePanel}
          setActivePanel={setActivePanel}
          isAdmin={isAdmin}
          search={search}
          setSearch={setSearch}
          newOrders={newOrders}
          isLoadingData={isLoadingData}
          loadDashboardData={loadDashboardData}
          onLogout={handleLogout}
        />

        {/* Customer Purchases runs edge to edge: it is a wide table, and the page
            gutter only wasted width. Every other panel keeps its padding. */}
        <div className={activePanel === "orders" ? "" : "p-4 sm:p-5 lg:p-8"}>
          {(message || error) && (
            <div
              className={`mb-5 rounded-xl p-4 text-sm font-semibold ${
                activePanel === "orders" ? "mx-4 mt-4 sm:mx-5 lg:mx-8" : ""
              } ${error ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}
            >
              {error || message}
            </div>
          )}

          {activePanel === "dashboard" && (
            <AdminOverviewPanel
              role={currentUser!.role}
              onNavigate={(panel, ordersFilter) => {
                if (panel === "orders" && ordersFilter) {
                  setOrderFilters({ ...emptyOrderFilters, ...ordersFilter });
                  setOrderPage(1);
                }
                setActivePanel(panel);
              }}
            />
          )}

          {activePanel === "products" && (
            <ProductsPanel
              products={filteredProducts}
              allProducts={products}
              productForm={productAdmin.productForm}
              setProductForm={productAdmin.setProductForm}
              isProductFormOpen={productAdmin.isProductFormOpen}
              setIsProductFormOpen={productAdmin.setIsProductFormOpen}
              isSavingProduct={productAdmin.isSavingProduct}
              onSave={productAdmin.handleSaveProduct}
              onDelete={productAdmin.handleDeleteProduct}
              search={search}
              setSearch={setSearch}
              isAdmin={isAdmin}
              isStaff={isStaff}
              onProductsChanged={loadDashboardData}
            />
          )}

          {activePanel === "orders" && (
            <OrdersPanel
              allOrders={orders}
              pageOrders={pagedOrders.items}
              filteredCount={filteredOrders.length}
              filters={orderFilters}
              onFilters={(next) => {
                setOrderFilters(next);
                setOrderPage(1);
              }}
              page={pagedOrders.page}
              onPage={setOrderPage}
              isAdmin={isAdmin}
              isStaff={isStaff}
              courierOrder={orderActions.courierOrder}
              setCourierOrder={orderActions.setCourierOrder}
              deliveryOrder={orderActions.deliveryOrder}
              setDeliveryOrder={orderActions.setDeliveryOrder}
              resendingOrderId={orderActions.resendingOrderId}
              onStatusChange={orderActions.handleOrderStatusChange}
              onResolveRequest={orderActions.openOrderRequestResolution}
              onWorkflow={orderActions.openOrderWorkflow}
              onDelivery={orderActions.handleDeliveryUpdate}
              onResendReceipt={orderActions.handleResendReceipt}
              loadDashboardData={loadDashboardData}
              setMessage={setMessage}
              setError={setError}
            />
          )}

          {activePanel === "queue" && <QueuePanel />}

          {isAdmin && activePanel === "locations" && <CustomerLocationsPanel />}

          {activePanel === "support" && <SupportPanel />}

          {activePanel === "ads" && <AdsPanel allowDelete={isAdmin} />}

          {isAdmin && activePanel === "wholesale" && <WholesalePanel />}

          {isAdmin && activePanel === "pricing" && <PricingPanel />}

          {isAdmin && activePanel === "staff" && <StaffPanel />}
          {isAdmin && activePanel === "feedback" && <FeedbackPanel />}
          {isAdmin && activePanel === "customers" && <CustomersPanel />}
          {isAdmin && activePanel === "activity" && <ActivityPanel />}
          {activePanel === "security" && <SecurityPanel isAdmin={isAdmin} />}

          {activePanel === "sync" && (
            <SheetSyncPanel
              isSyncing={sheetSync.isSyncing}
              autoSync={sheetSync.autoSync}
              sheetSyncReport={sheetSync.sheetSyncReport}
              onSync={sheetSync.handleSyncProducts}
            />
          )}
        </div>
      </section>

      {orderActions.orderResolution && (
        <OrderResolutionDialog
          draft={orderActions.orderResolution}
          isSubmitting={orderActions.isResolvingOrder}
          onNoteChange={(adminNote) =>
            orderActions.setOrderResolution((current) =>
              current ? { ...current, adminNote } : current
            )
          }
          onCancel={() => {
            if (!orderActions.isResolvingOrder) orderActions.setOrderResolution(null);
          }}
          onSubmit={orderActions.handleOrderRequestResolution}
        />
      )}
      {orderActions.orderWorkflow && (
        <OrderWorkflowDialog
          draft={orderActions.orderWorkflow}
          isSubmitting={orderActions.isSavingWorkflow}
          onChange={(update) =>
            orderActions.setOrderWorkflow((current) => current ? { ...current, ...update } : current)
          }
          onCancel={() => { if (!orderActions.isSavingWorkflow) orderActions.setOrderWorkflow(null); }}
          onSubmit={orderActions.handleOrderWorkflow}
        />
      )}
    </main>
  );
}
