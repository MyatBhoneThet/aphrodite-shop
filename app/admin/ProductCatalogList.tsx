import { useRef, useState } from "react";
import type { Product } from "../data/products";
import { pageCount, paginate } from "../lib/admin-order-filter";
import { useAdminText } from "../lib/useAdminText";
import ProductsTable from "./ProductsTable";

export default function ProductCatalogList({ products, pageSize, onPageSize, onEdit, onDelete }: {
  products: Product[];
  pageSize: number;
  onPageSize: (size: number) => void;
  onEdit: (product: Product) => void;
  onDelete?: (product: Product) => void;
}) {
  const a = useAdminText();
  const [requestedPage, setRequestedPage] = useState(1);
  const toolbar = useRef<HTMLDivElement>(null);
  const { page, items } = paginate(products, requestedPage, pageSize);
  const pages = pageCount(products.length, pageSize);
  const first = (page - 1) * pageSize + 1;

  function pageButtons(scrollToTop: boolean) {
    if (pages <= 1) return null;
    const changePage = (next: number) => {
      setRequestedPage(next);
      if (scrollToTop) toolbar.current?.scrollIntoView({ block: "start" });
    };
    const button = "rounded-lg border border-zinc-300 px-3 py-1.5 font-semibold enabled:hover:bg-zinc-100 disabled:opacity-40";

    return (
      <div className="flex items-center gap-2 text-sm">
        <button type="button" disabled={page === 1} onClick={() => changePage(page - 1)} className={button}>{a("Previous")}</button>
        <span className="px-1 tabular-nums">{page} / {pages}</span>
        <button type="button" disabled={page === pages} onClick={() => changePage(page + 1)} className={button}>{a("Next")}</button>
      </div>
    );
  }

  return (
    <>
      <div ref={toolbar} className="flex scroll-mt-24 flex-wrap items-center justify-between gap-3 bg-zinc-50 px-4 py-3 text-sm text-zinc-700 sm:px-6">
        <p aria-live="polite" className="font-medium tabular-nums">
          {items.length ? `${first.toLocaleString()}–${(first + items.length - 1).toLocaleString()} ${a("of")} ` : ""}
          {products.length.toLocaleString()} {a("products")}
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2">
            {a("Rows per page")}
            <select
              value={pageSize}
              onChange={event => {
                onPageSize(Number(event.target.value));
                setRequestedPage(1);
              }}
              className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 font-semibold"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </label>
          {pageButtons(false)}
        </div>
      </div>
      <ProductsTable products={items} onEdit={onEdit} onDelete={onDelete} />
      {pages > 1 && (
        <div className="flex justify-end border-t border-zinc-200 px-4 py-3 sm:px-6">{pageButtons(true)}</div>
      )}
    </>
  );
}
