import { useMemo } from 'react';
import { useRouter } from 'next/router';
import { QUADRANT_COLORS } from '../../lib/sectors';
import { formatPct } from '../../lib/format';

const TEAL = { r: 13, g: 148, b: 136 };

/** Heat color: higher allocation = more opaque teal */
function heatStyle(pct) {
  if (pct == null || pct <= 0) {
    return {
      backgroundColor: 'rgba(13,148,136,0.04)',
      color: '#94a3b8',
    };
  }
  const opacity = Math.min(0.6, 0.06 + pct * 0.018);
  const textColor =
    pct >= 20 ? '#0f766e' : pct >= 8 ? '#334155' : '#64748b';
  return {
    backgroundColor: `rgba(${TEAL.r},${TEAL.g},${TEAL.b},${opacity})`,
    color: textColor,
    fontWeight: pct >= 10 ? 700 : 600,
  };
}

/** Pick short column header from sector name */
function shortSector(name) {
  const map = {
    Technology: 'Tech',
    'Financial Services': 'Fin',
    Healthcare: 'Health',
    Energy: 'Energy',
    Automobile: 'Auto',
    'Consumer Defensive': 'FMCG',
    FMCG: 'FMCG',
    'Basic Materials': 'Metal',
    'Metals & Mining': 'Metal',
    'Real Estate': 'Realty',
    Infrastructure: 'Infra',
    Industrials: 'Indust',
    'Communication Services': 'Comm',
    Utilities: 'Util',
    'Consumer Cyclical': 'Cons.C',
    'IT Services': 'IT',
    Pharma: 'Pharma',
  };
  return map[name] || name.slice(0, 5);
}

export default function FundExposureMatrix({
  funds,
  sectorData,
  sectorExposures,
  online,
}) {
  const router = useRouter();

  const sectorColumns = useMemo(() => {
    if (!sectorData?.length) return [];
    return sectorData.slice(0, 9).map((s) => s.sector_name);
  }, [sectorData]);

  // Pick top funds that have exposure data
  const matrixFunds = useMemo(() => {
    if (!funds?.length || !sectorExposures) return [];
    return funds
      .filter((f) => sectorExposures[f.mstar_id])
      .slice(0, 6);
  }, [funds, sectorExposures]);

  if (
    !sectorData?.length ||
    matrixFunds.length === 0 ||
    sectorColumns.length === 0
  ) {
    return null;
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 animate-in">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="section-title">Fund Exposure Matrix</p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Which popular funds are most exposed to each sector
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
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
            {matrixFunds.map((fund) => {
              const exposureMap = sectorExposures[fund.mstar_id] || {};
              const ret1y = Number(fund.return_1y) || 0;

              return (
                <tr
                  key={fund.mstar_id}
                  className="cursor-pointer hover:bg-slate-50/50 transition-colors"
                  onClick={() =>
                    router.push(`/fund360?fund=${fund.mstar_id}`)
                  }
                >
                  <td className="py-2.5 pr-3 font-semibold text-slate-800 max-w-[180px] truncate">
                    {fund.fund_name}
                  </td>
                  {sectorColumns.map((sectorName) => {
                    const pct = exposureMap[sectorName] ?? null;
                    const style = heatStyle(pct);
                    return (
                      <td key={sectorName} className="py-2.5 text-center">
                        <span
                          className="inline-block w-10 h-7 rounded text-[11px] leading-7 tabular-nums"
                          style={style}
                        >
                          {pct != null ? `${Math.round(pct)}%` : '—'}
                        </span>
                      </td>
                    );
                  })}
                  <td className="py-2.5 text-right">
                    <span
                      className={`font-bold tabular-nums ${
                        ret1y >= 0 ? 'text-emerald-600' : 'text-red-500'
                      }`}
                    >
                      {formatPct(ret1y)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Quadrant indicator dots for columns */}
      <div className="flex gap-0 mt-2 pt-2 border-t border-slate-100">
        <div className="w-32 mr-4" />
        {sectorColumns.map((name) => {
          const sector = sectorData.find((s) => s.sector_name === name);
          const qColor =
            QUADRANT_COLORS[sector?.quadrant]?.circle || '#94a3b8';
          return (
            <div key={name} className="flex-1 text-center">
              <span
                className="inline-block w-2 h-2 rounded-full"
                style={{ backgroundColor: qColor }}
              />
            </div>
          );
        })}
      </div>
      {/* Color legend */}
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
          <span className="text-[10px] text-slate-400">Cell intensity = allocation %</span>
          <div className="flex gap-0.5">
            {[0.05, 0.15, 0.3, 0.45].map((op) => (
              <span
                key={op}
                className="w-3 h-3 rounded-sm"
                style={{ backgroundColor: `rgba(13,148,136,${op})` }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
