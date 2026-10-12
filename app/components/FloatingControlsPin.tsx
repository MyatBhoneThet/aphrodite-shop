"use client";

import { useEffect } from "react";

/**
 * Keeps the floating buttons (chat, recently viewed, back to top) at the
 * bottom of the screen on iPhone.
 *
 * `position: fixed` is anchored to the layout viewport. Mobile Safari can
 * leave that viewport behind the part of the page actually on screen (after
 * its toolbar resizes, or after the keyboard closes), and the buttons then
 * float up the page. This measures how far the visible area reaches below the
 * layout viewport and publishes it as --vv-shift, which .floating-control in
 * globals.css uses to move the buttons back down. It is 0 everywhere else.
 */
export default function FloatingControlsPin() {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    const root = document.documentElement;
    let frame = 0;

    const update = () => {
      frame = 0;
      const shift = viewport.offsetTop + viewport.height - root.clientHeight;
      // Never upwards: with the keyboard open the buttons stay where they are.
      root.style.setProperty("--vv-shift", `${shift > 1 ? Math.round(shift) : 0}px`);
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };

    update();
    viewport.addEventListener("resize", schedule);
    viewport.addEventListener("scroll", schedule);
    window.addEventListener("scroll", schedule, { passive: true });
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      viewport.removeEventListener("resize", schedule);
      viewport.removeEventListener("scroll", schedule);
      window.removeEventListener("scroll", schedule);
      root.style.removeProperty("--vv-shift");
    };
  }, []);

  return null;
}
