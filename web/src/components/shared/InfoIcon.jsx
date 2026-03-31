import { useState, useRef, useEffect } from 'react';

/**
 * Info icon with hover tooltip — supports plain text, formula, and interpretation.
 *
 * Props:
 *   tip: string — main explanation text
 *   formula: string (optional) — formula/derivation shown in monospace
 *   action: string (optional) — how to interpret / what action to take
 *   wide: boolean (optional) — wider tooltip for complex content (w-72 vs w-56)
 *   className: string (optional) — additional CSS classes
 */
export default function InfoIcon({ tip, formula, action, wide, className = '' }) {
  const [show, setShow] = useState(false);
  const ref = useRef(null);
  const tipRef = useRef(null);
  const [pos, setPos] = useState('bottom');

  useEffect(() => {
    if (show && ref.current && tipRef.current) {
      const rect = ref.current.getBoundingClientRect();
      const tipRect = tipRef.current.getBoundingClientRect();
      if (rect.top - tipRect.height < 8) {
        setPos('bottom');
      } else {
        setPos('top');
      }
    }
  }, [show]);

  const width = wide ? 'w-72' : 'w-56';

  return (
    <span
      ref={ref}
      className={`relative inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-slate-100 text-slate-400 text-[9px] font-bold cursor-help flex-shrink-0 hover:bg-teal-50 hover:text-teal-600 transition-colors ${className}`}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      i
      {show && (
        <span
          ref={tipRef}
          className={`absolute z-50 ${
            pos === 'top' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
          } left-1/2 -translate-x-1/2 bg-slate-800 text-slate-200 px-3 py-2.5 rounded-lg text-[10px] font-normal leading-relaxed ${width} shadow-lg pointer-events-none`}
        >
          {/* Main explanation */}
          <span className="block">{tip}</span>

          {/* Formula (monospace, teal highlight) */}
          {formula && (
            <span className="block mt-1.5 px-2 py-1 bg-slate-700/60 rounded text-[9px] font-mono text-teal-300">
              {formula}
            </span>
          )}

          {/* Action/interpretation (italic, lighter) */}
          {action && (
            <span className="block mt-1.5 text-[9px] text-slate-400 italic">
              {action}
            </span>
          )}

          {/* Arrow */}
          <span
            className={`absolute left-1/2 -translate-x-1/2 border-[5px] border-transparent ${
              pos === 'top'
                ? 'top-full border-t-slate-800'
                : 'bottom-full border-b-slate-800'
            }`}
          />
        </span>
      )}
    </span>
  );
}
