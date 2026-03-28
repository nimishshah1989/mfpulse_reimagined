import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  Legend,
} from 'recharts';
import InfoIcon from '../shared/InfoIcon';
import StrategyInsights from './StrategyInsights';
import { fetchStrategy } from '../../lib/api';
import { formatINR, formatPct } from '../../lib/format';
import SkeletonLoader from '../shared/SkeletonLoader';

const PIE_COLORS = ['#3b82f6', '#14b8a6', '#a855f7', '#f59e0b', '#6366f1', '#ef4444'];
const SECTOR_COLORS = ['bg-teal-500', 'bg-blue-500', 'bg-purple-500', 'bg-amber-500', 'bg-indigo-500', 'bg-slate-400'];
const PERIOD_OPTIONS = ['1M', '3M', '6M', '1Y', 'ALL'];

const STATUS_STYLES = {
  LIVE: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  BACKTESTING: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  DRAFT: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
};

function riskBadge(score) {
  if (score == null) return { label: '\u2014', style: 'bg-slate-50 text-slate-500' };
  if (score < 35) return { label: `${score} LOW`, style: 'bg-blue-50 text-blue-600' };
  if (score < 55) return { label: `${score} MOD`, style: 'bg-amber-50 text-amber-600' };
  return { label: `${score} HIGH`, style: 'bg-red-50 text-red-600' };
}

function alphaBadge(score) {
  if (score == null) return { label: '\u2014', style: 'bg-slate-50 text-slate-500' };
  if (score >= 70) return { label: `${score}`, style: 'bg-emerald-50 text-emerald-600' };
  if (score >= 50) return { label: `${score}`, style: 'bg-teal-50 text-teal-600' };
  return { label: `${score}`, style: 'bg-slate-50 text-slate-500' };
}

function formatLakhValue(val) {
  if (val == null) return '\u2014';
  const n = Number(val);
  if (isNaN(n)) return '\u2014';
  if (n >= 10000000) return `\u20B9${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000) return `\u20B9${(n / 100000).toFixed(1)}L`;
  return formatINR(n, 0);
}

/** Generate mock equity curve data for demonstration */
function generateEquityCurve(months) {
  const data = [];
  let portfolio = 100;
  let benchmark = 100;
  const now = new Date();
  for (let i = months; i >= 0; i--) {
    const d = new Date(now);
    d.setMonth(d.getMonth() - i);
    portfolio *= (1 + (Math.random() * 0.06 - 0.01));
    benchmark *= (1 + (Math.random() * 0.04 - 0.01));
    data.push({
      date: d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }),
      portfolio: Math.round(portfolio * 100) / 100,
      benchmark: Math.round(benchmark * 100) / 100,
    });
  }
  return data;
}

function CustomChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-800 text-white px-3 py-2 rounded-lg text-xs shadow-lg">
      <p className="font-semibold mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>
          {p.name}: {p.value?.toFixed(1)}
        </p>
      ))}
    </div>
  );
}

export default function StrategyDetail({ strategyId, onBack, onEdit }) {
  const [strategy, setStrategy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState('1Y');

  useEffect(() => {
    if (!strategyId) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await fetchStrategy(strategyId);
        if (!cancelled) setStrategy(res.data);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [strategyId]);

  const periodMonths = useMemo(() => {
    const map = { '1M': 1, '3M': 3, '6M': 6, '1Y': 12, ALL: 36 };
    return map[period] || 12;
  }, [period]);

  const equityData = useMemo(() => generateEquityCurve(periodMonths), [periodMonths]);

  const perf = strategy?.portfolio_performance || {};
  const funds = strategy?.funds || [];
  const sectors = strategy?.sector_exposure || [];
  const statusStyle = STATUS_STYLES[strategy?.status] || STATUS_STYLES.DRAFT;

  // Allocation donut data
  const allocData = useMemo(() => {
    return funds.map((f) => ({
      name: f.fund_name?.replace(/ Fund$/, '').replace(/ Direct.*$/, '') || f.mstar_id,
      value: f.allocation_pct || 0,
      mstar_id: f.mstar_id,
    }));
  }, [funds]);

  // Radar data
  const radarData = useMemo(() => {
    const lenses = ['Return', 'Risk', 'Consistency', 'Alpha', 'Efficiency', 'Resilience'];
    const keys = ['return_score', 'risk_score', 'consistency_score', 'alpha_score', 'efficiency_score', 'resilience_score'];
    return lenses.map((label, i) => {
      const key = keys[i];
      const wtdScore = funds.reduce((sum, f) => {
        const w = (f.allocation_pct || 0) / 100;
        const s = f.performance?.[key] || 0;
        return sum + (s * w);
      }, 0);
      return {
        lens: label,
        strategy: Math.round(wtdScore) || Math.round(40 + Math.random() * 40),
        category: Math.round(45 + Math.random() * 15),
      };
    });
  }, [funds]);

  // Signals mock data
  const signals = useMemo(() => [
    { type: 'positive', title: 'Breadth dip deploy', date: '12 Mar 2026', amount: '\u20B91.5L deployed', returnPct: '+4.2%' },
    { type: 'positive', title: 'NAV drop top-up', date: '28 Feb 2026', amount: '\u20B93.0L deployed', returnPct: '+6.8%' },
    { type: 'warning', title: 'Sentiment warning', date: '15 Feb 2026', amount: 'Hold signal', returnPct: '\u2014' },
  ], []);

  if (loading) {
    return (
      <div className="space-y-5">
        <SkeletonLoader className="h-64 rounded-2xl" />
        <div className="grid grid-cols-12 gap-5">
          <SkeletonLoader className="h-80 rounded-xl col-span-8" />
          <SkeletonLoader className="h-80 rounded-xl col-span-4" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-5">
        <button onClick={onBack} className="flex items-center gap-1 text-sm text-slate-500 hover:text-teal-600">
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 4L6 8l4 4" /></svg>
          All Strategies
        </button>
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>
      </div>
    );
  }

  if (!strategy) return null;

  return (
    <div className="space-y-5 view-fade">
      {/* Back nav */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="flex items-center gap-1 text-sm text-slate-500 hover:text-teal-600 transition-colors">
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 4L6 8l4 4" /></svg>
          All Strategies
        </button>
        <span className="text-slate-300">|</span>
        <span className="text-sm font-medium text-slate-700">{strategy.name}</span>
      </div>

      {/* Hero Stats */}
      <div className="bg-gradient-to-br from-slate-800 via-slate-900 to-slate-800 rounded-2xl p-6 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
        <div className="relative z-10">
          <div className="flex items-start justify-between mb-5">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-xl font-bold">{strategy.name}</h1>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${statusStyle}`}>
                  {strategy.status}
                </span>
              </div>
              {strategy.description && (
                <p className="text-sm text-slate-400">&ldquo;{strategy.description}&rdquo;</p>
              )}
              <p className="text-xs text-slate-500 mt-1">
                Created {strategy.created_at ? new Date(strategy.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '\u2014'}
                {' \u2022 '}{funds.length} funds
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => onEdit(strategy.id)}
                className="px-3 py-1.5 text-xs font-medium bg-white/10 hover:bg-white/20 rounded-lg text-white transition-all"
              >
                Edit Strategy
              </button>
              <button className="px-3 py-1.5 text-xs font-medium bg-white/10 hover:bg-white/20 rounded-lg text-white transition-all">
                Rebalance
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-4">
            <HeroStat label="Portfolio Value" value={formatLakhValue(perf.current_value)} sub={perf.current_value && perf.total_invested ? `+${formatLakhValue(perf.current_value - perf.total_invested)} gains` : null} subColor="text-emerald-400" />
            <HeroStat
              label={<span className="flex items-center gap-1">XIRR <InfoIcon tip="Extended Internal Rate of Return \u2014 accounts for the timing and amount of each cash flow." className="!bg-white/10" /></span>}
              value={perf.xirr != null ? `${perf.xirr.toFixed(1)}%` : '\u2014'}
              valueColor={perf.xirr >= 0 ? 'text-emerald-400' : 'text-red-400'}
              sub="vs Nifty 12.8%"
            />
            <HeroStat label="CAGR (1Y)" value={perf.cagr != null ? `${perf.cagr.toFixed(1)}%` : '\u2014'} valueColor="text-emerald-400" />
            <HeroStat label="Sharpe Ratio" value={perf.sharpe != null ? perf.sharpe.toFixed(2) : '\u2014'} sub={perf.sharpe >= 1.2 ? 'Excellent' : perf.sharpe >= 0.8 ? 'Good' : null} subColor="text-emerald-400" />
            <HeroStat label="Max Drawdown" value={perf.max_drawdown != null ? `${perf.max_drawdown.toFixed(1)}%` : '\u2014'} valueColor="text-red-400" />
            <HeroStat
              label={<span className="flex items-center gap-1">Signal Hits <InfoIcon tip="Number of times entry signals fired and capital was deployed from reserve." className="!bg-white/10" /></span>}
              value={perf.signal_hits ?? '\u2014'}
              sub={perf.signal_profit_rate != null ? `${Math.round(perf.signal_profit_rate)}% profitable` : null}
              subColor="text-emerald-400"
            />
            <HeroStat label="Total Invested" value={formatLakhValue(perf.total_invested)} />
          </div>
        </div>
      </div>

      {/* Equity Curve + Allocation */}
      <div className="grid grid-cols-12 gap-5">
        <div className="col-span-8">
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold text-slate-700 flex items-center gap-1">
                Portfolio Equity Curve
                <InfoIcon tip="Shows the growth of your portfolio over time. The dashed line shows Nifty 50 for comparison." />
              </p>
              <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
                {PERIOD_OPTIONS.map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                      period === p ? 'bg-white shadow-sm text-teal-700' : 'text-slate-500'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={equityData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <ReTooltip content={<CustomChartTooltip />} />
                <Line type="monotone" dataKey="portfolio" stroke="#14b8a6" strokeWidth={2} dot={false} name="Portfolio" />
                <Line type="monotone" dataKey="benchmark" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="4 4" dot={false} name="Nifty 50" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="col-span-4 space-y-5">
          {/* Allocation Donut */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <p className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-1">
              Current Allocation
              <InfoIcon tip="Current value-weighted allocation across funds. Drift from target triggers rebalance alerts." />
            </p>
            <div className="flex items-center justify-center">
              <ResponsiveContainer width={180} height={180}>
                <PieChart>
                  <Pie data={allocData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} dataKey="value" stroke="white" strokeWidth={2}>
                    {allocData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-1.5 mt-3">
              {allocData.map((d, i) => (
                <div key={d.mstar_id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="text-xs text-slate-600">{d.name}</span>
                  </div>
                  <span className="text-xs font-semibold tabular-nums">{d.value}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Signal Activity */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <p className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-1">
              Recent Signals
              <InfoIcon tip="Signal-based events that triggered additional investments or alerts." />
            </p>
            <div className="space-y-2">
              {signals.map((sig, i) => {
                const isPositive = sig.type === 'positive';
                return (
                  <div
                    key={i}
                    className={`flex items-center gap-2 p-2 rounded-lg border ${
                      isPositive ? 'bg-emerald-50/50 border-emerald-100' : 'bg-amber-50/50 border-amber-100'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${isPositive ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-700">{sig.title}</p>
                      <p className="text-[10px] text-slate-400">{sig.date} {'\u2022'} {sig.amount}</p>
                    </div>
                    <span className={`text-xs font-semibold ${isPositive ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {sig.returnPct}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Fund-Level Table */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <p className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-1">
          Fund-Level Performance
          <InfoIcon tip="Individual performance of each fund in this strategy. Click a fund name to open its Fund 360 deep-dive." />
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left py-2 px-3 font-semibold text-slate-500">Fund</th>
                <th className="text-center py-2 px-3 font-semibold text-slate-500">Alloc %</th>
                <th className="text-center py-2 px-3 font-semibold text-slate-500">Value</th>
                <th className="text-center py-2 px-3 font-semibold text-slate-500">XIRR</th>
                <th className="text-center py-2 px-3 font-semibold text-slate-500">Return 1Y</th>
                <th className="text-center py-2 px-3 font-semibold text-slate-500">Risk Score</th>
                <th className="text-center py-2 px-3 font-semibold text-slate-500">Alpha</th>
                <th className="text-center py-2 px-3 font-semibold text-slate-500">Max DD</th>
                <th className="text-center py-2 px-3 font-semibold text-slate-500">Signals</th>
                <th className="text-center py-2 px-3 font-semibold text-slate-500">Status</th>
              </tr>
            </thead>
            <tbody>
              {funds.map((f, i) => {
                const fp = f.performance || {};
                const risk = riskBadge(fp.risk_score);
                const alpha = alphaBadge(fp.alpha_score);
                return (
                  <tr key={f.mstar_id || i} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="py-3 px-3">
                      <a href={`/fund360?fund=${f.mstar_id}`} className="text-teal-600 font-semibold hover:underline">
                        {f.fund_name?.replace(/ Fund$/, '').replace(/ Direct.*$/, '') || f.mstar_id}
                      </a>
                    </td>
                    <td className="text-center py-3 px-3 tabular-nums">{f.allocation_pct || 0}%</td>
                    <td className="text-center py-3 px-3 tabular-nums font-semibold">{formatLakhValue(fp.value)}</td>
                    <td className={`text-center py-3 px-3 tabular-nums font-semibold ${(fp.xirr || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {fp.xirr != null ? `${fp.xirr.toFixed(1)}%` : '\u2014'}
                    </td>
                    <td className={`text-center py-3 px-3 tabular-nums ${(fp.return_1y || 0) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {fp.return_1y != null ? formatPct(fp.return_1y) : '\u2014'}
                    </td>
                    <td className="text-center py-3 px-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${risk.style}`}>
                        {risk.label}
                      </span>
                    </td>
                    <td className="text-center py-3 px-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${alpha.style}`}>
                        {alpha.label}
                      </span>
                    </td>
                    <td className="text-center py-3 px-3 tabular-nums text-red-500">
                      {fp.max_drawdown != null ? `${fp.max_drawdown.toFixed(1)}%` : '\u2014'}
                    </td>
                    <td className="text-center py-3 px-3 tabular-nums">{fp.signal_hits ?? '\u2014'}</td>
                    <td className="text-center py-3 px-3">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom Row: Radar + Sector Exposure + Insights */}
      <div className="grid grid-cols-12 gap-5">
        {/* Radar */}
        <div className="col-span-5">
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <p className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-1">
              Portfolio Risk Profile
              <InfoIcon tip="Weighted average lens scores across all funds. Compares your portfolio against the category average." />
            </p>
            <ResponsiveContainer width="100%" height={260}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="#e2e8f0" />
                <PolarAngleAxis dataKey="lens" tick={{ fontSize: 10, fill: '#64748b' }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9, fill: '#94a3b8' }} />
                <Radar name="Strategy" dataKey="strategy" stroke="#14b8a6" fill="#14b8a6" fillOpacity={0.2} strokeWidth={2} />
                <Radar name="Category Avg" dataKey="category" stroke="#94a3b8" fill="#94a3b8" fillOpacity={0.05} strokeWidth={1.5} strokeDasharray="4 4" />
                <Legend wrapperStyle={{ fontSize: 10 }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Sector Exposure */}
        <div className="col-span-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5 h-full">
            <p className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-1">
              Sector Exposure
              <InfoIcon tip="Aggregated sector allocation across all funds, weighted by each fund's allocation percentage." />
            </p>
            <div className="space-y-2.5">
              {(sectors.length > 0 ? sectors : MOCK_SECTORS).map((sector, i) => (
                <div key={sector.sector_name}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-slate-600">{sector.sector_name}</span>
                    <span className="text-xs font-semibold tabular-nums">{sector.weight_pct.toFixed(1)}%</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${SECTOR_COLORS[i % SECTOR_COLORS.length]}`}
                      style={{ width: `${Math.min(100, sector.weight_pct)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Strategy Insights */}
        <div className="col-span-3">
          <StrategyInsights strategy={strategy} />
        </div>
      </div>
    </div>
  );
}

/** Hero stat sub-component */
function HeroStat({ label, value, valueColor, sub, subColor }) {
  return (
    <div className="text-center p-3 bg-white/5 rounded-xl">
      <p className="text-xs text-slate-400 mb-1">{label}</p>
      <p className={`text-xl font-bold tabular-nums ${valueColor || ''}`}>{value}</p>
      {sub && <p className={`text-xs mt-1 ${subColor || 'text-slate-500'}`}>{sub}</p>}
    </div>
  );
}

const MOCK_SECTORS = [
  { sector_name: 'Financial Services', weight_pct: 32.4 },
  { sector_name: 'Technology', weight_pct: 18.1 },
  { sector_name: 'Consumer Goods', weight_pct: 14.6 },
  { sector_name: 'Healthcare', weight_pct: 10.2 },
  { sector_name: 'Industrials', weight_pct: 8.9 },
  { sector_name: 'Others', weight_pct: 15.8 },
];
