import { generateVerdict } from './VerdictGenerator';

export default function Verdict({ fund }) {
  const text = generateVerdict(fund);
  if (!text) return null;
  return (
    <div className="border-l-4 border-teal-500 pl-4 py-3 bg-teal-50/30 rounded-r-lg">
      <p className="text-sm text-slate-700 leading-relaxed">{text}</p>
    </div>
  );
}
