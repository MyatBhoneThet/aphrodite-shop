"use client";

import { useEffect, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useLanguage } from "../lib/language";
import type { Product } from "../data/products";
import { productPhotos, PRODUCT_PLACEHOLDER } from "../lib/product-gallery";
import Product3DViewer from "./Product3DViewer";

type ZoomPosition = { x: number; y: number };

const ZOOM_SCALE = 2.6;
const LENS_SIZE_PERCENT = 100 / ZOOM_SCALE;

export default function ProductGallery({ product }: { product: Product }) {
  const { text } = useLanguage();
  const photos = productPhotos(product);
  const [selected, setSelected] = useState(0);
  const [model, setModel] = useState(false);
  const [zoom, setZoom] = useState<ZoomPosition | null>(null);
  const [touchZoomOpen, setTouchZoomOpen] = useState(false);
  const [touchScale, setTouchScale] = useState(1);
  const photo = photos[Math.min(selected, Math.max(0, photos.length - 1))];
  const imageUrl = photo?.url ?? PRODUCT_PLACEHOLDER;
  const source =
    typeof product.fullSpecs.photoSource === "string" &&
    /^https:\/\//.test(product.fullSpecs.photoSource)
      ? product.fullSpecs.photoSource
      : null;

  useEffect(() => {
    if (!touchZoomOpen) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setTouchZoomOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [touchZoomOpen]);

  function updateZoom(event: ReactPointerEvent<HTMLDivElement>) {
    // Hover magnification is deliberately desktop/mouse-only. Touch customers
    // retain the normal tap-friendly gallery without a stuck overlay.
    if (event.pointerType !== "mouse" || model) {
      setZoom(null);
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    setZoom({
      x: Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width)),
      y: Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height)),
    });
  }

  function choosePhoto(index: number) {
    setSelected(index);
    setModel(false);
    setZoom(null);
  }

  function openTouchZoom() {
    if (model) return;
    setTouchScale(1);
    setTouchZoomOpen(true);
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <div
          className={`relative flex h-[340px] items-center justify-center overflow-hidden rounded-3xl border border-zinc-200 bg-white sm:h-[480px] ${
            model ? "" : "lg:cursor-zoom-in"
          }`}
          onPointerEnter={updateZoom}
          onPointerMove={updateZoom}
          onPointerLeave={() => setZoom(null)}
        >
          {model && product.model3D ? (
            <Product3DViewer
              modelUrl={product.model3D}
              imageUrl={product.image}
              productName={product.name}
            />
          ) : (
            <button
              type="button"
              aria-label={text("Open product photo zoom")}
              onClick={openTouchZoom}
              className="h-full w-full"
            >
              <img
                key={imageUrl}
                src={imageUrl}
                alt={
                  photo
                    ? `${product.name} — ${text(photo.label)}`
                    : `${product.name} — ${text("photo not yet available")}`
                }
                className="h-full w-full object-contain p-8"
                onError={(event) => {
                  event.currentTarget.onerror = null;
                  event.currentTarget.src = PRODUCT_PLACEHOLDER;
                  setZoom(null);
                }}
              />
            </button>
          )}

          {zoom && !model && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute hidden border-2 border-red-500 bg-white/20 shadow-[0_0_0_9999px_rgba(255,255,255,0.18)] lg:block"
              style={{
                width: `${LENS_SIZE_PERCENT}%`,
                height: `${LENS_SIZE_PERCENT}%`,
                left: `${zoom.x * 100}%`,
                top: `${zoom.y * 100}%`,
                transform: "translate(-50%, -50%)",
              }}
            />
          )}

          {!model && !zoom && (
            <div className="pointer-events-none absolute bottom-4 right-4 flex items-center gap-2 rounded-full border border-zinc-200 bg-white/95 px-3 py-2 text-xs font-semibold text-zinc-700 shadow-sm">
              <span aria-hidden="true">⌕</span>
              <span className="[@media(hover:hover)]:hidden">{text("Tap photo to zoom")}</span>
              <span className="hidden [@media(hover:hover)]:inline">{text("Hover over the photo to zoom")}</span>
            </div>
          )}

          {!model && photos.length > 1 && (
            <>
              <button
                type="button"
                aria-label={text("Previous product photo")}
                onClick={() => choosePhoto((selected - 1 + photos.length) % photos.length)}
                className="absolute left-3 rounded-full border bg-white/95 p-3 shadow-sm"
              >
                ←
              </button>
              <button
                type="button"
                aria-label={text("Next product photo")}
                onClick={() => choosePhoto((selected + 1) % photos.length)}
                className="absolute right-3 rounded-full border bg-white/95 p-3 shadow-sm"
              >
                →
              </button>
            </>
          )}
        </div>

        {zoom && !model && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-[calc(100%+1rem)] top-0 z-40 hidden h-full w-full overflow-hidden rounded-3xl border border-zinc-300 bg-white shadow-2xl lg:block"
          >
            <img
              src={imageUrl}
              alt=""
              className="absolute max-w-none object-contain"
              style={{
                width: `${ZOOM_SCALE * 100}%`,
                height: `${ZOOM_SCALE * 100}%`,
                left: `${50 - zoom.x * ZOOM_SCALE * 100}%`,
                top: `${50 - zoom.y * ZOOM_SCALE * 100}%`,
              }}
            />
          </div>
        )}
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2" aria-label={text("Product photos")}>
        {photos.map((item, index) => (
          <button
            key={item.url}
            type="button"
            aria-label={text(item.label)}
            aria-pressed={!model && selected === index}
            onClick={() => choosePhoto(index)}
            className={`w-24 shrink-0 rounded-2xl border p-2 ${
              !model && selected === index
                ? "border-red-600 bg-red-50"
                : "border-zinc-200 bg-white"
            }`}
          >
            <img
              src={item.url}
              alt=""
              loading="lazy"
              className="h-16 w-full object-contain"
              onError={(event) => {
                event.currentTarget.onerror = null;
                event.currentTarget.src = PRODUCT_PLACEHOLDER;
              }}
            />
            <span className="mt-1 block truncate text-xs">{text(item.label)}</span>
          </button>
        ))}
        {product.model3D && (
          <button
            type="button"
            onClick={() => {
              setModel(true);
              setZoom(null);
            }}
            aria-pressed={model}
            className="w-24 shrink-0 rounded-2xl border px-3 text-sm font-semibold"
          >
            {text("3D view")}
          </button>
        )}
      </div>

      <p aria-live="polite" className="text-sm text-zinc-500">
        {photos.length
          ? model
            ? text("Interactive 3D view")
            : `${text(photo.label)} · ${selected + 1} / ${photos.length}`
          : text("Product photos are being added. Contact the store for photos of this item.")}
      </p>
      {source && (
        <p className="text-xs leading-5 text-zinc-500">
          {text(
            "Reference photos show the product model. For used items, ask for photos of the actual unit and its condition."
          )}{" "}
          <a href={source} target="_blank" rel="noreferrer" className="underline">
            {text("Photo source ↗")}
          </a>
        </p>
      )}

      {touchZoomOpen && !model && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={text("Product photo zoom")}
          className="fixed inset-0 z-[100] flex flex-col bg-black/95 text-white"
        >
          <div className="flex items-center justify-between gap-4 border-b border-white/15 px-4 py-3">
            <p className="min-w-0 truncate text-sm font-bold">{product.name}</p>
            <button
              type="button"
              autoFocus
              onClick={() => setTouchZoomOpen(false)}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/15 text-2xl"
              aria-label={text("Close zoom")}
            >
              ×
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-auto overscroll-contain bg-black">
            <div
              className="relative min-h-full min-w-full transition-[width,height] duration-200"
              style={{ width: `${touchScale * 100}%`, height: `${touchScale * 100}%` }}
            >
              <img
                src={imageUrl}
                alt={photo ? `${product.name} — ${text(photo.label)}` : product.name}
                className="absolute inset-0 h-full w-full max-w-none select-none object-contain p-3"
                draggable={false}
              />
            </div>
          </div>
          <div className="flex items-center justify-center gap-4 border-t border-white/15 px-4 py-4">
            <button
              type="button"
              onClick={() => setTouchScale((value) => Math.max(1, value - 0.5))}
              disabled={touchScale <= 1}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-2xl font-bold text-black disabled:opacity-40"
              aria-label={text("Zoom out")}
            >
              −
            </button>
            <p className="w-20 text-center text-sm font-bold" aria-live="polite">{Math.round(touchScale * 100)}%</p>
            <button
              type="button"
              onClick={() => setTouchScale((value) => Math.min(4, value + 0.5))}
              disabled={touchScale >= 4}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-2xl font-bold text-black disabled:opacity-40"
              aria-label={text("Zoom in")}
            >
              +
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
