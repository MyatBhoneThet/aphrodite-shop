import type { Metadata } from "next";
import LegalPage from "../components/LegalPage";
import { PRIVACY_INTRO, PRIVACY_SECTIONS } from "../lib/legal-content";

export const metadata: Metadata = {
  title: "Privacy policy — Aphrodite Myanmar",
  description:
    "What Aphrodite Myanmar collects when you use this website, why, who else can see it, and how to have it removed.",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title={{ en: "Privacy policy", my: "ကိုယ်ရေးအချက်အလက် မူဝါဒ" }}
      intro={PRIVACY_INTRO}
      sections={PRIVACY_SECTIONS}
    />
  );
}
