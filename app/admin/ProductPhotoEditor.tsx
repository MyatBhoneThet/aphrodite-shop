import { useEffect, useId, useRef, useState } from "react";
import { useAdminText } from "../lib/useAdminText";
import type { ProductPhoto } from "../lib/product-gallery";

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_EDGE = 4096;

type Props = {
  onUpload: (file: File) => Promise<void>;
  onCancel: () => void;
} & (
  | { file: File; position: number; total: number; onSkip: () => void; photo?: never }
  | { photo: ProductPhoto; file?: never; position?: never; total?: never; onSkip?: never }
);

async function openPhoto(source: File | string) {
  if (typeof source !== "string") return createImageBitmap(source);
  const image = new Image();
  image.crossOrigin = "anonymous";
  image.src = source;
  await image.decode();
  return createImageBitmap(image);
}

export default function ProductPhotoEditor({ file, photo, position = 1, total = 1, onUpload, onSkip, onCancel }: Props) {
  const a = useAdminText();
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const [image, setImage] = useState<ImageBitmap | null>(null);
  const [aspect, setAspect] = useState("original");
  const [zoom, setZoom] = useState(100);
  const [horizontal, setHorizontal] = useState(50);
  const [vertical, setVertical] = useState(50);
  const [outputWidth, setOutputWidth] = useState("");
  const [unreadable, setUnreadable] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [replacement, setReplacement] = useState<File | null>(null);
  const localFile = file ?? replacement;
  const source = localFile ?? photo?.url;

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  useEffect(() => {
    if (!source) return;
    let disposed = false;
    let bitmap: ImageBitmap | undefined;
    void openPhoto(source).then((decoded) => {
      if (disposed) decoded.close();
      else {
        bitmap = decoded;
        setImage(decoded);
      }
    }).catch(() => {
      if (!disposed) setUnreadable(true);
    });
    return () => {
      disposed = true;
      bitmap?.close();
    };
  }, [source]);

  const ratio = aspect === "original" ? (image ? image.width / image.height : 1) : Number(aspect);
  const cropWidth = image ? Math.min(image.width, image.height * ratio) * 100 / zoom : 0;
  const cropHeight = cropWidth / ratio;
  const availableX = image ? Math.max(0, image.width - cropWidth) : 0;
  const availableY = image ? Math.max(0, image.height - cropHeight) : 0;
  const cropX = availableX * horizontal / 100;
  const cropY = availableY * vertical / 100;
  const maxWidth = Math.max(1, Math.min(MAX_EDGE, Math.floor(MAX_EDGE * ratio)));
  const unchangedCrop = aspect === "original" && zoom === 100;
  const unchanged = unchangedCrop && outputWidth === "";
  const useOriginal = unchanged && localFile && localFile.size > 0 && localFile.size <= MAX_BYTES;
  const keepExisting = unchanged && photo && !replacement;
  const keepSize = useOriginal || keepExisting;
  const width = keepSize ? image?.width ?? 0 : Number(outputWidth || Math.max(1, Math.min(Math.round(cropWidth), maxWidth)));
  const height = keepSize ? image?.height ?? 0 : Math.min(MAX_EDGE, Math.max(1, Math.round(width / ratio)));
  const validSize = keepSize || (Number.isInteger(width) && width >= 1 && width <= maxWidth);

  useEffect(() => {
    const canvas = previewRef.current;
    if (!canvas || !image) return;
    const scale = Math.min(480 / cropWidth, 250 / cropHeight, 1);
    canvas.width = Math.max(1, Math.round(cropWidth * scale));
    canvas.height = Math.max(1, Math.round(cropHeight * scale));
    // Drawing directly to canvas keeps the preview compatible with the image CSP.
    canvas.getContext("2d")?.drawImage(image, cropX, cropY, cropWidth, cropHeight, 0, 0, canvas.width, canvas.height);
  }, [image, cropX, cropY, cropWidth, cropHeight]);

  async function upload() {
    if (!image || !validSize || busy || keepExisting) return;
    setBusy(true);
    setError("");
    try {
      let output: File;
      if (useOriginal) {
        output = localFile;
      } else {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Could not prepare this photo.");
        context.imageSmoothingQuality = "high";
        context.drawImage(image, cropX, cropY, cropWidth, cropHeight, 0, 0, width, height);

        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, localFile?.type || "image/png", 0.9));
        if (!blob) throw new Error("Could not prepare this photo.");
        if (blob.size > MAX_BYTES) throw new Error("The result is over 5 MB. Reduce the output width and try again.");
        const extension = blob.type === "image/jpeg" ? "jpg" : blob.type === "image/webp" ? "webp" : "png";
        const name = localFile?.name.replace(/\.[^.]+$/, "") || "product-photo";
        output = new File([blob], name + "." + extension, { type: blob.type });
      }
      await onUpload(output);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
      setBusy(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onCancel();
      }}
      onKeyDown={(event) => {
        // Enter in the width field would otherwise submit the outer product form.
        if (event.key === "Enter" && event.target instanceof HTMLInputElement) event.preventDefault();
      }}
      className="m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-xl overflow-auto rounded-2xl bg-white p-5 text-zinc-900 shadow-xl backdrop:bg-black/50"
    >
      <h3 id={titleId} className="font-bold">{a("Crop and resize photo")}</h3>
      <p className="mt-1 break-all text-sm text-zinc-600">
        {total > 1 && <span>{position} / {total} · </span>}
        {localFile?.name ?? photo?.label}
      </p>

      <div className="mt-4 flex min-h-32 items-center justify-center rounded-xl border bg-zinc-50 p-2">
        {image ? (
          <canvas ref={previewRef} role="img" aria-label={a("Photo preview")} className="h-auto max-w-full" />
        ) : (
          <p role="status" className="text-sm text-zinc-600">
            {a(unreadable ? "Could not open this photo." : "Loading preview...")}
          </p>
        )}
      </div>

      {photo && unreadable && (
        <label className="mt-3 block text-sm font-semibold">
          {a("Choose a local copy to edit")}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="mt-1 block w-full text-sm font-normal"
            onChange={(event) => {
              const chosen = event.target.files?.[0];
              if (!chosen) return;
              event.target.value = "";
              if (!["image/png", "image/jpeg", "image/webp"].includes(chosen.type)) {
                setError("Choose JPG, PNG or WebP photos.");
                return;
              }
              setError("");
              setUnreadable(false);
              setReplacement(chosen);
            }}
          />
        </label>
      )}

      {image && (
        <fieldset disabled={busy} className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm font-semibold">
            {a("Crop ratio")}
            <select value={aspect} onChange={(event) => setAspect(event.target.value)} className="rounded-lg border p-2 font-normal">
              <option value="original">{a("Original ratio")}</option>
              <option value="1">{a("Square (1:1)")}</option>
              <option value={4 / 3}>{a("Landscape (4:3)")}</option>
              <option value={3 / 4}>{a("Portrait (3:4)")}</option>
              <option value={16 / 9}>{a("Wide (16:9)")}</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            {a("Output width (px)")}
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={Math.max(maxWidth, useOriginal ? width : 0)}
              placeholder={String(width)}
              value={outputWidth}
              onChange={(event) => setOutputWidth(event.target.value)}
              aria-invalid={!validSize}
              className="w-full rounded-lg border p-2 font-normal"
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold sm:col-span-2">
            {a("Crop zoom")} · {zoom}%
            <input type="range" min={100} max={400} value={zoom} onChange={(event) => setZoom(Number(event.target.value))} className="w-full accent-red-600" />
          </label>
          {availableX >= 1 && (
            <label className="grid gap-1 text-sm font-semibold">
              {a("Crop position left / right")}
              <input type="range" value={horizontal} onChange={(event) => setHorizontal(Number(event.target.value))} className="w-full accent-red-600" />
            </label>
          )}
          {availableY >= 1 && (
            <label className="grid gap-1 text-sm font-semibold">
              {a("Crop position up / down")}
              <input type="range" value={vertical} onChange={(event) => setVertical(Number(event.target.value))} className="w-full accent-red-600" />
            </label>
          )}
        </fieldset>
      )}

      {image && (
        <p className="mt-3 text-sm text-zinc-600">
          {validSize ? <>{a("Output size")} · {width} × {height} px</> : <>{a("Output width must be between 1 and")} {maxWidth} px.</>}
        </p>
      )}
      {error && <p role="alert" className="mt-2 text-sm text-red-700">{a(error)}</p>}

      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <button type="button" disabled={busy} onClick={onCancel} className="rounded-xl border px-4 py-2 text-sm font-semibold disabled:opacity-50">
          {a("Cancel")}
        </button>
        {position < total && (
          <button type="button" disabled={busy} onClick={onSkip} className="rounded-xl border px-4 py-2 text-sm font-semibold disabled:opacity-50">
            {a("Skip photo")}
          </button>
        )}
        <button type="button" disabled={!image || !validSize || busy || Boolean(keepExisting)} onClick={() => void upload()} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {a(busy ? "Uploading..." : photo ? "Apply changes" : "Upload photo")}
        </button>
      </div>
    </dialog>
  );
}
