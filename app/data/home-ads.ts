export type HomeAdTheme = "crimson" | "midnight" | "violet";

export type HomeAd = {
  id: string;
  eyebrow: string;
  eyebrowMy?: string;
  title: string;
  titleMy?: string;
  description: string;
  descriptionMy?: string;
  href: string;
  button: string;
  buttonMy?: string;
  /** Short highlights shown as pills under the text. */
  highlights?: string[];
  theme: HomeAdTheme;
  /** Transparent product photos drawn on the right of the slide. */
  photos?: { src: string; alt: string }[];
  /** Built-in illustration when a slide has no product photos. */
  illustration?: "desk" | "pc";
  /** Put your own 1600 x 600 banner in public/ads and enter /ads/filename.webp.
   *  A banner replaces the whole designed slide. */
  image?: string;
  imageAlt?: string;
};

const photo = (file: string) =>
  `${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""}/storage/v1/object/public/product-photos/laptops/${file}`;

// No discount or price is claimed by these store-navigation slides. Add a real
// offer only when it is approved and available.
export const homeAds: HomeAd[] = [
  {
    id: "laptops",
    eyebrow: "Business laptops",
    eyebrowMy: "လုပ်ငန်းသုံး Laptop များ",
    title: "Work-ready laptops from Dell, Lenovo and HP.",
    titleMy: "Dell၊ Lenovo နှင့် HP Laptop များ",
    description: "Latitude, ThinkPad and EliteBook models with clear specifications, photos and stock status.",
    descriptionMy: "Latitude၊ ThinkPad နှင့် EliteBook မော်ဒယ်များကို specs၊ ဓာတ်ပုံနှင့် stock အခြေအနေနှင့်အတူ ကြည့်ရှုနိုင်ပါသည်။",
    href: "/catalog/laptops",
    button: "Shop laptops",
    buttonMy: "Laptop များကြည့်ရန်",
    highlights: ["Dell", "Lenovo", "HP", "Asus"],
    theme: "crimson",
    // Use photos with transparent backgrounds here; white-background photos show a box.
    photos: [
      { src: photo("latitude-7430-angle.png"), alt: "Dell Latitude 7430" },
      { src: photo("hp-elitebook-830-g7-front.png"), alt: "HP EliteBook 830 G7" },
    ],
  },
  {
    id: "accessories",
    eyebrow: "Accessories",
    eyebrowMy: "Accessories",
    title: "The details make your desk.",
    titleMy: "သင့်စားပွဲကို ပြည့်စုံစေမည့် Accessories များ",
    description: "Monitors, keyboards, mice, headsets and bags for work, study and play.",
    descriptionMy: "Monitor၊ Keyboard၊ Mouse၊ Headset နှင့် Bag များ",
    href: "/catalog/accessories",
    button: "Explore accessories",
    buttonMy: "Accessories ကြည့်ရန်",
    highlights: ["Monitors", "Keyboards", "Mice", "Headsets"],
    theme: "midnight",
    illustration: "desk",
  },
  {
    id: "pc-parts",
    eyebrow: "PC builder",
    eyebrowMy: "Build a PC",
    title: "Build something of your own.",
    titleMy: "ကိုယ်ပိုင် PC ကို တည်ဆောက်ပါ။",
    description: "Choose a CPU, graphics card, memory and more, then check that the parts work together.",
    descriptionMy: "CPU၊ Graphics card၊ Memory စသည်တို့ကို ရွေးချယ်ပြီး ကိုက်ညီမှုကို စစ်ဆေးပါ။",
    href: "/pc-builder",
    button: "Start building",
    buttonMy: "စတင်တည်ဆောက်ရန်",
    highlights: ["CPU", "GPU", "Memory", "Storage"],
    theme: "violet",
    illustration: "pc",
  },
];
