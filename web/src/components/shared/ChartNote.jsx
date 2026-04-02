/**
 * Reusable "how to read this chart" note for every visualization.
 * Renders as a small, understated paragraph below the chart.
 */
export default function ChartNote({ children }) {
  if (!children) return null;
  return (
    <p className="text-[10px] text-slate-400 leading-relaxed mt-2 px-1">
      {children}
    </p>
  );
}

/**
 * Color legend row — shows colored dots/boxes with labels.
 * items: [{ color: '#hex', label: 'text' }, ...]
 */
export function ChartLegend({ items, type = 'dot' }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 px-1">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-1">
          {type === 'dot' ? (
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: item.color }}
            />
          ) : (
            <span
              className="w-3 h-2 rounded-sm shrink-0"
              style={{ backgroundColor: item.color }}
            />
          )}
          <span className="text-[9px] text-slate-500">{item.label}</span>
        </div>
      ))}
    </div>
  );
}
