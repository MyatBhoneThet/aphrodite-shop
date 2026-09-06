export type HomeAd = {
  id: string;
  title: string;
  titleMy?: string;
  description: string;
  descriptionMy?: string;
  href: string;
  button: string;
  buttonMy?: string;
  /** Put your own 1600 x 600 banner in public/ads and enter /ads/filename.webp. */
  image?: string;
  imageAlt?: string;
};

// Replace these text slides with your own banner images whenever you are ready.
// No advertisement or discount is claimed by these default store-navigation slides.
export const homeAds: HomeAd[] = [
  {
    id: "welcome",
    title: "Your next setup. Make it yours.",
    titleMy: "သင့် Setup အသစ်ကို ကိုယ်တိုင်ရွေးချယ်ပါ။",
    description: "Laptops, accessories and carefully matched PC parts, with clear stock and support from our Myanmar store.",
    descriptionMy: "Laptop၊ Accessories နှင့် PC Parts များကို ရွေးချယ်ဝယ်ယူနိုင်ပါသည်။",
    href: "/catalog/laptops",
    button: "Explore laptops",
    buttonMy: "Laptop များကြည့်ရန်",
  },
  {
    id: "accessories",
    title: "The details make your desk.",
    description: "Explore accessories for work, play and everything in between.",
    href: "/catalog/accessories",
    button: "Explore accessories",
  },
  {
    id: "pc-parts",
    title: "Build something of your own.",
    description: "Browse PC parts and plan a setup around your needs.",
    href: "/pc-builder",
    button: "Build a PC",
  },
];
