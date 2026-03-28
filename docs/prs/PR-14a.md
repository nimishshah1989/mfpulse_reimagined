# PR-14a: Frontend Redesign — Intelligence Layer (Universe + Fund 360° + Sectors)

## Objective
Redesign Universe Explorer, Fund 360°, and Sector Intelligence from data displays into decision tools. Every number becomes a colored tag or plain-English insight. The six lenses are FELT, not just displayed.

---

## Design Principles (apply everywhere)

### Color spectrum for all scoring/sentiment
Use a consistent green-to-red spectrum for ALL positive-to-negative messaging:
- 90-100: `#085041` (deep teal) — exceptional
- 70-89: `#0d9488` (teal) — strong  
- 50-69: `#5DCAA5` (light teal) — adequate
- 30-49: `#BA7517` (amber) — weak
- 0-29: `#E24B4A` (red) — poor/avoid

### No raw scores without context
NEVER show a lens score as just a number. Always pair with:
- An adjective tag: Leader / Strong / Adequate / Weak / Poor
- OR a contextual phrase: "Top 18% in category" / "Below 71% of peers"
- OR a comparison: "Fund: 82 vs Avg: 54"

### Bubble colors
Sector compass: green-to-red spectrum based on momentum (green = strong positive momentum, red = negative momentum). NOT opacity.

---

## TAB 1: Universe Explorer Redesign

### File: `web/src/pages/universe.jsx` (rewrite)

**Filters bar (horizontal, compact):**
- Regular / Direct / Both toggle
- Growth / IDCW / Both toggle
- Category dropdown (All, Equity Large Cap, Equity Flexi Cap, etc.)
- Fund type dropdown (All, Equity, Debt, Hybrid, Other)
- AMC dropdown
- Temporal: 6M / 1Y / 3Y / 5Y / 7Y / 10Y toggle (this changes which return period the lens scores reference)

**Axis controls:**
- X-axis: dropdown of 6 lenses (default: Return)
- Y-axis: dropdown of 6 lenses (default: Risk)
- Color: dropdown of 6 lenses (default: Alpha) — uses green-to-red spectrum
- Size = AUM (always, not configurable)

**Quadrant zones:** Light background shading only (top-right lightest green tint, bottom-left lightest red tint). Zones self-explain. No colored bubbles repeating the zone meaning.

**Bubble design:**
- Position = X/Y lens scores
- Size = AUM (log scale — ₹50Cr = small, ₹50,000Cr = large)
- Color = chosen lens score using green-to-red spectrum
- Label = short fund name (only on larger bubbles, collision-free)

**Hover card** (appears on bubble hover):
- Fund name, AMC, category
- 6 lens scores as small colored circles (each colored by green-to-red spectrum) with 3-letter labels (Ret, Rsk, Con, Alp, Eff, Res)
- Tier tags: Leader / Strong / etc. as colored pills
- 1Y return, AUM
- "Deep dive →" button

**Count summary bar** (above chart):
- Shows: "3,412 Regular Growth funds" with tier breakdown cards (Leaders: 841, Strong: 1,202, Average: 892, Weak: 344, Avoid: 133) — each card colored by spectrum, clickable to filter

**Data source:** Use new `/api/v1/funds/universe` bulk endpoint (PR-13). Cache client-side 10 minutes.

**Key: Regular/Growth filter should be default ON** — this cuts 13,365 to ~3,400 immediately. Most users care about Regular Growth plans.

### Components:
- `web/src/components/universe/BubbleScatter.jsx` — rewrite with green-to-red color encoding
- `web/src/components/universe/FilterBar.jsx` — new horizontal filter bar replacing old FilterPanel
- `web/src/components/universe/HoverCard.jsx` — new hover card with lens circles
- `web/src/components/universe/TierSummary.jsx` — new tier count cards

---

## TAB 2: Fund 360° Redesign

### File: `web/src/pages/fund360.jsx` (rewrite)

**Header section:**
- Fund name (large), AMC name, SEBI category
- Inception date + "X.X years" age
- AUM formatted, expense ratio, benchmark name
- Tier tags as colored pills (Leader, Consistent, Expensive, etc.)

**The Verdict** (generated client-side from lens scores + risk stats):
- Left border accent (teal)
- 3-5 sentence narrative covering: characterization, strengths, weaknesses, sector concentration risk, bottom-line recommendation
- Built from template patterns keyed off lens scores (see verdict generation logic in PR spec)

### File: `web/src/components/fund360/VerdictGenerator.js`

Pure function that takes fund data + lens scores + risk stats and returns a narrative string.

```javascript
export function generateVerdict(fund, lens, risk, peers) {
  const parts = [];
  
  // Character
  const avgScore = (lens.return_score + lens.risk_score + lens.consistency_score + 
                    lens.alpha_score + lens.efficiency_score + lens.resilience_score) / 6;
  if (avgScore > 75) parts.push(`A strong ${fund.category_name.toLowerCase()} performer.`);
  else if (avgScore > 55) parts.push(`An adequate ${fund.category_name.toLowerCase()} fund with mixed signals.`);
  else parts.push(`A below-average ${fund.category_name.toLowerCase()} fund.`);
  
  // Strengths (top 2 lenses)
  const sorted = Object.entries(lens).filter(([k]) => k.endsWith('_score')).sort((a,b) => b[1]-a[1]);
  // ... build strength phrases
  
  // Weaknesses (bottom 2 lenses)
  // ... build weakness phrases
  
  // Expense flag
  if (lens.efficiency_score < 40) parts.push(`Higher expense ratio than peers.`);
  
  // Bottom line
  if (avgScore > 70) parts.push(`Bottom line: strong for core allocation.`);
  else if (avgScore > 50) parts.push(`Bottom line: adequate, but better options exist.`);
  else parts.push(`Bottom line: consider switching to a stronger peer.`);
  
  return parts.join(' ');
}
```

**Six-Lens Profile** (2×3 grid of lens cards):
Each card shows:
- Lens name + score (large, colored by spectrum)
- Progress bar (colored by spectrum)
- Plain-English translation: "Top 18% in Flexi Cap" / "Below-average volatility" / "Expensive for category"
- Context row: "Avg: 54 · Best: 96 · Rank: 8 of 42"

**Returns vs Peers** (visual bar comparison):
- 1Y, 3Y, 5Y bars side by side (fund vs category avg)
- Fund bar colored teal, avg bar colored light gray
- Gap shown as text: "+7.9% ahead"

**Smart Alternatives** (NOT a 50-fund peer list):
- "3 funds that beat this one + 2 cheaper alternatives"
- Each card: fund name, one-line reason ("Highest alpha in category"), key lens pills, Compare button
- Logic: top 3 peers by return_score in same category + top 2 by efficiency_score

**Collapsible sections** (default collapsed, click to expand):
- Sector allocation — stacked bar + sector list with compass quadrant tags (Leading/Improving/Weakening/Lagging pulled from MarketPulse)
- Top 10 holdings — name, ISIN, sector, weight bar, sector compass tag
- Risk profile — 3 hero metrics (Max DD, Sharpe, Downside Capture) with "X% better than peers" tags + detail grid
- Peer positioning — dot-on-track visualization (each lens = a track, fund's dot positioned at its percentile)
- NAV chart — with period tabs (1M/3M/6M/1Y/3Y/5Y/Since Inception). FIX the "Max" period bug.

**Navigation:**
- Simulate → goes to `/strategies?fund={mstar_id}` (the merged tab in PR-14b)
- Compare → side-by-side panel with search to add funds
- Back to Universe → returns to explorer with scroll position preserved

### Components:
- `web/src/components/fund360/Verdict.jsx`
- `web/src/components/fund360/LensCard.jsx` (reusable for each lens)
- `web/src/components/fund360/ReturnsBars.jsx`
- `web/src/components/fund360/SmartAlternatives.jsx`
- `web/src/components/fund360/SectorAllocation.jsx` (with compass tags)
- `web/src/components/fund360/HoldingsTable.jsx` (with compass tags)
- `web/src/components/fund360/RiskProfile.jsx` (hero metrics + grid)
- `web/src/components/fund360/PeerPositioning.jsx` (dot-on-track)
- `web/src/components/fund360/PerformanceChart.jsx` (fix Max period)

---

## TAB 3: Sector Intelligence Redesign

### File: `web/src/pages/sectors.jsx` (rewrite)

**Compass chart:**
- 4-quadrant scatter: X = RS Score, Y = RS Momentum
- Quadrant zones: light background shading (green tint top-right, red tint bottom-left)
- Bubble color: green-to-red spectrum based on momentum value (NOT opacity)
  - Strong positive momentum (+5 or more): deep teal `#085041`
  - Positive momentum (+2 to +5): teal `#0d9488`
  - Mild positive (0 to +2): light teal `#5DCAA5`
  - Mild negative (0 to -2): amber `#BA7517`
  - Strong negative (-2 or worse): red `#E24B4A`
- Bubble size: number of MF schemes with >10% exposure to that sector
- Inside each bubble: sector name + momentum value
- **CLICK a bubble → the same page scrolls down to show funds for that sector** (no navigation, inline expansion)

**Market context sidebar:**
Every card has a metric value AND a 1-2 line explainer:
- Regime: "Risk-on" + "Broad market favoring equities. 4 of 11 sectors leading."
- Breadth: "62%" + "62% of Nifty 500 above 50d avg. Fading from 71% last week."
- Sentiment: "55/100" + "Neutral. Neither fear nor greed. Good for SIP continuation."
- Rotation signal: "IT moving in" + "3rd month of RS improvement. Crossed to leading."
- Period selector: 3M / 6M / 1Y

**Fund drill-down** (appears below compass when sector clicked):
- Header: "Technology · Leading · RS: 72 · Momentum: +8.4"
- Ranked fund cards sorted by sector_exposure × average_lens_score
- Each card: rank, fund name, sector exposure %, key lens scores as colored circles, tier tags (Leader/Strong/etc as adjectives not numbers), Deep Dive and Simulate buttons

**Sector rotation heatmap** (12-month timeline):
- Rows: 11 sectors
- Columns: months (12)
- Cell color: green (Leading), blue (Improving), amber (Weakening), red (Lagging)
- Current month highlighted with border

**Graceful MarketPulse offline handling:**
- If localhost:8000 returns errors, show "MarketPulse offline" banner
- Compass and rotation are empty (clear message)
- Fund drill-down still works using cached/stored sector exposure data

### Components:
- `web/src/components/sectors/CompassChart.jsx` — D3 scatter with green-to-red bubbles, click handler
- `web/src/components/sectors/MarketContextPanel.jsx` — sidebar with explainer subtexts
- `web/src/components/sectors/FundDrillDown.jsx` — ranked fund cards with lens circles
- `web/src/components/sectors/RotationHeatmap.jsx` — 12-month grid

---

## Shared Components (update)

### `web/src/lib/lens.js` — add:
```javascript
export function lensColor(score) {
  if (score >= 90) return '#085041';
  if (score >= 70) return '#0d9488';
  if (score >= 50) return '#5DCAA5';
  if (score >= 30) return '#BA7517';
  return '#E24B4A';
}

export function lensLabel(score) {
  if (score >= 90) return 'Exceptional';
  if (score >= 75) return 'Leader';
  if (score >= 60) return 'Strong';
  if (score >= 45) return 'Adequate';
  if (score >= 30) return 'Weak';
  return 'Poor';
}

export function lensBgColor(score) {
  if (score >= 70) return '#E1F5EE';
  if (score >= 50) return '#E1F5EE';
  if (score >= 30) return '#FAEEDA';
  return '#FCEBEB';
}
```

### `web/src/components/shared/LensCircle.jsx` — new:
Small colored circle showing a lens score (used in hover cards, fund lists, drill-downs). Color by green-to-red spectrum.

### `web/src/components/shared/TierBadge.jsx` — new:
Colored pill showing tier name (Leader, Strong, etc.). Background color matches spectrum.

---

## QA Checklist

1. `pnpm build` succeeds
2. Universe: default filter = Regular + Growth, shows ~3,400 funds
3. Universe: bubble color changes when Color dropdown changes
4. Universe: temporal filter changes return period data
5. Universe: hover shows lens circles with correct colors
6. Fund 360°: verdict paragraph generates for any fund
7. Fund 360°: all 6 lens cards show context (avg, best, rank)
8. Fund 360°: smart alternatives shows 3 better + 2 cheaper
9. Fund 360°: all collapsible sections expand/collapse
10. Fund 360°: NAV chart Max period works (bug fix)
11. Sectors: compass renders with green-to-red bubbles
12. Sectors: click bubble → fund drill-down appears below
13. Sectors: market context cards have explainer subtexts
14. Sectors: rotation heatmap renders 12 months
15. MarketPulse offline → graceful degradation
16. All lens scores use green-to-red spectrum everywhere
17. No raw numbers without adjective tags or context

Commit: `PR-14a: frontend redesign — universe + fund 360° + sector intelligence`
