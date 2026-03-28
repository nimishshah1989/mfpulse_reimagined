import { useMemo } from 'react';
import { useRouter } from 'next/router';
import EmptyState from '../shared/EmptyState';
import SectionTitle from '../shared/SectionTitle';
import { QUADRANT_COLORS } from '../../lib/sectors';
import { formatPct } from '../../lib/format';

const TEAL = { r: 13, g: 148, b: 136 };

/** Heat color: higher allocation = more opaque teal */
function heatStyle(pct) {
  if (pct == null || pct <= 0) {
    return {
      backgroundColor: 'rgba(13,148,136,0.02)',
      color: '#cbd5e1',
    };
  }
  const opacity = Math.min(0.5, 0.03 + pct * 0.012);
  const textColor =
    pct >= 20 ? '#0d9488' : pct >= 8 ? '#64748b' : '#94a3b8';
  return {
    backgroundColor: `rgba(${TEAL.r},${TEAL.g},${TEAL.b},${opacity})`,
    color: textColor,
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
    !online ||
    !sectorData?.length ||
    matrixFunds.length === 0 ||
    sectorColumns.length === 0
  ) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-5 animate-in">
        <SectionTitle tip="Heat-colored table showing sector allocation across popular funds">
          Fund Exposure Matrix
        </SectionTitle>
        <EmptyState message="Exposure matrix will appear after sector data loads" />
      </div>
    );
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
        <table className="w-full text-[11px]">
          <thead>
            <tr className="text-[9px] text-slate-400 uppercase tracking-wider">
              <th className="text-left pb-3 pr-4 font-medium">Fund</th>
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
                  <td className="py-2.5 pr-4 font-medium text-slate-700">
                    {fund.fund_name}
                  </td>
                  {sectorColumns.map((sectorName) => {
                    const pct = exposureMap[sectorName] ?? null;
                    const style = heatStyle(pct);
                    return (
                      <td key={sectorName} className="py-2.5 text-center">
                        <span
                          className="inline-block w-9 h-6 rounded text-[10px] font-bold leading-6"
                          style={style}
                        >
                          {pct != null ? `${Math.round(pct)}%` : '0%'}
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
    </div>
  );
}
