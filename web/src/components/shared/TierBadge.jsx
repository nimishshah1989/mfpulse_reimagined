import { lensColor, lensBgColor } from '../../lib/lens';

export default function TierBadge({ tier, score }) {
  return (
    <span
      className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold"
      style={{ backgroundColor: lensBgColor(score), color: lensColor(score) }}
    >
      {tier}
    </span>
  );
}
