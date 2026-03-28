import { lensColor, lensBgColor, lensLabel } from '../../lib/lens';

/**
 * Colored pill showing tier name.
 * Accepts either:
 *   - tier (string like "Leader") + score (for color)
 *   - label (string) without score (uses neutral styling)
 *   - lensKey + score (derives tier name from lensLabel)
 */
export default function TierBadge({ tier, label, score, lensKey }) {
  const displayText = tier || label || (score != null ? lensLabel(score) : '');
  if (!displayText) return null;

  const hasScore = score != null && !isNaN(Number(score));
  const s = hasScore ? Number(score) : 50;

  return (
    <span
      className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap"
      style={{
        backgroundColor: hasScore ? lensBgColor(s) : '#f1f5f9',
        color: hasScore ? lensColor(s) : '#475569',
      }}
    >
      {displayText}
    </span>
  );
}
