import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import {
  fetchFundDetail,
  fetchFundLensScores,
  fetchNAVHistory,
  fetchHoldings,
  fetchSectorExposure,
  fetchPeers,
  fetchFundRisk,
  fetchFunds,
  fetchCategories,
  fetchAMCs,
} from '../lib/api';
import { formatPct, formatAUM, formatINR } from '../lib/format';
import { LENS_OPTIONS, LENS_CLASS_KEYS, lensColor, lensLabel } from '../lib/lens';
import Pill from '../components/shared/Pill';
import SkeletonLoader from '../components/shared/SkeletonLoader';
import EmptyState from '../components/shared/EmptyState';
import Badge from '../components/shared/Badge';
import LensCircle from '../components/shared/LensCircle';
import TierBadge from '../components/shared/TierBadge';
import CompareMode from '../components/fund360/CompareMode';
import PerformanceChart from '../components/fund360/PerformanceChart';
import Verdict from '../components/fund360/Verdict';
import LensCard from '../components/fund360/LensCard';
import ReturnsBars from '../components/fund360/ReturnsBars';
import SmartAlternatives from '../components/fund360/SmartAlternatives';
import SectorAllocation from '../components/fund360/SectorAllocation';
import HoldingsTable from '../components/fund360/HoldingsTable';
import RiskProfile from '../components/fund360/RiskProfile';
import PeerPositioning from '../components/fund360/PeerPositioning';

const BROAD_CATEGORIES = ['All', 'Equity', 'Fixed Income', 'Allocation', 'Alternative Strategies'];

function ChevronIcon({ open }) {
  return (
    <svg
      className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function CollapsibleSection({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
      >
        {title}
        <ChevronIcon open={open} />
      </button>
      {open && <div className="px-5 pb-5">{children}</div>}
    </div>
  );
}

function FundSearch({ onSelect }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const [categories, setCategories] = useState([]);
  const [amcs, setAmcs] = useState([]);
  const [selectedBroad, setSelectedBroad] = useState('All');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedAmc, setSelectedAmc] = useState('');

  const [topFunds, setTopFunds] = useState([]);
  const [topLoading, setTopLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([fetchCategories(), fetchAMCs()]).then(([catRes, amcRes]) => {
      if (catRes.status === 'fulfilled') setCategories(catRes.value.data || []);
      if (amcRes.status === 'fulfilled') setAmcs(amcRes.value.data || []);
    });
    fetchFunds({ limit: 20, sort: 'return_1y', order: 'desc' })
      .then((res) => setTopFunds(res.data || []))
      .catch(() => {})
      .finally(() => setTopLoading(false));
  }, []);

  const filteredCategories =
    selectedBroad === 'All'
      ? categories
      : categories.filter((c) => c.broad_category === selectedBroad);

  useEffect(() => {
    const params = { limit: 20 };
    if (query.length >= 2) params.search = query;
    if (selectedCategory) params.category = selectedCategory;
    if (selectedAmc) params.amc = selectedAmc;
    if (selectedBroad !== 'All') params.broad_category = selectedBroad;

    const hasFilter =
      query.length >= 2 || selectedCategory || selectedAmc || selectedBroad !== 'All';
    if (!hasFilter) {
      setResults([]);
      return;
    }

    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetchFunds(params);
        setResults(res.data || []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [query, selectedCategory, selectedAmc, selectedBroad]);

  const displayFunds =
    results.length > 0
      ? results
      : !query && !selectedCategory && !selectedAmc && selectedBroad === 'All'
      ? topFunds
      : results;
  const showingTop = displayFunds === topFunds && topFunds.length > 0;

  return (
    <div className="space-y-6 -m-6">
      <div className="bg-white border-b border-slate-200 px-6 py-5">
        <h2 className="text-xl font-semibold text-slate-800">Fund 360°</h2>
        <p className="text-sm text-slate-500 mt-1">
          Search, filter, and explore any mutual fund in depth
        </p>
      </div>

      <div className="px-6 space-y-4">
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by fund name, AMC, or ISIN..."
            className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white shadow-sm"
          />
          {loading && (
            <div className="absolute right-3 top-3.5 text-xs text-slate-400">Searching...</div>
          )}
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="flex gap-1.5">
            {BROAD_CATEGORIES.map((bc) => (
              <button
                key={bc}
                type="button"
                onClick={() => {
                  setSelectedBroad(bc);
                  setSelectedCategory('');
                }}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  selectedBroad === bc
                    ? 'bg-teal-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {bc}
              </button>
            ))}
          </div>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 min-w-[180px]"
          >
            <option value="">All Categories ({filteredCategories.length})</option>
            {filteredCategories.map((c) => (
              <option key={c.category_name} value={c.category_name}>
                {c.category_name} ({c.fund_count})
              </option>
            ))}
          </select>

          <select
            value={selectedAmc}
            onChange={(e) => setSelectedAmc(e.target.value)}
            className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 min-w-[180px]"
          >
            <option value="">All AMCs ({amcs.length})</option>
            {amcs.map((a) => (
              <option key={a.amc_name} value={a.amc_name}>
                {a.amc_name} ({a.fund_count})
              </option>
            ))}
          </select>

          {(selectedCategory || selectedAmc || selectedBroad !== 'All' || query) && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setSelectedBroad('All');
                setSelectedCategory('');
                setSelectedAmc('');
              }}
              className="px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-lg"
            >
              Clear filters
            </button>
          )}
        </div>

        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500">
            {showingTop ? 'Top performers by 1Y return' : `${displayFunds.length} funds found`}
          </p>
        </div>

        {topLoading && displayFunds.length === 0 ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonLoader key={i} className="h-16 rounded-xl" />
            ))}
          </div>
        ) : displayFunds.length === 0 ? (
          <EmptyState message="No funds match your filters. Try adjusting your search criteria." />
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
            {displayFunds.map((f) => (
              <button
                key={f.mstar_id}
                type="button"
                onClick={() => onSelect(f.mstar_id)}
                className="w-full px-4 py-3 text-left hover:bg-slate-50 transition-colors flex items-center justify-between gap-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-slate-800 truncate">
                    {f.fund_name || f.legal_name}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {f.amc_name} · {f.category_name}
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {f.return_1y != null && (
                    <div className="text-right">
                      <div
                        className={`text-sm font-mono tabular-nums font-medium ${
                          Number(f.return_1y) >= 0 ? 'text-emerald-600' : 'text-red-600'
                        }`}
                      >
                        {formatPct(f.return_1y)}
                      </div>
                      <div className="text-[10px] text-slate-400">1Y</div>
                    </div>
                  )}
                  {f.return_class && (
                    <Badge variant="tier">{f.return_class}</Badge>
                  )}
                  <span className="text-slate-400 text-sm">&#8250;</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function inceptionAge(inceptionDate) {
  if (!inceptionDate) return null;
  const start = new Date(inceptionDate);
  const now = new Date();
  const years = Math.floor((now - start) / (1000 * 60 * 60 * 24 * 365));
  if (years < 1) return '< 1 yr';
  return `${years} yr${years !== 1 ? 's' : ''} old`;
}

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

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [compareOpen, setCompareOpen] = useState(false);

  useEffect(() => {
    if (router.isReady) {
      setMstarId(router.query.fund || null);
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
    return () => {
      cancelled = true;
    };
  }, [mstarId]);

  useEffect(() => {
    if (!mstarId) return;
    let cancelled = false;
    async function loadSecondary() {
      const [pRes, rRes] = await Promise.allSettled([
        fetchPeers(mstarId),
        fetchFundRisk(mstarId),
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
    }
    loadSecondary();
    return () => {
      cancelled = true;
    };
  }, [mstarId]);

  const handleFundSearch = useCallback(
    (id) => {
      router.push(`/fund360?fund=${id}`);
    },
    [router]
  );

  // Build sector quadrant map from sectors array
  const sectorQuadrants = sectors.reduce((acc, s) => {
    if (s.sector_name && s.quadrant) {
      acc[s.sector_name] = s.quadrant;
    }
    return acc;
  }, {});

  if (!mstarId) {
    return <FundSearch onSelect={handleFundSearch} />;
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <SkeletonLoader variant="row" className="w-96 h-8" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SkeletonLoader variant="chart" className="h-80" />
          <SkeletonLoader variant="chart" className="h-80" />
        </div>
        <SkeletonLoader variant="card" className="h-40" />
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        icon={'\u26A0\uFE0F'}
        message={`Failed to load fund: ${error}`}
        action="Back to Universe"
        onAction={() => router.push('/')}
      />
    );
  }

  if (!fundDetail) return null;

  const fundName = fundDetail.fund_name || fundDetail.legal_name;
  const age = inceptionAge(fundDetail.inception_date);

  // Merge lens scores into fundDetail for Verdict
  const fundWithScores = lensScores ? { ...fundDetail, ...lensScores } : fundDetail;

  return (
    <div className="space-y-6 -m-6">
      {/* 1. Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <button
              type="button"
              onClick={() => router.push('/')}
              className="text-xs text-teal-600 hover:underline mb-1 inline-block"
            >
              {'\u2190'} Back to Universe
            </button>
            <h2 className="text-lg font-semibold text-slate-800 truncate">{fundName}</h2>
            <p className="text-sm text-slate-500">{fundDetail.amc_name}</p>

            {/* Meta row */}
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <Badge variant="category">{fundDetail.category_name}</Badge>
              {fundDetail.aum != null && (
                <span className="text-xs font-mono text-slate-500">
                  AUM: {formatAUM(fundDetail.aum)}
                </span>
              )}
              {age && (
                <span className="text-xs text-slate-400">{age}</span>
              )}
              {fundDetail.expense_ratio != null && (
                <span className="text-xs text-slate-500 font-mono">
                  TER: {Number(fundDetail.expense_ratio).toFixed(2)}%
                </span>
              )}
              {fundDetail.primary_benchmark && (
                <span className="text-xs text-slate-400 truncate max-w-[200px]">
                  vs {fundDetail.primary_benchmark}
                </span>
              )}
            </div>

            {/* Tier tags */}
            {lensScores && (
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                {LENS_OPTIONS.map((lens) => {
                  const classKey = LENS_CLASS_KEYS[lens.key];
                  const tier = lensScores[classKey];
                  return tier ? <TierBadge key={lens.key} tier={tier} /> : null;
                })}
                {lensScores.headline_tag && (
                  <p className="text-xs italic text-slate-600 mt-0.5 w-full">
                    {'\u201C'}{lensScores.headline_tag}{'\u201D'}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={() => router.push(`/strategies?fund=${mstarId}`)}
              className="px-3 py-1.5 text-xs font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 whitespace-nowrap"
            >
              Simulate {'\u2192'}
            </button>
            <button
              type="button"
              onClick={() => setCompareOpen(true)}
              className="px-3 py-1.5 text-xs font-medium text-teal-600 border border-teal-200 rounded-lg hover:bg-teal-50 whitespace-nowrap"
            >
              Compare
            </button>
            <button
              type="button"
              onClick={() => router.push('/')}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 whitespace-nowrap"
            >
              Back to Universe
            </button>
          </div>
        </div>
      </div>

      <div className="px-6 space-y-6">
        {/* 2. Verdict */}
        <Verdict fund={fundWithScores} />

        {/* 3. Six-Lens Profile */}
        {lensScores && (
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Six-Lens Profile</h3>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              {LENS_OPTIONS.map((lens) => (
                <LensCard
                  key={lens.key}
                  name={lens.label}
                  score={lensScores[lens.key]}
                  categoryName={fundDetail.category_name}
                />
              ))}
            </div>
          </div>
        )}

        {/* 4. Returns vs Peers */}
        <ReturnsBars
          fundReturns={fundDetail.returns || fundDetail}
          categoryReturns={fundDetail.category_returns || null}
        />

        {/* 5. Smart Alternatives */}
        {peers && peers.length > 0 && (
          <SmartAlternatives
            peers={peers}
            currentMstarId={mstarId}
            onCompare={() => setCompareOpen(true)}
          />
        )}

        {/* 6. Collapsible sections */}
        <CollapsibleSection title="Sector Allocation">
          <SectorAllocation sectors={sectors} />
        </CollapsibleSection>

        <CollapsibleSection title="Top 10 Holdings">
          <HoldingsTable holdings={holdings} sectorQuadrants={sectorQuadrants} />
        </CollapsibleSection>

        <CollapsibleSection title="Risk Profile">
          <RiskProfile
            riskStats={riskStats || fundDetail.risk_stats || null}
            peerAvg={null}
          />
        </CollapsibleSection>

        <CollapsibleSection title="Peer Positioning">
          <PeerPositioning scores={lensScores} />
        </CollapsibleSection>

        <CollapsibleSection title="NAV Chart">
          <PerformanceChart mstarId={mstarId} initialData={navData} />
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
