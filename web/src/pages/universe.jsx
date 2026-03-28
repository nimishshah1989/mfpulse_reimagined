import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { fetchUniverseData, fetchCategories, fetchAMCs } from '../lib/api';
import { cachedFetch } from '../lib/cache';
import { formatCount } from '../lib/format';
import { LENS_OPTIONS, lensLabel } from '../lib/lens';
import Pill from '../components/shared/Pill';
import SkeletonLoader from '../components/shared/SkeletonLoader';
import EmptyState from '../components/shared/EmptyState';
import FilterBar from '../components/universe/FilterBar';
import TierSummary from '../components/universe/TierSummary';
import HoverCard from '../components/universe/HoverCard';

const BubbleScatter = dynamic(
  () => import('../components/universe/BubbleScatter'),
  { ssr: false, loading: () => <SkeletonLoader variant="chart" className="flex-1 min-h-[500px]" /> }
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
  const [selectedTier, setSelectedTier] = useState(null);

  // Hover state for HoverCard
  const [hoverFund, setHoverFund] = useState(null);
  const [hoverX, setHoverX] = useState(0);
  const [hoverY, setHoverY] = useState(0);

  const chartContainerRef = useRef(null);
  const [chartWidth, setChartWidth] = useState(800);
  const [chartHeight, setChartHeight] = useState(600);

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

  // Measure chart container dimensions
  useEffect(() => {
    function measure() {
      if (chartContainerRef.current) {
        const rect = chartContainerRef.current.getBoundingClientRect();
        setChartWidth(Math.max(400, Math.floor(rect.width)));
        setChartHeight(Math.max(500, Math.floor(rect.height)));
      }
    }
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [loading]);

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

  // Tag each fund with its tier label for the active color lens (used by BubbleScatter for dimming)
  const taggedFunds = useMemo(() => {
    const activeLens = colorLens || 'return_score';
    return filteredFunds.map((f) => ({
      ...f,
      _tierLabel: lensLabel(Number(f[activeLens]) || 0),
    }));
  }, [filteredFunds, colorLens]);

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
    setSelectedTier(tierLabel);
  }, []);

  const handleResetFilters = useCallback(() => {
    setFilters({ ...DEFAULT_FILTERS });
    setSelectedTier(null);
  }, []);

  if (loading) {
    return (
      <div className="space-y-4 p-4">
        <SkeletonLoader variant="row" className="w-full h-12" />
        <SkeletonLoader variant="row" className="w-full h-10" />
        <SkeletonLoader variant="chart" className="flex-1 min-h-[500px]" />
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
      {/* Filter bar (fund count is inside FilterBar) */}
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
        filteredCount={taggedFunds.length}
        totalCount={allFunds.length}
      />

      {/* Tier summary cards */}
      <TierSummary
        funds={taggedFunds}
        colorLens={colorLens}
        onTierClick={handleTierClick}
        selectedTier={selectedTier}
      />

      {/* Visualization area -- flex-1 fills ALL remaining vertical space */}
      <div ref={chartContainerRef} className="flex-1 min-h-[500px] min-w-0 relative">
        {taggedFunds.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <EmptyState
              icon={'\uD83D\uDD0D'}
              message="No funds match your current filters"
              action="Reset Filters"
              onAction={handleResetFilters}
            />
          </div>
        ) : (
          <BubbleScatter
            data={taggedFunds}
            xAxis={xAxis}
            yAxis={yAxis}
            colorLens={colorLens}
            onFundClick={handleFundClick}
            onHover={handleHover}
            width={chartWidth}
            height={chartHeight}
            selectedTier={selectedTier}
          />
        )}
      </div>

      {/* HoverCard -- shown on bubble hover */}
      {hoverFund && <HoverCard fund={hoverFund} x={hoverX} y={hoverY} />}
    </div>
  );
}
