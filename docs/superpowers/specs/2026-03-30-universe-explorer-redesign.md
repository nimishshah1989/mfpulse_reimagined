# Universe Explorer Redesign — Design Spec

**Date:** 30 March 2026
**Status:** Approved (mockup reviewed and accepted)
**Scope:** Universe page (`/universe`) — polish existing foundation to production quality

---

## Goal

Transform the Universe Explorer from "a mad cluster of dots" into a globally competitive fund screening tool where every bubble is clickable, every data point has context, and three visualization modes (Scatter, Heatmap, Treemap) provide complementary views of 2,500+ funds across 6 lenses.

## What Already Exists (Foundation)

The current page has a solid component architecture:

| Component | Status | Delta |
|-----------|--------|-------|
| `BubbleScatter.jsx` (263 lines) | Canvas-based, quadtree, zoom/pan | Needs: quadrant labels, lens mini-pills in tooltip, better hover UX |
| `SmartPresets.jsx` (131 lines) | 6 presets with live counts | Good — minor styling polish |
| `HorizontalFilterBar.jsx` (223 lines) | Axis selectors, plan type, dropdowns | Needs: view mode toggle (Scatter/Heatmap/Treemap) |
| `TierSummary.jsx` (171 lines) | Left sidebar — stats + tier bars | Needs: narrative text, vs Nifty comparison, tier click → spotlight |
| `IntelligencePanel.jsx` (250 lines) | Right sidebar — context + top 5 | Needs: auto-generated insights, market regime narrative |
| `FundCard.jsx` (160 lines) | Click popup — lens scores + returns | Needs: headline tag, cat avg comparison, "Simulate SIP" button |
| `Heatmap.jsx` (248 lines) | Quintile grid — categories × score buckets | Needs: visual polish, click-to-filter, better color mapping |
| `Treemap.jsx` (243 lines) | D3 hierarchy — broad → category → fund | Needs: visual polish, proper color spectrum, click interactions |
| `chartHelpers.js` (251 lines) | Canvas drawing functions | Needs: quadrant labels, green-to-red spectrum |
| `universe.jsx` (490 lines) | Page orchestrator | Needs: view mode state, URL param support, global filter integration |

**No new components needed.** This is a polish + integration task, not a rebuild.

## Design Sections

### 1. NL Search Bar (top)
- Full-width search with placeholder: `"high alpha small cap funds", "return > 20% equity"`
- Hint text below: "Natural language search — parses categories, lenses, sectors, numeric filters"
- Clear button (X) when query active
- Active filter chips displayed below (sectors = teal, categories = blue, numeric = amber)
- **Existing:** Already works. Minor style updates.

### 2. Smart Screener Presets + View Toggle
- 6 preset chips in a row with live fund counts
- View mode toggle on the right: `Scatter | Heatmap | Treemap`
- Active preset highlighted with teal border + background
- **Existing:** Presets work. Add view toggle to this row.

### 3. Filter Bar
- Axis selectors: X (Risk Score), Y (1Y Return), Color (Alpha Score) — dropdown style
- Plan type pills: Direct / Regular / Both
- Dropdowns: All Categories, All AMCs, Any AUM
- Live count: "1,247 of 2,588 funds" right-aligned
- **Existing:** All works. Styling polish only.

### 4. Three-Panel Layout (2:7:3 grid)

#### Left Panel — Stats + Tier Distribution
- 4 stat cards: Avg 1Y Return (vs Nifty), Median Risk, Top Performer, Avg AUM
- Tier distribution bars (color-coded, clickable to spotlight in chart)
- 1-line narrative: "Only 6% generate machine-level alpha..."
- **Existing:** TierSummary has stats + tier bars. Add narrative, Nifty comparison.

#### Center — Visualization Area
**Scatter mode (default):**
- Canvas-based bubble chart (already exists)
- Quadrant labels: SWEET SPOT, HIGH RISK HIGH RETURN, CONSERVATIVE, AVOID
- Dashed midpoint dividers
- Hover tooltip: fund name, category, AUM, 1Y return, risk, alpha, 6 lens mini-pills, "Click for details"
- Click → FundCard popup (enriched with headline tag, cat avg, Simulate SIP)
- Double-click → navigate to Fund 360
- Chart guide bar at bottom (5 interaction hints)

**Heatmap mode:**
- Grid: rows = SEBI categories (grouped by broad), columns = score quintiles (0-20, 20-40, ..., 80-100)
- Cell color intensity by fund count
- Hover: top 3 funds in cell
- Click cell → filter scatter to those funds
- Column totals, category avg score column

**Treemap mode:**
- Hierarchy: Broad Category → SEBI Category → Fund
- Rectangle size = AUM
- Color = selected lens score (green-to-red spectrum)
- Click category → zoom in, breadcrumb to zoom out
- Click fund → FundCard popup

#### Right Panel — Intelligence
- Market Context card: regime badge, sentiment, breadth, narrative
- Top 5 by selected Y-axis metric (clickable fund names → Fund 360)
- Data Insights: 4 auto-generated observations from visible fund distribution
- **Existing:** IntelligencePanel has all this. Polish + ensure narrative generation.

### 5. FundCard Popup (click interaction)
- Fund name + AMC + category + AUM
- Headline tag: "Consistent Alpha Generator · Top 5% in Category"
- 6 lens scores in a grid with colored bars + tier labels
- Multi-period returns: 1Y, 3Y CAGR, 5Y CAGR, Cat Avg
- Two action buttons: "View Fund 360 →" (primary) and "Simulate SIP" (secondary)
- **Existing:** FundCard has lens scores. Add headline tag, cat avg, simulate button.

### 6. URL Query Parameter Support
- `?q=high alpha small cap` → pre-populate NL search, apply filters
- `?return_class=LEADER` → pre-select tier filter
- `?category=Small Cap` → pre-filter category
- `?alpha_class=ALPHA_MACHINE,POSITIVE&consistency_class=ROCK_SOLID,CONSISTENT` → smart bucket links
- Enables linking from Dashboard → Universe pre-filtered
- **Existing:** `?q=` partially works. Add full param support.

### 7. Data Integration Requirements
- Every fund must have AUM displayed (from `fund_holdings_snapshot.aum`, raw rupees / 1e7 for Cr)
- Green-to-red spectrum on all score visualizations (use `scoreColor()` from `lib/lens.js`)
- Exclude: segregated portfolios, IDCW plans, AUM < 10 Cr, age < 3 years
- Tier labels use proper display names (Alpha Machine, not ALPHA_MACHINE)
- Fund click → Fund 360 navigation via `router.push('/fund360?fund=MSTAR_ID')`
- Category names clickable → `/sectors?category=CATEGORY_NAME` where applicable

---

## Non-Negotiables
1. Every bubble is clickable (single-click = card, double-click = Fund 360)
2. Every fund name in every panel is clickable → Fund 360
3. AUM is never 0 Cr — hide fund if no AUM
4. Green-to-red spectrum everywhere (no monochrome bars)
5. All 3 view modes (Scatter/Heatmap/Treemap) are polished and functional
6. URL params work for cross-page linking
7. No empty states visible — hide sections if data unavailable
8. Tier narrative text accompanies every distribution visualization

## Files to Modify (no new files)

| File | Changes |
|------|---------|
| `web/src/pages/universe.jsx` | Add view mode state, URL param parsing, wire view toggle |
| `web/src/components/universe/BubbleScatter.jsx` | Quadrant labels, improved hover |
| `web/src/components/universe/chartHelpers.js` | Green-to-red spectrum, quadrant labels in canvas |
| `web/src/components/universe/SmartPresets.jsx` | Add view toggle, style polish |
| `web/src/components/universe/HorizontalFilterBar.jsx` | Minor style alignment |
| `web/src/components/universe/TierSummary.jsx` | Narrative text, Nifty comparison |
| `web/src/components/universe/IntelligencePanel.jsx` | Auto-insights, narrative, fund clickability |
| `web/src/components/universe/FundCard.jsx` | Headline tag, cat avg, Simulate SIP button |
| `web/src/components/universe/Heatmap.jsx` | Visual polish, green-to-red colors, click-to-filter |
| `web/src/components/universe/Treemap.jsx` | Visual polish, green-to-red colors, click interactions |
| `web/src/components/universe/BubbleTooltip.jsx` | 6 lens mini-pills, richer data |
