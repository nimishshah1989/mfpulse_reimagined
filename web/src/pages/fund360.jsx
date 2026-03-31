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
  fetchAssetAllocation,
} from '../lib/api';
import { LENS_OPTIONS, LENS_CLASS_KEYS } from '../lib/lens';
import SkeletonLoader from '../components/shared/SkeletonLoader';
import EmptyState from '../components/shared/EmptyState';
import InfoBulb from '../components/shared/InfoBulb';
import FundSearch from '../components/fund360/FundSearch';
import HeroSection from '../components/fund360/HeroSection';
import FundManagerStrategy from '../components/fund360/FundManagerStrategy';
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
import RadarChart from '../components/fund360/RadarChart';
import IntelligenceCards from '../components/fund360/IntelligenceCards';
import PeerScatter from '../components/fund360/PeerScatter';
import PortfolioMetrics from '../components/fund360/PortfolioMetrics';
import CreditQuality from '../components/fund360/CreditQuality';

/* ---- Section wrapper — matches sectors page design language ---- */
function SectionCard({ title, subtitle, badge, children, className = '' }) {
  return (
    <div className={`bg-white rounded-xl border border-slate-200 p-5 ${className}`}>
      {(title || subtitle || badge) && (
        <div className="flex items-center justify-between mb-4">
          <div>
            {title && (
              <p className="section-title">{title}</p>
            )}
            {subtitle && (
              <p className="text-[11px] text-slate-400 mt-0.5">{subtitle}</p>
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
  const [holdingsSnapshot, setHoldingsSnapshot] = useState(null);
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
          category_avg_returns: detailRaw?.category_avg_returns ?? null,
          indian_risk_level: detailRaw?.indian_risk_level ?? null,
          primary_benchmark: detailRaw?.primary_benchmark ?? null,
          investment_strategy: detailRaw?.investment_strategy ?? null,
          managers: detailRaw?.managers ?? null,
          credit_quality: detailRaw?.credit_quality ?? null,
          portfolio: detailRaw?.portfolio ?? null,
          top_holdings: detailRaw?.top_holdings ?? null,
          sector_exposure: detailRaw?.sector_exposure ?? null,
          category_fund_count: detailRaw?.category_fund_count ?? null,
          turnover_ratio: detailRaw?.turnover_ratio ?? null,
          gross_expense_ratio: detailRaw?.gross_expense_ratio ?? null,
          sip_available: detailRaw?.sip_available ?? null,
          lock_in_period: detailRaw?.lock_in_period ?? null,
          is_etf: detailRaw?.is_etf ?? null,
          is_index_fund: detailRaw?.is_index_fund ?? null,
          distribution_status: detailRaw?.distribution_status ?? null,
          closed_to_investors: detailRaw?.closed_to_investors ?? null,
          previous_fund_name: detailRaw?.previous_fund_name ?? null,
          investment_philosophy: detailRaw?.investment_philosophy ?? null,
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
      const [pRes, rRes, sRes, aRes] = await Promise.allSettled([
        fetchPeers(mstarId),
        fetchFundRisk(mstarId),
        fetchSectors('3M'),
        fetchAssetAllocation(mstarId),
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
      if (aRes.status === 'fulfilled') {
        setHoldingsSnapshot(aRes.value?.data || aRes.value || null);
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

  // Compute approximate rank info from percentile scores + peer count
  const rankInfoMap = useMemo(() => {
    if (!lensScores || !peers?.length) return {};
    const total = peers.length + 1; // include the fund itself
    const map = {};
    LENS_OPTIONS.forEach((lens) => {
      const score = lensScores[lens.key];
      if (score != null) {
        const rank = Math.max(1, Math.round(total * (1 - Number(score) / 100)));
        map[lens.key] = { rank, total };
      }
    });
    return map;
  }, [lensScores, peers]);

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
      <div className="max-w-7xl mx-auto space-y-6">
        <SkeletonLoader className="h-48 rounded-xl" />
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <SkeletonLoader className="lg:col-span-2 h-72 rounded-xl" />
          <SkeletonLoader className="lg:col-span-3 h-72 rounded-xl" />
        </div>
        <SkeletonLoader className="h-80 rounded-xl" />
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
    <div className="max-w-7xl mx-auto space-y-6">
      {/* SECTION 1: Hero — Fund Identity + Quick Stats + Returns Strip */}
      <HeroSection
        fundDetail={fundDetail}
        lensScores={lensScores}
        mstarId={mstarId}
        onCompare={() => setCompareOpen(true)}
      />

      {/* SECTION 2: Intelligence Signals — 3 actionable cards up front */}
      <SectionCard
        title="Intelligence Signals"
        subtitle="Three things to know before making a decision on this fund"
      >
        <IntelligenceCards mstarId={mstarId} />
      </SectionCard>

      {/* SECTION 4: Six-Lens Radar + Lens Breakdown */}
      {lensScores && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Narrative / Radar (2 cols) */}
          <div className="lg:col-span-2 space-y-4">
            <NarrativeCard
              mstarId={mstarId}
              headlineTag={lensScores?.headline_tag}
            />
            <SectionCard title="Six-Lens Classification" subtitle="Each lens is an independent 0-100 percentile rank within this category">
              <RadarChart
                funds={[{
                  label: fundDetail.fund_name || 'Fund',
                  scores: {
                    return_score: Number(lensScores.return_score) || 0,
                    risk_score: Number(lensScores.risk_score) || 0,
                    consistency_score: Number(lensScores.consistency_score) || 0,
                    alpha_score: Number(lensScores.alpha_score) || 0,
                    efficiency_score: Number(lensScores.efficiency_score) || 0,
                    resilience_score: Number(lensScores.resilience_score) || 0,
                  },
                }]}
                size={280}
                categoryAvg={peerAvgs}
              />
              <InfoBulb title="Radar Chart" items={[
                { icon: '🎯', label: 'Solid teal', text: 'This fund. Points farther from center = higher score.' },
                { icon: '- - -', label: 'Dashed gray', text: 'Category median. Compare the shapes to see where this fund excels vs peers.' },
                { icon: '📊', label: 'No composite', text: 'Each lens is independent. A fund can be a Leader in returns but Weak in efficiency.' },
              ]} />
            </SectionCard>
          </div>

          {/* Lens Breakdown (3 cols) */}
          <SectionCard
            title="Lens Scores vs Category"
            subtitle="Click any lens to see detailed breakdown"
            className="lg:col-span-3"
          >
            <p className="text-[10px] text-slate-500 leading-relaxed mb-3 ds-callout ds-callout-teal">
              Each lens is an independent percentile rank (0-100) within the fund&apos;s SEBI category.
              <strong> Return</strong> measures if it makes money. <strong>Risk</strong> measures volatility.
              <strong> Consistency</strong> measures reliability over time. <strong>Alpha</strong> measures manager skill.
              <strong> Efficiency</strong> measures cost-effectiveness. <strong>Resilience</strong> measures bad-market behavior.
              A score of 80 means the fund is better than 80% of peers on that dimension.
            </p>
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
                    rankInfo={rankInfoMap[lens.key]}
                  />
                );
              })}
            </div>
          </SectionCard>
        </div>
      )}

      {/* SECTION 5: Performance Comparison */}
      <SectionCard
        title="Performance Comparison"
        subtitle="Growth of investment — fund vs benchmark vs category average"
      >
        <PerformanceChart
          mstarId={mstarId}
          initialData={navData}
          fundReturns={fundReturns}
          riskStats={combinedRiskStats}
        />
      </SectionCard>

      {/* SECTION 5b: Returns vs Category + Peer Scatter side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title="Returns vs Category">
          <ReturnsBars
            fundReturns={fundReturns}
            categoryReturns={categoryReturns}
          />
        </SectionCard>
        <SectionCard title="Peer Scatter" subtitle="Risk vs return — this fund highlighted in teal">
          <p className="text-[10px] text-slate-500 mb-3 leading-relaxed">
            Each dot is a peer fund in the same SEBI category. X-axis is risk score (higher = riskier),
            Y-axis is 1-year return. Funds in the top-left offer the best risk-adjusted returns.
          </p>
          <PeerScatter
            fund={fundDetail}
            lensScores={lensScores}
            peers={peers}
            fundDetail={fundDetail}
          />
        </SectionCard>
      </div>

      {/* SECTION 6: Quartile Rank History */}
      {fundDetail.ranks && (
        <SectionCard
          title="Quartile Rank History"
          subtitle="Where this fund ranked within its category over time. Q1 = top 25%."
        >
          <QuartileRibbon
            ranks={fundDetail.ranks}
            categoryName={fundDetail.category_name}
          />
          <InfoBulb title="Quartile History" items={[
            { icon: '🏆', label: 'Consistency matters', text: 'A fund in Q1/Q2 most years is genuinely consistent. If great trailing returns come from one exceptional year, the calendar view exposes it.' },
            { icon: '📅', label: 'Calendar year percentiles', text: 'Lower percentile = better. P10 = top 10% that year. Look for sustained low percentiles across years.' },
          ]} />
        </SectionCard>
      )}

      {/* SECTION 7: Risk Profile */}
      <SectionCard
        title="Risk Profile"
        subtitle="All metrics are 3-year rolling. Lower is better for risk metrics (except Sharpe/Sortino — higher is better)."
      >
        <RiskProfile riskStats={combinedRiskStats} />
      </SectionCard>

      {/* SECTION 8: Portfolio Holdings + Sector Holdings — equal side-by-side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Portfolio Holdings */}
        <SectionCard title="Portfolio Holdings" subtitle="Top holdings by weight. Click to expand full list.">
          <HoldingsTable holdings={holdings} sectorQuadrants={sectorQuadrants} />
        </SectionCard>

        {/* Right: Sector + Asset + Credit stacked */}
        <div className="space-y-4">
          <SectionCard title="Sector Allocation">
            <SectorAllocation sectors={sectors} sectorQuadrants={sectorQuadrants} />
          </SectionCard>
          <SectionCard title="Asset Allocation">
            <AssetAllocation mstarId={mstarId} />
          </SectionCard>
          <SectionCard title="Credit Quality">
            <CreditQuality
              creditQuality={fundDetail.credit_quality}
              categoryName={fundDetail.category_name}
            />
          </SectionCard>
        </div>
      </div>

      {/* SECTION 8b: Portfolio Metrics */}
      {(fundDetail.portfolio || holdingsSnapshot) && (
        <SectionCard title="Portfolio Characteristics" subtitle="Valuation, quality, and style metrics from latest holdings snapshot">
          <PortfolioMetrics holdingsData={fundDetail.portfolio || holdingsSnapshot} />
        </SectionCard>
      )}

      {/* SECTION 9: Peer Comparison */}
      <SectionCard title="Peer Comparison" subtitle="All funds in the same SEBI category, sorted by Sharpe ratio">
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
