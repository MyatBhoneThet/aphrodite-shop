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

  useEffect(() => {
    if (count < 2 || paused || reducedMotion) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) setIndex((value) => (value + 1) % count);
    }, 7000);
    return () => window.clearInterval(timer);
  }, [count, paused, reducedMotion]);

  if (!active) return null;
  const move = (amount: number) => setIndex((value) => (value + amount + count) % count);

  return (
    <section className="mx-auto max-w-7xl px-5 pb-10" aria-label="Store advertisement">
      <div
        className="group relative overflow-hidden rounded-2xl bg-zinc-950 shadow-lg ring-1 ring-black/5 sm:rounded-3xl"
        aria-roledescription="carousel"
        aria-label={`${placement === "before_laptops" ? "Laptop section" : "Shopping help section"} advertisements`}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocusCapture={() => setPaused(true)}
        onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false); }}
      >
        <a href={active.href} className="block aspect-[16/7] w-full sm:aspect-[3/1]" aria-label={active.title}>
          <img
            src={active.image_url}
            alt={active.alt_text}
            className="h-full w-full object-contain"
            onError={() => { setFailed((items) => items.includes(active.id) ? items : [...items, active.id]); setIndex(0); }}
          />
        </a>
        {count > 1 && (
          <div className="flex items-center justify-between bg-zinc-950 p-2 sm:pointer-events-none sm:absolute sm:inset-x-0 sm:bottom-0 sm:bg-gradient-to-t sm:from-black/65 sm:to-transparent sm:p-4">
            <div className="flex gap-1">
              <button type="button" onClick={() => move(-1)} aria-label="Previous advertisement" className="pointer-events-auto grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/10 font-bold text-white backdrop-blur transition hover:bg-white/20">←</button>
              <button type="button" onClick={() => move(1)} aria-label="Next advertisement" className="pointer-events-auto grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/10 font-bold text-white backdrop-blur transition hover:bg-white/20">→</button>
            </div>
            <span className="rounded-full bg-white/10 px-3 py-2 text-xs font-bold text-white sm:hidden" aria-live="polite">{index + 1} / {count}</span>
            <div className="pointer-events-auto hidden gap-2 sm:flex" aria-label="Choose advertisement">
              {visibleAds.map((ad, position) => (
                <button key={ad.id} type="button" onClick={() => setIndex(position)} aria-label={`Show advertisement ${position + 1}: ${ad.title}`} aria-pressed={position === index} className="grid h-11 min-w-11 place-items-center">
                  <span className={`h-2 rounded-full bg-white transition-all ${position === index ? "w-8" : "w-2 opacity-55"}`} />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
