import Card from '../shared/Card';
import LensCircle from '../shared/LensCircle';
import SkeletonLoader from '../shared/SkeletonLoader';
import { formatScore } from '../../lib/format';
import { lensColor } from '../../lib/lens';

const SHOWCASE_LENSES = [
  { key: 'return_score', label: 'Return Leaders', icon: '📈' },
  { key: 'alpha_score', label: 'Alpha Generators', icon: '🎯' },
  { key: 'resilience_score', label: 'Fortress Resilience', icon: '🛡️' },
];

export default function TopFundsByLens({ fundsByLens, onFundClick, loading }) {
  if (loading || !fundsByLens) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <SkeletonLoader key={i} className="h-40 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {SHOWCASE_LENSES.map(({ key, label, icon }) => {
        const funds = fundsByLens[key] || [];
        return (
          <Card key={key} title={label} emoji={icon}>
            <div className="space-y-2 mt-1">
              {funds.slice(0, 3).map((fund, idx) => (
                <div key={fund.mstar_id} className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 w-4 font-mono tabular-nums">
                    {idx + 1}
                  </span>
                  <LensCircle scoreKey={key} score={fund.score || fund[key]} size="sm" />
                  <span
                    className="text-xs font-medium truncate max-w-[140px] cursor-pointer text-teal-600 hover:underline"
                    onClick={() => onFundClick(fund.mstar_id)}
                    title={fund.fund_name}
                  >
                    {fund.fund_name}
                  </span>
                  <span
                    className="ml-auto font-mono text-xs tabular-nums font-medium"
                    style={{ color: lensColor(fund.score || fund[key] || 0) }}
                  >
                    {formatScore(fund.score || fund[key])}
                  </span>
                </div>
              ))}
              {funds.length === 0 && (
                <p className="text-xs text-slate-400">No data</p>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
