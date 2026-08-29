import Image from "next/image";
import Link from "next/link";

const steps = [
  ["1", "Request", "Open Orders within 7 days after delivery, choose the problem, describe it, and select courier pickup or store drop-off."],
  ["2", "Review", "Aphrodite reviews the order and may ask for photos, serial numbers, or a short diagnostic check before approval."],
  ["3", "Handover", "Keep the machine, charger, accessories, packaging, and serial labels together. Back up data and remove passwords before pickup or drop-off."],
  ["4", "Inspection", "Staff records the item as received and checks the model, condition, fault, accessories, and serial number. Stock is restored only when the item is sellable."],
  ["5", "Refund", "After approval and inspection, staff records the agreed cash, bank, wallet, or store-credit refund and its reference number."],
];

export default function ReturnsPolicyPage() {
  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <header className="border-b bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4"><Link href="/"><Image src="/brand/aphrodite-myanmar.png" alt="Aphrodite Myanmar" width={218} height={77} className="h-12 w-auto" priority /></Link><div className="flex gap-2"><Link href="/orders" className="rounded-full border px-4 py-2 text-sm font-semibold">My orders</Link><Link href="/" className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white">Store</Link></div></div></header>
      <section className="mx-auto max-w-5xl px-5 py-12">
        <div className="rounded-[2rem] bg-red-600 p-8 text-white sm:p-12"><p className="text-sm font-bold uppercase tracking-[0.25em] text-red-100">Customer return policy</p><h1 className="mt-3 max-w-3xl text-4xl font-black sm:text-5xl">A clear process for wrong, damaged, or faulty machines.</h1><p className="mt-5 max-w-2xl text-red-50">Request an eligible return within 7 calendar days after the delivery time shown in your order.</p></div>

        <div className="mt-8 grid gap-5 md:grid-cols-2">
          <article className="rounded-3xl bg-white p-6 shadow-sm"><h2 className="text-xl font-black text-emerald-700">Eligible reasons</h2><ul className="mt-4 space-y-2 text-sm text-zinc-700"><li>• The machine is defective or shows a confirmed error.</li><li>• The delivered product is not the model ordered.</li><li>• Colour or storage size does not match the order.</li><li>• The item was damaged in delivery.</li><li>• Another documented seller or fulfilment error.</li></ul></article>
          <article className="rounded-3xl bg-white p-6 shadow-sm"><h2 className="text-xl font-black text-red-700">Normally not eligible</h2><ul className="mt-4 space-y-2 text-sm text-zinc-700"><li>• Change of mind after opening or using the item.</li><li>• Damage caused after delivery, liquid damage, or unauthorised repair.</li><li>• Missing serial labels, charger, included accessories, or evidence of the order.</li><li>• A request made after the 7-day return window; warranty support may still apply.</li></ul></article>
        </div>

        <section className="mt-10"><h2 className="text-3xl font-black">How the return works</h2><div className="mt-5 space-y-4">{steps.map(([number, title, text]) => <article key={number} className="grid gap-4 rounded-3xl bg-white p-6 shadow-sm sm:grid-cols-[3rem_1fr]"><span className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-950 text-lg font-black text-white">{number}</span><div><h3 className="text-lg font-black">{title}</h3><p className="mt-1 text-sm leading-6 text-zinc-600">{text}</p></div></article>)}</div></section>

        <section className="mt-10 rounded-3xl border border-amber-200 bg-amber-50 p-7"><h2 className="text-xl font-black">Refund timing and method</h2><p className="mt-3 text-sm leading-6 text-amber-950">The website records a refund only after the returned item is received and inspected. Cash-on-delivery money is returned by the method agreed with the customer: cash, bank transfer, mobile wallet, or store credit. The payment itself must be completed by authorised staff; the order record keeps the amount, method, date, and reference. Bank or wallet processing time may depend on the provider.</p></section>
        <section className="mt-6 rounded-3xl bg-zinc-950 p-7 text-white"><h2 className="text-xl font-black">Protect your data</h2><p className="mt-3 text-sm leading-6 text-zinc-300">Back up files, sign out of personal accounts, remove activation locks and passwords, and remove SIM or memory cards before handover. Aphrodite is not responsible for customer data left on a returned device.</p><Link href="/orders" className="mt-5 inline-block rounded-full bg-red-600 px-6 py-3 text-sm font-bold">Open my orders</Link></section>
        <p className="mt-8 text-xs leading-5 text-zinc-500">This store policy is a practical operating template and does not reduce any mandatory consumer rights that apply in the customer&apos;s location. Aphrodite Myanmar should have the final wording reviewed for its local business and warranty obligations before publication.</p>
      </section>
    </main>
  );
}
