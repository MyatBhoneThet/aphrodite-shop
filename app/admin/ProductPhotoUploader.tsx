"use client";

import { useRef, useState } from "react";
import { authHeaders } from "../lib/client-auth";
import { normalizeGallery, safeImageUrl, type ProductPhoto } from "../lib/product-gallery";

const MAX_PHOTOS = 12;

type Props = {
  photos: ProductPhoto[];
  onChange: (photos: ProductPhoto[]) => void;
};

// Uploads straight to Supabase Storage through /api/admin/product-photos and
// keeps only the returned https URLs. We never preview a local blob: URL —
// the site's Content-Security-Policy allows images from 'self', data: and
// https: only, so a blob: preview would silently render blank.
export default function ProductPhotoUploader({ photos, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState("");

  async function uploadFiles(files: File[]) {
    if (!files.length) return;
    setError(null);

    const room = MAX_PHOTOS - photos.length;
    if (room <= 0) {
      setError(`You already have ${MAX_PHOTOS} photos. Remove one first.`);
      return;
    }

    const body = new FormData();
    files.slice(0, room).forEach((file) => body.append("file", file));

    setIsUploading(true);
    try {
      const response = await fetch("/api/admin/product-photos", {
        method: "POST",
        headers: authHeaders(),
        body,
      });

      const data = (await response.json().catch(() => null)) as {
        photos?: ProductPhoto[];
        error?: string;
      } | null;

      if (!response.ok) throw new Error(data?.error ?? "Upload failed.");

      onChange(normalizeGallery([...photos, ...(data?.photos ?? [])]));
      if (files.length > room) {
        setError(`Only ${room} more photo(s) fit, so the rest were not added.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setIsUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
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
      <label className="mb-1 block text-sm font-semibold">Product photos</label>

      <div
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          void uploadFiles(Array.from(event.dataTransfer.files));
        }}
        onClick={() => inputRef.current?.click()}
        className={`cursor-pointer rounded-xl border-2 border-dashed px-4 py-6 text-center transition ${
          isDragging
            ? "border-red-500 bg-red-50"
            : "border-zinc-300 hover:border-red-400 hover:bg-zinc-50"
        }`}
      >
        <p className="text-sm font-semibold text-zinc-700">
          {isUploading ? "Uploading..." : "Click to choose photos, or drag them here"}
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          JPG, PNG or WebP · up to 5 MB each · up to {MAX_PHOTOS} photos
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        multiple
        hidden
        onChange={(event) => void uploadFiles(Array.from(event.target.files ?? []))}
      />

      {error && <p className="mt-2 text-xs font-semibold text-red-600">{error}</p>}

      {photos.length > 0 && (
        <ul className="mt-3 space-y-2">
          {photos.map((photo, index) => (
            <li
              key={photo.url}
              className="flex items-center gap-3 rounded-xl border px-3 py-2"
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
                  placeholder="Front view"
                  aria-label={`Name for photo ${index + 1}`}
                  className="w-full rounded-lg border px-2 py-1 text-sm outline-none focus:border-red-500"
                />
                {index === 0 ? (
                  <span className="mt-1 inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                    Cover photo
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => makeCover(index)}
                    className="mt-1 text-[11px] font-semibold text-zinc-500 hover:text-red-600"
                  >
                    Make cover
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => remove(index)}
                aria-label={`Remove photo ${index + 1}`}
                className="rounded-full px-2 text-lg leading-none text-zinc-400 hover:text-red-600"
              >
                &times;
              </button>
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
          placeholder="or paste an image link (https://...)"
          aria-label="Add a photo by link"
          className="flex-1 rounded-xl border px-3 py-2 text-sm outline-none focus:border-red-500"
        />
        <button
          type="button"
          onClick={addLink}
          className="rounded-xl border px-4 py-2 text-sm font-semibold hover:bg-zinc-100"
        >
          Add
        </button>
      </div>

      <p className="mt-2 text-xs text-zinc-500">
        The first photo is used as the cover in the shop. This gallery is kept
        during later Google Sheet syncs.
      </p>
    </div>
  );
}
