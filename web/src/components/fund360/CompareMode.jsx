import { useState, useEffect, useRef } from 'react';
import { fetchFunds, fetchFundDetail, fetchFundLensScores, fetchOverlap } from '../../lib/api';
import { formatPct } from '../../lib/format';
import Badge from '../shared/Badge';
import { LENS_OPTIONS } from '../../lib/lens';
import { lensColor } from '../../lib/lens';

const slideIn = {
  animation: 'slideInRight 0.3s ease-out forwards',
};

export default function CompareMode({ primaryFund, primaryScores, onClose }) {
  const [compareFunds, setCompareFunds] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [overlap, setOverlap] = useState(null);
  const panelRef = useRef(null);

  // Debounced search
  useEffect(() => {
    if (!searchQuery || searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetchFunds({ search: searchQuery, limit: 8 });
        const funds = res?.data ?? res ?? [];
        const filtered = funds.filter(
          (f) =>
            f.mstar_id !== primaryFund.mstar_id &&
            !compareFunds.some((c) => c.detail.mstar_id === f.mstar_id)
        );
        setSearchResults(filtered);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, primaryFund.mstar_id, compareFunds]);

  // Fetch overlap when funds change
  useEffect(() => {
    if (compareFunds.length === 0) {
      setOverlap(null);
      return;
    }
    const ids = [primaryFund.mstar_id, ...compareFunds.map((f) => f.detail.mstar_id)];
    fetchOverlap(ids).then(setOverlap).catch(() => setOverlap(null));
  }, [compareFunds, primaryFund.mstar_id]);

  const addFund = async (fund) => {
    if (compareFunds.length >= 2) return;
    setSearchQuery('');
    setSearchResults([]);
    try {
      const [detailRaw, scores] = await Promise.all([
        fetchFundDetail(fund.mstar_id),
        fetchFundLensScores(fund.mstar_id),
      ]);
      // Flatten nested { fund: {...}, returns: {...} } structure
      const rawData = detailRaw?.data ?? detailRaw;
      const fundData = rawData?.fund ? { ...rawData.fund, returns: rawData.returns } : rawData;
      setCompareFunds((prev) => [...prev, { detail: fundData, scores: scores?.data ?? scores }]);
    } catch {
      // silently ignore
    }
  };

  const removeFund = (idx) => {
    setCompareFunds((prev) => prev.filter((_, i) => i !== idx));
  };

  const allFunds = [
    { label: primaryFund.fund_name, detail: primaryFund, scores: primaryScores },
    ...compareFunds.map((f) => ({ label: f.detail.fund_name, detail: f.detail, scores: f.scores })),
  ];

  const returnPeriods = [
    { key: 'return_1y', label: '1Y' },
    { key: 'return_3y', label: '3Y' },
    { key: 'return_5y', label: '5Y' },
  ];

  return (
    <>
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
      <div
        ref={panelRef}
        style={slideIn}
        className="fixed top-0 right-0 h-full w-[420px] bg-white border-l border-slate-200 shadow-xl z-40 flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Compare Funds</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-xl leading-none"
          >
            &#10005;
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Search */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={compareFunds.length >= 2 ? 'Max 2 funds added' : 'Search fund to compare...'}
              disabled={compareFunds.length >= 2}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-600 disabled:bg-slate-50 disabled:text-slate-400"
            />
            {(searchResults.length > 0 || searching) && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-10 max-h-60 overflow-y-auto">
                {searching && <div className="px-3 py-2 text-sm text-slate-500">Searching...</div>}
                {searchResults.map((fund) => (
                  <button
                    key={fund.mstar_id}
                    onClick={() => addFund(fund)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 border-b border-slate-100 last:border-0"
                  >
                    <div className="font-medium text-slate-800 truncate">{fund.fund_name}</div>
                    <div className="text-xs text-slate-500">{fund.category_name}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Added funds pills */}
          {compareFunds.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {compareFunds.map((f, idx) => (
                <span
                  key={f.detail.mstar_id}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-teal-50 text-teal-700 rounded-full text-xs font-medium"
                >
                  <span className="truncate max-w-[200px]">{f.detail.fund_name}</span>
                  <button onClick={() => removeFund(idx)} className="hover:text-teal-900 ml-1">
                    &#10005;
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Lens Scores Comparison */}
          {compareFunds.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Lens Score Comparison</h3>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-1.5 text-slate-500 font-medium">Lens</th>
                    {allFunds.map((f, idx) => (
                      <th key={idx} className="text-right py-1.5 text-slate-500 font-medium truncate max-w-[80px]">
                        {f.label?.slice(0, 12)}{f.label?.length > 12 ? '…' : ''}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {LENS_OPTIONS.map(({ key, label }) => (
                    <tr key={key} className="border-b border-slate-100 last:border-0">
                      <td className="py-1.5 text-slate-600">{label}</td>
                      {allFunds.map((f, idx) => {
                        const score = f.scores?.[key];
                        const color = lensColor(score);
                        return (
                          <td key={idx} className="py-1.5 text-right font-mono tabular-nums font-semibold" style={{ color }}>
                            {score != null ? Math.round(Number(score)) : '—'}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Returns Comparison Table */}
          {compareFunds.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Returns Comparison</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-2 text-slate-500 font-medium">Fund</th>
                    {returnPeriods.map((p) => (
                      <th key={p.key} className="text-right py-2 text-slate-500 font-medium">{p.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {allFunds.map((f, idx) => (
                    <tr key={idx} className="border-b border-slate-100 last:border-0">
                      <td className="py-2 text-slate-800 truncate max-w-[160px]" title={f.label}>
                        {f.label?.length > 25 ? f.label.slice(0, 25) + '...' : f.label}
                      </td>
                      {returnPeriods.map((p) => {
                        const val = f.detail?.[p.key];
                        return (
                          <td key={p.key} className="text-right py-2">
                            {val != null ? (
                              <span className={`font-mono tabular-nums ${val >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                {formatPct(val)}
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Overlap Section */}
          {overlap && (
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-2">Holdings Overlap</h3>
              <p className="text-sm text-slate-600">
                <span className="font-mono tabular-nums font-semibold text-teal-600">
                  {overlap.common_count ?? 0}
                </span>{' '}
                common stocks
                {overlap.overlap_pct != null && (
                  <span className="ml-1">
                    (<span className="font-mono tabular-nums">{formatPct(overlap.overlap_pct)}</span>)
                  </span>
                )}
              </p>
            </div>
          )}

          {compareFunds.length === 0 && (
            <p className="text-sm text-slate-400 text-center pt-8">
              Search and add up to 2 funds to compare against the primary fund.
            </p>
          )}
        </div>
      </div>
    </>
  );
}
