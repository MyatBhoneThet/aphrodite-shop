import type { Metadata } from "next";
import LegalPage from "../components/LegalPage";
import { DELETION_INTRO, DELETION_SECTIONS } from "../lib/legal-content";

/**
 * The "user data deletion instructions" URL that Meta asks every published
 * app for, and the page the privacy policy points customers at.
 */
export const metadata: Metadata = {
  title: "Delete your data — Aphrodite Myanmar",
  description:
    "How to have your Aphrodite Myanmar account and the data attached to it deleted.",
};

export default function DataDeletionPage() {
  return (
    <LegalPage
      title={{ en: "Delete your data", my: "အချက်အလက် ဖျက်သိမ်းရန်" }}
      intro={DELETION_INTRO}
      sections={DELETION_SECTIONS}
    />
  );
}
