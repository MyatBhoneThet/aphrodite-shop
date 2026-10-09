"use client";

import { useState } from "react";
import { authHeaders } from "../lib/client-auth";
import { formatCurrency, formatDateTime } from "../lib/format";
import { useLanguage } from "../lib/language";

type WizardItem = {
  id: string;
  product_id: number;
  quantity: number;
  unit_price: number;
  product?: { name: string } | null;
};

type WizardOrder = {
  id: string;
  shipping_address: string;
  delivered_at?: string | null;
  order_items?: WizardItem[];
};

type ReasonCode =
  | "defective"
  | "wrong_item"
  | "wrong_color"
  | "wrong_storage"
  | "damaged_in_transit"
  | "other";

type Resolution = "replacement" | "refund" | "repair";
type Collection = "courier_pickup" | "store_dropoff";

const REASONS: ReasonCode[] = [
  "defective",
  "wrong_item",
  "wrong_color",
  "wrong_storage",
  "damaged_in_transit",
  "other",
];

const REASON_LABELS: Record<ReasonCode, { en: string; my: string }> = {
  defective: { en: "Machine has a fault or error", my: "စက်တွင် ချွတ်ယွင်းချက် ရှိသည်" },
  wrong_item: { en: "Wrong product received", my: "မှားယွင်းသော ပစ္စည်း ရရှိသည်" },
  wrong_color: { en: "Wrong colour received", my: "အရောင် မှားယွင်းသည်" },
  wrong_storage: { en: "Wrong storage size received", my: "သိုလှောင်မှု ပမာဏ မှားယွင်းသည်" },
  damaged_in_transit: { en: "Damaged during delivery", my: "ပို့ဆောင်စဉ် ပျက်စီးသည်" },
  other: { en: "Other eligible problem", my: "အခြား အကျုံးဝင်သော ပြဿနာ" },
};

const RESOLUTIONS: Resolution[] = ["replacement", "refund", "repair"];
const COLLECTIONS: Collection[] = ["courier_pickup", "store_dropoff"];

const PHOTO_TYPES = "image/jpeg,image/png,image/webp";
const VIDEO_TYPES = "video/mp4,video/quicktime,video/webm";

/**
 * Three steps: pick one or more items, describe the problem with evidence,
 * then choose the outcome. Each selected line becomes its own auditable return
 * request, while the customer completes the shared details only once.
 */
export default function ReturnWizard({
  order,
  unavailableItemIds = [],
  onSubmitted,
}: {
  order: WizardOrder;
  unavailableItemIds?: string[];
  onSubmitted: () => void;
}) {
  const { language, t } = useLanguage();
  const items = (order.order_items ?? []).filter((item) => !unavailableItemIds.includes(item.id));

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedQuantities, setSelectedQuantities] = useState<Record<string, number>>({});
  const [reasonCode, setReasonCode] = useState<ReasonCode>("defective");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [videoConfirmed, setVideoConfirmed] = useState(false);
  const [resolution, setResolution] = useState<Resolution>("replacement");
  const [collection, setCollection] = useState<Collection>("courier_pickup");
  const [pickupAddress, setPickupAddress] = useState(order.shipping_address ?? "");
  const [refundBankName, setRefundBankName] = useState("");
  const [refundAccountName, setRefundAccountName] = useState("");
  const [refundAccountNumber, setRefundAccountNumber] = useState("");
  const [preferredServiceDate, setPreferredServiceDate] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");

  const selectedItems = items.filter((item) => selectedQuantities[item.id] > 0);
  const deadline = order.delivered_at
    ? new Date(new Date(order.delivered_at).getTime() + 7 * 24 * 60 * 60 * 1000)
    : null;
  const needsVideo = reasonCode === "damaged_in_transit";

  function label(code: ReasonCode) {
    return REASON_LABELS[code][language];
  }

  function goNext() {
    setError("");

    if (step === 1) {
      if (selectedItems.length === 0) {
        setError(t("return.step1Help"));
        return;
      }
      setStep(2);
      return;
    }

    if (step === 2) {
      if (description.trim().length < 10) {
        setError(t("return.describe"));
        return;
      }
      if (needsVideo && !videoConfirmed) {
        setError(t("return.videoConfirm"));
        return;
      }
      setStep(3);
    }
  }

  async function submit() {
    if (selectedItems.length === 0 || isSending) return;

    if (collection === "courier_pickup" && pickupAddress.trim().length < 5) {
      setError(t("return.pickupAddress"));
      return;
    }
    if (resolution === "refund" && (
      refundBankName.trim().length < 2 ||
      refundAccountName.trim().length < 2 ||
      refundAccountNumber.trim().length < 5
    )) {
      setError(t("return.refundAccountRequired"));
      return;
    }
    if (resolution !== "refund" && !preferredServiceDate) {
      setError(t("return.serviceDateRequired"));
      return;
    }

    setIsSending(true);
    setError("");

    try {
      const requestIds: string[] = [];
      for (const selectedItem of selectedItems) {
        const response = await fetch("/api/returns", {
          method: "POST",
          headers: { ...authHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({
            order_id: order.id,
            order_item_id: selectedItem.id,
            quantity: selectedQuantities[selectedItem.id],
            reason_code: reasonCode,
            description: description.trim(),
            preferred_resolution: resolution,
            collection_method: collection,
            pickup_address: collection === "courier_pickup" ? pickupAddress.trim() : null,
            unboxing_video_confirmed: videoConfirmed,
            evidence_url: evidenceUrl.trim() || null,
            refund_bank_name: resolution === "refund" ? refundBankName.trim() : null,
            refund_account_name: resolution === "refund" ? refundAccountName.trim() : null,
            refund_account_number: resolution === "refund" ? refundAccountNumber.trim() : null,
            preferred_service_at: resolution === "refund"
              ? null
              : new Date(preferredServiceDate).toISOString(),
          }),
        });
        const data = (await response.json().catch(() => null)) as
          | { request?: { id: string }; error?: string }
          | null;

        if (!response.ok || !data?.request) {
          throw new Error(data?.error ?? "Unable to send your return request.");
        }
        requestIds.push(data.request.id);
      }

      // Files go up one at a time against the saved request, so a rejected
      // file never loses the request the customer already filled in.
      for (const requestId of requestIds) {
        for (const file of files) {
          const upload = new FormData();
          upload.set("file", file);
          upload.set(
            "evidence_kind",
            file.type.startsWith("video/")
              ? "unboxing_video"
              : reasonCode === "damaged_in_transit"
                ? "shipping_damage_photo"
                : "product_photo"
          );

          const uploaded = await fetch(`/api/returns/${requestId}/evidence`, {
            method: "POST",
            headers: authHeaders(),
            body: upload,
          });

          if (!uploaded.ok) {
            const uploadError = (await uploaded.json().catch(() => null)) as
              | { error?: string }
              | null;
            throw new Error(uploadError?.error ?? "Unable to upload your evidence.");
          }
        }
      }

      onSubmitted();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to send your return request."
      );
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="mt-6 rounded-2xl border border-orange-200 bg-orange-50 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-black">
          {step === 1
            ? t("return.step1")
            : step === 2
              ? t("return.step2")
              : t("return.step3")}
        </h3>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-orange-700">
          {t("return.step", { step })}
        </span>
      </div>

      {deadline && (
        <p className="mt-2 text-xs font-semibold text-orange-800">
          {t("return.deadline", { date: formatDateTime(deadline.toISOString()) })}
        </p>
      )}

      {step === 1 && (
        <div className="mt-4">
          <p className="text-xs leading-5 text-zinc-600">{t("return.step1Help")}</p>
          <div className="mt-3 space-y-2">
            {items.map((item) => (
              <div
                key={item.id}
                className={`flex cursor-pointer flex-wrap items-center gap-3 rounded-xl border bg-white p-3 text-sm ${
                  selectedQuantities[item.id] ? "border-red-500" : "border-zinc-200"
                }`}
              >
                <input
                  type="checkbox"
                  checked={Boolean(selectedQuantities[item.id])}
                  onChange={(event) => setSelectedQuantities((current) => {
                    const next = { ...current };
                    if (event.target.checked) next[item.id] = 1;
                    else delete next[item.id];
                    return next;
                  })}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">
                    {item.product?.name ?? `Product #${item.product_id}`}
                  </span>
                  <span className="text-xs text-zinc-500">
                    × {item.quantity} · {formatCurrency(item.unit_price)}
                  </span>
                </span>
                {selectedQuantities[item.id] && item.quantity > 1 && (
                  <label className="ml-7 flex w-full items-center justify-between gap-2 border-t border-zinc-100 pt-3 text-xs font-semibold sm:ml-0 sm:w-auto sm:shrink-0 sm:justify-start sm:border-0 sm:pt-0">
                    {t("return.quantity")}
                    <input
                      type="number"
                      min={1}
                      max={item.quantity}
                      value={selectedQuantities[item.id]}
                      onClick={(event) => event.stopPropagation()}
                      onChange={(event) => setSelectedQuantities((current) => ({
                        ...current,
                        [item.id]: Math.min(Math.max(1, Number(event.target.value) || 1), item.quantity),
                      }))}
                      className="w-20 rounded-lg border px-2 py-1.5 font-normal"
                    />
                  </label>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="mt-4 space-y-4">
          <label className="block text-sm font-semibold">
            {t("return.problem")}
            <select
              value={reasonCode}
              onChange={(event) => setReasonCode(event.target.value as ReasonCode)}
              className="mt-2 w-full rounded-xl border bg-white px-4 py-3 font-normal outline-none focus:border-red-500"
            >
              {REASONS.map((code) => (
                <option key={code} value={code}>
                  {label(code)}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-semibold">
            {t("return.describe")}
            <textarea
              rows={3}
              maxLength={1000}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder={t("return.describePlaceholder")}
              className="mt-2 w-full rounded-xl border px-4 py-3 font-normal outline-none focus:border-red-500"
            />
          </label>

          <div className="rounded-xl bg-white p-4">
            <p className="text-sm font-bold text-red-600">{t("return.evidence")}</p>
            <p className="mt-1 text-xs font-semibold leading-5 text-red-600">
              {t("return.evidenceHelp")}
            </p>
            <p className="mt-2 rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-900">
              {t("return.videoRule")}
            </p>
            <label className="mt-3 block text-sm font-bold text-red-600">
              {t("return.uploadEvidence")}
              <input
                type="file"
                multiple
                accept={`${PHOTO_TYPES},${VIDEO_TYPES}`}
                onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
                className="mt-2 block w-full rounded-xl border border-red-300 bg-white px-4 py-3 text-sm text-zinc-900"
              />
            </label>
            <p className="mt-2 text-xs text-zinc-500">{t("return.fileLimit")}</p>

            <label className="mt-3 block text-sm font-semibold">
              {t("return.evidenceLink")}
              <input
                type="url"
                value={evidenceUrl}
                onChange={(event) => setEvidenceUrl(event.target.value)}
                placeholder="https://drive.google.com/..."
                className="mt-2 w-full rounded-xl border px-4 py-3 font-normal outline-none focus:border-red-500"
              />
            </label>

            <label className="mt-3 flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={videoConfirmed}
                onChange={(event) => setVideoConfirmed(event.target.checked)}
                className="mt-1"
              />
              <span>
                {t("return.videoConfirm")}
                {needsVideo && <span className="font-bold text-red-600"> *</span>}
              </span>
            </label>
          </div>

        </div>
      )}

      {step === 3 && (
        <div className="mt-4 space-y-4">
          <div>
            <p className="text-sm font-semibold">{t("return.resolution")}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {RESOLUTIONS.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setResolution(value)}
                  aria-pressed={resolution === value}
                  className={`rounded-full px-4 py-2 text-xs font-bold ${
                    resolution === value
                      ? "bg-red-600 text-white"
                      : "border bg-white hover:border-red-400"
                  }`}
                >
                  {t(`return.resolution.${value}`)}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs leading-5 text-zinc-600">
              {t("return.resolutionHelp")}
            </p>
          </div>

          {resolution === "refund" ? (
            <div className="grid gap-3 rounded-xl border border-red-200 bg-white p-4 md:grid-cols-3">
              <label className="text-sm font-semibold">{t("return.bankName")}<input value={refundBankName} onChange={(event) => setRefundBankName(event.target.value)} maxLength={120} className="mt-2 w-full rounded-xl border px-3 py-2 font-normal" /></label>
              <label className="text-sm font-semibold">{t("return.accountName")}<input value={refundAccountName} onChange={(event) => setRefundAccountName(event.target.value)} maxLength={160} className="mt-2 w-full rounded-xl border px-3 py-2 font-normal" /></label>
              <label className="text-sm font-semibold">{t("return.accountNumber")}<input value={refundAccountNumber} onChange={(event) => setRefundAccountNumber(event.target.value)} maxLength={80} inputMode="numeric" autoComplete="off" className="mt-2 w-full rounded-xl border px-3 py-2 font-normal" /></label>
            </div>
          ) : (
            <label className="block text-sm font-semibold">
              {resolution === "replacement" ? t("return.replacementDate") : t("return.repairDate")}
              <input type="datetime-local" value={preferredServiceDate} onChange={(event) => setPreferredServiceDate(event.target.value)} className="mt-2 w-full rounded-xl border bg-white px-4 py-3 font-normal" />
            </label>
          )}

          <div>
            <p className="text-sm font-semibold">{t("return.collection")}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {COLLECTIONS.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setCollection(value)}
                  aria-pressed={collection === value}
                  className={`rounded-full px-4 py-2 text-xs font-bold ${
                    collection === value
                      ? "bg-zinc-900 text-white"
                      : "border bg-white hover:border-zinc-500"
                  }`}
                >
                  {t(`return.collection.${value}`)}
                </button>
              ))}
            </div>
          </div>

          {collection === "courier_pickup" && (
            <label className="block text-sm font-semibold">
              {t("return.pickupAddress")}
              <textarea
                rows={2}
                maxLength={500}
                value={pickupAddress}
                onChange={(event) => setPickupAddress(event.target.value)}
                className="mt-2 w-full rounded-xl border px-4 py-3 font-normal outline-none focus:border-red-500"
              />
            </label>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-700">
          {error}
        </p>
      )}

      <div className="mt-5 grid gap-2 sm:flex sm:flex-wrap">
        {step > 1 && (
          <button
            type="button"
            onClick={() => {
              setError("");
              setStep((current) => (current === 3 ? 2 : 1));
            }}
            className="rounded-full border px-5 py-2.5 text-sm font-bold"
          >
            {t("return.back")}
          </button>
        )}
        {step < 3 ? (
          <button
            type="button"
            onClick={goNext}
            className="rounded-full bg-zinc-900 px-6 py-2.5 text-sm font-bold text-white"
          >
            {t("return.next")}
          </button>
        ) : (
          <button
            type="button"
            onClick={submit}
            disabled={isSending}
            className="rounded-full bg-red-600 px-6 py-2.5 text-sm font-bold text-white disabled:bg-zinc-400"
          >
            {isSending ? t("return.submitting") : t("return.submit")}
          </button>
        )}
      </div>
    </div>
  );
}
