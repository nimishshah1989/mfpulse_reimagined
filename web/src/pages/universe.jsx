import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { fetchUniverseData, fetchCategories, fetchAMCs } from '../lib/api';
import { cachedFetch } from '../lib/cache';
import { formatCount } from '../lib/format';
import { LENS_OPTIONS } from '../lib/lens';
import Pill from '../components/shared/Pill';
import SkeletonLoader from '../components/shared/SkeletonLoader';
import EmptyState from '../components/shared/EmptyState';
import FilterBar from '../components/universe/FilterBar';
import TierSummary from '../components/universe/TierSummary';
import HoverCard from '../components/universe/HoverCard';

const BubbleScatter = dynamic(
  () => import('../components/universe/BubbleScatter'),
  { ssr: false, loading: () => <SkeletonLoader variant="chart" className="h-[600px]" /> }
);

const DEFAULT_FILTERS = {
  purchaseMode: 'Regular',
  dividendType: 'Growth',
  category: '',
  broadCategory: '',
  amc: '',
  period: '1Y',
};

export default function UniversePage() {
  // Raw data
  const [allFunds, setAllFunds] = useState([]);
  const [categories, setCategories] = useState([]);
  const [amcs, setAmcs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // UI state
  const [xAxis, setXAxis] = useState('return_score');
  const [yAxis, setYAxis] = useState('risk_score');
  const [colorLens, setColorLens] = useState('alpha_score');
  const [filters, setFilters] = useState({ ...DEFAULT_FILTERS });

  // Hover state for HoverCard
  const [hoverFund, setHoverFund] = useState(null);
  const [hoverX, setHoverX] = useState(0);
  const [hoverY, setHoverY] = useState(0);

  const contentRef = useRef(null);
  const [chartWidth, setChartWidth] = useState(800);

  // Load data on mount with client-side cache (single bulk endpoint)
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);

        const [funds, cats, amcList] = await Promise.all([
          cachedFetch('universe', fetchUniverseData, 600),
          fetchCategories().then((r) => r.data || []),
          fetchAMCs().then((r) => r.data || []),
        ]);

        setAllFunds(funds);
        setCategories(cats);
        setAmcs(amcList);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Measure chart width
  useEffect(() => {
    function measure() {
      if (contentRef.current) {
        setChartWidth(Math.max(400, contentRef.current.offsetWidth - 16));
      }
    }
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  // Apply filters
  const filteredFunds = useMemo(() => {
    return allFunds.filter((fund) => {
      const { purchaseMode, dividendType, category, broadCategory, amc } = filters;

      if (purchaseMode !== 'Both' && fund.purchase_mode !== purchaseMode) return false;
      if (dividendType !== 'Both' && fund.dividend_type !== dividendType) return false;
      if (category && fund.category_name !== category) return false;
      if (broadCategory && fund.broad_category !== broadCategory) return false;
      if (amc && fund.amc_name !== amc) return false;

      return true;
    });
  }, [allFunds, filters]);

  const handleHover = useCallback((fund, x, y) => {
    setHoverFund(fund || null);
    setHoverX(x);
    setHoverY(y);
  }, []);

  const handleFundClick = useCallback((fund) => {
    if (fund?.mstar_id) {
      window.location.href = `/fund360?fund=${fund.mstar_id}`;
    }
  }, []);

  const handleTierClick = useCallback((tierLabel) => {
    // No-op for now — could drill into a filtered view
  }, []);

  const handleResetFilters = useCallback(() => {
    setFilters({ ...DEFAULT_FILTERS });
  }, []);

  if (loading) {
    return (
      <div className="space-y-4 p-4">
        <SkeletonLoader variant="row" className="w-full h-12" />
        <SkeletonLoader variant="row" className="w-full h-10" />
        <SkeletonLoader variant="chart" className="flex-1 h-[600px]" />
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        icon={'\u26A0\uFE0F'}
        message={`Failed to load fund data: ${error}`}
        action="Retry"
        onAction={() => window.location.reload()}
      />
    );
  }

  return (
    <div className="h-full flex flex-col -m-6">
      {/* Page subtitle */}
      <div className="px-6 py-2.5 bg-white border-b border-slate-200 flex items-center justify-between">
        <p className="text-sm text-slate-500">
          Universe Explorer &mdash; explore{' '}
          <span className="font-mono font-semibold text-slate-700">
            {formatCount(allFunds.length)}
          </span>{' '}
          mutual funds across 6 intelligence lenses
        </p>
      </div>

      {/* Filter bar */}
      <FilterBar
        categories={categories}
        amcs={amcs}
        filters={filters}
        onFiltersChange={setFilters}
        xAxis={xAxis}
        yAxis={yAxis}
        colorLens={colorLens}
        onXAxisChange={setXAxis}
        onYAxisChange={setYAxis}
        onColorLensChange={setColorLens}
        filteredCount={filteredFunds.length}
        totalCount={allFunds.length}
      />

      {/* Tier summary */}
      <TierSummary
        funds={filteredFunds}
        colorLens={colorLens}
        onTierClick={handleTierClick}
      />

      {/* Visualization area */}
      <div ref={contentRef} className="flex-1 overflow-auto p-4 min-w-0">
        {filteredFunds.length === 0 ? (
          <EmptyState
            icon={'\uD83D\uDD0D'}
            message="No funds match your current filters"
            action="Reset Filters"
            onAction={handleResetFilters}
          />
        ) : (
          <BubbleScatter
            data={filteredFunds}
            xAxis={xAxis}
            yAxis={yAxis}
            colorLens={colorLens}
            onFundClick={handleFundClick}
            onHover={handleHover}
            width={chartWidth}
            height={600}
          />
        )}
      </div>

      {/* HoverCard — shown on bubble hover */}
      {hoverFund && <HoverCard fund={hoverFund} x={hoverX} y={hoverY} />}
    </div>
  );
}
