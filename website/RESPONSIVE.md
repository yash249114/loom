# Responsive & viewport behaviour

The site keeps its editorial black / cream / copper identity at every size. Layout
changes come from CSS grid, flexbox, `clamp()` and viewport units — never from
transform scaling. There is no site-wide `overflow-x: hidden`.

## Layout system

| Concern | Implementation |
| --- | --- |
| Content container | `max-w-[1560px]` with `2xl:max-w-[1680px]`, `px-6` gutters |
| Section rhythm | `.section-y` → `padding-block: clamp(3.5rem, 6vw, 7rem)` |
| Page top/bottom | `.page-y` → `padding-block: clamp(3rem, 5vw, 6rem)` |
| Hero type | `.type-hero` → `clamp(2.5rem, 3.2vw + 1.55rem, 4.5rem)` |
| Page title | `.type-h1` → `clamp(2.25rem, 2.7vw + 1.25rem, 3.75rem)` |
| Section heading | `.type-h2` → `clamp(1.375rem, 0.5vw + 1.2rem, 1.75rem)` |
| Standfirst | `.type-lead` → `clamp(1rem, 0.3vw + 0.95rem, 1.125rem)` |
| Body | `clamp(0.9375rem, 0.2vw + 0.9rem, 1rem)` |
| Navigation switch | menu button below `1024px`, desktop links at `1024px` and up |

Every multi-column grid uses `minmax(0, …)` or `[&>*]:min-w-0` so wide `<pre>`
and table content cannot force the page wider. Tables and code blocks scroll
inside their own bordered containers; the page itself never scrolls sideways.

### Hero

- One column below `1024px`: headline, copy and calls to action first, canvas
  panel underneath at `clamp(17rem, 50svh, 28rem)` (up to `30rem` at `sm`).
- Two columns from `1024px`: `minmax(0, 1.05fr) minmax(0, 1fr)`, stretched to
  `min(86svh, 880px)` so short desktop windows still scroll naturally instead of
  compressing content.
- Halftone canvas fills its parent through `ResizeObserver`, caps the dot count
  at 6000, caps DPR at 1.25 (small screens) / 1.5, pauses when the tab is hidden,
  and only attaches pointer interaction for fine pointers. Reduced motion renders
  the particles statically.

### Navigation

- Editorial right-aligned links on desktop; 44px menu button, 44px menu rows,
  `max-h-[calc(100dvh-4rem)]` scrollable panel on tablet and mobile.
- Opening the menu locks document scroll (with scrollbar-width compensation);
  navigating or pressing Escape closes it, restores scrolling and returns focus
  to the menu button. The menu also closes when the viewport crosses `1024px`.

### Components

- Code samples use a bordered header bar with the copy button instead of an
  absolutely positioned button, so it can never overlap long lines.
- Platform tabs and copy buttons are at least 44px tall on touch-sized screens.
- The docs page swaps its sticky sidebar table of contents for a collapsible
  "On this page" list below `1024px`.
- Footer install column stacks label, copy button and command so they cannot
  collide in the five-column desktop grid.

## Verified results

Tested against the production build (`pnpm build` + `pnpm start -p 3100`) in
Chromium through the Playwright MCP browser. Exact CSS viewports were achieved
by compensating for the test browser's 90% zoom; each row below is the measured
`window.innerWidth × innerHeight`, and every route was checked at every size:
`/`, `/features`, `/providers`, `/docs`, `/changelog`, `/download`.

For each route the audit asserted `documentElement.scrollWidth` equals
`clientWidth` (no horizontal page scrolling), no element extends past the
viewport outside a deliberate scroll container, and the hero canvas matches its
parent box exactly. Animations were allowed to settle before measuring.

### Primary matrix — 60/60 passed

| Requested | Measured | Result |
| --- | --- | --- |
| 320 × 640 | 320 × 640 | Pass |
| 375 × 812 | 376 × 812 | Pass |
| 430 × 932 | 430 × 932 | Pass |
| 768 × 1024 | 768 × 1025 | Pass |
| 1024 × 768 | 1025 × 768 | Pass |
| 1280 × 720 | 1280 × 720 | Pass |
| 1440 × 900 | 1440 × 900 | Pass |
| 1920 × 1080 | 1920 × 1080 | Pass |
| 2560 × 1440 | 2560 × 1440 | Pass |
| 3440 × 1440 | 3440 × 1440 | Pass |

### Short-height, orientation and zoom — 48/48 passed

| Requested | Measured | Covers |
| --- | --- | --- |
| 1280 × 600 | 1280 × 600 | Short desktop window |
| 1024 × 600 | 1025 × 600 | Short desktop window |
| 1440 × 650 | 1440 × 651 | Short desktop window |
| 812 × 375 | 812 × 376 | Phone landscape |
| 932 × 430 | 932 × 430 | Phone landscape |
| 1152 × 720 | 1153 × 720 | 125% zoom on a 1440 × 900 window |
| 1800 × 1125 | 1800 × 1126 | 80% zoom on a 1440 × 900 window |
| 1600 × 900 | 1600 × 900 | 80% zoom on a 1280 × 720 window |

Live resizing was also exercised on a single loaded page (1440 → 375 → 768 →
3440 → 320 → 812 landscape → 375) with no reloads: no horizontal overflow at any
step and the canvas backing store re-sized with its CSS box each time.

### Geometry and interaction checks

- Hero grid: one column below 1024, two flexible columns above; headline stays
  inside the viewport at every size.
- Hero canvas panel: 50% of viewport height at 320 × 640 and 375 × 812, 47% at
  768 × 1024, never the whole screen.
- Primary buttons measure 45–47px tall; mobile menu rows and platform tabs 44px.
- Mobile menu: opens (357px panel at 376px wide), locks scroll, closes on link
  navigation, closes on Escape and returns focus; no horizontal overflow while
  open.
- Docs table of contents: 44px summary toggle, ten 36px anchor rows.
- Platform tabs switch panels correctly (Windows panel shows the WSL note).
- Reduced motion: headings stay at opacity 1, the canvas renders a static frame.
- Console: zero errors or page errors across 4 viewports × 6 routes.

Screenshots were captured for desktop (1440 × 900), tablet (768 × 1024) and
mobile (375 × 812) across the hero, navigation menu, docs, download, features,
providers and changelog pages. Note that Chromium screenshots taken at deep
scroll positions in this environment can omit already-scrolled content; those
sections were additionally verified through computed geometry and pixel checks.

## Notes

- `overflow-x: auto` appears only on code blocks, tables and the mobile menu —
  deliberate containers for wide content, not a page-level mask.
- In-view reveal animations only run once their section is scrolled into view, so
  a full-page screenshot taken without scrolling will show those sections as
  empty. Normal browsing and scrolling renders them.
- Zoom is handled by the layout itself; there are no zoom-specific styles.
