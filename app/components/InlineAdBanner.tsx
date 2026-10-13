"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from "react";
import type { HomepageAdPlacement } from "../lib/homepage-ads";

type StorefrontAd = {
  id: string;
  title: string;
  alt_text: string;
  image_url: string;
  href: string;
};

export default function InlineAdBanner({ placement }: { placement: Exclude<HomepageAdPlacement, "hero"> }) {
  const [ads, setAds] = useState<StorefrontAd[]>([]);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(true);
  const [failed, setFailed] = useState<string[]>([]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/home-ads?placement=${encodeURIComponent(placement)}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return;
        const data = await response.json() as { ads?: StorefrontAd[] };
        if (!cancelled) {
          setAds(data.ads ?? []);
          setIndex(0);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [placement]);

  const visibleAds = useMemo(() => ads.filter((ad) => !failed.includes(ad.id)), [ads, failed]);
  const count = visibleAds.length;
  const active = visibleAds[index % Math.max(count, 1)];

  const playing = count > 1 && !paused && !reducedMotion;

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) setIndex((value) => (value + 1) % count);
    }, 6000);
    return () => window.clearInterval(timer);
  }, [count, playing, index]);

  if (!active) return null;
  const move = (amount: number) => setIndex((value) => (value + amount + count) % count);

  const activeIndex = index % count;

  return (
    <section className="mx-auto max-w-7xl px-3 pb-10 sm:px-5" aria-label="Store advertisement">
      <div
        className="relative isolate overflow-hidden rounded-2xl bg-zinc-950 text-white shadow-xl ring-1 ring-black/5 sm:rounded-3xl"
        aria-roledescription="carousel"
        aria-label={`${placement === "before_laptops" ? "Laptop section" : "Shopping help section"} advertisements`}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocusCapture={() => setPaused(true)}
        onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false); }}
      >
        {/* Same 1800 × 600 frame and controls as the hero slider. */}
        <a href={active.href} className="relative block aspect-[3/1] w-full overflow-hidden bg-zinc-950" aria-label={active.title}>
          <img
            src={active.image_url}
            alt={active.alt_text}
            className="absolute inset-0 h-full w-full object-contain"
            onError={() => { setFailed((items) => items.includes(active.id) ? items : [...items, active.id]); setIndex(0); }}
          />
        </a>

        {count > 1 && (
          <>
            <button type="button" onClick={() => move(-1)} aria-label="Previous advertisement" className="pointer-events-auto absolute top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white text-zinc-900 shadow-lg shadow-black/30 ring-1 ring-black/10 transition hover:bg-red-600 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white motion-reduce:transition-none left-2 sm:left-3"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><path d="m15 6-6 6 6 6" /></svg></button>
            <button type="button" onClick={() => move(1)} aria-label="Next advertisement" className="pointer-events-auto absolute top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white text-zinc-900 shadow-lg shadow-black/30 ring-1 ring-black/10 transition hover:bg-red-600 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white motion-reduce:transition-none right-2 sm:right-3"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><path d="m9 6 6 6-6 6" /></svg></button>
          </>
        )}

        {count > 1 && <div className="pointer-events-none absolute inset-x-0 bottom-1 z-20 flex items-center justify-end gap-2 bg-transparent px-2 sm:justify-center sm:gap-3 sm:px-4">
          <span className="pointer-events-auto rounded-full bg-black/70 px-3 py-2 text-xs font-bold text-white shadow-lg shadow-black/30 backdrop-blur sm:hidden" aria-live="polite">{activeIndex + 1} / {count}</span>
          <div className="pointer-events-auto hidden gap-2 sm:flex" aria-label="Choose advertisement">
            {visibleAds.map((ad, position) => (
              <button type="button" key={ad.id} aria-label={`Show advertisement ${position + 1}: ${ad.title}`} aria-pressed={position === activeIndex}
                onClick={() => setIndex(position)} className="flex h-11 min-w-11 items-center justify-center">
                <span className={`relative h-1.5 overflow-hidden rounded-full bg-white/60 shadow ring-1 ring-black/25 transition-all ${position === activeIndex ? "w-8 sm:w-12" : "w-3 sm:w-5"}`}>
                  {position === activeIndex && <span key={`${activeIndex}-${playing}`} className={`absolute inset-0 rounded-full bg-white ${playing ? "hero-progress" : ""}`} />}
                </span>
              </button>
            ))}
          </div>
        </div>}
      </div>
    </section>
  );
}
