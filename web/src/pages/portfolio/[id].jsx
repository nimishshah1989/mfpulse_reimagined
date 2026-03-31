import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { fetchPortfolioAnalytics } from '../../lib/api';
import PortfolioHero from '../../components/portfolio/PortfolioHero';
import EquityCurve from '../../components/portfolio/EquityCurve';
import HoldingsTable from '../../components/portfolio/HoldingsTable';
import SectorBlend from '../../components/portfolio/SectorBlend';
import MarketCapSplit from '../../components/portfolio/MarketCapSplit';
import BlendedLensRadar from '../../components/portfolio/BlendedLensRadar';
import RiskProfile from '../../components/portfolio/RiskProfile';
import RiskReturnScatter from '../../components/portfolio/RiskReturnScatter';
import SimilarFunds from '../../components/portfolio/SimilarFunds';
import SignalTimeline from '../../components/portfolio/SignalTimeline';
import ChangeTrail from '../../components/portfolio/ChangeTrail';

function SkeletonBlock({ className = '' }) {
  return (
    <div className={`bg-white rounded-xl border border-slate-200 p-5 animate-pulse ${className}`}>
      <div className="h-4 bg-slate-200 rounded w-1/4 mb-4" />
      <div className="space-y-3">
        <div className="h-3 bg-slate-100 rounded w-3/4" />
        <div className="h-3 bg-slate-100 rounded w-1/2" />
        <div className="h-3 bg-slate-100 rounded w-2/3" />
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      {/* Hero skeleton */}
      <div className="bg-gradient-to-r from-slate-900 via-teal-900 to-teal-700 rounded-xl p-6 animate-pulse">
        <div className="flex gap-2 mb-3">
          <div className="h-5 w-12 bg-white/10 rounded-full" />
          <div className="h-5 w-16 bg-white/10 rounded-full" />
        </div>
        <div className="h-7 bg-white/10 rounded w-1/3 mb-2" />
        <div className="h-4 bg-white/5 rounded w-1/2 mb-5" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-white/10 rounded-lg p-3 h-20" />
          ))}
        </div>
      </div>
      {Array.from({ length: 4 }).map((_, i) => (
        <SkeletonBlock key={i} />
      ))}
    </div>
  );
}

export default function PortfolioDetailPage() {
  const router = useRouter();
  const { id } = router.query;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    setLoading(true);
    setError(null);

    fetchPortfolioAnalytics(id)
      .then((res) => {
        if (!cancelled) {
          setData(res.data || res);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || 'Failed to load portfolio analytics');
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Back link */}
        <Link
          href="/strategies"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-teal-600 transition-colors mb-5"
        >
          <span className="text-base leading-none">{'\u2190'}</span>
          Back to Strategies
        </Link>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {loading ? (
          <LoadingSkeleton />
        ) : data ? (
          <div className="space-y-6">
            {/* Section 1: Hero */}
            <PortfolioHero data={data} />

            {/* Section 2: Equity Curve */}
            <EquityCurve data={data.equity_curve} />

            {/* Section 3: Holdings */}
            <HoldingsTable holdings={data.holdings} />

            {/* Two-column layout for sector + market cap */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Section 4: Sector Blend */}
              <SectorBlend sectors={data.sector_blend} />

              {/* Section 5: Market Cap Split */}
              <MarketCapSplit data={data.market_cap} />
            </div>

            {/* Two-column layout for radar + risk */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Section 6: Blended Lens Radar */}
              <BlendedLensRadar
                portfolio={data.blended_lens}
                categoryAverage={data.category_average_lens}
              />

              {/* Section 7: Risk Profile */}
              <RiskProfile
                portfolio={data.risk_metrics}
                benchmark={data.benchmark_risk}
              />
            </div>

            {/* Section 8: Risk-Return Scatter */}
            <RiskReturnScatter
              portfolio={data.risk_return_portfolio}
              benchmark={data.risk_return_benchmark}
              medianRisk={data.median_risk}
              medianReturn={data.median_return}
            />

            {/* Section 9: Similar Funds */}
            <SimilarFunds funds={data.similar_funds} />

            {/* Section 10: Signal Timeline */}
            <SignalTimeline events={data.signal_events} />

            {/* Section 11: Change Trail */}
            <ChangeTrail trail={data.change_trail} />
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
            <p className="text-slate-400">Portfolio not found.</p>
          </div>
        )}
      </div>
    </div>
  );
}
