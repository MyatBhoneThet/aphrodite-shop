export const ORDER_PAGE_SIZE = 20;

export type OrderFilters = {
  query: string;
  status: string; // "" = every status
  from: string; // YYYY-MM-DD, "" = no lower bound
  to: string; // YYYY-MM-DD, "" = no upper bound
};

export const emptyOrderFilters: OrderFilters = { query: "", status: "", from: "", to: "" };

type FilterableOrder = {
  id: string;
  status: string;
  created_at: string;
  shipping_name: string;
  shipping_phone: string;
  profiles?: { email?: string | null } | null;
};

const digits = (value: string) => value.replace(/\D/g, "");

/**
 * Search matches the order number (with or without "#"), the recipient name
 * and, unless `includeContact` is false, the phone number and email. Staff
 * accounts cannot see phone/email in the table, so they must not be able to
 * find an order by them either.
 */
export function filterOrders<T extends FilterableOrder>(
  orders: T[],
  filters: OrderFilters,
  { includeContact }: { includeContact: boolean }
): T[] {
  const query = filters.query.trim().toLowerCase().replace(/^#/, "");
  const queryDigits = digits(query);
  const from = filters.from ? new Date(`${filters.from}T00:00:00`).getTime() : null;
  const to = filters.to ? new Date(`${filters.to}T23:59:59.999`).getTime() : null;

  return orders.filter((order) => {
    if (filters.status && order.status !== filters.status) return false;

    const placed = Date.parse(order.created_at);
    if (from !== null && placed < from) return false;
    if (to !== null && placed > to) return false;

    if (!query) return true;
    if (order.id.toLowerCase().startsWith(query)) return true;
    if (order.shipping_name.toLowerCase().includes(query)) return true;
    if (!includeContact) return false;
    if (queryDigits.length >= 3 && digits(order.shipping_phone).includes(queryDigits)) return true;
    return (order.profiles?.email ?? "").toLowerCase().includes(query);
  });
}

export function pageCount(total: number, pageSize = ORDER_PAGE_SIZE) {
  return Math.max(1, Math.ceil(total / pageSize));
}

/** Clamps `page` (1-based) into range so a shrinking list never shows an empty page. */
export function paginate<T>(items: T[], page: number, pageSize = ORDER_PAGE_SIZE) {
  const safePage = Math.min(Math.max(1, page), pageCount(items.length, pageSize));
  const start = (safePage - 1) * pageSize;
  return { page: safePage, items: items.slice(start, start + pageSize) };
}
