import { lensColor } from '../../lib/lens';

const SIZES = { sm: 'w-6 h-6 text-[9px]', md: 'w-8 h-8 text-[10px]' };

export default function LensCircle({ score, label, size = 'sm' }) {
  return (
    <div
      className={`${SIZES[size]} rounded-full flex items-center justify-center text-white font-bold`}
      style={{ backgroundColor: lensColor(score) }}
      title={`${label}: ${Math.round(score)}`}
    >
      {label}
    </div>
  );
}
