import { useState } from 'react';

const JOBS = [
  { name: 'NAV Daily Fetch', frequency: 'Daily 9PM', status: 'success', lastRun: '2026-03-28 21:00', nextRun: '2026-03-29 21:00', duration: '2m 14s' },
  { name: 'Master Weekly Sync', frequency: 'Mon 6AM', status: 'success', lastRun: '2026-03-24 06:00', nextRun: '2026-03-31 06:00', duration: '8m 42s' },
  { name: 'Risk Stats Monthly', frequency: '5th BD', status: 'success', lastRun: '2026-03-07 06:00', nextRun: '2026-04-07 06:00', duration: '12m 08s' },
  { name: 'Holdings Monthly', frequency: 'Monthly', status: 'success', lastRun: '2026-03-10 06:00', nextRun: '2026-04-10 06:00', duration: '15m 33s' },
  { name: 'Category Returns Daily', frequency: 'Daily 9:30PM', status: 'success', lastRun: '2026-03-28 21:30', nextRun: '2026-03-29 21:30', duration: '1m 05s' },
  { name: 'Lens Computation', frequency: 'Post-ingestion', status: 'idle', lastRun: '2026-03-07 06:15', nextRun: 'After next ingestion', duration: '3m 22s' },
];

const STATUS_STYLES = {
  success: 'bg-emerald-50 text-emerald-700',
  failed: 'bg-red-50 text-red-700',
  running: 'bg-blue-50 text-blue-700',
  idle: 'bg-slate-50 text-slate-500',
};

export default function SchedulerDashboard() {
  const [runningJob, setRunningJob] = useState(null);

  const handleRunNow = (jobName) => {
    setRunningJob(jobName);
    // Simulated -- in production this would call a real endpoint
    setTimeout(() => setRunningJob(null), 3000);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100">
        <h3 className="text-sm font-bold text-slate-800">Scheduled Jobs</h3>
        <p className="text-[11px] text-slate-400 mt-0.5">APScheduler-managed ingestion and computation tasks</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/50">
              <th className="text-left py-2.5 px-4 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Job</th>
              <th className="text-left py-2.5 px-4 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Frequency</th>
              <th className="text-left py-2.5 px-4 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Last Run</th>
              <th className="text-left py-2.5 px-4 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Next Run</th>
              <th className="text-left py-2.5 px-4 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Status</th>
              <th className="text-left py-2.5 px-4 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Duration</th>
              <th className="text-right py-2.5 px-4 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Action</th>
            </tr>
          </thead>
          <tbody>
            {JOBS.map((job) => {
              const isRunning = runningJob === job.name;
              const displayStatus = isRunning ? 'running' : job.status;
              return (
                <tr key={job.name} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                  <td className="py-2.5 px-4 font-semibold text-slate-700">{job.name}</td>
                  <td className="py-2.5 px-4 text-slate-500">{job.frequency}</td>
                  <td className="py-2.5 px-4 font-mono text-slate-500 tabular-nums">{job.lastRun}</td>
                  <td className="py-2.5 px-4 font-mono text-slate-500 tabular-nums">{job.nextRun}</td>
                  <td className="py-2.5 px-4">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLES[displayStatus]}`}>
                      {isRunning && (
                        <svg className="inline w-3 h-3 mr-1 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      )}
                      {displayStatus.toUpperCase()}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 font-mono text-slate-400 tabular-nums">{job.duration}</td>
                  <td className="py-2.5 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => handleRunNow(job.name)}
                      disabled={isRunning}
                      className="text-[10px] font-semibold px-2.5 py-1 rounded-md bg-teal-50 text-teal-700 hover:bg-teal-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isRunning ? 'Running...' : 'Run Now'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
