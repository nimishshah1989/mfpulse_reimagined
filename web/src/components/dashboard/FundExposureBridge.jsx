import SkeletonLoader from '../shared/SkeletonLoader';
import SectionTitle from '../shared/SectionTitle';
import { formatAUMRaw, formatPct } from '../../lib/format';

const SECTOR_ABBREV = {
  Technology: 'Tech',
  'Financial Services': 'Fin',
  Healthcare: 'Health',
  'Consumer Cyclical': 'Cons.C',
  'Consumer Defensive': 'Cons.D',
  Industrials: 'Indust.',
  'Basic Materials': 'Matls',
  Energy: 'Energy',
  'Communication Services': 'Comm.',
  Communication: 'Comm.',
  'Real Estate': 'RE',
  Utilities: 'Util.',
};

const QUADRANT_COLORS = {
  Leading: '#059669',
  Improving: '#0ea5e9',
  Weakening: '#d97706',
  Lagging: '#ef4444',
};

function toTitleCase(str) {
  if (!str) return 'Improving';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function getQuadrantColor(sectorName, sectors) {
  if (!sectors || sectors.length === 0) return '#94a3b8';
  const match = sectors.find(
    (s) => (s.sector_name || s.display_name || s.name || '') === sectorName
  );
  if (!match) return '#94a3b8';
  const q = toTitleCase(match.quadrant);
  return QUADRANT_COLORS[q] || '#94a3b8';
}

function heatBg(pct) {
  if (pct == null || pct === 0) return 'transparent';
  return `rgba(13, 148, 136, ${(pct / 100) * 0.4})`;
}

function heatText(pct) {
  if (pct == null || pct === 0) return 'text-slate-300';
  if (pct > 25) return 'text-teal-700';
  if (pct >= 10) return 'text-slate-600';
  return 'text-slate-400';
}

function deriveTopSectors(funds) {
  if (!funds || funds.length === 0) return [];
  const totals = {};
  funds.forEach((f) => {
    if (!f.sectors) return;
    Object.entries(f.sectors).forEach(([name, pct]) => {
      totals[name] = (totals[name] || 0) + (Number(pct) || 0);
    });
  });
  return Object.entries(totals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 7)
    .map(([name]) => name);
}

export default function FundExposureBridge({ matrixData, sectors, loading }) {
  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <SkeletonLoader className="h-6 w-48 rounded mb-4" />
        <SkeletonLoader className="h-48 rounded" />
      </div>
    );
  }

  const funds = (matrixData || []).slice(0, 5);
  if (funds.length === 0) return null;

  const topSectors = deriveTopSectors(funds);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <SectionTitle tip="Top funds by AUM with sector allocation heatmap">
        SECTOR-FUND BRIDGE
      </SectionTitle>
      <p className="text-[10px] text-slate-400 -mt-2 mb-3">
        Top funds by AUM &times; sector allocation
      </p>

      <div className="overflow-x-auto">
        <table className="w-full" style={{ fontSize: 11, borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th className="text-left text-[9px] uppercase text-slate-400 font-medium tracking-wider pb-2 pr-3">
                Fund
              </th>
              {topSectors.map((s) => (
                <th key={s} className="text-center text-[9px] uppercase text-slate-400 font-medium tracking-wider pb-2 px-1">
                  <div className="flex flex-col items-center gap-0.5">
                    <span
                      className="inline-block w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: getQuadrantColor(s, sectors) }}
                    />
                    <span>{SECTOR_ABBREV[s] || s.slice(0, 5)}</span>
                  </div>
                </th>
              ))}
              <th className="text-right text-[9px] uppercase text-slate-400 font-medium tracking-wider pb-2 pl-3">
                1Y Ret
              </th>
            </tr>
          </thead>
          <tbody>
            {funds.map((fund) => {
              const ret = fund.return_1y;
              const isPositive = ret != null && Number(ret) >= 0;
              return (
                <tr
                  key={fund.mstar_id}
                  className="hover:bg-[#f8fafc] cursor-pointer border-t border-slate-100"
                >
                  <td className="py-1.5 pr-3">
                    <div className="text-xs font-medium text-slate-700 truncate max-w-[140px]">
                      {fund.fund_name}
                    </div>
                    <div className="text-[9px] text-slate-400">
                      {formatAUMRaw(fund.aum)}
                    </div>
                  </td>
                  {topSectors.map((s) => {
                    const pct = fund.sectors?.[s] || 0;
                    const display = pct > 0 ? pct.toFixed(0) : '\u2014';
                    return (
                      <td key={s} className="text-center py-1.5 px-1">
                        <span
                          className={`inline-flex items-center justify-center font-bold tabular-nums ${heatText(pct)}`}
                          style={{
                            width: 36,
                            height: 24,
                            borderRadius: 4,
                            fontSize: 10,
                            backgroundColor: heatBg(pct),
                          }}
                        >
                          {display}
                        </span>
                      </td>
                    );
                  })}
                  <td className="text-right py-1.5 pl-3">
                    <span
                      className={`text-xs font-semibold tabular-nums ${
                        isPositive ? 'text-emerald-600' : 'text-red-600'
                      }`}
                    >
                      {formatPct(ret)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer legend */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
        <div className="flex items-center gap-3">
          {Object.entries(QUADRANT_COLORS).map(([label, color]) => (
            <div key={label} className="flex items-center gap-1">
              <span
                className="inline-block w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span className="text-[9px] text-slate-400">{label}</span>
            </div>
          ))}
        </div>
        <span className="text-[9px] text-slate-400 italic">
          Cell intensity = allocation %
        </span>
      </div>
    </div>
  );
}
