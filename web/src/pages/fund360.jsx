import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/router';
import {
  fetchFundDetail,
  fetchFundLensScores,
  fetchNAVHistory,
  fetchHoldings,
  fetchSectorExposure,
  fetchPeers,
  fetchFundRisk,
  fetchSectors,
} from '../lib/api';
import { LENS_OPTIONS, LENS_CLASS_KEYS } from '../lib/lens';
import SkeletonLoader from '../components/shared/SkeletonLoader';
import EmptyState from '../components/shared/EmptyState';
import FundSearch from '../components/fund360/FundSearch';
import HeroSection from '../components/fund360/HeroSection';
import NarrativeCard from '../components/fund360/NarrativeCard';
import CompareMode from '../components/fund360/CompareMode';
import PerformanceChart from '../components/fund360/PerformanceChart';
import ReturnsBars from '../components/fund360/ReturnsBars';
import LensCard from '../components/fund360/LensCard';
import HoldingsTable from '../components/fund360/HoldingsTable';
import SectorAllocation from '../components/fund360/SectorAllocation';
import AssetAllocation from '../components/fund360/AssetAllocation';
import RiskProfile from '../components/fund360/RiskProfile';
import PeerPositioning from '../components/fund360/PeerPositioning';

/* ── Collapsible Section ─────────────────────────────────── */
function CollapsibleSection({ title, icon, count, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="bg-gradient-to-br from-white to-slate-50/80 border-[0.5px] border-slate-200/40 rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.03),0_8px_32px_rgba(0,0,0,0.04)] overflow-hidden transition-all duration-300">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full px-3.5 py-2.5 flex items-center justify-between hover:bg-slate-50/50 transition-colors"
      >
        <h3 className="text-xs font-semibold text-slate-700 flex items-center gap-2">
          {icon}
          {title}
          {count != null && (
            <span className="text-[9px] font-mono tabular-nums bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">
              {count}
            </span>
          )}
        </h3>
        <svg
          className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <div
        className={`transition-all duration-300 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] overflow-hidden ${open ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}
      >
        <div className="px-3.5 pb-3.5">{children}</div>
      </div>
    </div>
  );
}

/* ── Compact Section (always open, no accordion) ──────── */
function Section({ title, icon, count, children }) {
  return (
    <div className="bg-gradient-to-br from-white to-slate-50/80 border-[0.5px] border-slate-200/40 rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.03),0_8px_32px_rgba(0,0,0,0.04)] overflow-hidden">
      <div className="px-3.5 py-2 border-b border-slate-100/60 flex items-center justify-between">
        <h3 className="text-xs font-semibold text-slate-700 flex items-center gap-2">
          {icon}
          {title}
        </h3>
        {count != null && (
          <span className="text-[9px] font-mono tabular-nums bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">
            {count}
          </span>
        )}
      </div>
      <div className="px-3.5 py-3">{children}</div>
    </div>
  );
}

/* ── FUND DETAIL PAGE ─────────────────────────────────── */
export default function Fund360Page() {
  const router = useRouter();
  const [mstarId, setMstarId] = useState(null);

  const [fundDetail, setFundDetail] = useState(null);
  const [lensScores, setLensScores] = useState(null);
  const [navData, setNavData] = useState([]);
  const [holdings, setHoldings] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [peers, setPeers] = useState(null);
  const [riskStats, setRiskStats] = useState(null);
  const [sectorQuadrants, setSectorQuadrants] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [compareOpen, setCompareOpen] = useState(false);

  useEffect(() => {
    if (router.isReady) {
      // Support both /fund360?fund=ID and /fund/ID URL patterns
      const fromQuery = router.query.fund;
      if (fromQuery) {
        setMstarId(fromQuery);
      } else if (typeof window !== 'undefined') {
        const pathMatch = window.location.pathname.match(/\/fund\/([A-Za-z0-9]+)/);
        if (pathMatch) setMstarId(pathMatch[1]);
      }
    }
  }, [router.isReady, router.query.fund]);

  useEffect(() => {
    if (!mstarId) return;
    let cancelled = false;
    async function loadPrimary() {
      setLoading(true);
      setError(null);
      try {
        const [detailRaw, lens, nav, hold, sect] = await Promise.all([
          fetchFundDetail(mstarId).then((r) => r.data),
          fetchFundLensScores(mstarId).then((r) => r.data),
          fetchNAVHistory(mstarId, '1y').then((r) => r.data || []),
          fetchHoldings(mstarId, 10).then((r) => r.data || []),
          fetchSectorExposure(mstarId).then((r) => r.data || []),
        ]);
        if (cancelled) return;
        const fund = detailRaw?.fund ?? detailRaw ?? {};
        const detail = {
          ...fund,
          returns: detailRaw?.returns ?? null,
          risk_stats: detailRaw?.risk_stats ?? null,
          ranks: detailRaw?.ranks ?? null,
          indian_risk_level: detailRaw?.indian_risk_level ?? null,
          primary_benchmark: detailRaw?.primary_benchmark ?? null,
          investment_strategy: detailRaw?.investment_strategy ?? null,
          managers: detailRaw?.managers ?? null,
        };
        setFundDetail(detail);
        setLensScores(lens);
        setNavData(nav);
        setHoldings(hold);
        setSectors(sect);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadPrimary();
    return () => { cancelled = true; };
  }, [mstarId]);

  useEffect(() => {
    if (!mstarId) return;
    let cancelled = false;
    async function loadSecondary() {
      const [pRes, rRes, sRes] = await Promise.allSettled([
        fetchPeers(mstarId),
        fetchFundRisk(mstarId),
        fetchSectors('3M'),
      ]);
      if (cancelled) return;
      if (pRes.status === 'fulfilled') {
        const peerData = pRes.value.data;
        setPeers(Array.isArray(peerData) ? peerData : peerData?.peers || []);
      }
      if (rRes.status === 'fulfilled') {
        const riskData = rRes.value.data;
        setRiskStats(Array.isArray(riskData) ? riskData[0] || null : riskData || null);
      }
      if (sRes.status === 'fulfilled') {
        const sectorData = sRes.value.data;
        if (Array.isArray(sectorData)) {
          const qMap = {};
          for (const s of sectorData) {
            const name = s.display_name || s.sector_name || s.name;
            if (name) qMap[name] = { quadrant: s.quadrant || s.rs_quadrant || 'Neutral' };
          }
          setSectorQuadrants(qMap);
        }
      }
    }
    loadSecondary();
    return () => { cancelled = true; };
  }, [mstarId]);

  // Compute peer averages for PeerPositioning bars
  const peerAvgs = useMemo(() => {
    if (!peers?.length) return {};
    const keys = ['return_score', 'risk_score', 'consistency_score', 'alpha_score', 'efficiency_score', 'resilience_score'];
    const avgs = {};
    keys.forEach((k) => {
      const vals = peers.filter((p) => p[k] != null).map((p) => Number(p[k]));
      avgs[k] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 50;
    });
    return avgs;
  }, [peers]);

  // Extract category returns more robustly
  const categoryReturns = useMemo(() => {
    if (fundDetail?.category_returns) return fundDetail.category_returns;
    if (fundDetail?.returns?.category) return fundDetail.returns.category;
    return null;
  }, [fundDetail]);

  const handleFundSearch = useCallback(
    (id) => { router.push(`/fund360?fund=${id}`); },
    [router]
  );

  if (!mstarId) return <FundSearch onSelect={handleFundSearch} />;

  if (loading) {
    return (
      <div className="space-y-3 -m-6">
        <div className="bg-white border-b border-slate-200 px-4 py-3">
          <SkeletonLoader variant="row" className="w-80 h-6 mb-2" />
          <SkeletonLoader variant="row" className="w-48 h-4" />
        </div>
        <div className="px-4 space-y-3">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonLoader key={i} className="h-16 rounded-2xl" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <SkeletonLoader variant="chart" className="h-64 rounded-2xl" />
            <SkeletonLoader className="h-64 rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        message={`Failed to load fund: ${error}`}
        action="Back to Explorer"
        onAction={() => router.push('/fund360')}
      />
    );
  }

  if (!fundDetail) return null;

  const fundReturns = fundDetail.returns || fundDetail;

  return (
    <div className="space-y-0 -m-6">
      {/* Hero Bar — compact */}
      <HeroSection
        fundDetail={fundDetail}
        lensScores={lensScores}
        mstarId={mstarId}
        onCompare={() => setCompareOpen(true)}
      />

      <div className="px-4 py-3 space-y-3">
        {/* Above fold: Verdict + 6 Lens Cards (2x3 grid) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {/* Verdict / Narrative — 1/3 width */}
          <div className="lg:col-span-1">
            <NarrativeCard
              mstarId={mstarId}
              headlineTag={lensScores?.headline_tag}
            />
          </div>

          {/* 6 Lens Cards as 2x3 grid — 2/3 width */}
          {lensScores && (
            <div className="lg:col-span-2">
              <Section
                title="Six-Lens Profile"
                icon={
                  <svg className="w-3.5 h-3.5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                }
              >
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {LENS_OPTIONS.map((lens) => {
                    const classKey = LENS_CLASS_KEYS[lens.key];
                    return (
                      <LensCard
                        key={lens.key}
                        name={lens.label}
                        lensKey={lens.key}
                        score={lensScores[lens.key]}
                        tier={lensScores[classKey]}
                        categoryName={fundDetail.category_name}
                        riskStats={riskStats || fundDetail.risk_stats}
                        fundDetail={fundReturns}
                      />
                    );
                  })}
                </div>
              </Section>
            </div>
          )}
        </div>

        {/* NAV Performance + Returns side-by-side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <Section
            title="NAV Performance"
            icon={
              <svg className="w-3.5 h-3.5 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
              </svg>
            }
          >
            <PerformanceChart
              mstarId={mstarId}
              initialData={navData}
              fundReturns={fundReturns}
            />
          </Section>

          <Section
            title="Returns vs Category"
            icon={
              <svg className="w-3.5 h-3.5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            }
          >
            <ReturnsBars
              fundReturns={fundReturns}
              categoryReturns={categoryReturns}
            />
          </Section>
        </div>

        {/* Collapsible sections below the fold */}
        <CollapsibleSection
          title="Asset Allocation"
          defaultOpen={true}
          icon={
            <svg className="w-3.5 h-3.5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
            </svg>
          }
        >
          <AssetAllocation mstarId={mstarId} />
        </CollapsibleSection>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <CollapsibleSection
            title="Sector Allocation"
            defaultOpen={true}
            icon={
              <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
              </svg>
            }
          >
            <SectorAllocation sectors={sectors} sectorQuadrants={sectorQuadrants} />
          </CollapsibleSection>

          <CollapsibleSection
            title="Top Holdings"
            count={holdings.length > 0 ? holdings.length : undefined}
            defaultOpen={true}
            icon={
              <svg className="w-3.5 h-3.5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            }
          >
            <HoldingsTable holdings={holdings} sectorQuadrants={sectorQuadrants} />
          </CollapsibleSection>
        </div>

        <CollapsibleSection
          title="Risk Profile"
          icon={
            <svg className="w-3.5 h-3.5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          }
        >
          <RiskProfile riskStats={riskStats || fundDetail.risk_stats || null} />
        </CollapsibleSection>

        <CollapsibleSection
          title="Peer Positioning"
          icon={
            <svg className="w-3.5 h-3.5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          }
        >
          <PeerPositioning
            scores={lensScores}
            peerAvgs={peerAvgs}
            peers={peers}
          />
        </CollapsibleSection>
      </div>

      {/* Compare Mode Panel */}
      {compareOpen && lensScores && (
        <CompareMode
          primaryFund={fundDetail}
          primaryScores={lensScores}
          onClose={() => setCompareOpen(false)}
        />
      )}
    </div>
  );
}
