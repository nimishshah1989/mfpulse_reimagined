import { lensColor, LENS_LABELS } from '../../lib/lens';

const LABEL_ABBR = {
  return_score: 'Ret',
  risk_score: 'Rsk',
  consistency_score: 'Con',
  alpha_score: 'Alp',
  efficiency_score: 'Eff',
  resilience_score: 'Res',
};

const SIZES = {
  sm: { cls: 'w-6 h-6 text-[9px]', px: 24 },
  md: { cls: 'w-8 h-8 text-[10px]', px: 32 },
};

/**
 * Small colored circle showing a lens score.
 * Accepts either:
 *   - label (3-letter string) + score
 *   - lensKey/scoreKey (e.g. "return_score") + score/value
 *   - size as "sm"/"md" string or numeric px
 */
export default function LensCircle({ score, value, label, lensKey, scoreKey, size = 'sm' }) {
  const s = Number(score ?? value) || 0;
  const key = lensKey || scoreKey;
  const displayLabel = label || LABEL_ABBR[key] || '?';
  const fullLabel = LENS_LABELS[key] || displayLabel;

  // Accept size as string ("sm"/"md") or number (px)
  const sizeInfo = typeof size === 'string' ? SIZES[size] : null;
  const cls = sizeInfo
    ? sizeInfo.cls
    : `text-[9px]`;
  const inlineSize = sizeInfo
    ? undefined
    : { width: size, height: size };

  return (
    <div
      className={`${cls} rounded-full flex items-center justify-center text-white font-bold flex-shrink-0`}
      style={{ backgroundColor: lensColor(s), ...inlineSize }}
      title={`${fullLabel}: ${Math.round(s)}`}
    >
      {displayLabel}
    </div>
  );
}
