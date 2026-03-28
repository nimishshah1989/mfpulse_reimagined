import Card from '../shared/Card';
import SkeletonLoader from '../shared/SkeletonLoader';
import { formatScore } from '../../lib/format';
import { LENS_OPTIONS } from '../../lib/lens';

function scoreColor(score) {
  if (score >= 75) return 'text-emerald-600';
  if (score >= 50) return 'text-teal-600';
  if (score >= 25) return 'text-amber-600';
  return 'text-red-600';
}

export default function TopFundsByLens({ fundsByLens, onFundClick }) {
  if (!fundsByLens) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <SkeletonLoader key={i} className="h-36 rounded-xl" />
        ))}
      </div>
    );
  }

  const lensKeys = [
    'return_score',
    'risk_score',
    'consistency_score',
    'alpha_score',
    'efficiency_score',
    'resilience_score',
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
      {lensKeys.map((key) => {
        const lens = LENS_OPTIONS.find((l) => l.value === key);
        const funds = fundsByLens[key] || [];

        return (
          <Card key={key} title={lens ? lens.label : key}>
            <div className="space-y-2 mt-2">
              {funds.slice(0, 3).map((fund, idx) => (
                <div key={fund.mstar_id} className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 w-4 font-mono">
                    {idx + 1}
                  </span>
                  <span
                    className="text-xs font-medium truncate max-w-[160px] cursor-pointer text-teal-600 hover:underline"
                    onClick={() => onFundClick(fund.mstar_id)}
                    title={fund.fund_name}
                  >
                    {fund.fund_name}
                  </span>
                  <span
                    className={`ml-auto font-mono text-xs ${scoreColor(fund.score)}`}
                  >
                    {formatScore(fund.score)}
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
