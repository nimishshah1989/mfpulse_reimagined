import { useState, useCallback, useMemo } from 'react';
import InfoIcon from '../shared/InfoIcon';
import FundConfigCard from './FundConfigCard';
import AllocationPreview from './AllocationPreview';
import { fetchUniverseData, createStrategy } from '../../lib/api';
import { formatCount } from '../../lib/format';
import { LENS_OPTIONS } from '../../lib/lens';

const EXAMPLE_CHIPS = [
  { label: 'Top 5 by alpha in large cap', query: 'Top 5 funds by alpha in each large cap category' },
  { label: 'Fortress + low cost', query: 'Funds with fortress resilience and expense ratio under 0.5%' },
  { label: 'Benchmark beaters', query: 'Mid and small cap funds beating benchmark by 5% or more over 3 years' },
];

/**
 * Parse a natural-language query into filter criteria.
 * Returns array of { label, color } pills + a filter function.
 */
function parseNLQuery(query) {
  const q = (query || '').toLowerCase();
  const criteria = [];
  let filterFn = () => true;
  const filters = [];

  // Category detection
  const catMap = {
    'large cap': 'Large Cap',
    'flexi cap': 'Flexi Cap',
    'mid cap': 'Mid Cap',
    'small cap': 'Small Cap',
    'multi cap': 'Multi Cap',
    'large & mid': 'Large & Mid Cap',
  };
  const matchedCats = [];
  Object.entries(catMap).forEach(([k, v]) => {
    if (q.includes(k)) matchedCats.push(v);
  });
  if (matchedCats.length > 0) {
    criteria.push({ label: `Category: ${matchedCats.join(', ')}`, color: 'bg-blue-50 text-blue-600 border-blue-100' });
    filters.push((f) => matchedCats.some((c) => (f.category_name || '').toLowerCase().includes(c.toLowerCase())));
  }

  // Score thresholds
  LENS_OPTIONS.forEach((lens) => {
    const shortName = lens.label.toLowerCase();
    const patterns = [
      new RegExp(`${shortName}\\s*(?:score)?\\s*(?:above|>|>=|\\u2265)\\s*(\\d+)`),
      new RegExp(`${shortName}\\s*(?:score)?\\s*(?:at least|minimum)\\s*(\\d+)`),
    ];
    for (const pat of patterns) {
      const m = q.match(pat);
      if (m) {
        const threshold = parseInt(m[1], 10);
        criteria.push({ label: `${lens.label} \u2265 ${threshold}`, color: 'bg-teal-50 text-teal-600 border-teal-100' });
        filters.push((f) => (f[lens.key] || 0) >= threshold);
        break;
      }
    }
  });

  // Expense ratio
  const erMatch = q.match(/expense\s*(?:ratio)?\s*(?:below|under|<|<=)\s*([\d.]+)%?/);
  if (erMatch) {
    const threshold = parseFloat(erMatch[1]);
    criteria.push({ label: `Expense \u2264 ${threshold}%`, color: 'bg-amber-50 text-amber-600 border-amber-100' });
    filters.push((f) => (f.expense_ratio || 999) <= threshold);
  }

  // Sector exposure
  const sectorMatch = q.match(/(\d+)%\s*(?:exposure\s*to|in)\s*(\w[\w\s]*)/);
  if (sectorMatch) {
    criteria.push({ label: `${sectorMatch[2].trim()} \u2265 ${sectorMatch[1]}%`, color: 'bg-purple-50 text-purple-600 border-purple-100' });
  }

  // Class detection (fortress, rock solid, alpha machine)
  const classMap = {
    fortress: { key: 'resilience_class', label: 'Fortress Resilience', color: 'bg-purple-50 text-purple-600 border-purple-100' },
    'rock solid': { key: 'consistency_class', label: 'Rock Solid Consistency', color: 'bg-teal-50 text-teal-600 border-teal-100' },
    'alpha machine': { key: 'alpha_class', label: 'Alpha Machine', color: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
  };
  Object.entries(classMap).forEach(([k, v]) => {
    if (q.includes(k)) {
      criteria.push({ label: v.label, color: v.color });
      filters.push((f) => (f[v.key] || '').toLowerCase().replace(/_/g, ' ') === k);
    }
  });

  if (filters.length > 0) {
    filterFn = (fund) => filters.every((fn) => fn(fund));
  }

  return { criteria, filterFn };
}

export default function StrategyBuilder({ onBack, onLaunch, onSaveDraft, templateQuery }) {
  const [strategyName, setStrategyName] = useState('');
  const [nlQuery, setNlQuery] = useState(templateQuery || '');
  const [searching, setSearching] = useState(false);
  const [universe, setUniverse] = useState([]);
  const [matchedFunds, setMatchedFunds] = useState([]);
  const [criteria, setCriteria] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [expandedId, setExpandedId] = useState(null);
  const [configs, setConfigs] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleFindFunds = useCallback(async () => {
    if (!nlQuery.trim()) return;
    setSearching(true);
    setError(null);
    try {
      let data = universe;
      if (data.length === 0) {
        data = await fetchUniverseData();
        setUniverse(data);
      }
      const { criteria: parsed, filterFn } = parseNLQuery(nlQuery);
      setCriteria(parsed);
      const matched = data.filter(filterFn).slice(0, 20);
      setMatchedFunds(matched);

      // Auto-select top 5
      const autoSelect = new Set(matched.slice(0, 5).map((f) => f.mstar_id));
      setSelectedIds(autoSelect);

      // Default configs with equal allocation
      const pct = matched.length > 0 ? Math.floor(100 / Math.min(5, matched.length)) : 0;
      const newConfigs = {};
      matched.slice(0, 5).forEach((f) => {
        newConfigs[f.mstar_id] = {
          investment_type: 'SIP',
          sip_amount: '',
          lumpsum_amount: '',
          allocation_pct: pct,
          entry_triggers: [],
          exit_triggers: [],
        };
      });
      setConfigs(newConfigs);
    } catch (err) {
      setError(err.message);
    } finally {
      setSearching(false);
    }
  }, [nlQuery, universe]);

  const handleToggleSelect = useCallback((mstarId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(mstarId)) {
        next.delete(mstarId);
      } else {
        next.add(mstarId);
      }
      return next;
    });
    // Ensure config exists
    setConfigs((prev) => {
      if (prev[mstarId]) return prev;
      return {
        ...prev,
        [mstarId]: {
          investment_type: 'SIP',
          sip_amount: '',
          lumpsum_amount: '',
          allocation_pct: 0,
          entry_triggers: [],
          exit_triggers: [],
        },
      };
    });
  }, []);

  const handleConfigChange = useCallback((mstarId, config) => {
    setConfigs((prev) => ({ ...prev, [mstarId]: config }));
  }, []);

  const handleSelectAll = useCallback(() => {
    const allIds = new Set(matchedFunds.map((f) => f.mstar_id));
    setSelectedIds(allIds);
  }, [matchedFunds]);

  const selectedFunds = useMemo(() => {
    return matchedFunds.filter((f) => selectedIds.has(f.mstar_id));
  }, [matchedFunds, selectedIds]);

  const handleLaunch = useCallback(async () => {
    if (!strategyName.trim()) {
      setError('Strategy name is required');
      return;
    }
    if (selectedFunds.length === 0) {
      setError('Select at least one fund');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: strategyName.trim(),
        description: nlQuery.trim(),
        status: 'LIVE',
        funds: selectedFunds.map((f) => ({
          mstar_id: f.mstar_id,
          fund_name: f.fund_name,
          allocation_pct: configs[f.mstar_id]?.allocation_pct || 0,
          investment_type: configs[f.mstar_id]?.investment_type || 'SIP',
          sip_amount: configs[f.mstar_id]?.sip_amount || null,
          lumpsum_amount: configs[f.mstar_id]?.lumpsum_amount || null,
          entry_triggers: configs[f.mstar_id]?.entry_triggers || [],
          exit_triggers: configs[f.mstar_id]?.exit_triggers || [],
        })),
      };
      await createStrategy(payload);
      onLaunch();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }, [strategyName, nlQuery, selectedFunds, configs, onLaunch]);

  const handleDraft = useCallback(async () => {
    if (!strategyName.trim()) {
      setError('Strategy name is required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createStrategy({
        name: strategyName.trim(),
        description: nlQuery.trim(),
        status: 'DRAFT',
        funds: selectedFunds.map((f) => ({
          mstar_id: f.mstar_id,
          fund_name: f.fund_name,
          allocation_pct: configs[f.mstar_id]?.allocation_pct || 0,
        })),
      });
      onSaveDraft();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }, [strategyName, nlQuery, selectedFunds, configs, onSaveDraft]);

  return (
    <div className="space-y-5 view-fade">
      {/* Back nav */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-teal-600 transition-colors"
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10 4L6 8l4 4" />
          </svg>
          Back to Strategies
        </button>
        <span className="text-slate-300">|</span>
        <span className="text-sm font-medium text-slate-700">New Strategy</span>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Step 1: Describe */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-6 h-6 rounded-full bg-teal-100 flex items-center justify-center text-xs font-bold text-teal-600">1</div>
          <p className="text-sm font-semibold text-slate-700">Describe Your Strategy</p>
          <InfoIcon tip="Use plain English to describe the kind of funds you want. The system interprets your criteria and finds matching funds from the entire MF Pulse universe." />
        </div>

        <div className="mt-4 mb-3">
          <input
            type="text"
            value={strategyName}
            onChange={(e) => setStrategyName(e.target.value)}
            placeholder="Strategy Name"
            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
          />
        </div>

        {/* NL Input */}
        <div className={`rounded-2xl p-5 border-2 transition-all ${searching ? 'border-teal-400 animate-pulse' : 'border-teal-200'}`}
          style={{ background: 'linear-gradient(135deg, #f0fdfa 0%, #ecfdf5 50%, #f0fdf4 100%)' }}
        >
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-teal-500 flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg width="16" height="16" fill="white" viewBox="0 0 24 24">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
            <textarea
              value={nlQuery}
              onChange={(e) => setNlQuery(e.target.value)}
              rows={3}
              placeholder="Describe what you're looking for... e.g., 'Large cap funds with alpha score above 70, low risk, and less than 1% expense ratio'"
              className="w-full bg-transparent text-sm text-slate-700 placeholder-slate-400 resize-none focus:outline-none leading-relaxed flex-1"
            />
          </div>
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-teal-200/50">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-teal-600/60">Try:</span>
              {EXAMPLE_CHIPS.map((chip) => (
                <span
                  key={chip.label}
                  onClick={() => setNlQuery(chip.query)}
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/80 text-teal-700 border border-teal-200 cursor-pointer hover:bg-teal-50 hover:border-teal-300 transition-all"
                >
                  {chip.label}
                </span>
              ))}
            </div>
            <button
              onClick={handleFindFunds}
              disabled={searching || !nlQuery.trim()}
              className="px-5 py-2 bg-teal-600 hover:bg-teal-500 text-white font-semibold text-sm rounded-xl transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="5.5" cy="5.5" r="4.5" />
                <path d="M9 9l4 4" />
              </svg>
              {searching ? 'Searching...' : 'Find Funds'}
            </button>
          </div>
        </div>

        {/* Interpretation */}
        {criteria.length > 0 && (
          <div className="mt-4 bg-slate-50 rounded-xl p-4 border border-slate-100">
            <div className="flex items-start gap-2">
              <svg width="16" height="16" className="text-teal-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
              <div>
                <p className="text-xs font-semibold text-slate-600 mb-1">Interpreted Criteria</p>
                <div className="flex flex-wrap gap-2">
                  {criteria.map((c, i) => (
                    <span key={i} className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${c.color}`}>
                      {c.label}
                    </span>
                  ))}
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  Matched <strong className="text-teal-600">{matchedFunds.length} funds</strong> from {formatCount(universe.length)} in universe
                  {' \u2022 '}
                  <button className="text-teal-500 underline">Edit filters manually</button>
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Step 2: Fund Selection */}
      {matchedFunds.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-teal-100 flex items-center justify-center text-xs font-bold text-teal-600">2</div>
              <p className="text-sm font-semibold text-slate-700">Select & Configure Funds</p>
              <InfoIcon tip="Select which recommended funds to include. For each fund, configure SIP/lumpsum amounts, entry triggers, and exit triggers. All configurations are optional." />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">
                {selectedIds.size} of {matchedFunds.length} selected
              </span>
              <button
                onClick={handleSelectAll}
                className="text-xs text-teal-600 font-medium hover:underline"
              >
                Select All
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {matchedFunds.map((fund) => (
              <FundConfigCard
                key={fund.mstar_id}
                fund={fund}
                selected={selectedIds.has(fund.mstar_id)}
                config={configs[fund.mstar_id] || {}}
                onToggleSelect={() => handleToggleSelect(fund.mstar_id)}
                onConfigChange={(cfg) => handleConfigChange(fund.mstar_id, cfg)}
                expanded={expandedId === fund.mstar_id}
                onToggleExpand={() => setExpandedId(expandedId === fund.mstar_id ? null : fund.mstar_id)}
              />
            ))}
          </div>

          {/* Allocation Preview */}
          {selectedFunds.length > 0 && (
            <AllocationPreview
              funds={selectedFunds}
              configs={configs}
              onLaunch={handleLaunch}
              onBacktest={() => {/* TODO: Wire to backtest */}}
              onSaveDraft={handleDraft}
            />
          )}
        </div>
      )}
    </div>
  );
}
