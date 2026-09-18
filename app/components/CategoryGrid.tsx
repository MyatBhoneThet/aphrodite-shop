const categories = [
  // Product words stay in English in both languages, at the shop's request.
  { en: "Laptops", my: "Laptops", icon: "💻", href: "/catalog/laptops" },
  { en: "Accessories", my: "Accessories", icon: "⌨️", href: "/catalog/accessories" },
  { en: "PC Parts", my: "PC Parts", icon: "🖥️", href: "/catalog/pc-parts" },
  { en: "Build a PC", my: "Build a PC", icon: "🧩", href: "/pc-builder" },
];

export default function CategoryGrid({ language }: { language: "en" | "my" }) {
  return (
    <section className="mx-auto max-w-7xl px-5 py-16">
      <h2 className="mb-8 text-center text-4xl font-bold">
        {language === "en" ? "Categories" : "အမျိုးအစားများ"}
      </h2>

      <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
        {categories.map((category) => (
          <a
            key={category.en}
            href={category.href}
            className="rounded-[2rem] bg-zinc-100 px-3 py-6 sm:p-8 text-center transition hover:-translate-y-1 hover:shadow-xl"
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
