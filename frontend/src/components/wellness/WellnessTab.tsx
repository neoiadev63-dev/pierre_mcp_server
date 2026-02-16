// SPDX-License-Identifier: MIT OR Apache-2.0
// Copyright (c) 2025 Pierre Fitness Intelligence

import { useState, useCallback, lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { useWellnessData } from '../../hooks/useWellnessData';
import { Tabs } from '../ui/Tabs';

const WellnessDashboard = lazy(() => import('./WellnessDashboard'));
const ActivitiesListPage = lazy(() => import('./ActivitiesListPage'));
const WeightFullPage = lazy(() => import('./WeightFullPage'));
const HealthSnapshotPage = lazy(() => import('./HealthSnapshotPage'));
const SleepFullPage = lazy(() => import('./SleepFullPage'));

type WellnessView = 'dashboard' | 'activities' | 'weight' | 'health' | 'sleep';

export default function WellnessTab() {
  const { t } = useTranslation();
  const { data, isLoading, error } = useWellnessData();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [refreshStatus, setRefreshStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [wellnessView, setWellnessView] = useState<WellnessView>('dashboard');

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setRefreshStatus(null);
    try {
      const res = await fetch('/wellness-refresh', { method: 'POST' });
      const json = await res.json();
      if (json.ok) {
        await queryClient.invalidateQueries({ queryKey: ['wellness-summary'] });
        setRefreshStatus({ ok: true, msg: 'Données mises à jour !' });
      } else {
        setRefreshStatus({ ok: false, msg: json.error || 'Erreur lors du rafraîchissement' });
      }
    } catch {
      setRefreshStatus({ ok: false, msg: 'Impossible de contacter le serveur' });
    } finally {
      setRefreshing(false);
      setTimeout(() => setRefreshStatus(null), 5000);
    }
  }, [queryClient]);

  const subTabs = [
    { id: 'dashboard' as const, label: t('wellness.tabs.dashboard') },
    { id: 'activities' as const, label: t('wellness.tabs.activities') },
    { id: 'weight' as const, label: t('wellness.tabs.weight') },
    { id: 'health' as const, label: t('wellness.tabs.health') },
    { id: 'sleep' as const, label: t('wellness.tabs.sleep') },
  ];

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <div className="pierre-spinner" />
      </div>
    );
  }

  if (error || !data?.latest) {
    return (
      <div className="p-6">
        <div className="card-dark text-center py-12">
          <svg className="w-12 h-12 mx-auto text-zinc-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <h3 className="text-lg font-medium text-white mb-2">{t('wellness.noDataTitle')}</h3>
          <p className="text-zinc-400 text-sm max-w-md mx-auto">
            {t('wellness.noDataDesc')}
          </p>
        </div>
      </div>
    );
  }

  const fallback = (
    <div className="flex justify-center py-8">
      <div className="pierre-spinner" />
    </div>
  );

  return (
    <div className="p-4 sm:p-5 md:p-6 space-y-4 sm:space-y-5 md:space-y-6 min-w-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">{t('wellness.title')}</h2>
          <p className="text-sm text-zinc-400">
            {new Date(data.latest.date).toLocaleDateString('fr-FR', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {data.vo2max && (
            <div className="card-dark !p-3 flex items-center gap-2">
              <span className="text-xs text-zinc-400">VO2max</span>
              <span className="text-lg font-bold text-pierre-cyan">{data.vo2max.vo2max}</span>
            </div>
          )}
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="card-dark !p-3 flex items-center gap-2 hover:border-pierre-cyan/50 border border-white/10 transition-colors disabled:opacity-50"
            title="Actualiser les données depuis Garmin Connect"
          >
            <svg
              className={`w-5 h-5 text-pierre-cyan ${refreshing ? 'animate-spin' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span className="text-xs text-zinc-300 hidden sm:inline">{refreshing ? 'Actualisation...' : 'Actualiser'}</span>
          </button>
          {refreshStatus && (
            <span className={`text-xs ${refreshStatus.ok ? 'text-green-400' : 'text-red-400'}`}>
              {refreshStatus.msg}
            </span>
          )}
        </div>
      </div>

      {/* Sub-tabs */}
      <Tabs
        tabs={subTabs}
        activeTab={wellnessView}
        onChange={(id) => setWellnessView(id as WellnessView)}
        variant="pills"
        size="sm"
      />

      {/* Sub-page content */}
      <Suspense fallback={fallback}>
        {wellnessView === 'dashboard' && <WellnessDashboard data={data} />}
        {wellnessView === 'activities' && (
          <ActivitiesListPage activities={data.activityHistory || (data.latestActivity ? [data.latestActivity] : [])} />
        )}
        {wellnessView === 'weight' && (
          <WeightFullPage weightHistory={data.weightHistory} />
        )}
        {wellnessView === 'health' && <HealthSnapshotPage data={data} />}
        {wellnessView === 'sleep' && <SleepFullPage data={data} />}
      </Suspense>
    </div>
  );
}
