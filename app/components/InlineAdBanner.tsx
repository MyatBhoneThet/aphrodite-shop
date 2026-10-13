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
  // prev/dir drive the sideways transition: the previous slide leaves as the new one enters.
  const [{ index, prev, dir }, setSlide] = useState({ index: 0, prev: -1, dir: 1 });
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
          setSlide({ index: 0, prev: -1, dir: 1 });
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
      if (!document.hidden) setSlide((slide) => ({ index: (slide.index + 1) % count, prev: slide.index, dir: 1 }));
    }, 6000);
    return () => window.clearInterval(timer);
  }, [count, playing, index]);

  if (!active) return null;
  const go = (to: number, direction: number) => setSlide((slide) => (to === slide.index ? slide : { index: to, prev: slide.index, dir: direction }));
  const move = (amount: number) => go((index + amount + count) % count, amount);
  const way = dir > 0 ? "next" : "prev";

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
        <div className="relative aspect-[3/1] w-full overflow-hidden bg-zinc-950">
          {visibleAds.map((ad, position) => (
            <a
              key={ad.id}
              href={ad.href}
              aria-label={ad.title}
              inert={position !== activeIndex}
              aria-hidden={position !== activeIndex}
              className={`absolute inset-0 block bg-zinc-950 ${position === activeIndex ? `z-10 ${prev >= 0 ? `ad-in-${way}` : ""}` : position === prev ? `ad-out-${way}` : "invisible"}`}
            >
              <img
                src={ad.image_url}
                alt={ad.alt_text}
                className="absolute inset-0 h-full w-full object-contain"
                onError={() => { setFailed((items) => items.includes(ad.id) ? items : [...items, ad.id]); setSlide({ index: 0, prev: -1, dir: 1 }); }}
              />
            </a>
          ))}
        </div>

        {count > 1 && (
          <div className="absolute bottom-2 left-2 z-20 flex gap-1 sm:bottom-4 sm:left-4 sm:gap-2">
            {/* No disc behind the arrows; the text shadow keeps them readable on light artwork. */}
            <button type="button" onClick={() => move(-1)} aria-label="Previous advertisement" className="grid h-11 w-11 place-items-center rounded-full text-2xl font-bold text-white [text-shadow:0_1px_4px_rgb(0_0_0/.9)] transition hover:text-red-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white motion-reduce:transition-none">←</button>
            <button type="button" onClick={() => move(1)} aria-label="Next advertisement" className="grid h-11 w-11 place-items-center rounded-full text-2xl font-bold text-white [text-shadow:0_1px_4px_rgb(0_0_0/.9)] transition hover:text-red-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white motion-reduce:transition-none">→</button>
          </div>
        )}

        {count > 1 && <div className="pointer-events-none absolute inset-x-0 bottom-1 z-20 flex items-center justify-end gap-2 bg-transparent px-2 sm:justify-center sm:gap-3 sm:px-4">
          <span className="pointer-events-auto rounded-full bg-black/70 px-3 py-2 text-xs font-bold text-white shadow-lg shadow-black/30 backdrop-blur sm:hidden" aria-live="polite">{activeIndex + 1} / {count}</span>
          <div className="pointer-events-auto hidden gap-2 sm:flex" aria-label="Choose advertisement">
            {visibleAds.map((ad, position) => (
              <button type="button" key={ad.id} aria-label={`Show advertisement ${position + 1}: ${ad.title}`} aria-pressed={position === activeIndex}
                onClick={() => go(position, position > activeIndex ? 1 : -1)} className="flex h-11 min-w-11 items-center justify-center">
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
