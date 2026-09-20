"use client";
import { useLanguage } from "../lib/language";
import { useState } from "react";
import type { Product } from "../data/products";
import { productPhotos, PRODUCT_PLACEHOLDER } from "../lib/product-gallery";
import Product3DViewer from "./Product3DViewer";

export default function ProductGallery({ product }: { product: Product }) {
  const { text } = useLanguage();
  const photos = productPhotos(product);
  const [selected, setSelected] = useState(0);
  const [model, setModel] = useState(false);
  const photo = photos[Math.min(selected, Math.max(0, photos.length - 1))];
  const source = typeof product.fullSpecs.photoSource === "string" && /^https:\/\//.test(product.fullSpecs.photoSource) ? product.fullSpecs.photoSource : null;
  return <div className="space-y-4">
    <div className="relative flex h-[340px] items-center justify-center overflow-hidden rounded-3xl border border-zinc-200 bg-white sm:h-[480px]">
      {model && product.model3D ? <Product3DViewer modelUrl={product.model3D} imageUrl={product.image} productName={product.name} /> : <img key={photo?.url ?? "placeholder"} src={photo?.url ?? PRODUCT_PLACEHOLDER} alt={photo ? `${product.name} — ${text(photo.label)}` : `${product.name} — ${text("photo not yet available")}`} className="h-full w-full object-contain p-8" onError={event => { event.currentTarget.onerror = null; event.currentTarget.src = PRODUCT_PLACEHOLDER; }} />}
      {!model && photos.length > 1 && <><button type="button" aria-label={text("Previous product photo")} onClick={() => setSelected((selected - 1 + photos.length) % photos.length)} className="absolute left-3 rounded-full border bg-white/95 p-3 shadow-sm">←</button><button type="button" aria-label={text("Next product photo")} onClick={() => setSelected((selected + 1) % photos.length)} className="absolute right-3 rounded-full border bg-white/95 p-3 shadow-sm">→</button></>}
    </div>
    <div className="flex gap-3 overflow-x-auto pb-2" aria-label={text("Product photos")}>
      {photos.map((item,i) => <button key={item.url} type="button" aria-label={text(item.label)} aria-pressed={!model && selected === i} onClick={() => { setSelected(i); setModel(false); }} className={`w-24 shrink-0 rounded-2xl border p-2 ${!model && selected === i ? "border-red-600 bg-red-50" : "border-zinc-200 bg-white"}`}><img src={item.url} alt="" loading="lazy" className="h-16 w-full object-contain" onError={event => { event.currentTarget.onerror = null; event.currentTarget.src = PRODUCT_PLACEHOLDER; }} /><span className="mt-1 block truncate text-xs">{text(item.label)}</span></button>)}
      {product.model3D && <button type="button" onClick={() => setModel(true)} aria-pressed={model} className="w-24 shrink-0 rounded-2xl border px-3 text-sm font-semibold">{text("3D view")}</button>}
    </div>
    <p aria-live="polite" className="text-sm text-zinc-500">{photos.length ? model ? text("Interactive 3D view") : `${text(photo.label)} · ${selected + 1} / ${photos.length}` : text("Product photos are being added. Contact the store for photos of this item.")}</p>
    {source && <p className="text-xs leading-5 text-zinc-500">{text("Reference photos show the product model. For used items, ask for photos of the actual unit and its condition.")} <a href={source} target="_blank" rel="noreferrer" className="underline">{text("Photo source \u2197")}</a></p>}
  </div>;
}
