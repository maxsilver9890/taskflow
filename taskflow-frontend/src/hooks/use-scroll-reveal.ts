"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Tracks whether an element is in the viewport, for the "fade/lift in on
 * scroll, fade back out on leaving" treatment (`.tf-scroll-reveal` in
 * globals.css) used throughout the app shell — page titles, section
 * headings, etc. Mirrors the marketing page's scroll-driven reveal, toned
 * down for in-app content.
 *
 * Falls back to permanently visible when IntersectionObserver isn't
 * available (older browsers, non-DOM test environments) so content is never
 * stuck hidden.
 */
export function useScrollReveal<T extends HTMLElement>(threshold = 0.1) {
  const ref = useRef<T | null>(null);
  // Lazy initializer (not a setState call inside the effect body) so
  // environments without IntersectionObserver render visible immediately.
  const [visible, setVisible] = useState(() => typeof IntersectionObserver === "undefined");

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(([entry]) => setVisible(!!entry?.isIntersecting), {
      threshold,
      rootMargin: "-8% 0px -8% 0px",
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, visible };
}
