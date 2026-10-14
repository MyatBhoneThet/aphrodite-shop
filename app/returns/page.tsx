import type { Metadata } from "next";
import { APHRODITE_BRANCHES } from "../lib/contact-info";
import ReturnsPolicyView from "./ReturnsPolicyView";

export const metadata: Metadata = {
  title: "Returns and refunds — Aphrodite Myanmar",
  description: "How to return, replace or get a refund for an Aphrodite Myanmar order, and what evidence to send.",
};

// The same numbers as the website footer; an optional email can be added with NEXT_PUBLIC_SUPPORT_EMAIL.
const supportPhones = APHRODITE_BRANCHES[0].phones.join(" / ");
const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim();

export default function ReturnsPolicyPage() {
  return <ReturnsPolicyView phones={supportPhones} email={supportEmail || undefined} />;
}
