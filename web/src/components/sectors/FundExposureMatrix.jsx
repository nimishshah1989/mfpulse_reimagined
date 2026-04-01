import { useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { QUADRANT_COLORS } from '../../lib/sectors';
import { formatPct } from '../../lib/format';
import { fetchFundExposureMatrix } from '../../lib/api';
import InfoBulb from '../shared/InfoBulb';

const TEAL = { r: 13, g: 148, b: 136 };
const PAGE_SIZE = 12;

const MATRIX_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'large_cap', label: 'Large Cap' },
  { key: 'flexi', label: 'Flexi Cap' },
  { key: 'multi', label: 'Multi Cap' },
  { key: 'equity', label: 'All Equity' },
];

function heatStyle(pct) {
  if (pct == null || pct <= 0) {
    return { backgroundColor: 'rgba(13,148,136,0.04)', color: '#94a3b8' };
  }
  const opacity = Math.min(0.6, 0.06 + pct * 0.018);
  const textColor = pct >= 20 ? '#0f766e' : pct >= 8 ? '#334155' : '#64748b';
  return {
    backgroundColor: `rgba(${TEAL.r},${TEAL.g},${TEAL.b},${opacity})`,
    color: textColor,
    fontWeight: pct >= 10 ? 700 : 600,
  };
}

function shortSector(name) {
  const map = {
    Technology: 'Tech', 'Financial Services': 'Fin', Healthcare: 'Health',
    Energy: 'Energy', Automobile: 'Auto', 'Consumer Defensive': 'FMCG',
    FMCG: 'FMCG', 'Basic Materials': 'Metal', 'Metals & Mining': 'Metal',
    'Real Estate': 'Realty', Infrastructure: 'Infra', Industrials: 'Indust',
    'Communication Services': 'Comm', Utilities: 'Util',
    'Consumer Cyclical': 'Cons.C', 'IT Services': 'IT', Pharma: 'Pharma',
  };
  return map[name] || name.slice(0, 5);
}

export default function FundExposureMatrix({ funds, sectorData, sectorExposures, online }) {
  const router = useRouter();
  const [allMatrixFunds, setAllMatrixFunds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState('all');

  // Fetch more funds from backend (up to 50)
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await fetchFundExposureMatrix(50);
        if (!cancelled && res.data) {
          setAllMatrixFunds(res.data);
        }
      } catch {
        // Fall back to props
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const sectorColumns = useMemo(() => {
    if (!sectorData?.length) return [];
    return sectorData.slice(0, 9).map((s) => s.sector_name);
  }, [sectorData]);

  // Apply filter
  const filteredFunds = useMemo(() => {
    let list = allMatrixFunds.length > 0 ? allMatrixFunds : [];
    switch (filter) {
      case 'large_cap':
        list = list.filter((f) => f.category_name?.toLowerCase().includes('large'));
        break;
      case 'flexi':
        list = list.filter((f) => f.category_name?.toLowerCase().includes('flexi'));
        break;
      case 'multi':
        list = list.filter((f) => f.category_name?.toLowerCase().includes('multi'));
        break;
      case 'equity':
        list = list.filter((f) => {
          const cat = (f.category_name || '').toLowerCase();
          return !cat.includes('debt') && !cat.includes('liquid') && !cat.includes('money market')
            && !cat.includes('gilt') && !cat.includes('bond') && !cat.includes('overnight');
        });
        break;
      default:
        break;
    }
    return list;
  }, [allMatrixFunds, filter]);

  const totalPages = Math.ceil(filteredFunds.length / PAGE_SIZE);
  const pageFunds = filteredFunds.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Reset page on filter change
  useEffect(() => { setPage(0); }, [filter]);

  if (!sectorData?.length || sectorColumns.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 animate-in flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="section-title">Fund Exposure Matrix</p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Top funds by AUM — sector allocation heatmap ({filteredFunds.length} funds)
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-1 mb-3">
        {MATRIX_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
              filter === f.key
                ? 'bg-teal-100 text-teal-700 border border-teal-200'
                : 'text-slate-400 hover:bg-slate-100 border border-transparent'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto flex-1">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-[10px] text-slate-500 uppercase tracking-wider">
              <th className="text-left pb-3 pr-3 font-semibold">Fund</th>
              {sectorColumns.map((name) => (
                <th key={name} className="text-center pb-3 font-medium px-1.5">
                  {shortSector(name)}
                </th>
              ))}
              <th className="text-right pb-3 font-medium">1Y Ret</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {loading && pageFunds.length === 0 ? (
              <tr><td colSpan={sectorColumns.length + 2} className="py-8 text-center text-slate-400 text-xs">Loading...</td></tr>
            ) : pageFunds.length === 0 ? (
              <tr><td colSpan={sectorColumns.length + 2} className="py-8 text-center text-slate-400 text-xs">No funds match filter</td></tr>
            ) : pageFunds.map((fund) => {
              const sectors = fund.sectors || {};
              const ret1y = Number(fund.return_1y) || 0;
              return (
                <tr
                  key={fund.mstar_id}
                  className="cursor-pointer hover:bg-slate-50/50 transition-colors"
                  onClick={() => router.push(`/fund360?fund=${fund.mstar_id}`)}
                >
                  <td className="py-2.5 pr-3 font-semibold text-slate-800 max-w-[180px] truncate" title={fund.fund_name}>
                    {fund.fund_name}
                  </td>
                  {sectorColumns.map((sectorName) => {
                    const pct = sectors[sectorName] ?? null;
                    const style = heatStyle(pct);
                    return (
                      <td key={sectorName} className="py-2.5 text-center">
                        <span className="inline-block w-10 h-7 rounded text-[11px] leading-7 tabular-nums" style={style}>
                          {pct != null && pct > 0 ? `${Math.round(pct)}%` : '—'}
                        </span>
                      </td>
                    );
                  })}
                  <td className="py-2.5 text-right">
                    <span className={`font-bold tabular-nums ${ret1y >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {formatPct(ret1y)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-100">
              <td className="pt-2" />
              {sectorColumns.map((name) => {
                const sector = sectorData.find((s) => s.sector_name === name);
                const qColor = QUADRANT_COLORS[sector?.quadrant]?.circle || '#94a3b8';
                return (
                  <td key={name} className="pt-2 text-center">
                    <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: qColor }} />
                  </td>
                );
              })}
              <td className="pt-2" />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-100">
          <span className="text-[10px] text-slate-400">
            Page {page + 1} of {totalPages}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="px-2 py-1 text-[10px] font-medium rounded border border-slate-200 disabled:opacity-30 hover:bg-slate-50"
            >
              ←
            </button>
            <button
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page >= totalPages - 1}
              className="px-2 py-1 text-[10px] font-medium rounded border border-slate-200 disabled:opacity-30 hover:bg-slate-50"
            >
              →
            </button>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-100">
        <div className="flex gap-4">
          {[
            { label: 'Leading', color: '#059669' },
            { label: 'Improving', color: '#0ea5e9' },
            { label: 'Weakening', color: '#f59e0b' },
            { label: 'Lagging', color: '#ef4444' },
          ].map(({ label, color }) => (
            <div key={label} className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-[10px] text-slate-500">{label}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-400">Cell = allocation %</span>
          <div className="flex gap-0.5">
            {[0.05, 0.15, 0.3, 0.45].map((op) => (
              <span key={op} className="w-3 h-3 rounded-sm" style={{ backgroundColor: `rgba(13,148,136,${op})` }} />
            ))}
          </div>
        </div>
      </div>

      <InfoBulb title="Exposure Matrix" items={[
        { icon: '🔥', label: 'Heatmap', text: 'Darker teal = higher allocation to that sector. Each cell shows what % of the fund is invested in that sector.' },
        { icon: '⚫', label: 'Dots', text: 'Colored dots below each column indicate the sector\'s current rotation quadrant (Leading/Improving/Weakening/Lagging).' },
        { icon: '🎯', label: 'Insight', text: 'Look for funds with heavy allocation to Leading sectors (green dots) and minimal exposure to Lagging sectors (red dots).' },
        { icon: '📊', label: 'Filters', text: 'Use category filters to narrow to your investment style. Click any row for the fund\'s full 360 deep-dive.' },
      ]} />
    </div>
  );
}
