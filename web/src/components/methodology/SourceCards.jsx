const SOURCES = [
  {
    name: 'Morningstar API Center',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125v-3.75" />
      </svg>
    ),
    stats: '8 APIs',
    coverage: '~2,500 funds',
    desc: 'Fund master data, risk statistics, holdings, rankings, and category returns.',
    color: 'teal',
  },
  {
    name: 'AMFI (amfiindia.com)',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    stats: 'Daily feed',
    coverage: 'All open-ended schemes',
    desc: 'NAV data, AMFI codes, and scheme-level identifiers. Backup source for daily NAV.',
    color: 'emerald',
  },
  {
    name: 'MarketPulse (Internal)',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
      </svg>
    ),
    stats: 'localhost:8000',
    coverage: 'Nifty 500 breadth',
    desc: 'Market breadth, sentiment composite, sector rotation signals, and market regime.',
    color: 'violet',
  },
];

const COLOR_MAP = {
  teal: 'bg-teal-50 text-teal-600 border-teal-100',
  emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  violet: 'bg-violet-50 text-violet-600 border-violet-100',
};

export default function SourceCards() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {SOURCES.map((src) => (
        <div
          key={src.name}
          className={`rounded-xl border p-5 ${COLOR_MAP[src.color]}`}
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="opacity-70">{src.icon}</div>
            <div>
              <div className="text-sm font-bold">{src.name}</div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] font-semibold opacity-70">{src.stats}</span>
                <span className="text-[10px] opacity-50">|</span>
                <span className="text-[10px] font-medium opacity-60">{src.coverage}</span>
              </div>
            </div>
          </div>
          <p className="text-[11px] leading-relaxed opacity-70">{src.desc}</p>
        </div>
      ))}
    </div>
  );
}
