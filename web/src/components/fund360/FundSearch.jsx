import { useState, useEffect } from 'react';
import {
  fetchFunds,
  fetchCategories,
  fetchAMCs,
  fetchUniverseData,
} from '../../lib/api';
import { cachedFetch } from '../../lib/cache';
import SkeletonLoader from '../shared/SkeletonLoader';
import EmptyState from '../shared/EmptyState';
import SmartBuckets from './SmartBuckets';
import FundCardGrid from './FundCardGrid';

const BROAD_CATEGORIES = ['All', 'Equity', 'Fixed Income', 'Allocation', 'Alternative Strategies'];
const PURCHASE_MODES = [
  { label: 'Regular', value: 1 },
  { label: 'Direct', value: 2 },
  { label: 'Both', value: 0 },
];

/**
 * FundSearch -- the explorer page shown when no fund is selected.
 * Includes Smart Buckets, search bar, filters, and card grid.
 *
 * Props:
 *   onSelect func(mstarId) -- called when a fund card is clicked
 */
export default function FundSearch({ onSelect }) {
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
  const [activeBucket, setActiveBucket] = useState(null);
  const [bucketFundIds, setBucketFundIds] = useState([]);
  const [universe, setUniverse] = useState([]);
  const [purchaseMode, setPurchaseMode] = useState(2);

  useEffect(() => {
    Promise.allSettled([fetchCategories(), fetchAMCs()]).then(([catRes, amcRes]) => {
      if (catRes.status === 'fulfilled') setCategories(catRes.value.data || []);
      if (amcRes.status === 'fulfilled') setAmcs(amcRes.value.data || []);
    });
    fetchFunds({ limit: 50, sort: 'return_1y', order: 'desc', purchase_mode: 2, broad_category: 'Equity' })
      .then((res) => setTopFunds(res.data || []))
      .catch(() => {})
      .finally(() => setTopLoading(false));
    cachedFetch('universe', fetchUniverseData, 600)
      .then(setUniverse)
      .catch(() => {});
  }, []);

  const filteredCategories =
    selectedBroad === 'All'
      ? categories
      : categories.filter((c) => c.broad_category === selectedBroad);

  useEffect(() => {
    if (query.length >= 2 || selectedCategory || selectedAmc || selectedBroad !== 'All') {
      setActiveBucket(null);
      setBucketFundIds([]);
    }
  }, [query, selectedCategory, selectedAmc, selectedBroad, purchaseMode]);

  useEffect(() => {
    const params = { limit: 100 };
    if (purchaseMode > 0) params.purchase_mode = purchaseMode;
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
  }, [query, selectedCategory, selectedAmc, selectedBroad, purchaseMode]);

  const handleBucketSelect = (bucketId, fundIds) => {
    setActiveBucket(bucketId);
    setBucketFundIds(fundIds || []);
    setQuery('');
    setSelectedCategory('');
    setSelectedAmc('');
    setSelectedBroad('All');
    setPurchaseMode(2);
  };

  let displayFunds;
  let displayLabel;

  if (activeBucket && bucketFundIds.length > 0) {
    const idSet = new Set(bucketFundIds);
    displayFunds = universe.filter((f) => idSet.has(f.mstar_id));
    displayLabel = `${displayFunds.length} funds in bucket`;
  } else if (results.length > 0) {
    displayFunds = results;
    displayLabel = `${results.length} funds found`;
  } else if (!query && !selectedCategory && !selectedAmc && selectedBroad === 'All') {
    // Show top performing Direct equity funds by default
    const defaultFunds = universe.length > 0
      ? universe
          .filter((f) => f.purchase_mode === 'Direct' && (f.broad_category === 'Equity' || !f.broad_category))
          .sort((a, b) => (Number(b.return_1y) || 0) - (Number(a.return_1y) || 0))
          .slice(0, 50)
      : topFunds;
    displayFunds = defaultFunds;
    displayLabel = defaultFunds.length > 0
      ? `Top ${defaultFunds.length} Direct Equity funds by 1Y return`
      : '0 funds found';
  } else {
    displayFunds = [];
    displayLabel = '0 funds found';
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-4">
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Fund 360{'\u00B0'}</h2>
        <p className="text-sm text-slate-500 mt-1">
          Explore, filter, and deep-dive into any Indian mutual fund
        </p>
      </div>

      <div className="space-y-6">
        {/* Smart Buckets */}
        <SmartBuckets
          activeBucket={activeBucket}
          onSelect={handleBucketSelect}
          universe={universe.length > 0 ? universe : undefined}
          purchaseMode={purchaseMode}
        />

        {/* Search bar */}
        <div className="relative">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
            <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by fund name, AMC, or ISIN..."
            className="w-full pl-11 pr-4 py-3.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-300 bg-white shadow-sm transition-shadow hover:shadow-md"
          />
          {loading && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              <svg className="animate-spin w-4 h-4 text-teal-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          )}
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex gap-1">
            {BROAD_CATEGORIES.map((bc) => (
              <button
                key={bc}
                type="button"
                onClick={() => {
                  setSelectedBroad(bc);
                  setSelectedCategory('');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  selectedBroad === bc
                    ? 'bg-teal-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {bc}
              </button>
            ))}
          </div>

          <div className="w-px h-6 bg-slate-200" />

          <div className="flex gap-1">
            {PURCHASE_MODES.map((pm) => (
              <button
                key={pm.value}
                type="button"
                onClick={() => setPurchaseMode(pm.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  purchaseMode === pm.value
                    ? 'bg-slate-700 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {pm.label}
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

          {(selectedCategory || selectedAmc || selectedBroad !== 'All' || query || activeBucket || purchaseMode !== 2) && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setSelectedBroad('All');
                setSelectedCategory('');
                setSelectedAmc('');
                setActiveBucket(null);
                setBucketFundIds([]);
                setPurchaseMode(2);
              }}
              className="px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-lg font-medium transition-colors"
            >
              Clear all filters
            </button>
          )}
        </div>

        {/* Results label */}
        <p className="text-xs text-slate-500 font-medium">{displayLabel}</p>

        {/* Fund cards */}
        {topLoading && displayFunds.length === 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonLoader key={i} className="h-36 rounded-xl" />
            ))}
          </div>
        ) : displayFunds.length === 0 ? (
          <EmptyState message="No funds match your filters. Try adjusting your search criteria." />
        ) : (
          <FundCardGrid funds={displayFunds} onSelect={onSelect} />
        )}
      </div>
    </div>
  );
}
