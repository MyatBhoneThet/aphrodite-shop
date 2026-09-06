"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { homeAds } from "../data/home-ads";

export default function HeroSlider({ language }: { language: "en" | "my" }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(true);
  const [failedImages, setFailedImages] = useState<string[]>([]);
  const count = homeAds.length;
  const active = homeAds[index % Math.max(1, count)];

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (count < 2 || paused || hovered || focused || reducedMotion) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) setIndex(value => (value + 1) % count);
    }, 6000);
    return () => window.clearInterval(timer);
  }, [count, paused, hovered, focused, reducedMotion]);

  if (!active) return null;
  const title = language === "my" ? active.titleMy ?? active.title : active.title;
  const description = language === "my" ? active.descriptionMy ?? active.description : active.description;
  const button = language === "my" ? active.buttonMy ?? active.button : active.button;
  const move = (amount: number) => { setPaused(true); setIndex(value => (value + amount + count) % count); };

  return (
    <section className="mx-auto max-w-7xl px-5 pt-6" aria-label="Store highlights" aria-roledescription="carousel"
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}>
      <div className="relative overflow-hidden rounded-xl bg-[#17181c] text-white shadow-lg">
        <div role="group" aria-roledescription="slide" aria-label={`${index + 1} of ${count}`}>
        {active.image && !failedImages.includes(active.image) ? (
          <Link href={active.href} className="block aspect-[8/3] bg-zinc-950">
            {/* Uploaded advertisements must remain fully visible, without cropping their text. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={active.image} alt={active.imageAlt ?? title} className="h-full w-full object-contain" onError={() => setFailedImages(value => [...value, active.image!])} />
          </Link>
        ) : <>
        <div className="absolute -right-10 -top-20 h-72 w-72 rounded-full bg-red-600/20 blur-3xl" />
        <div className="relative grid min-h-80 items-center gap-6 px-7 py-10 md:aspect-[8/3] md:grid-cols-[1.2fr_.8fr] md:px-14">
          <div className="relative z-10 max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-red-300">APHRODITE MYANMAR</p>
            <h1 className="mt-4 text-3xl font-black leading-tight tracking-tight md:text-5xl">{title}</h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-zinc-300 md:text-base">{description}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href={active.href} className="rounded-full bg-red-600 px-6 py-3 text-sm font-bold transition hover:bg-red-500">{button}</Link>
              {active.id === "welcome" && <Link href="/pc-builder" className="rounded-full border border-white/30 px-6 py-3 text-sm font-bold transition hover:border-white">{language === "en" ? "Build a PC" : "PC တည်ဆောက်ရန်"}</Link>}
            </div>
          </div>
          <div className="relative mx-auto hidden w-full max-w-md md:block" aria-hidden="true">
            <svg viewBox="0 0 520 330" className="h-auto w-full drop-shadow-2xl" role="presentation">
              <defs><linearGradient id="hero-laptop" x1="0" x2="1"><stop stopColor="#ef4444"/><stop offset="1" stopColor="#991b1b"/></linearGradient></defs>
              <path d="M95 72h330c9 0 16 7 16 16v172H79V88c0-9 7-16 16-16Z" fill="#27282d" stroke="#71717a" strokeWidth="5"/>
              <path d="M112 94h296v140H112z" fill="#09090b"/><path d="M134 116h252v96H134z" fill="url(#hero-laptop)" opacity=".9"/>
              <path d="M35 260h450l-30 39H65z" fill="#3f3f46" stroke="#a1a1aa" strokeWidth="5"/><path d="M236 271h48l8 9h-64z" fill="#71717a"/>
              <circle cx="260" cy="164" r="26" fill="#f4f4f5" opacity=".9"/><path d="m252 164 8-8 8 8-8 8z" fill="#ef4444"/>
            </svg>
          </div>
        </div>
        </>}
        </div>
        {count > 1 && <div className="relative flex items-center justify-between border-t border-white/10 bg-zinc-950/50 px-4 py-2">
          <div className="flex gap-1">
            <button type="button" onClick={() => move(-1)} aria-label="Previous advertisement" className="h-10 w-10 rounded-full hover:bg-white/15">←</button>
            <button type="button" onClick={() => move(1)} aria-label="Next advertisement" className="h-10 w-10 rounded-full hover:bg-white/15">→</button>
          </div>
          <div className="flex gap-1" aria-label="Choose advertisement">{homeAds.map((ad, position) => <button type="button" key={ad.id} aria-label={`Show slide ${position + 1}: ${ad.title}`} aria-pressed={position === index} onClick={() => { setIndex(position); setPaused(true); }} className="flex h-10 w-8 items-center justify-center"><span className={`h-2 rounded-full ${position === index ? "w-6 bg-white" : "w-2 bg-white/40"}`} /></button>)}</div>
          <button type="button" className="rounded-full px-3 py-2 text-xs font-semibold hover:bg-white/15" onClick={() => setPaused(value => !value)} disabled={reducedMotion} aria-label={paused ? "Play slideshow" : "Pause slideshow"}>{reducedMotion ? "Manual" : paused ? "Play" : "Pause"}</button>
        </div>}
      </div>
    </section>
  );
}
