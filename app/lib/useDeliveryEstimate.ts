"use client";

import { useEffect, useState } from "react";
import type { DeliveryEstimate } from "./delivery-estimate";
import { authHeaders } from "./client-auth";

export function useDeliveryEstimate(enabled: boolean) {
  const [estimate, setEstimate] = useState<DeliveryEstimate | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!enabled) {
      queueMicrotask(() => { if (!cancelled) setEstimate(null); });
      return () => { cancelled = true; };
    }
    void fetch("/api/delivery-estimate", { headers: authHeaders(), cache: "no-store" })
      .then(async (response) => response.ok
        ? response.json() as Promise<{ estimate?: DeliveryEstimate | null }>
        : null)
      .then((data) => {
        if (!cancelled) setEstimate(data?.estimate ?? null);
      })
      .catch(() => {
        if (!cancelled) setEstimate(null);
      });
    return () => { cancelled = true; };
  }, [enabled]);

  return estimate;
}
