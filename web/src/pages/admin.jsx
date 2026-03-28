import { useState, useEffect } from 'react';
import SectionTitle from '../components/shared/SectionTitle';
import StatusHero from '../components/admin/StatusHero';
import DataSourceCards from '../components/admin/DataSourceCards';
import SchedulerDashboard from '../components/admin/SchedulerDashboard';
import IngestionHistory from '../components/admin/IngestionHistory';
import ClaudeUsage from '../components/admin/ClaudeUsage';
import FreshnessMatrix from '../components/admin/FreshnessMatrix';
import { fetchDataFreshness, fetchMarketRegime } from '../lib/api';
import { cachedFetch } from '../lib/cache';

export default function AdminPage() {
  const [health, setHealth] = useState(null);
  const [freshness, setFreshness] = useState(null);
  const [mpStatus, setMpStatus] = useState('unknown');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [freshnessRes, mpRes] = await Promise.allSettled([
          cachedFetch('admin-freshness', fetchDataFreshness, 120),
          cachedFetch('admin-mp', fetchMarketRegime, 120),
        ]);

        if (freshnessRes.status === 'fulfilled') {
          const data = freshnessRes.value?.data || freshnessRes.value;
          setFreshness(Array.isArray(data) ? data : []);
          setHealth((h) => ({ ...h, status: 'healthy', database: true }));
        }

        if (mpRes.status === 'fulfilled') {
          setMpStatus('up');
        } else {
          setMpStatus('down');
        }
      } catch {
        // Fallback -- show page with defaults
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-slate-400">
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm">Loading system status...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in duration-300">
      {/* System status hero */}
      <StatusHero health={health} />

      {/* Data Sources */}
      <div>
        <SectionTitle tip="Connection status of all external data providers and internal services">
          Data Sources
        </SectionTitle>
        <DataSourceCards health={health} mpStatus={mpStatus} />
      </div>

      {/* Scheduler */}
      <div>
        <SectionTitle tip="APScheduler jobs managing data ingestion and lens computation">
          Scheduler
        </SectionTitle>
        <SchedulerDashboard />
      </div>

      {/* Ingestion + Freshness side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <SectionTitle tip="Daily record volume processed by the ingestion pipeline over 30 days">
            Ingestion Volume
          </SectionTitle>
          <IngestionHistory />
        </div>
        <div>
          <SectionTitle tip="How current each data domain is relative to its expected update cycle">
            Data Freshness
          </SectionTitle>
          <FreshnessMatrix freshness={freshness} />
        </div>
      </div>

      {/* Claude API Usage */}
      <div>
        <SectionTitle tip="Claude API token usage, costs, and per-feature breakdown for the current month">
          Claude API Usage
        </SectionTitle>
        <ClaudeUsage />
      </div>

      {/* Footer */}
      <div className="text-center py-4">
        <p className="text-[11px] text-slate-400">
          MF Pulse Engine v1.0 {'\u2014'} Jhaveri Securities {'\u2014'} Port 8001 {'\u2014'} EC2 Mumbai
        </p>
      </div>
    </div>
  );
}
