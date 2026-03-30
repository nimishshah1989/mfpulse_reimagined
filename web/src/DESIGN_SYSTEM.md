# MF Pulse — Frontend Design System

## Purpose
Single source of truth for all page-level and component-level design decisions.
Every new page or component MUST reference this before building.

---

## Color Palette

### Brand
| Token | Hex | Usage |
|-------|-----|-------|
| accent | #0f766e | Primary actions, active states, section: Explorer |
| band-screener | #1e40af | Section: Screener |
| band-analytics | #0369a1 | Section: Analytics |
| band-compare | #475569 | Section: Compare |

### Data Spectrum (for quantitative bars, allocations)
| Token | Hex | Meaning |
|-------|-----|---------|
| d-top | #047857 | Best / Large Cap |
| d-good | #0d9488 | Good / Mid Cap |
| d-mid | #d97706 | Moderate / Small Cap |
| d-low | #be123c | Worst / Avoid |

### Score Spectrum (scoreColor from lib/lens.js)
| Range | Hex | Meaning |
|-------|-----|---------|
| 80-100 | #059669 | Excellent |
| 60-79 | #10b981 | Good |
| 40-59 | #d97706 | Average |
| 20-39 | #ef4444 | Below Average |
| 0-19 | #dc2626 | Poor |

### Quartile Colors
| Q | Hex |
|---|-----|
| 1 | #047857 |
| 2 | #0d9488 |
| 3 | #d97706 |
| 4 | #be123c |

### Forbidden Colors
- No purple (#6d28d9) — rejected
- No maroon/rose (#9f1239) — rejected
- No gray backgrounds — all white with card borders

---

## Typography
- Font: Inter (system fallback)
- Financial numbers: `font-mono tabular-nums`
- Section titles: `text-[13px] font-extrabold text-slate-900 tracking-tight`
- Card titles: `text-xs font-bold text-slate-800 uppercase tracking-wider`
- Data labels: `text-[10px] font-bold text-slate-400 uppercase`
- Body: `text-xs text-slate-600`
- Commentary: `text-[11px] text-slate-500 leading-relaxed`

---

## Card System
All cards use `glass-card` class (white bg, subtle border, rounded-xl).
No gray backgrounds inside cards. No childish icons/emojis.

---

## Standardized Fund List (FundListPanel)

**This is THE component for showing fund lists anywhere in the app.**
Used in: Analytics expandable cards, Dashboard smart buckets, Sector drill-downs, etc.

### Layout per fund row:
```
[Rank] | Fund Name (truncated 28ch) | Category tag | AUM (Cr) | 1Y Return | 6 Lens Mini-Bars | Arrow →
        AMC name (muted)
```

### Columns:
| Column | Width | Format |
|--------|-------|--------|
| # | 24px | Rank number, text-slate-400 |
| Fund Name | flex-1, min 180px | Bold slate-800, AMC below in slate-400 |
| Category | 100px | Pill: bg-slate-100 text-slate-600 |
| AUM | 70px | formatAUM(aum/1e7), right-aligned, tabular-nums |
| 1Y Return | 60px | formatPct, green/red, right-aligned, font-bold |
| 6 Lenses | 90px | 6 micro bars (w-1.5 each, height = score%, color = scoreColor) |
| Nav arrow | 20px | → icon, navigates to Fund 360 |

### Behaviors:
- Row click → navigates to `/fund360?fund={mstar_id}`
- Hover → bg-slate-50/60 transition
- Sorted by the card's primary metric (e.g., return, Sharpe, consistency)
- Max 20 items shown, "Show all N funds" button at bottom
- Pagination not needed (lists are pre-filtered, usually 10-50 items)

### Props:
```jsx
<FundListPanel
  funds={[]}           // Array of fund objects
  sortKey="return_1y"  // Which field to sort by (desc)
  title="Funds"        // Optional header
  maxItems={20}        // How many to show before "show all"
  returnPeriod="1y"    // Which return to display: "1y" | "3y" | "5y"
/>
```

---

## Analytics Card Pattern

Each analytics card follows this structure:

```
┌─────────────────────────────────────┐
│ TITLE                    [controls] │
│ Subtitle / one-line explanation     │
│                                     │
│ ┌─ Visual ────────────────────────┐ │
│ │ Chart / Grid / Bars             │ │
│ └─────────────────────────────────┘ │
│                                     │
│ Commentary: 1-2 sentence narrative  │
│                                     │
│ ▼ Expand: Fund List (FundListPanel) │
└─────────────────────────────────────┘
```

- Title: `section-title` class
- Controls: time period toggles, sort options — small pills
- Visual: the chart/grid/bars
- Commentary: auto-generated from data (best performer, trend direction, etc.)
- Expand: click to reveal FundListPanel below the card

---

## Page Layout Standards

### Max width: 1440px, centered
### Spacing: space-y-5 between sections
### Grid: 2-col on lg for cards (grid-cols-1 lg:grid-cols-2 gap-5)

### Section Navigation (tabs without "tab" word):
- Colored bottom border on active
- No background color on tabs
- Color from section's `band` property

### Section Band Header:
- 4px left border in section color
- Light tint background
- Title + description

---

## Performance Standards

### Loading States
- Full page: skeleton grid matching layout
- Section switch: show section skeleton for 0ms (instant if cached)
- Card: individual card skeleton (rounded-xl, h-48, animate-pulse)
- Never show "Loading..." text — always structural skeletons

### Data Strategy
- Universe data cached 10min client-side (cachedFetch)
- Sections render only when active (conditional rendering)
- Heavy computations in useMemo with proper dependency arrays
- Use startTransition for section switches to keep UI responsive

### Rendering
- Dynamic imports for heavy chart components (BubbleScatter, Heatmap, Treemap, ComparePanel)
- No dynamic import for tables/lists (they're lightweight)
- Intersection Observer for below-fold content (future)

---

## Fund 360 Landing Page (future)

Fund 360 becomes the canonical fund detail page. When a fund is clicked
anywhere in the app, it navigates to `/fund360?fund={mstar_id}`.

All fund list rows, cards, and expandable panels use FundListPanel
with row click → Fund 360 navigation.

---

## Do NOT
- Use emojis or icons next to labels
- Use gray backgrounds (slate-50/100 bg)
- Use purple or maroon anywhere
- Show empty state cards with large icons
- Show "No data available" — hide the section instead
- Use "tab" word — use "section" with colored bands
