import InfoIcon from '../shared/InfoIcon';

const STATUS_DOT = {
  up: 'bg-emerald-500',
  degraded: 'bg-amber-500',
  down: 'bg-red-500',
  unknown: 'bg-slate-400',
};

const STATUS_LABEL = {
  up: 'Connected',
  degraded: 'Slow',
  down: 'Offline',
  unknown: 'Unknown',
};

function SourceCard({ name, icon, status, lastCall, errors24h, details, tip }) {
  const dotColor = STATUS_DOT[status] || STATUS_DOT.unknown;
  return (
    <div className="bg-white rounded-xl border border-slate-200/80 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="text-slate-400">{icon}</div>
          <span className="text-[13px] font-semibold text-slate-800">{name}</span>
          {tip && <InfoIcon tip={tip} />}
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${dotColor}`} />
          <span className="text-[10px] font-semibold text-slate-500">{STATUS_LABEL[status]}</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Last Call</div>
          <div className="text-[12px] font-mono text-slate-600 tabular-nums mt-0.5">{lastCall || '\u2014'}</div>
        </div>
        <div>
          <div className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Errors (24h)</div>
          <div className={`text-[12px] font-mono font-semibold tabular-nums mt-0.5 ${
            (errors24h || 0) > 0 ? 'text-red-600' : 'text-emerald-600'
          }`}>
            {errors24h ?? 0}
          </div>
        </div>
      </div>
      {details && (
        <div className="mt-2 pt-2 border-t border-slate-100 text-[11px] text-slate-400">
          {details}
        </div>
      )}
    </div>
  );
}

export default function DataSourceCards({ health, mpStatus }) {
  const dbIcon = (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375" />
    </svg>
  );
  const apiIcon = (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582" />
    </svg>
  );
  const boltIcon = (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
    </svg>
  );
  const rupeeIcon = (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );

  const dbStatus = health?.database ? 'up' : 'unknown';

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <SourceCard
        name="Morningstar"
        icon={apiIcon}
        status={health?.morningstar_status || 'up'}
        lastCall={health?.morningstar_last_call}
        errors24h={health?.morningstar_errors_24h}
        tip="8 APIs: Identifier, Additional, Category, Nav, Return, Risk Stats, Rank, Category Returns"
      />
      <SourceCard
        name="AMFI"
        icon={rupeeIcon}
        status={health?.amfi_status || 'up'}
        lastCall={health?.amfi_last_fetch}
        errors24h={health?.amfi_errors_24h}
        details="Daily NAV feed backup"
      />
      <SourceCard
        name="MarketPulse"
        icon={boltIcon}
        status={mpStatus || 'unknown'}
        lastCall={health?.marketpulse_last_refresh}
        errors24h={health?.marketpulse_errors_24h}
        tip="localhost:8000 -- Breadth, sentiment, sector rotation"
      />
      <SourceCard
        name="PostgreSQL"
        icon={dbIcon}
        status={dbStatus}
        lastCall={health?.db_last_query}
        errors24h={health?.db_errors_24h}
        details={health?.db_pool_size ? `Pool: ${health.db_pool_size} connections` : 'Port 5432 / mf_pulse'}
      />
    </div>
  );
}
