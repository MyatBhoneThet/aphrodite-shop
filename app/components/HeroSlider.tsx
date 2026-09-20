"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { homeAds, type HomeAd, type HomeAdTheme } from "../data/home-ads";

const themes: Record<HomeAdTheme, { background: string; glow: string; accent: string; button: string }> = {
  crimson: {
    background: "bg-[radial-gradient(120%_120%_at_85%_20%,#7f1d1d_0%,#1c1017_45%,#0b0b0f_100%)]",
    glow: "bg-red-500/30",
    accent: "text-red-300",
    button: "bg-red-600 hover:bg-red-500",
  },
  midnight: {
    background: "bg-[radial-gradient(120%_120%_at_85%_20%,#1e3a8a_0%,#0f172a_45%,#05070d_100%)]",
    glow: "bg-sky-400/25",
    accent: "text-sky-300",
    button: "bg-sky-600 hover:bg-sky-500",
  },
  violet: {
    background: "bg-[radial-gradient(120%_120%_at_85%_20%,#5b21b6_0%,#1e1235_45%,#08060f_100%)]",
    glow: "bg-fuchsia-500/25",
    accent: "text-fuchsia-300",
    button: "bg-fuchsia-600 hover:bg-fuchsia-500",
  },
};

export default function HeroSlider({ language }: { language: "en" | "my" }) {
  const [index, setIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(true);
  const [failedImages, setFailedImages] = useState<string[]>([]);
  const count = homeAds.length;
  const active = homeAds[index % Math.max(1, count)];
  const playing = count > 1 && !hovered && !focused && !reducedMotion;

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) setIndex(value => (value + 1) % count);
    }, 6000);
    return () => window.clearInterval(timer);
  }, [count, playing, index]);

  if (!active) return null;
  const text = (en: string, mm?: string) => (language === "my" ? mm ?? en : en);
  const move = (amount: number) => { setIndex(value => (value + amount + count) % count); };
  const failed = (src: string) => setFailedImages(value => (value.includes(src) ? value : [...value, src]));
  const theme = themes[active.theme];


  return (
    <section className="mx-auto max-w-7xl px-5 pt-6" aria-label="Store highlights">
      <div aria-roledescription="carousel" aria-label="Advertisements"
        className={`relative isolate overflow-hidden rounded-3xl text-white shadow-xl ring-1 ring-black/5 transition-colors duration-700 ${theme.background}`}
        onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
        onFocusCapture={() => setFocused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}>
        <div className={`pointer-events-none absolute -right-16 -top-24 -z-10 h-80 w-80 rounded-full blur-3xl ${theme.glow}`} />
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_right,rgba(255,255,255,.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,.04)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_at_70%_40%,black,transparent_75%)]" />

        <div className="grid">
        {homeAds.map((ad, position) => {
          const active = ad;
          const title = text(ad.title, ad.titleMy);
          const theme = themes[ad.theme];
          const photos = (ad.photos ?? []).filter(photo => !failedImages.includes(photo.src));
          return <div key={ad.id} inert={position !== index} aria-hidden={position !== index}
            className={`col-start-1 row-start-1 ${position === index ? "visible" : "invisible"}`}
            role="group" aria-roledescription="slide" aria-label={`${position + 1} of ${count}: ${title}`}>

          {active.image && !failedImages.includes(active.image) ? (
            <Link href={active.href} className="block aspect-[8/3] bg-zinc-950">
              {/* Uploaded advertisements must remain fully visible, without cropping their text. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={active.image} alt={active.imageAlt ?? title} className="h-full w-full object-contain" onError={() => failed(active.image!)} />
            </Link>
          ) : (
            <div className="grid h-full min-h-[22rem] items-center gap-6 px-7 py-10 md:min-h-[24rem] md:grid-cols-[1.05fr_.95fr] md:px-12">
              <div className="hero-rise relative z-10 max-w-xl">
                <p className={`inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] ring-1 ring-white/15 backdrop-blur ${theme.accent}`}>
                  <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />{text(active.eyebrow, active.eyebrowMy)}
                </p>
                <h1 className="mt-5 text-3xl font-black leading-[1.08] tracking-tight md:text-5xl">{title}</h1>
                <p className="mt-4 max-w-lg text-sm leading-6 text-white/75 md:text-base">{text(active.description, active.descriptionMy)}</p>
                {active.highlights && <ul className="mt-5 flex flex-wrap gap-2" aria-label="Highlights">
                  {active.highlights.map(item => <li key={item} className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-white/85">{item}</li>)}
                </ul>}
                <div className="mt-7 flex flex-wrap gap-3">
                  <Link href={active.href} className={`rounded-full px-6 py-3 text-sm font-bold shadow-lg shadow-black/30 transition ${theme.button}`}>{text(active.button, active.buttonMy)} →</Link>
                </div>
              </div>
              <div className="relative mx-auto hidden h-72 w-full max-w-md md:block" aria-hidden="true">
                <SlideVisual ad={active} photos={photos} onFail={failed} />
              </div>
            </div>
          )}
        </div>

        ;})}
        </div>

        {count > 1 && <div className="relative flex items-center justify-between gap-3 border-t border-white/10 bg-black/25 px-4 py-2 backdrop-blur">
          <div className="flex gap-1">
            <button type="button" onClick={() => move(-1)} aria-label="Previous advertisement" className="h-10 w-10 rounded-full transition hover:bg-white/15">←</button>
            <button type="button" onClick={() => move(1)} aria-label="Next advertisement" className="h-10 w-10 rounded-full transition hover:bg-white/15">→</button>
          </div>
          <div className="flex gap-2" aria-label="Choose advertisement">
            {homeAds.map((ad, position) => (
              <button type="button" key={ad.id} aria-label={`Show slide ${position + 1}: ${ad.title}`} aria-pressed={position === index}
                onClick={() => setIndex(position)} className="flex h-10 items-center">
                <span className={`relative h-1.5 overflow-hidden rounded-full bg-white/25 transition-all ${position === index ? "w-12" : "w-5"}`}>
                  {position === index && <span key={`${index}-${playing}`} className={`absolute inset-0 rounded-full bg-white ${playing ? "hero-progress" : ""}`} />}
                </span>
              </button>
            ))}
          </div>
        </div>}
      </div>
    </section>
  );
}

function SlideVisual({ ad, photos, onFail }: { ad: HomeAd; photos: { src: string; alt: string }[]; onFail: (src: string) => void }) {
  if (photos.length > 0) {
    const [front, back] = photos;
    return (
      <div className="hero-float absolute inset-0">
        <div className="absolute inset-x-8 bottom-2 h-10 rounded-[50%] bg-black/50 blur-2xl" />
        {back && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={back.src} alt="" onError={() => onFail(back.src)} className="absolute right-0 top-2 w-[62%] -rotate-3 object-contain opacity-90 drop-shadow-2xl" />
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={front.src} alt="" onError={() => onFail(front.src)} className={`absolute bottom-4 left-0 object-contain drop-shadow-[0_30px_40px_rgba(0,0,0,.55)] ${back ? "w-[72%]" : "w-full"}`} />
      </div>
    );
  }
  return (
    <svg viewBox="0 0 480 300" className="hero-float h-full w-full drop-shadow-2xl" role="presentation">
      <defs>
        <linearGradient id={`screen-${ad.id}`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor={ad.illustration === "pc" ? "#e879f9" : "#38bdf8"} />
          <stop offset="1" stopColor={ad.illustration === "pc" ? "#6d28d9" : "#1d4ed8"} />
        </linearGradient>
      </defs>
      {ad.illustration === "pc" ? (
        <g>
          <rect x="150" y="20" width="180" height="260" rx="18" fill="#18181b" stroke="#52525b" strokeWidth="4" />
          <rect x="168" y="40" width="144" height="220" rx="10" fill="#09090b" />
          {[80, 150, 220].map(cy => (
            <g key={cy}>
              <circle cx="240" cy={cy} r="30" fill="none" stroke={`url(#screen-${ad.id})`} strokeWidth="6" />
              <circle cx="240" cy={cy} r="8" fill="#f5f5f5" opacity=".85" />
              <path d={`M240 ${cy - 22}q14 12 0 22q-14 10 0 22`} stroke="#a1a1aa" strokeWidth="3" fill="none" opacity=".6" />
            </g>
          ))}
          <rect x="60" y="120" width="70" height="44" rx="6" fill="#27272a" stroke="#71717a" strokeWidth="3" />
          <path d="M72 132h46M72 142h46M72 152h30" stroke={`url(#screen-${ad.id})`} strokeWidth="4" strokeLinecap="round" />
          <rect x="350" y="150" width="84" height="30" rx="6" fill="#27272a" stroke="#71717a" strokeWidth="3" />
          <path d="M360 165h64" stroke={`url(#screen-${ad.id})`} strokeWidth="6" strokeLinecap="round" />
        </g>
      ) : (
        <g>
          <rect x="70" y="20" width="340" height="190" rx="14" fill="#18181b" stroke="#52525b" strokeWidth="4" />
          <rect x="86" y="36" width="308" height="158" rx="6" fill={`url(#screen-${ad.id})`} opacity=".9" />
          <path d="M110 160l60-50 40 30 60-60 90 80" stroke="#f8fafc" strokeWidth="5" fill="none" opacity=".75" strokeLinejoin="round" />
          <path d="M225 210h30l10 40h-50z" fill="#3f3f46" />
          <rect x="175" y="248" width="130" height="10" rx="5" fill="#52525b" />
          <rect x="60" y="266" width="260" height="26" rx="8" fill="#27272a" stroke="#71717a" strokeWidth="3" />
          <path d="M76 279h228" stroke="#a1a1aa" strokeWidth="3" strokeDasharray="10 6" />
          <rect x="345" y="262" width="34" height="32" rx="16" fill="#27272a" stroke="#71717a" strokeWidth="3" />
        </g>
      )}
    </svg>
  );
}
