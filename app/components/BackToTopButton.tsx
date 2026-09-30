"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "../lib/language";

export default function BackToTopButton() {
  const [visible, setVisible] = useState(false);
  const { language } = useLanguage();
  const label = language === "my" ? "အပေါ်သို့ ပြန်သွားရန်" : "Back to top";

  useEffect(() => {
    const update = () => setVisible(window.scrollY > 400);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  if (!visible) return null;

  return (
    <button type="button" aria-label={label} title={label}
      onClick={() => window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" })}
      className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-5 z-40 flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-zinc-950 text-white shadow-xl transition hover:-translate-y-1 hover:bg-red-600 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-red-600 motion-reduce:transform-none motion-reduce:transition-none sm:h-14 sm:w-14">
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
        <path d="m6 12 6-6 6 6M12 6v14" />
      </svg>
    </button>
  );
}
