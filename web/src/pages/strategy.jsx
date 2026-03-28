import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { fetchStrategies } from '../lib/api';
import StrategyList from '../components/strategy/StrategyList';
import StrategyBuilder from '../components/strategy/StrategyBuilder';
import StrategyDetail from '../components/strategy/StrategyDetail';

export default function StrategyPage() {
  const router = useRouter();

  const [view, setView] = useState('list'); // 'list' | 'builder' | 'detail'
  const [selectedStrategy, setSelectedStrategy] = useState(null);
  const [strategies, setStrategies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [templateQuery, setTemplateQuery] = useState('');

  // Read template from simulation page
  useEffect(() => {
    if (router.isReady && router.query.template) {
      try {
        const decoded = JSON.parse(atob(router.query.template));
        const MSTAR_ID_RE = /^[A-Za-z0-9]{8,12}$/;
        if (decoded && typeof decoded.mstar_id === 'string' && MSTAR_ID_RE.test(decoded.mstar_id)) {
          setView('builder');
        }
      } catch {
        // Invalid template, ignore
      }
    }
  }, [router.isReady, router.query.template]);

  const loadStrategies = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchStrategies();
      setStrategies(res.data || []);
    } catch (err) {
      setError(err.message);
      setStrategies([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStrategies();
  }, [loadStrategies]);

  const handleNewStrategy = useCallback(() => {
    setTemplateQuery('');
    setView('builder');
  }, []);

  const handleLoadTemplate = useCallback((template) => {
    setTemplateQuery(template.query || '');
    setView('builder');
  }, []);

  const handleSelectStrategy = useCallback((strategy) => {
    setSelectedStrategy(strategy);
    setView('detail');
  }, []);

  const handleBackToList = useCallback(() => {
    setView('list');
    setSelectedStrategy(null);
    setTemplateQuery('');
    loadStrategies();
  }, [loadStrategies]);

  const handleBuilderLaunch = useCallback(() => {
    handleBackToList();
  }, [handleBackToList]);

  const handleBuilderDraft = useCallback(() => {
    handleBackToList();
  }, [handleBackToList]);

  const handleEditStrategy = useCallback((id) => {
    // For now, go back to list — could be enhanced to load into builder
    setView('list');
  }, []);

  if (view === 'builder') {
    return (
      <StrategyBuilder
        onBack={handleBackToList}
        onLaunch={handleBuilderLaunch}
        onSaveDraft={handleBuilderDraft}
        templateQuery={templateQuery}
      />
    );
  }

  if (view === 'detail' && selectedStrategy) {
    return (
      <StrategyDetail
        strategyId={selectedStrategy.id}
        onBack={handleBackToList}
        onEdit={handleEditStrategy}
      />
    );
  }

  return (
    <StrategyList
      strategies={strategies}
      loading={loading}
      error={error}
      onNewStrategy={handleNewStrategy}
      onSelectStrategy={handleSelectStrategy}
      onLoadTemplate={handleLoadTemplate}
    />
  );
}
