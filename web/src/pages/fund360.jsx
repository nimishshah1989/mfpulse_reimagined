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
import PerformanceChart from '../components/fund360/PerformanceChart';
import ReturnsBars from '../components/fund360/ReturnsBars';
import LensCard from '../components/fund360/LensCard';
import QuartileRibbon from '../components/fund360/QuartileRibbon';
import HoldingsTable from '../components/fund360/HoldingsTable';
import SectorAllocation from '../components/fund360/SectorAllocation';
import AssetAllocation from '../components/fund360/AssetAllocation';
import RiskProfile from '../components/fund360/RiskProfile';
import PeerPositioning from '../components/fund360/PeerPositioning';
import CompareMode from '../components/fund360/CompareMode';

/* ---- Section wrapper matching mockup white cards ---- */
function SectionCard({ title, subtitle, badge, children, className = '' }) {
  return (
    <div className={`bg-white rounded-2xl border border-slate-200 p-5 animate-in ${className}`}>
      {(title || subtitle || badge) && (
        <div className="flex items-center justify-between mb-4">
          <div>
            {title && (
              <p className="text-[11px] font-semibold tracking-[0.08em] uppercase text-slate-400">
                {title}
              </p>
            )}
            {subtitle && (
              <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
            )}
          </div>
          {badge}
        </div>
      )}
      {children}
    </div>
  );
}

/* ---- FUND DETAIL PAGE ---- */
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
          category_returns: detailRaw?.category_returns ?? null,
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

  const categoryReturns = useMemo(() => {
    if (fundDetail?.category_returns) return fundDetail.category_returns;
    if (fundDetail?.returns?.category) return fundDetail.returns.category;
    return null;
  }, [fundDetail]);

  const handleFundSearch = useCallback(
    (id) => { router.push(`/fund360?fund=${id}`); },
    [router]
  );

  /* ---- No fund selected: show explorer ---- */
  if (!mstarId) return <FundSearch onSelect={handleFundSearch} />;

  /* ---- Loading state ---- */
  if (loading) {
    return (
      <div className="-m-5 max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <SkeletonLoader className="h-48 rounded-2xl" />
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <SkeletonLoader className="lg:col-span-2 h-72 rounded-2xl" />
          <SkeletonLoader className="lg:col-span-3 h-72 rounded-2xl" />
        </div>
        <SkeletonLoader className="h-80 rounded-2xl" />
      </div>
    );
  }

  /* ---- Error state ---- */
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
  const combinedRiskStats = riskStats || fundDetail.risk_stats || null;

  return (
    <div className="-m-5 max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* SECTION 1: Hero */}
      <HeroSection
        fundDetail={fundDetail}
        lensScores={lensScores}
        mstarId={mstarId}
        onCompare={() => setCompareOpen(true)}
      />

      {/* SECTION 2: Six-Lens Radar + Lens Breakdown */}
      {lensScores && (
        <div className="animate-in grid grid-cols-1 lg:grid-cols-5 gap-4" style={{ animationDelay: '0.1s' }}>
          {/* Narrative / Verdict (2 cols) */}
          <div className="lg:col-span-2 space-y-4">
            <NarrativeCard
              mstarId={mstarId}
              headlineTag={lensScores?.headline_tag}
            />
            <SectionCard title="Fund DNA -- Six Lenses">
              <RiskProfile riskStats={combinedRiskStats} />
            </SectionCard>
          </div>

          {/* Lens Breakdown (3 cols) */}
          <SectionCard
            title="Lens Scores vs Category"
            subtitle="Click any lens to see detailed breakdown"
            className="lg:col-span-3"
          >
            <div className="space-y-2">
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
                    riskStats={combinedRiskStats}
                    fundDetail={fundDetail}
                  />
                );
              })}
            </div>
          </SectionCard>
        </div>
      )}

      {/* SECTION 3: NAV Performance Chart */}
      <SectionCard title="Performance">
        <PerformanceChart
          mstarId={mstarId}
          initialData={navData}
          fundReturns={fundReturns}
          riskStats={combinedRiskStats}
        />
      </SectionCard>

      {/* SECTION 4: Quartile Consistency Ribbon */}
      {fundDetail.ranks && (
        <SectionCard title="Quartile Consistency">
          <QuartileRibbon
            ranks={fundDetail.ranks}
            categoryName={fundDetail.category_name}
          />
        </SectionCard>
      )}

      {/* SECTION 5: Risk Profile Stats Grid */}
      <SectionCard title="Risk Profile">
        <RiskProfile riskStats={combinedRiskStats} />
      </SectionCard>

      {/* SECTION 6: Holdings + Sector + Asset */}
      <div className="animate-in grid grid-cols-1 lg:grid-cols-3 gap-4" style={{ animationDelay: '0.3s' }}>
        {/* Holdings (2 cols) */}
        <SectionCard title="Top Holdings" className="lg:col-span-2">
          <HoldingsTable holdings={holdings} sectorQuadrants={sectorQuadrants} />
        </SectionCard>

        {/* Sector + Asset (1 col) */}
        <div className="space-y-4">
          <SectionCard title="Sector Allocation">
            <SectorAllocation sectors={sectors} sectorQuadrants={sectorQuadrants} />
          </SectionCard>
          <SectionCard title="Asset Allocation">
            <AssetAllocation mstarId={mstarId} />
          </SectionCard>
        </div>
      </div>

      {/* SECTION 7: Returns vs Category */}
      <SectionCard title="Returns vs Category">
        <ReturnsBars
          fundReturns={fundReturns}
          categoryReturns={categoryReturns}
        />
      </SectionCard>

      {/* SECTION 8: Peer Comparison */}
      <SectionCard title="Peer Comparison">
        <PeerPositioning
          scores={lensScores}
          peerAvgs={peerAvgs}
          peers={peers}
        />
      </SectionCard>

      {/* Compare Mode Panel */}
      {compareOpen && lensScores && (
        <CompareMode
          primaryFund={fundDetail}
          primaryScores={lensScores}
          onClose={() => setCompareOpen(false)}
        />
      )}

      {/* Footer spacer */}
      <div className="h-8" />
    </div>
  );
}
