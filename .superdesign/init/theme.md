# TaskFlow Theme and Styling

## Compact token summary

- CSS approach: Tailwind CSS v4 through @tailwindcss/postcss; shared design tokens are CSS custom properties in src/app/globals.css.
- Fonts: Archivo Variable for sans/display; IBM Plex Mono for code and compact metadata.
- Light canvas/surfaces: canvas #f5efe4; surface #ffffff; secondary surface #efe6d6.
- Light text: ink #241c14; secondary #5a4f41; muted #8a7c68.
- Light coral accent: brand #c64a32; hover #a83d28; brand-soft #f6e2db; focus #c64a32.
- Dark canvas/surfaces: canvas #0b2030; surface #0f2736; secondary surface #142e3f.
- Dark text: ink #f0e5d4; secondary #c9bba3; muted #8fa0ac.
- Dark coral accent: brand #e2705a; hover #ec8a76; brand-soft #2c2019; focus #e2705a.
- Borders: light #e1d5c0 / strong #cdbd9f; dark #244459 / strong #345a70.
- Status colors: todo/progress/review/done have paired semantic foreground and soft-background tokens. Priorities low/medium/high/urgent likewise use dedicated tokens.
- Shape and depth: rounded cards and controls (commonly rounded-lg/rounded-xl); --shadow-pop is the shared elevated shadow.
- Type scale and spacing: Tailwind utility scale, with compact 12–14px metadata/body details and display headings; common spacing utilities p-4, gap-4, mt-6 are used.
- Breakpoints: responsive layouts use Tailwind sm, md, lg, xl, and 2xl utilities; there is no custom Tailwind config.
- Motion: tf-fade-in, tf-pop-in, tf-slide-in, tf-skeleton, tf-glossy, and tf-scroll-reveal; reduced-motion preferences are respected.
- Theme switching: :root[data-theme="dark"] overrides the shared tokens; components consume variables rather than hardcoded theme colors.

## Raw source dumps

### taskflow-frontend/src/app/globals.css```css
@import "tailwindcss";

/*
 * TaskFlow design tokens — shared across the marketing site and the
 * authenticated app. Light mode is the sand/cream register, dark mode is
 * the deep-navy register; coral is the one accent color, used for primary
 * actions and status emphasis, not decoration.
 *
 * Every component in src/components reads these variables (never a raw
 * hex), so retheming the whole product is a one-file change.
 */
:root {
  --canvas: #f5efe4;
  --surface: #ffffff;
  --surface-2: #efe6d6;
  --line: #e1d5c0;
  --line-strong: #cdbd9f;
  --ink: #241c14;
  --ink-2: #5a4f41;
  --ink-3: #8a7c68;
  --brand: #c64a32;
  --brand-hover: #a83d28;
  --brand-ink: #ffffff;
  --brand-soft: #f6e2db;
  --focus: #c64a32;
  --danger: #b42318;
  --danger-soft: #fdeceb;

  --s-todo: #7a7265;
  --s-progress: #2563eb;
  --s-review: #b7791f;
  --s-done: #2f7a4f;
  --s-todo-soft: #ece4d6;
  --s-progress-soft: #e4ecfd;
  --s-review-soft: #fbf0d9;
  --s-done-soft: #e1f0e5;

  --p-low: #8a7c68;
  --p-medium: #2563eb;
  --p-high: #c2410c;
  --p-urgent: #b91c1c;

  --shadow-pop: 0 12px 32px -8px rgb(36 28 20 / 0.18), 0 2px 6px rgb(36 28 20 / 0.08);
  color-scheme: light;
}

:root[data-theme="dark"] {
  --canvas: #0b2030;
  --surface: #0f2736;
  --surface-2: #142e3f;
  --line: #244459;
  --line-strong: #345a70;
  --ink: #f0e5d4;
  --ink-2: #c9bba3;
  --ink-3: #8fa0ac;
  --brand: #e2705a;
  --brand-hover: #ec8a76;
  --brand-ink: #1a0c08;
  --brand-soft: #2c2019;
  --focus: #e2705a;
  --danger: #f3776b;
  --danger-soft: #3a1c1a;

  --s-todo: #94a3b8;
  --s-progress: #6b9bff;
  --s-review: #e0a53d;
  --s-done: #4ec97a;
  --s-todo-soft: #1c3240;
  --s-progress-soft: #182a4d;
  --s-review-soft: #382b12;
  --s-done-soft: #12301d;

  --p-low: #94a3b8;
  --p-medium: #6b9bff;
  --p-high: #f08a4b;
  --p-urgent: #f47a7a;

  --shadow-pop: 0 12px 32px -8px rgb(0 0 0 / 0.55), 0 2px 6px rgb(0 0 0 / 0.3);
  color-scheme: dark;
}

@theme inline {
  --font-sans: "Archivo Variable", ui-sans-serif, system-ui, sans-serif;
  --font-display: "Archivo Variable", ui-sans-serif, system-ui, sans-serif;
  --font-mono: "IBM Plex Mono", ui-monospace, monospace;

  --color-canvas: var(--canvas);
  --color-surface: var(--surface);
  --color-surface-2: var(--surface-2);
  --color-line: var(--line);
  --color-line-strong: var(--line-strong);
  --color-ink: var(--ink);
  --color-ink-2: var(--ink-2);
  --color-ink-3: var(--ink-3);
  --color-brand: var(--brand);
  --color-brand-hover: var(--brand-hover);
  --color-brand-ink: var(--brand-ink);
  --color-brand-soft: var(--brand-soft);
  --color-danger: var(--danger);
  --color-danger-soft: var(--danger-soft);
  --color-s-todo: var(--s-todo);
  --color-s-progress: var(--s-progress);
  --color-s-review: var(--s-review);
  --color-s-done: var(--s-done);
  --color-s-todo-soft: var(--s-todo-soft);
  --color-s-progress-soft: var(--s-progress-soft);
  --color-s-review-soft: var(--s-review-soft);
  --color-s-done-soft: var(--s-done-soft);
  --color-p-low: var(--p-low);
  --color-p-medium: var(--p-medium);
  --color-p-high: var(--p-high);
  --color-p-urgent: var(--p-urgent);
  --shadow-pop: var(--shadow-pop);
}

html {
  background: var(--canvas);
  -webkit-text-size-adjust: 100%;
}

body {
  font-family: var(--font-sans);
  font-variation-settings: "wdth" 90;
  color: var(--ink);
  background: var(--canvas);
  font-size: 14.5px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}

h1,
h2,
h3 {
  font-family: var(--font-display);
  font-weight: 700;
  font-variation-settings: "wdth" 85;
  letter-spacing: -0.015em;
}

.mono,
.font-mono {
  font-family: var(--font-mono);
}

::selection {
  background: var(--brand-soft);
  color: var(--ink);
}

:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 2px;
  border-radius: 6px;
}

/* Thin, unobtrusive scrollbars for the board and tables. */
* {
  scrollbar-width: thin;
  scrollbar-color: var(--line-strong) transparent;
}

@keyframes tf-fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
@keyframes tf-pop-in {
  from {
    opacity: 0;
    transform: translateY(6px) scale(0.985);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
@keyframes tf-slide-in {
  from {
    transform: translateX(24px);
    opacity: 0;
  }
  to {
    transform: none;
    opacity: 1;
  }
}
@keyframes tf-shimmer {
  to {
    background-position: -200% 0;
  }
}

.tf-fade-in {
  animation: tf-fade-in 0.15s ease-out both;
}
.tf-pop-in {
  animation: tf-pop-in 0.18s cubic-bezier(0.2, 0.8, 0.2, 1) both;
}
.tf-slide-in {
  animation: tf-slide-in 0.22s cubic-bezier(0.2, 0.8, 0.2, 1) both;
}
.tf-skeleton {
  background: linear-gradient(90deg, var(--surface-2) 25%, var(--line) 37%, var(--surface-2) 63%);
  background-size: 200% 100%;
  animation: tf-shimmer 1.4s linear infinite;
}

@keyframes tf-glossy-sheen {
  to {
    background-position: -200% 0;
  }
}
/* Animated sheen sweeping across text — used sparingly on wordmarks/titles.
   Deliberately does NOT use currentColor in the gradient: this rule also
   sets color:transparent (required for background-clip:text to reveal the
   gradient), and currentColor always resolves to an element's own final
   `color` value — so a currentColor gradient on a color:transparent element
   resolves to a transparent gradient too, rendering nothing. --tf-glossy-base
   carries the "real" text color instead; override it (not `color`) to retint
   the sheen for a given context, e.g. on a dark background. */
.tf-glossy {
  --tf-glossy-base: var(--ink);
  background-image: linear-gradient(
    100deg,
    var(--tf-glossy-base) 35%,
    color-mix(in srgb, var(--tf-glossy-base) 45%, white) 50%,
    var(--tf-glossy-base) 65%
  );
  background-size: 250% 100%;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  animation: tf-glossy-sheen 3.4s ease-in-out infinite;
}

/* Fades/lifts text in as it scrolls into view and back out as it leaves —
   toggled by the useScrollReveal hook via the data-visible attribute. */
.tf-scroll-reveal {
  opacity: 0;
  transform: translateY(10px);
  transition:
    opacity 0.45s cubic-bezier(0.2, 0.8, 0.2, 1),
    transform 0.45s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.tf-scroll-reveal[data-visible="true"] {
  opacity: 1;
  transform: none;
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
  }
}
```

### taskflow-frontend/postcss.config.mjs

```js
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
```

### taskflow-frontend/next.config.ts

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
};

export default nextConfig;
```

No tailwind.config.* file is present; Tailwind v4 defaults are used with the tokens above.
