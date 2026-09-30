import type { Metadata } from "next";
import { Suspense } from "react";
import TrackForm from "./TrackForm";

export const metadata: Metadata = {
  title: "Track your delivery — Aphrodite Myanmar",
  description:
    "Check where your Aphrodite Myanmar order is, using the order code from your confirmation email and your delivery phone number. No account needed.",
};

/** `useSearchParams` inside TrackForm needs a Suspense boundary. */
export default function TrackPage() {
  return (
    <Suspense>
      <TrackForm />
    </Suspense>
  );
}
