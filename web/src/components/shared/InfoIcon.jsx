import { useState, useRef, useEffect } from 'react';

/**
 * Info icon with hover tooltip — matches mockup's dark tooltip style.
 * Repositions automatically to stay within viewport.
 */
export default function InfoIcon({ tip, className = '' }) {
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

  return (
    <span
      ref={ref}
      className={`relative inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-slate-100 text-slate-400 text-[9px] font-bold cursor-help flex-shrink-0 ${className}`}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      i
      {show && (
        <span
          ref={tipRef}
          className={`absolute z-50 ${
            pos === 'top' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
          } left-1/2 -translate-x-1/2 bg-slate-800 text-slate-200 px-3 py-2 rounded-lg text-[10px] font-normal leading-relaxed w-56 shadow-lg pointer-events-none`}
        >
          {tip}
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
