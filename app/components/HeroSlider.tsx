const ads = [
  {
    titleEn: "Shop your favorite laptops.",
    titleMy: "သင်ကြိုက်တဲ့ လက်ပ်တော့များကို ဝယ်ယူပါ။",
    subtitleEn: "Special discounts for selected products.",
    subtitleMy: "ရွေးချယ်ထားသော ပစ္စည်းများအတွက် အထူးလျှော့စျေး။",
  },
  {
    titleEn: "Aphrodite Laptop Sale",
    titleMy: "Aphrodite Laptop Sale",
    subtitleEn: "Best price for students, office and business.",
    subtitleMy: "ကျောင်းသား၊ ရုံးသုံး၊ စီးပွားရေးအတွက် အကောင်းဆုံးစျေးနှုန်း။",
  },
  {
    titleEn: "Accessories for your setup.",
    titleMy: "သင့် Laptop Setup အတွက် Accessories များ။",
    subtitleEn: "Mouse, keyboard, laptop bag and more.",
    subtitleMy: "Mouse, Keyboard, Laptop Bag နှင့် အခြားပစ္စည်းများ။",
  },
];

export default function HeroSlider({ language }: { language: "en" | "my" }) {
  return (
    <section className="mx-auto max-w-7xl px-5 pt-6">
      <div className="overflow-hidden rounded-[2rem] bg-red-600 text-white">
        <div className="flex animate-hero-slide">
          {ads.map((ad, index) => (
            <div
              key={index}
              className="flex min-w-full flex-col items-center justify-center px-6 py-24 text-center md:py-32"
            >
              <p className="mb-4 text-sm uppercase tracking-[0.3em]">
                Aphrodite Store
              </p>

              <h1 className="max-w-4xl text-4xl font-bold md:text-6xl">
                {language === "en" ? ad.titleEn : ad.titleMy}
              </h1>

              <p className="mt-5 text-lg">
                {language === "en" ? ad.subtitleEn : ad.subtitleMy}
              </p>

              <a
                href="#laptops"
                className="mt-8 rounded-full bg-white px-7 py-3 font-semibold text-red-600"
              >
                {language === "en" ? "Shop Now" : "ယခု ဝယ်ယူရန်"}
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}