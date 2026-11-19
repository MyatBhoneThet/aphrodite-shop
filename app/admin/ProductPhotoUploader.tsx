"use client";

import { useAdminText } from "../lib/useAdminText";

import { useRef, useState } from "react";
import { authHeaders } from "../lib/client-auth";
import { normalizeGallery, safeImageUrl, type ProductPhoto } from "../lib/product-gallery";
import ProductPhotoEditor from "./ProductPhotoEditor";

const MAX_PHOTOS = 12;
const PHOTO_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

type Props = {
  photos: ProductPhoto[];
  onChange: (photos: ProductPhoto[]) => void;
};

export default function ProductPhotoUploader({ photos, onChange }: Props) {
  const a = useAdminText();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [fileIndex, setFileIndex] = useState(0);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState("");

  function chooseFiles(selected: File[]) {
    if (!selected.length) return;

    const room = MAX_PHOTOS - photos.length;
    if (room <= 0) {
      setError(`You already have ${MAX_PHOTOS} photos. Remove one first.`);
      return;
    }

    const supported = selected.filter((file) => PHOTO_TYPES.has(file.type));
    const notices = [];
    if (supported.length < selected.length) notices.push(a("Choose JPG, PNG or WebP photos."));
    if (supported.length > room) notices.push(`Only ${room} more photo(s) fit, so the rest were not added.`);
    setError(notices.join(" ") || null);
    setFileIndex(0);
    setFiles(supported.slice(0, room));
  }

  async function storePhoto(file: File) {
    const body = new FormData();
    body.append("file", file);
    const response = await fetch("/api/admin/product-photos", {
      method: "POST",
      headers: authHeaders(),
      body,
    });
    const data = (await response.json().catch(() => null)) as {
      photos?: ProductPhoto[];
      error?: string;
    } | null;
    if (!response.ok || !data?.photos?.length) throw new Error(data?.error ?? "Upload failed.");

    return data.photos[0];
  }

  async function uploadPhoto(file: File) {
    const photo = await storePhoto(file);
    onChange(normalizeGallery([...photos, photo]));
    advance();
  }

  async function replacePhoto(index: number, file: File) {
    const replacement = await storePhoto(file);
    update(index, { url: replacement.url });
    setEditingIndex(null);
  }

  function advance() {
    if (fileIndex + 1 < files.length) setFileIndex(fileIndex + 1);
    else setFiles([]);
  }

  function addLink() {
    const url = safeImageUrl(link.trim());
    if (!url) {
      setError("Paste a full https:// image link.");
      return;
    }
    setError(null);
    setLink("");
    onChange(normalizeGallery([...photos, { url, label: "Product view" }]));
  }

  function update(index: number, next: Partial<ProductPhoto>) {
    onChange(photos.map((photo, i) => (i === index ? { ...photo, ...next } : photo)));
  }

  function remove(index: number) {
    onChange(photos.filter((_, i) => i !== index));
  }

  function makeCover(index: number) {
    const next = [...photos];
    const [picked] = next.splice(index, 1);
    onChange([picked, ...next]);
  }

  return (
    <div>
      <label className="mb-1 block text-sm font-semibold">{a("Product photos")}</label>

      <button
        type="button"
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          chooseFiles(Array.from(event.dataTransfer.files));
        }}
        onClick={() => inputRef.current?.click()}
        className={`block w-full cursor-pointer rounded-xl border-2 border-dashed px-4 py-6 text-center transition ${
          isDragging
            ? "border-red-500 bg-red-50"
            : "border-zinc-300 hover:border-red-400 hover:bg-zinc-50"
        }`}
      >
        <span className="block text-sm font-semibold text-zinc-700">
          {a("Click to choose photos, or drag them here")}
        </span>
        <span className="mt-1 block text-xs text-zinc-500">
          {a("JPG, PNG or WebP · up to 5 MB each · up to")} {MAX_PHOTOS} {a("photos")}
        </span>
        <span className="mt-1 block text-xs text-zinc-500">{a("Crop and resize before uploading.")}</span>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        multiple
        hidden
        onChange={(event) => {
          chooseFiles(Array.from(event.target.files ?? []));
          event.target.value = "";
        }}
      />

      {files[fileIndex] && (
        <ProductPhotoEditor
          key={fileIndex}
          file={files[fileIndex]}
          position={fileIndex + 1}
          total={files.length}
          onUpload={uploadPhoto}
          onSkip={advance}
          onCancel={() => setFiles([])}
        />
      )}

      {editingIndex !== null && photos[editingIndex] && (
        <ProductPhotoEditor
          key={photos[editingIndex].url}
          photo={photos[editingIndex]}
          onUpload={(file) => replacePhoto(editingIndex, file)}
          onCancel={() => setEditingIndex(null)}
        />
      )}

      {error && <p className="mt-2 text-xs font-semibold text-red-600">{a(error)}</p>}

      {photos.length > 0 && (
        <ul className="mt-3 space-y-2">
          {photos.map((photo, index) => (
            <li
              key={photo.url}
              className="flex flex-wrap items-center gap-3 rounded-xl border px-3 py-2"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.url}
                alt={photo.label}
                className="h-14 w-14 shrink-0 rounded-lg border object-contain p-1"
              />

              <div className="min-w-0 flex-1">
                <input
                  value={photo.label}
                  onChange={(event) => update(index, { label: event.target.value })}
                  placeholder={a("Front view")}
                  aria-label={`Name for photo ${index + 1}`}
                  className="w-full rounded-lg border px-2 py-1 text-sm outline-none focus:border-red-500"
                />
                {index === 0 ? (
                  <span className="mt-1 inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                     {a("Cover photo")} </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => makeCover(index)}
                    className="mt-1 text-[11px] font-semibold text-zinc-500 hover:text-red-600"
                  >
                     {a("Make cover")} </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setEditingIndex(index)}
                className="shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold hover:bg-zinc-100"
              >
                {a("Crop / resize")}
              </button>
              <button
                type="button"
                onClick={() => remove(index)}
                aria-label={`Remove photo ${index + 1}`}
                className="shrink-0 rounded-full border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
              >
                 {a("Delete")} </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex gap-2">
        <input
          value={link}
          onChange={(event) => setLink(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addLink();
            }
          }}
          placeholder={a("or paste an image link (https://...)")}
          aria-label={a("Add a photo by link")}
          className="flex-1 rounded-xl border px-3 py-2 text-sm outline-none focus:border-red-500"
        />
        <button
          type="button"
          onClick={addLink}
          className="rounded-xl border px-4 py-2 text-sm font-semibold hover:bg-zinc-100"
        >
           {a("Add")} </button>
      </div>

      <p className="mt-2 text-xs text-zinc-500">
         {a("The first photo is used as the cover in the shop. This gallery is kept during later Google Sheet syncs.")} </p>
    </div>
  );
}
