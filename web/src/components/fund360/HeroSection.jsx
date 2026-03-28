import { useRouter } from 'next/router';
import { formatAUM } from '../../lib/format';
import { LENS_OPTIONS, LENS_CLASS_KEYS } from '../../lib/lens';
import Badge from '../shared/Badge';

function inceptionAge(inceptionDate) {
  if (!inceptionDate) return null;
  const start = new Date(inceptionDate);
  const now = new Date();
  const years = Math.floor((now - start) / (1000 * 60 * 60 * 24 * 365.25));
  if (years < 1) return '< 1 yr';
  return `${years} yr${years !== 1 ? 's' : ''}`;
}

/**
 * HeroSection -- full-width fund identity with tier tags, stats, and action buttons.
 *
 * Props:
 *   fundDetail   object
 *   lensScores   object
 *   mstarId      string
 *   onCompare    func
 */
export default function HeroSection({ fundDetail, lensScores, mstarId, onCompare }) {
  const router = useRouter();
  const fundName = fundDetail.fund_name || fundDetail.legal_name;
  const age = inceptionAge(fundDetail.inception_date);

  // AUM: try direct, then universe-enriched field
  const aumRaw = fundDetail.aum;
  const aumCr = aumRaw != null ? Number(aumRaw) / 10000000 : null;

  return (
    <div className="bg-gradient-to-br from-white via-white to-teal-50/30 border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Back navigation */}
        <button
          type="button"
          onClick={() => router.push('/fund360')}
          className="text-xs text-teal-600 hover:text-teal-800 mb-3 inline-flex items-center gap-1.5 font-medium transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Explorer
        </button>

        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0 flex-1">
            {/* Fund name */}
            <h1 className="text-2xl font-bold text-slate-900 leading-tight tracking-tight">
              {fundName}
            </h1>
            <p className="text-sm text-slate-500 mt-1">{fundDetail.amc_name}</p>

            {/* Stat pills row */}
            <div className="flex flex-wrap items-center gap-3 mt-4">
              {fundDetail.category_name && (
                <span className="px-3 py-1 bg-slate-100 text-slate-700 text-xs font-medium rounded-lg">
                  {fundDetail.category_name}
                </span>
              )}
              {aumCr != null && (
                <StatPill label="AUM" value={formatAUM(aumCr)} />
              )}
              {fundDetail.expense_ratio != null && (
                <StatPill label="TER" value={`${Number(fundDetail.expense_ratio).toFixed(2)}%`} />
              )}
              {age && (
                <StatPill label="Age" value={age} />
              )}
              {fundDetail.indian_risk_level && (
                <StatPill label="Risk" value={fundDetail.indian_risk_level} />
              )}
            </div>

            {/* Headline tag */}
            {lensScores?.headline_tag && (
              <p className="text-sm italic text-slate-600 mt-4 leading-relaxed max-w-2xl">
                &ldquo;{lensScores.headline_tag}&rdquo;
              </p>
            )}

            {/* Color-coded tier tags */}
            {lensScores && (
              <div className="flex flex-wrap items-center gap-1.5 mt-4">
                {LENS_OPTIONS.map((lens) => {
                  const classKey = LENS_CLASS_KEYS[lens.key];
                  const tier = lensScores[classKey];
                  if (!tier) return null;
                  return (
                    <button
                      key={lens.key}
                      type="button"
                      onClick={() => router.push(`/universe?filter=${tier}`)}
                      className="transition-transform hover:scale-105"
                      title={`${lens.label}: ${tier} -- Click to filter Universe`}
                    >
                      <Badge variant="tier">{tier}</Badge>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-2.5 flex-shrink-0 pt-1">
            <button
              type="button"
              onClick={() => router.push(`/strategies?fund=${mstarId}`)}
              className="px-5 py-2.5 text-xs font-semibold text-white bg-teal-600 rounded-lg hover:bg-teal-700 transition-all shadow-sm hover:shadow-md whitespace-nowrap flex items-center gap-2"
            >
              Simulate
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </button>
            <button
              type="button"
              onClick={onCompare}
              className="px-5 py-2.5 text-xs font-semibold text-teal-600 border border-teal-200 rounded-lg hover:bg-teal-50 transition-colors whitespace-nowrap"
            >
              Compare
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatPill({ label, value }) {
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-slate-200 rounded-lg shadow-sm">
      <span className="text-[10px] text-slate-400 uppercase font-medium">{label}</span>
      <span className="text-xs font-mono tabular-nums font-semibold text-slate-700">{value}</span>
    </div>
  );
}
