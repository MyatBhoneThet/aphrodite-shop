import { Suspense } from "react";
import SlipsView from "./SlipsView";

export default function PackingSlipsPage() {
  return (
    <Suspense fallback={<main className="flex min-h-screen items-center justify-center">Loading…</main>}>
      <SlipsView />
    </Suspense>
  );
}
