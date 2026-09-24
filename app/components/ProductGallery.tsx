"use client";

import { useState, type PointerEvent as ReactPointerEvent } from "react";
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
  const photo = photos[Math.min(selected, Math.max(0, photos.length - 1))];
  const imageUrl = photo?.url ?? PRODUCT_PLACEHOLDER;
  const source =
    typeof product.fullSpecs.photoSource === "string" &&
    /^https:\/\//.test(product.fullSpecs.photoSource)
      ? product.fullSpecs.photoSource
      : null;

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
            <div className="pointer-events-none absolute bottom-4 right-4 hidden items-center gap-2 rounded-full border border-zinc-200 bg-white/95 px-3 py-2 text-xs font-semibold text-zinc-700 shadow-sm lg:flex">
              <span aria-hidden="true">⌕</span>
              {text("Hover over the photo to zoom")}
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
    </div>
  );
}
