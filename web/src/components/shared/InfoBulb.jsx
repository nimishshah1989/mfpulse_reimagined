import { useState } from 'react';

/**
 * InfoBulb — expandable insight panel for every chart.
 * Click the bulb icon to reveal: what it measures, how to read it,
 * calculation methodology, and key insights.
 */
export default function InfoBulb({ title, items }) {
  const [open, setOpen] = useState(false);

  if (!items?.length) return null;

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-[10px] text-slate-400 hover:text-teal-600 transition-colors group"
        aria-expanded={open}
      >
        <span className="w-4 h-4 rounded-full bg-amber-100 group-hover:bg-amber-200 flex items-center justify-center text-[10px] transition-colors">
          💡
        </span>
        <span className="font-medium">
          {open ? 'Hide' : ''} How to read this{title ? ` — ${title}` : ''}
        </span>
        <span className="text-[9px]">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="mt-2 p-3 rounded-lg bg-amber-50/60 border border-amber-100 space-y-2 animate-in">
          {items.map((item, i) => (
            <div key={i} className="flex gap-2">
              <span className="text-amber-500 text-[10px] font-bold mt-0.5 flex-shrink-0">
                {item.icon || '→'}
              </span>
              <div>
                {item.label && (
                  <span className="text-[10px] font-semibold text-slate-700">
                    {item.label}:{' '}
                  </span>
                )}
                <span className="text-[10px] text-slate-600 leading-relaxed">
                  {item.text}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
