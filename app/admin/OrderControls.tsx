"use client";

import { useAdminText } from "../lib/useAdminText";

export function OrderRequestControls({
  label, reason, onApprove, onReject,
}: {
  label: string;
  reason: string | null;
  onApprove: () => void;
  onReject: () => void;
}) {
  const a = useAdminText();
  return (
    <div className="max-w-xs">
      <p className="font-bold text-red-600">{label}  {a("requested")}</p>
      <p className="mt-1 text-xs text-zinc-600">{reason ?? a("No reason supplied.")}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={onApprove}
          className="rounded-full bg-green-600 px-3 py-1.5 text-xs font-semibold text-white">
          {label === "Return" ? a("Approve return") : a("Approve")}
        </button>
        <button type="button" onClick={onReject}
          className="rounded-full border px-3 py-1.5 text-xs font-semibold">
           {a("Reject")} </button>
      </div>
    </div>
  );
}

export function ReturnWorkflowControls({
  title,
  detail,
  button,
  onClick,
}: {
  title: string;
  detail: string;
  button: string;
  onClick: () => void;
}) {
  const a = useAdminText();
  return (
    <div className="max-w-xs">
      <p className="font-bold text-orange-700">{a(title)}</p>
      <p className="mt-1 text-xs capitalize text-zinc-600">{a(detail)}</p>
      <button type="button" onClick={onClick} className="mt-3 rounded-full bg-orange-600 px-3 py-1.5 text-xs font-bold text-white">
        {button}
      </button>
    </div>
  );
}
