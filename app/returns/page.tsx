import Image from "next/image";
import Link from "next/link";

const supportPhone = process.env.NEXT_PUBLIC_SUPPORT_PHONE ?? "Aphrodite live support";
const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "the secure support form";

const returnTypes = [
  { title: "Wrong colour, model, storage or product", timing: "Report as soon as you inspect the order and within 7 calendar days of delivery.", evidence: "Upload clear photos of the delivered product, model/serial label, packaging, and order label." },
  { title: "Defective product within 7 days", timing: "Open an RMA request within 7 calendar days of the delivery timestamp in My Orders.", evidence: "Describe the fault and upload photos or video showing the problem. Keep the continuous unboxing video when available." },
  { title: "Damaged, torn, opened or incomplete parcel", timing: "Refuse delivery when safe and report transit damage within 24 hours.", evidence: "Photograph the unopened parcel from every side and record one continuous unboxing video before handling the product further." },
];

const steps = [
  ["1", "Report", "Open My Orders, select the delivered order, choose the exact problem, explain it, and upload evidence. You can also contact support."],
  ["2", "RMA review", "Aphrodite checks the order, delivery time, serial information and evidence. Approval is not automatic."],
  ["3", "Pickup or drop-off", "After approval, staff records a courier pickup appointment or store drop-off instructions. A courier may call one day before and again before collection."],
  ["4", "Prepare the complete item", "Return the product with original packaging, foam, bags, manuals, charger and every included accessory. Back up data, sign out and remove passwords."],
  ["5", "Inspection and decision", "Staff records receipt and inspects the item, serial, accessories and reported fault. If no covered fault is found, the product may be sent back and return delivery charges may apply."],
  ["6", "Refund", "An approved refund is sent to the original payment channel where possible. For COD, staff agrees a secure bank or mobile-wallet refund method. Target completion is 15–30 days after approval and inspection."],
];

export default function ReturnsPolicyPage() {
  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <header className="border-b bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-5"><Link href="/" className="w-28 shrink-0 sm:w-auto"><Image src="/brand/aphrodite-myanmar.png" alt="Aphrodite Myanmar" width={218} height={77} className="h-9 w-auto sm:h-12" priority /></Link><div className="flex shrink-0 gap-2"><Link href="/orders" className="rounded-full border px-3 py-2 text-xs font-semibold sm:px-4 sm:text-sm">My orders</Link><Link href="/" className="rounded-full bg-zinc-900 px-3 py-2 text-xs font-semibold text-white sm:px-4 sm:text-sm">Store</Link></div></div></header>
      <section className="mx-auto max-w-5xl px-5 py-12">
        <div className="rounded-[2rem] bg-red-600 p-6 text-white sm:p-12"><p className="text-xs font-bold uppercase tracking-[0.18em] text-red-100 sm:text-sm sm:tracking-[0.25em]">Aphrodite Myanmar RMA policy</p><h1 className="mt-3 max-w-3xl text-3xl font-black sm:text-5xl">Returns for wrong, damaged, or faulty products.</h1><p className="mt-5 max-w-2xl text-sm leading-6 text-red-50 sm:text-base">Start from My Orders or contact {supportPhone} / {supportEmail}. Never send bank details or identity documents by ordinary email or chat.</p></div>
        <div className="mt-8 grid gap-5 lg:grid-cols-3">{returnTypes.map((item) => <article key={item.title} className="rounded-3xl bg-white p-6 shadow-sm"><h2 className="text-xl font-black">{item.title}</h2><p className="mt-4 text-sm font-semibold text-red-700">{item.timing}</p><p className="mt-3 text-sm leading-6 text-zinc-600">{item.evidence}</p></article>)}</div>
        <section className="mt-10 rounded-3xl border border-amber-200 bg-amber-50 p-6"><h2 className="text-xl font-black">Transit damage evidence</h2><p className="mt-3 text-sm leading-6 text-amber-950">Inspect the parcel before accepting it. If it is badly damaged, opened or incomplete, ask the courier to record refusal and contact Aphrodite immediately. A continuous unboxing video is important evidence, but every request is reviewed fairly against the available order and courier records.</p></section>
        <section className="mt-10"><h2 className="text-3xl font-black">RMA process</h2><div className="mt-5 space-y-4">{steps.map(([number, title, text]) => <article key={number} className="grid gap-4 rounded-3xl bg-white p-6 shadow-sm sm:grid-cols-[3rem_1fr]"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-zinc-950 text-lg font-black text-white">{number}</span><div><h3 className="text-lg font-black">{title}</h3><p className="mt-1 text-sm leading-6 text-zinc-600">{text}</p></div></article>)}</div></section>
        <section className="mt-10 grid gap-5 md:grid-cols-2"><article className="rounded-3xl bg-white p-7 shadow-sm"><h2 className="text-xl font-black">Refund information for COD</h2><p className="mt-3 text-sm leading-6 text-zinc-600">After approval, staff can request the account holder name, bank or wallet provider, account number and phone through a secure authenticated form. Access must be limited to authorised refund staff and retained only as required. Do not upload a full bank statement or national ID unless legally required and a secure, documented process exists.</p></article><article className="rounded-3xl bg-white p-7 shadow-sm"><h2 className="text-xl font-black">Normally not eligible</h2><p className="mt-3 text-sm leading-6 text-zinc-600">Change of mind after use, customer-caused damage, liquid damage, unauthorised repair, missing serial labels or material missing accessories are normally excluded. Warranty rights may still apply after the 7-day online RMA window.</p></article></section>
        <section className="mt-6 rounded-3xl bg-zinc-950 p-7 text-white"><h2 className="text-xl font-black">Protect your data</h2><p className="mt-3 text-sm leading-6 text-zinc-300">Back up files, sign out of personal accounts, remove activation locks and passwords, and remove SIM or memory cards before handover.</p><Link href="/orders" className="mt-5 inline-block rounded-full bg-red-600 px-6 py-3 text-sm font-bold">Open my orders</Link></section>
        <p className="mt-8 text-xs leading-5 text-zinc-500">This operational policy is original Aphrodite wording, not Banana/BNN policy. It must be reviewed for Myanmar consumer, privacy, warranty, tax and transport requirements before publication and does not reduce mandatory customer rights.</p>
      </section>
    </main>
  );
}
