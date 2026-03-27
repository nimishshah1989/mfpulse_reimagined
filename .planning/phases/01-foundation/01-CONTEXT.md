# Phase 1: Foundation - Context

**Gathered:** 2026-03-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver the application shell: Next.js 14 scaffold with static export, typed API client for the existing FastAPI backend, Indian number formatters, Jhaveri design system primitives, skeleton loaders, error/empty states, and global navigation with `/` search shortcut. Every subsequent phase builds on this base.

</domain>

<decisions>
## Implementation Decisions

### Scaffold & Routing
- **D-01:** Next.js 14 App Router with `output: 'export'` — static build served by FastAPI from `web/out`
- **D-02:** SPA fallback route MUST be added to FastAPI BEFORE the StaticFiles mount so hard refresh on `/funds/ISIN123` returns the page, not 404 (critical pitfall from research)
- **D-03:** Route structure: `/` (dashboard), `/funds` (discovery/screener), `/funds/[id]` (deep dive), `/compare` (comparison), `/simulate` (simulator), `/portfolios` (model portfolios), `/watchlist`, `/system` (admin)
- **D-04:** pnpm as package manager with frozen lockfile

### API Client
- **D-05:** Typed API client wrapping `fetch` that unwraps `{ success, data, meta, error }` envelope — throws typed errors on `success: false`
- **D-06:** All financial values received as strings (Decimal-as-string convention from backend) — never parsed to float for display
- **D-07:** React Query v5 as server state manager — stale time 10 minutes for fund data (weekly updates), 5 minutes for market data
- **D-08:** MarketPulse fields typed as `T | null` throughout — null-safe access everywhere

### Formatters
- **D-09:** `lib/formatters.ts` is the FIRST utility written — custom implementation since `Intl.NumberFormat('en-IN')` doesn't handle Lakh/Crore shorthand
- **D-10:** Three modes: full (₹1,23,456), lakh shorthand (₹12.5L), crore shorthand (₹1.2Cr) — auto-selected by magnitude
- **D-11:** `font-mono tabular-nums` CSS class on all formatted numbers
- **D-12:** GREEN (#059669) for positive returns, RED (#dc2626) for negative — never reversed

### Design System
- **D-13:** Jhaveri design system as Tailwind config tokens — teal-600 primary, Inter font, white cards on slate-50 background, consistent spacing scale
- **D-14:** Foundation primitives: Button, Card, Badge (lens tiers), Input, Skeleton, EmptyState, ErrorState, DataFreshness indicator
- **D-15:** Tailwind v3.4.x with `tailwind.config.js` — NOT v4
- **D-16:** Desktop-only (1280px+ min-width) — no mobile responsive

### Skeleton & Loading
- **D-17:** Page-specific skeleton shapes that match the content layout (not generic pulse bars)
- **D-18:** Skeletons for data-loading states; ErrorState component for failures; EmptyState for no-data scenarios

### Navigation
- **D-19:** Top navigation bar (not sidebar) — visible on every page with app name, route links, and search input
- **D-20:** Search input opens on pressing `/` — keyboard shortcut wired in Phase 1, actual search logic in Phase 2
- **D-21:** Data freshness indicator ("NAV as of [date]") in the nav or page header area

### Claude's Discretion
- Animation style for skeleton shimmer (CSS animation vs framer-motion)
- Exact Tailwind spacing scale values
- File/folder organization within `web/src/` (standard Next.js App Router conventions)
- React Query error boundary vs per-component error handling approach
- Whether to scaffold empty page shells for all routes or just `/` in Phase 1

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Specs
- `CLAUDE.md` — Full project operating system: architecture, code standards, six-lens definitions, API envelope format, frontend standards, tech stack
- `CLAUDE.md` §Technology Stack — Complete frontend stack decisions with version pins, alternatives considered, and compatibility matrix
- `CLAUDE.md` §Frontend Standards — Design system tokens, chart library, number formatting rules

### Backend Integration
- `backend/app/main.py` — FastAPI app with static frontend mount (needs SPA fallback fix)
- `backend/app/core/config.py` — CORS origins include `localhost:3000` and `mfpulse.jslwealth.in`
- `backend/app/core/exceptions.py` — Error envelope structure
- `backend/app/api/v1/router.py` — All available API routes (funds, categories, holdings, system, ingestion, marketpulse)

### Requirements
- `.planning/REQUIREMENTS.md` §Foundation — FOUND-01 through FOUND-08, UX-02, UX-04

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Backend API is fully built — funds, categories, holdings, system, ingestion, marketpulse routes all available at `/api/v1`
- API envelope `{ success, data, meta, error }` is implemented in backend exception handler — frontend client must match this shape
- CORS already configured for `localhost:3000`

### Established Patterns
- Backend uses Pydantic v2 schemas — frontend Zod schemas should mirror these
- Error codes are string enums (NOT_FOUND, VALIDATION_ERROR, etc.) — frontend error handling should map these

### Integration Points
- `web/out` directory is where FastAPI expects the static build (`main.py` line 99)
- Health endpoint at `GET /health` for connectivity checks
- All API routes under `/api/v1` prefix

</code_context>

<specifics>
## Specific Ideas

No specific requirements — standard approaches per CLAUDE.md tech stack spec.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-03-27*
