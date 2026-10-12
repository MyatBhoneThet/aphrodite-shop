"use client";

import { useEffect } from "react";
import StatusScreen from "./components/StatusScreen";

type Props = {
  error: Error & { digest?: string };
  /** Next.js 16 calls it `retry`; `reset` is the older name, kept as a fallback. */
  retry?: () => void;
  reset?: () => void;
};

export default function GlobalSegmentError({ error, retry, reset }: Props) {
  useEffect(() => {
    // The digest matches the server log line; it is what support needs.
    console.error("[app-error]", error.digest ?? "", error.message);
  }, [error]);

  return <StatusScreen kind="error" digest={error.digest} onRetry={retry ?? reset} />;
}
