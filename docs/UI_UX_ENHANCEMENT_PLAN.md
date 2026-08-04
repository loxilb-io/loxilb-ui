# loxilb-ui — Visual Design Enhancement Plan

Status: **PROPOSAL** (requirements/design discovery — no implementation yet)
Date: 2026-08-05 (rev. 2 — product decisions folded in)
Scope: visual design & UX polish of the management UI. No functional/API changes.

**Product decisions (2026-08-05):**
- **Dark mode is OUT OF SCOPE** — the UI stays light-mode only. No dark
  tokens, no scheme toggle, no dark chart validation anywhere in this plan.
- **Brand hex values stay as-is** (`#113351` navy, `#D27B24` orange). The
  AA-contrast issue with orange text is handled by *usage rules* (see
  Phase 1), not by changing the brand colors.

---

## 1. Design audit — why the UI reads as "boring"

The UI is functionally solid (validated by the E2E suite) but visually it is
**default Material-UI with a navy header**. Concretely:

### 1.1 Theme is nearly empty (`src/theme.ts`)
- Only two palette entries (primary navy `#113351`, secondary orange `#D27B24`).
  No neutral ramp, no semantic status colors, no `background.default`, no
  `shape`/radius, no shadow strategy.
- Typography = stock **Roboto** with 3 weight tweaks. Roboto is the single
  strongest "default Material app" signal — it dates the product instantly.
- `chart_color` is 5 unrelated hues (`#6A89CC, #82CA9D, #FFC658, #E85D04,
  #9B59B6`) — not harmonized with the brand, no semantic meaning.
- `MuiInputLabel` forced to pure `#000000` — harsh against MUI's soft grays.

### 1.2 Everything looks like a form
- KPI/stat summaries (e.g. IPsec "Tunnels Up / Tunnels Down / Active SAs") are
  rendered as **outlined TextField lookalikes** — they read as *disabled form
  inputs*, not metrics. This is the single biggest "boring" driver on detail
  pages: display surfaces and input surfaces are visually identical.
- Status values ("CONNECTING", HA state, endpoint health) render as plain black
  table text — no color, no chips, no at-a-glance scannability. For a network
  ops console, **state should be visible from across the room**.

### 1.3 Tables are stock DataGrid at minimum density value
- `TableBase.tsx`: `border: 0`, default header style, default row height,
  **default page size 5** → a 1080p screen shows 5 rows and a huge blank white
  void below (visible in the IPsec screenshot).
- Toolbar = unlabeled icon strip (refresh/add/edit/delete) on a gray band.
- No row hover tint, no zebra option, no empty-state design (empty table =
  blank white rectangle), no monospace for IPs/MACs/CIDRs.

### 1.4 Chrome is flat and untuned
- Header: flat navy bar with 78px logo, tiny white icons separated by 1px
  divider bars; **flag icon for language** (i18n antipattern + visual noise).
- Side menu: stock persistent `Drawer` (300px, non-collapsible to a rail),
  stock `List` items, gray-highlight selection only — no accent indicator, no
  visual grouping rhythm.
- Random watermark SVGs (`BGImage.tsx`) float at bottom-right on ~10 routes at
  70% opacity — inconsistent decoration that reads as accidental.
- Footer is a second dark bar competing with the header.

### 1.5 Dashboard
- `react-grid-layout` with **hard-coded `width={1200}`** — the dashboard does
  not use the viewport; on wide NOC displays it's a fixed column with dead
  space right of it.
- Cards are default `<Paper>` (elevation 1) with a `subtitle1` text title —
  no icons, no big-number typography, no trend indicators, uniform gray.
- Dashboard bg is `grey.100` but every other page is pure white — the app has
  no consistent surface system.

### 1.6 Feel & accessibility issues
- `root.css` sets `user-select: none` on `*` and `App.tsx` **blocks
  right-click globally** — operators copy IPs/MACs/tokens constantly; this
  makes the app feel like a locked-down kiosk, not a professional tool.
- Secondary orange `#D27B24` on white ≈ **3.0:1 contrast — fails WCAG AA** for
  normal text (it's used for links/accents/table toolbar icons). Since the
  brand hexes are fixed, the fix is usage rules: orange for large text,
  icons, and graphic elements only — never small body-size text.

### 1.7 What already works (keep)
- Login page (black + orange particle animation) — the most "designed" screen;
  its confidence is the direction the rest of the app should follow.
- Information architecture (side menu grouping, breadcrumbs, sub-tabs) is
  sound. This plan is **skin, not structure**.
- The shared-component discipline (CardBase / TableBase / SingleTextBox /
  DataTable) means most of the restyle lands in a handful of files.

---

## 2. Design direction

**"Calm ops console"** — the aesthetic register of Grafana / Tailscale /
Vercel-style dashboards, applied to the existing NetLOX brand:

1. **Keep the brand colors exactly as-is, build a system around them.**
   Navy `#113351` stays the identity anchor; orange `#D27B24` becomes a
   *deliberate* accent (primary actions, active nav indicator, brand moments)
   instead of an incidental icon color. The supporting neutral ramp and
   semantic status colors are new additions *around* the fixed brand hexes.
2. **Neutral surface system**: app background `gray-50`, cards white with a
   1px `gray-200` border + radius 10–12px + subtle shadow on hover only.
   Borders-over-shadows is the modern console idiom and is cheap in MUI.
3. **Typography as the upgrade lever**: Inter (UI) + IBM Plex Mono or
   JetBrains Mono (IPs, MACs, CIDRs, counters, IDs). Data set in mono with
   tabular numerals instantly makes a network tool look purpose-built.
4. **Semantic color does the talking**: green/amber/red/blue status ramp used
   in chips, dots, and chart lines — consistent across tables, cards, HA
   state, tunnel state, endpoint health.
5. **Light mode only, done well** (product decision): one polished scheme
   with a real surface/neutral system, rather than a half-finished pair.

---

## 3. Phased plan

Ordered so each phase ships independently and visibly. Phases 1–3 deliver
~80% of the perceived improvement.

### Phase 1 — Design tokens & theme foundation (the multiplier)
*Files: `src/theme.ts`, `root.css`, `App.tsx`, font loading in `index.tsx`.*

- Full light-mode palette definition: the two fixed brand hexes plus derived
  tints/shades for hover/active states, a 10-step neutral ramp, and semantic
  `success/warning/error/info` colors.
- AA compliance without touching brand hexes: **usage rule** — orange only
  for large text (≥18.5px/bold), icons, indicators, and buttons with
  sufficient contrast; body-size links/text use navy or the neutral ramp.
- Typography: self-hosted **Inter** (`@fontsource`) + mono stack; type scale
  (13px base body2 for data density, defined h5/h6/subtitle roles); tabular
  numbers (`font-variant-numeric: tabular-nums`) for all metrics.
- `shape.borderRadius: 10`, elevation policy (borders by default, shadow on
  overlay surfaces only), spacing rhythm documented.
- Harmonized `chart_color` palette derived from brand + semantic hues.
- **Remove `user-select: none` on `*` and the global right-click block**
  (keep drag-cancel selectors where RGL needs them).
- Component defaults in theme: buttons (weight 600, no all-caps), inputs
  (size small default), Tabs, Tooltip, Chip, Dialog paddings — so every page
  improves without per-page edits.

*Acceptance:* side-by-side screenshot diff of 5 key pages shows coherent
type/color/radius; typecheck + full unit suite green; zero page-level code
changes required beyond imports.

### Phase 2 — App chrome (header, nav, page frame)
*Files: `Header.tsx`, `SideMenu*/SlideMenuItem.tsx`, `TopNavMenu.tsx`,
`Footer.tsx`, `BGImage.tsx`, `NavLayout.tsx`.*

- Header: tighter 48–52px bar; group actions into an avatar menu (profile,
  user mgmt, language, logout); replace **flag icon → "EN/한국어" text menu**;
  version moves into the avatar menu or footer.
- Side nav: 3px orange active-indicator bar + tinted active bg; section
  headers styled as overline labels; **collapsible to a 64px icon rail**
  (tooltips on rail); instance name gets a styled instance-switcher block at
  the top of the nav instead of plain h6 + icon.
- Breadcrumb bar merges visually with the content header (one page-title
  block: breadcrumb, page h5, page-level actions right-aligned).
- Footer: slim, light, single line (dark double-bar goes away).
- Delete `BGImage.tsx` watermarks; the decoration budget moves to designed
  empty states (Phase 3).

*Acceptance:* nav rail collapse persists; active route obvious at a glance;
no E2E selector breakage (`SideMenu` text labels unchanged).

### Phase 3 — Data display: tables, stats, status (the daily-driver phase)
*Files: `TableBase.tsx`, `DataTable.tsx`, `SingleTextBox.tsx`, new
`StatCard`/`StatusChip` elements, ~26 table wrappers only if labels change.*

- **StatCard** element replaces TextField-lookalike stat boxes: label
  (overline, gray), big tabular number (h4/mono), optional delta/status dot,
  bordered card surface. IPsec overview, LB summaries, etc. adopt it.
- **StatusChip / StatusDot**: single semantic mapping (UP/CONNECTED/ESTAB →
  green; CONNECTING/PENDING → amber; DOWN/FAILED → red; DISABLED → gray)
  used by every table and card that shows state.
- DataGrid restyle in one place (`TableBase`): `gray-50` header band with
  600-weight labels, row hover tint, 44px rows + density toggle,
  **default page size 25**, mono cell renderer for IP/MAC/CIDR columns,
  styled empty-state overlay ("No tunnels yet" + primary Add action),
  labeled toolbar (text+icon buttons instead of bare icons).
- Forms/dialogs inherit Phase 1 tokens; dialog headers get consistent
  title/description pattern.

*Acceptance:* an operator can tell tunnel/HA/endpoint health from 2m away;
empty tables invite the create action; E2E table specs still green (keep
`data-*`/aria hooks stable, add `data-testid` where labels change).

### Phase 4 — Dashboard
*Files: `DashboardPage.tsx`, `card/*.tsx`, `RateLineGraph.tsx`.*

- Fix **hard-coded `width={1200}`** → `WidthProvider`/measured responsive
  grid with breakpoint layouts.
- Card redesign on the new surface system: icon + title row, hero number,
  sparkline with brand-consistent gradient fill, semantic thresholds
  (warning/critical states tint the card border, not just text).
- Unified chart theme (axis/grid/tooltip styling shared by MUI-X charts and
  the rate graphs); skeleton loaders instead of blank cards during first poll.

*Acceptance:* dashboard fills 1440px and 1920px viewports; screenshot passes
"would this demo well at Open Source Summit" review.

### Phase 5 — Motion & micro-interactions (small, cheap, high perceived value)
- 150–200ms ease transitions on nav collapse and hover states.
- Consistent focus-visible rings (a11y + polish).
- Subtle number-change transitions on live metric cards (no layout shift).

### Phase 6 — Final accessibility & consistency pass
- WCAG AA contrast audit across all pages (with the orange usage rules from
  Phase 1 enforced everywhere).
- Sweep for stragglers: pages/dialogs that bypassed the shared components and
  still look pre-redesign; keyboard navigation spot-check on tables/forms.
- Login page keeps its black/particle identity untouched.

---

## 4. Quick wins (could land ahead of Phase 1, one small PR)

1. Table default page size 5 → 25 (`TableBase.tsx`).
2. Allow text selection app-wide; remove right-click block.
3. Status chips for the 3–4 highest-traffic state columns (tunnels, HA,
   endpoint health).
4. Flag icon → text language menu.
5. Row hover highlight on all tables.

## 5. Risks & guardrails

- **E2E stability is the #1 risk** — the suite is a major asset. Rule:
  restyle via theme/`sx`, never rename user-visible labels or roles without
  updating specs in the same PR; run the full suite per phase on the elice
  testbed.
- `react-scripts`/CRA constrains fancy font tooling → use `@fontsource`
  packages (pure npm, self-hosted, works today).
- Bundle: Inter + one mono weight ≈ ~100KB woff2 total — acceptable; subset
  latin + latin-ext (Korean UI text falls back to system font stack —
  decide in open questions).
- No i18n string churn except where labels are redesigned (language menu).

## 6. Decisions log & remaining open questions

**Decided (2026-08-05):**

1. **Brand hexes stay exactly as-is** — `#113351` / `#D27B24` are not tuned.
   Contrast is handled by usage rules (Phase 1), derived tints/shades are
   allowed only for hover/active states, never as replacements.
2. **Dark mode: out of scope** — light mode only, no tokens or toggle.

**Still open:**

3. **Korean typography** — pair Inter with **Pretendard** for the `ko` locale
   (recommended: it's the de-facto Korean UI font, pairs cleanly with Inter,
   available via `@fontsource`-style npm package), or accept system-font
   fallback (zero bundle cost, less consistent rendering across OSes)?
4. **Density default** — comfortable (44px rows) vs compact (36px) as the
   out-of-box table density for target operators?
5. Any marketing/demo deadline (e.g. Open Source Summit Korea) that should
   pull Phase 4 (dashboard) earlier?
