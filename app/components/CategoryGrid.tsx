const categories = [
  { en: "Laptops", my: "လက်ပ်တော့များ", detail: "Work anywhere. Play everywhere.", detailMy: "အလုပ်နှင့် ဂိမ်းအတွက်", href: "/catalog/laptops", kind: "laptop" },
  { en: "Accessories", my: "ဆက်စပ်ပစ္စည်းများ", detail: "Small upgrades. Big difference.", detailMy: "သင့်စက်အတွက် ဖြည့်စွက်ပစ္စည်းများ", href: "/catalog/accessories", kind: "keyboard" },
  { en: "PC Parts", my: "ကွန်ပျူတာ အစိတ်အပိုင်းများ", detail: "Power your next upgrade.", detailMy: "သင့်ကွန်ပျူတာကို အဆင့်မြှင့်ရန်", href: "/catalog/pc-parts", kind: "chip" },
  { en: "Build a PC", my: "ကွန်ပျူတာ ဆင်ရန်", detail: "Your budget. Your perfect build.", detailMy: "သင့်ဘတ်ဂျက်နှင့် ကိုက်ညီသော PC", href: "/pc-builder", kind: "tower" },
];

/** Lightweight vector illustrations stay crisp without loading product photos. */
function HardwareIllustration({ kind }: { kind: string }) {
  return <svg viewBox="0 0 240 140" fill="none" aria-hidden="true" className="h-full w-full" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
    {kind === "laptop" && <>
      <rect x="48" y="20" width="144" height="92" rx="7" fill="#27272a" />
      <path d="M57 29h126v73H57z" fill="#18181b" stroke="#52525b" />
      <path d="m67 85 35-40 31 23 37-29" stroke="#ef4444" strokeWidth="3" />
      <path d="M48 112h144l20 13H28z" fill="#d4d4d8" /><path d="M28 125h184M99 113h42" />
    </>}
    {kind === "keyboard" && <>
      <path d="m35 48 150-12 18 69-158 13z" fill="#fafafa" />
      {[0, 1, 2, 3].map(row => <g key={row}>{Array.from({ length: 10 }, (_, col) => <path key={col} d={`m${46 + col * 14 + row * 2} ${58 + row * 12 - col} 9-.7 1.5 7-9 .7z`} fill={col === 0 ? "#ef4444" : "#d4d4d8"} stroke="none" />)}</g>)}
      <path d="m80 105 75-6" strokeWidth="5" strokeLinecap="round" />
      <rect x="209" y="44" width="22" height="39" rx="11" fill="#e4e4e7" /><path d="M220 45v12" stroke="#ef4444" />
    </>}
    {kind === "chip" && <>
      <path d="m120 15 78 43v37l-78 32-78-43V47z" fill="#f4f4f5" stroke="#d4d4d8" />
      <rect x="80" y="32" width="80" height="80" rx="7" fill="#27272a" />
      <rect x="94" y="46" width="52" height="52" rx="3" stroke="#ef4444" />
      {[0, 1, 2, 3, 4, 5].map(i => <path key={i} d={`M${90+i*12} 24v8m0 80v8M72 ${42+i*12}h8m80 0h8`} stroke="#71717a" strokeWidth="3" />)}
      <path d="m110 73 7 7 14-17" stroke="white" strokeWidth="3" />
    </>}
    {kind === "tower" && <>
      <path d="m72 20 94 8v101l-94-8z" fill="#27272a" stroke="#71717a" />
      <path d="m166 28 18-9v100l-18 10M72 20l19-9 93 8" fill="#18181b" stroke="#71717a" />
      <path d="M82 31h73v78H82z" fill="#18181b" stroke="#52525b" />
      <rect x="91" y="39" width="29" height="25" rx="2" stroke="#f87171" />
      <path d="M126 42h20M126 49h20M126 56h20M91 72h55v12H91zM91 91h34" stroke="#a1a1aa" />
      <circle cx="143" cy="98" r="8" stroke="#f87171" />
      <path d="M78 121h83M170 36v6" stroke="#f87171" strokeLinecap="round" />
      <path d="M63 128h112" stroke="#52525b" strokeWidth="3" strokeLinecap="round" />
    </>}
  </svg>;
}

export default function CategoryGrid({ language }: { language: "en" | "my" }) {
  const english = language === "en";
  return (
    <section className="mx-auto max-w-7xl px-5 pb-8 pt-12 sm:pt-16" aria-labelledby="categories-heading">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-red-600">{english ? "Explore the store" : "စတိုးဆိုင်ကို လေ့လာရန်"}</p>
          <h2 id="categories-heading" className="text-3xl font-bold tracking-tight sm:text-4xl">{english ? "Find your next upgrade." : "သင့်စက်ကို အဆင့်မြှင့်လိုက်ပါ။"}</h2>
        </div>
        <p className="text-sm text-zinc-500">{english ? "The right tech, for the way you live." : "သင့်ဘဝနှင့် ကိုက်ညီသော နည်းပညာ။"}</p>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {categories.map((category, index) => {
          const dark = category.kind === "tower";
          return <a key={category.en} href={category.href} className={`group relative flex flex-col overflow-hidden rounded-2xl border p-4 transition duration-200 hover:-translate-y-1 focus-visible:outline-red-600 motion-reduce:transform-none sm:p-5 ${dark ? "border-zinc-900 bg-zinc-950 text-white hover:border-red-500" : "border-zinc-200 bg-zinc-50 text-zinc-900 hover:border-red-300 hover:bg-white hover:shadow-lg"}`}>
            <div className="flex items-center justify-between"><span className={`text-[10px] font-bold tracking-[0.16em] ${dark ? "text-zinc-500" : "text-zinc-400"}`}>0{index + 1}</span><span className={`flex h-8 w-8 items-center justify-center rounded-full border transition group-hover:border-red-600 group-hover:bg-red-600 group-hover:text-white ${dark ? "border-zinc-700" : "border-zinc-200 bg-white"}`} aria-hidden="true">↗</span></div>
            <div className="my-2 h-28 transition duration-300 group-hover:scale-105 motion-reduce:transform-none sm:h-36"><HardwareIllustration kind={category.kind} /></div>
            <h3 className="text-base font-bold sm:text-xl">{english ? category.en : category.my}</h3>
            <p className={`mt-2 text-xs leading-relaxed sm:text-sm ${dark ? "text-zinc-400" : "text-zinc-500"}`}>{english ? category.detail : category.detailMy}</p>
          </a>;
        })}
      </div>
    </section>
  );
}
