import { useState, useEffect } from 'react';
import { fetchNarrative } from '../../lib/api';

/**
 * NarrativeCard -- AI intelligence brief with teal-left-border style.
 *
 * Props:
 *   mstarId      string
 *   headlineTag  string -- fallback text
 */
export default function NarrativeCard({ mstarId, headlineTag }) {
  const [narrative, setNarrative] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!mstarId) return;
    let cancelled = false;
    setLoading(true);
    setError(false);

    fetchNarrative(mstarId)
      .then((res) => {
        if (cancelled) return;
        const text = res?.data?.narrative || res?.narrative;
        if (text && text.trim().length > 0) {
          setNarrative(text);
        } else {
          setError(true);
        }
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [mstarId]);

  if (loading) {
    return (
      <div className="bg-gradient-to-r from-teal-50 to-emerald-50 rounded-xl border border-teal-200/50 p-5">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-teal-100 animate-pulse flex-shrink-0" />
          <div className="flex-1 space-y-2.5">
            <div className="h-3 bg-teal-100 rounded-full animate-pulse w-1/3" />
            <div className="h-3 bg-teal-100/70 rounded-full animate-pulse w-full" />
            <div className="h-3 bg-teal-100/70 rounded-full animate-pulse w-5/6" />
            <div className="h-3 bg-teal-100/50 rounded-full animate-pulse w-4/6" />
          </div>
        </div>
      </div>
    );
  }

  if (narrative) {
    return (
      <div className="bg-gradient-to-r from-teal-50 to-emerald-50 rounded-xl border border-teal-200/50 p-5">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-teal-100 flex items-center justify-center flex-shrink-0">
            <svg className="w-4.5 h-4.5 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-xs font-semibold text-teal-700 uppercase tracking-wide mb-2">
              AI Intelligence Brief
            </p>
            <p className="text-sm text-slate-700 leading-relaxed">
              {narrative}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (headlineTag) {
    return (
      <div className="border-l-4 border-teal-500 pl-4 py-3 bg-teal-50/30 rounded-r-lg">
        <p className="text-xs font-semibold text-teal-700 uppercase tracking-wide mb-1">
          Fund Profile
        </p>
        <p className="text-sm text-slate-700 leading-relaxed italic">
          &ldquo;{headlineTag}&rdquo;
        </p>
      </div>
    );
  }

  return null;
}
