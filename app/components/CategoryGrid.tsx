const categories = [
  { en: "Laptops", my: "လက်ပ်တော့များ", icon: "💻", href: "/catalog/laptops" },
  { en: "Gaming", my: "Gaming", icon: "🎮", href: "/#laptops" },
  { en: "Office Laptop", my: "ရုံးသုံး Laptop", icon: "🏢", href: "/#laptops" },
  { en: "Accessories", my: "Accessories", icon: "⌨️", href: "/catalog/accessories" },
  { en: "PC Parts", my: "PC Parts", icon: "🖥️", href: "/catalog/pc-parts" },
  { en: "Build a PC", my: "PC တည်ဆောက်ရန်", icon: "🧩", href: "/pc-builder" },
];

export default function CategoryGrid({ language }: { language: "en" | "my" }) {
  return (
    <section className="mx-auto max-w-7xl px-5 py-16">
      <h2 className="mb-8 text-center text-4xl font-bold">
        {language === "en" ? "Categories" : "အမျိုးအစားများ"}
      </h2>

      <div className="grid grid-cols-2 gap-5 md:grid-cols-3 xl:grid-cols-6">
        {categories.map((category) => (
          <a
            key={category.en}
            href={category.href}
            className="rounded-[2rem] bg-zinc-100 p-8 text-center transition hover:-translate-y-1 hover:shadow-xl"
          >
            <div className="text-5xl">{category.icon}</div>

            <h3 className="mt-4 font-bold">
              {language === "en" ? category.en : category.my}
            </h3>
          </a>
        ))}
      </div>
    </section>
  );
}
