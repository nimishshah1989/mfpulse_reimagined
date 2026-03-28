const SCHEDULE = [
  { time: 'Daily 9:00 PM IST', label: 'NAV + Returns', color: 'bg-teal-500', tables: 'nav_daily, category_returns_daily' },
  { time: 'Weekly Mon 6:00 AM', label: 'Fund Master', color: 'bg-blue-500', tables: 'fund_master' },
  { time: 'Monthly 5th BD', label: 'Risk Statistics', color: 'bg-violet-500', tables: 'risk_stats_monthly' },
  { time: 'Monthly 5th BD', label: 'Rankings', color: 'bg-amber-500', tables: 'rank_monthly' },
  { time: 'Monthly', label: 'Holdings & Sectors', color: 'bg-rose-500', tables: 'fund_holdings_snapshot, fund_holding_detail, fund_sector_exposure' },
  { time: 'Post-Ingestion', label: 'Lens Computation', color: 'bg-emerald-500', tables: 'fund_lens_scores' },
];

export default function UpdateTimeline() {
  return (
    <div className="bg-white rounded-xl border border-slate-200/80 p-5">
      <h3 className="text-sm font-bold text-slate-800 mb-4">Update Schedule</h3>
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-3 top-2 bottom-2 w-px bg-slate-200" />
        <div className="space-y-4">
          {SCHEDULE.map((item, i) => (
            <div key={i} className="flex items-start gap-4 relative">
              <div className={`w-6 h-6 rounded-full ${item.color} flex items-center justify-center flex-shrink-0 z-10 shadow-sm`}>
                <span className="text-white text-[9px] font-bold">{i + 1}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-semibold text-slate-800">{item.label}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium">
                    {item.time}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5 font-mono">{item.tables}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
