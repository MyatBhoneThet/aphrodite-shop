"use client";

import { useEffect, useRef, useState } from "react";
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
  const [slides, setSlides] = useState<HomeAd[]>(homeAds);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(true);
  const [failedImages, setFailedImages] = useState<string[]>([]);
  const bannerRef = useRef<HTMLDivElement>(null);
  const [bannerWidth, setBannerWidth] = useState(0);
  const count = slides.length;
  const active = slides[index % Math.max(1, count)];
  const playing = count > 1 && !hovered && !focused && !reducedMotion;

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const banner = bannerRef.current;
    if (!banner) return;
    const observer = new ResizeObserver(([entry]) => {
      setBannerWidth(entry.contentRect.width);
    });
    observer.observe(banner);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/home-ads", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return;
        const data = await response.json() as {
          ads?: { id: string; title: string; alt_text: string; image_url: string; href: string }[];
        };
        if (cancelled || !data.ads?.length) return;
        const customSlides: HomeAd[] = data.ads.map((ad) => ({
          id: `custom-${ad.id}`,
          eyebrow: "Aphrodite Myanmar",
          title: ad.title,
          description: "",
          href: ad.href,
          button: "View offer",
          theme: "crimson",
          image: ad.image_url,
          imageAlt: ad.alt_text,
        }));
        setSlides([...customSlides, ...homeAds]);
        setIndex(0);
      })
      .catch(() => {});
    return () => { cancelled = true; };
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
    <section className="mx-auto max-w-7xl px-3 pt-4 sm:px-5 sm:pt-6" aria-label="Store highlights">
      <div ref={bannerRef} aria-roledescription="carousel" aria-label="Advertisements"
        className={`relative isolate overflow-hidden rounded-2xl text-white shadow-xl ring-1 ring-black/5 transition-colors duration-700 sm:rounded-3xl ${theme.background}`}
        onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
        onFocusCapture={() => setFocused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}>
        <div className={`pointer-events-none absolute -right-16 -top-24 -z-10 h-80 w-80 rounded-full blur-3xl ${theme.glow}`} />
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_right,rgba(255,255,255,.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,.04)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_at_70%_40%,black,transparent_75%)]" />

        <div className="relative grid">
        {slides.map((ad, position) => {
          const active = ad;
          const title = text(ad.title, ad.titleMy);
          const theme = themes[ad.theme];
          const photos = (ad.photos ?? []).filter(photo => !failedImages.includes(photo.src));
          return <div key={ad.id} inert={position !== index} aria-hidden={position !== index}
            className={position === index ? "relative col-start-1 row-start-1 visible" : "invisible absolute inset-0"}
            role="group" aria-roledescription="slide" aria-label={`${position + 1} of ${count}: ${title}`}>

          {active.image && !failedImages.includes(active.image) ? (
            <Link
              href={active.href}
              className="relative block aspect-[3/1] w-full overflow-hidden bg-zinc-950"
            >
              {/* A 1800 × 600 banner fills this fixed 3:1 frame without cropping. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={active.image} alt={active.imageAlt ?? title} className="absolute inset-0 h-full w-full object-contain" onError={() => failed(active.image!)} />
            </Link>
          ) : (
            <div className="relative aspect-[3/1] w-full overflow-hidden">
              <div
                className="absolute left-0 top-0 grid h-[600px] w-[1800px] origin-top-left grid-cols-[1.05fr_.95fr] items-center gap-16 bg-cover bg-center px-24 pb-14 pt-12"
                style={{ transform: `scale(${bannerWidth / 1800})`, ...(active.backgroundImage ? { backgroundImage: `url(${active.backgroundImage})` } : {}) }}
              >
                {active.backgroundImage && <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/55 via-black/10 to-transparent" aria-hidden="true" />}
                <div className="hero-rise relative z-10 max-w-[850px]">
                  <p className={`inline-flex items-center gap-3 rounded-full bg-white/10 px-5 py-2 text-[18px] font-bold uppercase tracking-[0.2em] ring-1 ring-white/15 backdrop-blur ${theme.accent}`}>
                    <span className="h-2.5 w-2.5 rounded-full bg-current" aria-hidden="true" />{text(active.eyebrow, active.eyebrowMy)}
                  </p>
                  <h1 className="mt-4 text-[52px] font-black leading-[1.06] tracking-tight">{title}</h1>
                  <p className="mt-4 max-w-[800px] text-[22px] leading-8 text-white/75">{text(active.description, active.descriptionMy)}</p>
                  {active.highlights && <ul className="mt-4 flex flex-wrap gap-3" aria-label="Highlights">
                    {active.highlights.map(item => <li key={item} className="rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-[18px] font-semibold text-white/85">{item}</li>)}
                  </ul>}
                  <div className="mt-5 flex flex-wrap gap-3">
                    <Link href={active.href} className={`rounded-full px-8 py-4 text-[20px] font-bold shadow-lg shadow-black/30 transition ${theme.button}`}>{text(active.button, active.buttonMy)} →</Link>
                  </div>
                </div>
                {!active.backgroundImage && <div className="relative mx-auto h-[480px] w-full max-w-[750px]" aria-hidden="true">
                  <SlideVisual ad={active} photos={photos} onFail={failed} />
                </div>}
              </div>
            </div>
          )}
        </div>

        ;})}
        </div>

        {count > 1 && <div className="pointer-events-none absolute inset-x-0 bottom-1 z-20 flex items-center justify-between gap-2 bg-transparent px-2 sm:gap-3 sm:px-4">
          <div className="flex gap-1">
            <button type="button" onClick={() => move(-1)} aria-label="Previous advertisement" className="pointer-events-auto h-7 w-7 rounded-full drop-shadow-[0_1px_2px_rgba(0,0,0,.9)] transition hover:bg-black/20 sm:h-10 sm:w-10">←</button>
            <button type="button" onClick={() => move(1)} aria-label="Next advertisement" className="pointer-events-auto h-7 w-7 rounded-full drop-shadow-[0_1px_2px_rgba(0,0,0,.9)] transition hover:bg-black/20 sm:h-10 sm:w-10">→</button>
          </div>
          <div className="pointer-events-auto flex gap-2" aria-label="Choose advertisement">
            {slides.map((ad, position) => (
              <button type="button" key={ad.id} aria-label={`Show slide ${position + 1}: ${ad.title}`} aria-pressed={position === index}
                onClick={() => setIndex(position)} className="flex h-7 items-center sm:h-10">
                <span className={`relative h-1.5 overflow-hidden rounded-full bg-white/25 transition-all ${position === index ? "w-8 sm:w-12" : "w-3 sm:w-5"}`}>
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
