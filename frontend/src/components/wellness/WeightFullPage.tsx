// SPDX-License-Identifier: MIT OR Apache-2.0
// Copyright (c) 2025 Pierre Fitness Intelligence

import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Line } from 'react-chartjs-2';
import type { TooltipItem } from 'chart.js';
import type { WeightHistory, WeightEntry } from '../../types/wellness';
import { useChartResponsive } from '../../hooks/useChartResponsive';
import WaistTracker from './WaistTracker';

interface WeightFullPageProps {
  weightHistory: WeightHistory | null;
}

type MetricTab = 'weight' | 'bmi' | 'bodyFat' | 'muscle' | 'bone' | 'water';
type PeriodKey = '1day' | '7days' | '4weeks' | '1year';

const METRIC_TABS: { key: MetricTab; labelKey: string }[] = [
  { key: 'weight', labelKey: 'Poids' },
  { key: 'bmi', labelKey: 'IMC' },
  { key: 'bodyFat', labelKey: 'Masse grasse' },
  { key: 'muscle', labelKey: 'Masse musculaire' },
  { key: 'bone', labelKey: 'Masse osseuse' },
  { key: 'water', labelKey: 'Masse hydrique' },
];

const PERIODS: { key: PeriodKey; days: number }[] = [
  { key: '1day', days: 1 },
  { key: '7days', days: 7 },
  { key: '4weeks', days: 28 },
  { key: '1year', days: 365 },
];

function getMetricValue(entry: WeightEntry, tab: MetricTab): number | null {
  switch (tab) {
    case 'weight': return entry.weight_kg;
    case 'bmi': return entry.bmi;
    case 'bodyFat': return entry.body_fat_pct;
    case 'muscle': return entry.muscle_mass_kg;
    case 'bone': return entry.bone_mass_kg;
    case 'water': return entry.body_water_pct;
  }
}

function getMetricUnit(tab: MetricTab): string {
  switch (tab) {
    case 'weight': return 'kg';
    case 'bmi': return '';
    case 'bodyFat': return '%';
    case 'muscle': return 'kg';
    case 'bone': return 'kg';
    case 'water': return '%';
  }
}

function getMetricColor(tab: MetricTab): string {
  switch (tab) {
    case 'weight': return '#3B82F6';
    case 'bmi': return '#8B5CF6';
    case 'bodyFat': return '#EF4444';
    case 'muscle': return '#22C55E';
    case 'bone': return '#6B7280';
    case 'water': return '#22D3EE';
  }
}

function getVariation(entries: WeightEntry[], index: number): { value: number; dir: 'up' | 'down' | 'same' } | null {
  if (index <= 0) return null;
  const curr = entries[index].weight_kg;
  const prev = entries[index - 1].weight_kg;
  const diff = Math.round((curr - prev) * 10) / 10;
  return { value: Math.abs(diff), dir: diff > 0 ? 'up' : diff < 0 ? 'down' : 'same' };
}

export default function WeightFullPage({ weightHistory }: WeightFullPageProps) {
  const { t } = useTranslation();
  const [activeMetric, setActiveMetric] = useState<MetricTab>('weight');
  const [period, setPeriod] = useState<PeriodKey>('4weeks');
  const [periodOffset, setPeriodOffset] = useState(0);
  const chartConfig = useChartResponsive();

  const entries = useMemo(() => weightHistory?.entries ?? [], [weightHistory?.entries]);
  const periodDays = PERIODS.find(p => p.key === period)!.days;

  // Filter entries by period
  const filteredEntries = useMemo(() => {
    if (entries.length === 0) return [];
    const now = new Date();
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() - periodOffset * periodDays);
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - periodDays);

    return entries.filter(e => {
      const d = new Date(e.date);
      return d >= startDate && d <= endDate;
    });
  }, [entries, periodDays, periodOffset]);

  // Date range label
  const dateRangeLabel = useMemo(() => {
    if (filteredEntries.length === 0) return '';
    const first = new Date(filteredEntries[0].date);
    const last = new Date(filteredEntries[filteredEntries.length - 1].date);
    const fmt = (d: Date) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    return `${fmt(first)} - ${fmt(last)}`;
  }, [filteredEntries]);

  // Available metric tabs (only show tabs with data)
  const availableTabs = useMemo(() => {
    return METRIC_TABS.filter(tab => {
      if (tab.key === 'weight') return true;
      return entries.some(e => getMetricValue(e, tab.key) !== null);
    });
  }, [entries]);

  // Chart data
  const chartData = useMemo(() => {
    const source = filteredEntries.length > 0 ? filteredEntries : entries.slice(-14);
    const color = getMetricColor(activeMetric);

    // Group by date for high/low bands
    const byDate = new Map<string, number[]>();
    for (const e of source) {
      const v = getMetricValue(e, activeMetric);
      if (v !== null) {
        if (!byDate.has(e.date)) byDate.set(e.date, []);
        byDate.get(e.date)!.push(v);
      }
    }

    const dates = Array.from(byDate.keys()).sort();
    const labels = dates.map(d => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }));
    const lastValues = dates.map(d => {
      const vals = byDate.get(d)!;
      return vals[vals.length - 1];
    });

    const datasets: {
      label: string;
      data: number[];
      borderColor: string;
      backgroundColor: string;
      borderWidth: number;
      pointRadius: number;
      pointHoverRadius: number;
      tension: number;
      fill?: boolean | string;
      borderDash?: number[];
      pointStyle?: false;
    }[] = [
      {
        label: METRIC_TABS.find(t => t.key === activeMetric)?.labelKey || '',
        data: lastValues,
        borderColor: color,
        backgroundColor: `${color}20`,
        borderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 7,
        tension: 0.3,
        fill: true,
      },
    ];

    // Goal line
    if (activeMetric === 'weight' && weightHistory?.goal_kg && lastValues.length > 0) {
      datasets.push({
        label: `Objectif (${weightHistory.goal_kg} kg)`,
        data: dates.map(() => weightHistory.goal_kg!),
        borderColor: '#71717A',
        backgroundColor: 'transparent',
        borderWidth: 1.5,
        borderDash: [6, 4],
        pointRadius: 0,
        pointHoverRadius: 0,
        pointStyle: false,
        tension: 0,
      });
    }

    return { labels, datasets };
  }, [filteredEntries, entries, weightHistory, activeMetric]);

  if (!weightHistory || entries.length === 0) {
    return (
      <div className="card-dark text-center py-16">
        <svg className="w-12 h-12 mx-auto text-zinc-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
        </svg>
        <h3 className="text-lg font-medium text-white mb-2">{t('wellness.weight.noData')}</h3>
        <p className="text-sm text-zinc-400 max-w-md mx-auto">
          Connectez une balance intelligente ou entrez manuellement vos données de poids.
        </p>
      </div>
    );
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        padding: chartConfig.padding,
        titleFont: { size: chartConfig.fontSize.tooltip },
        bodyFont: { size: chartConfig.fontSize.tooltip },
        callbacks: {
          label: (ctx: TooltipItem<'line'>) =>
            `${ctx.dataset.label}: ${ctx.parsed.y} ${getMetricUnit(activeMetric)}`,
        },
      },
    },
    scales: {
      x: {
        ticks: {
          color: '#71717A',
          font: { size: chartConfig.fontSize.axis },
          maxRotation: chartConfig.isMobile ? 45 : 0,
          minRotation: chartConfig.isMobile ? 45 : 0,
        },
        grid: { display: false },
      },
      y: {
        ticks: {
          color: '#71717A',
          font: { size: chartConfig.fontSize.axis },
        },
        grid: { color: 'rgba(255,255,255,0.05)' },
      },
    },
  };

  // All entries sorted descending for the table
  const tableEntries = [...weightHistory.entries].reverse();

  return (
    <div className="space-y-5">
      {/* Waist Tracker */}
      <WaistTracker />

      {/* Period selector */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPeriodOffset(o => o + 1)}
            className="p-1.5 rounded border border-white/10 text-zinc-400 hover:text-white hover:border-white/20 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-sm text-zinc-300 min-w-[140px] text-center">{dateRangeLabel}</span>
          <button
            onClick={() => setPeriodOffset(o => Math.max(0, o - 1))}
            disabled={periodOffset === 0}
            className="p-1.5 rounded border border-white/10 text-zinc-400 hover:text-white hover:border-white/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        <div className="flex gap-1.5">
          {PERIODS.map(p => (
            <button
              key={p.key}
              onClick={() => { setPeriod(p.key); setPeriodOffset(0); }}
              className={`text-xs px-3 py-1.5 rounded border transition-colors ${
                period === p.key
                  ? 'border-pierre-violet bg-pierre-violet/20 text-white'
                  : 'border-white/10 text-zinc-400 hover:text-white hover:border-white/20'
              }`}
            >
              {t(`wellness.weight.${p.key}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="card-dark !p-4 border border-white/10">
        <div className="h-72">
          <Line data={chartData} options={chartOptions} />
        </div>
        {/* Goal legend */}
        {activeMetric === 'weight' && weightHistory.goal_kg && weightHistory.latest && (
          <div className="flex items-center justify-center gap-4 mt-3 text-xs text-zinc-500">
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-0.5 rounded" style={{ backgroundColor: getMetricColor('weight') }} />
              <span>Pesée</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-0.5 border-t border-dashed border-zinc-500" />
              <span>Objectif ({weightHistory.goal_kg} kg)</span>
            </div>
            <span className="text-zinc-400">
              {t('wellness.weight.remaining')}: {(weightHistory.latest.weight_kg - weightHistory.goal_kg).toFixed(1)} kg
            </span>
          </div>
        )}
      </div>

      {/* Metric tabs */}
      {availableTabs.length > 1 && (
        <div className="flex gap-1.5 flex-wrap">
          {availableTabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveMetric(tab.key)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                activeMetric === tab.key
                  ? 'border-white/30 bg-white/10 text-white font-medium'
                  : 'border-white/5 bg-white/[0.02] text-zinc-500 hover:text-zinc-300 hover:border-white/10'
              }`}
            >
              {tab.labelKey}
            </button>
          ))}
        </div>
      )}

      {/* Weight table */}
      <div className="card-dark !p-0 overflow-hidden border border-white/10">
        <div className="px-5 py-3 flex items-center justify-between border-b border-white/5">
          <h3 className="text-sm font-medium text-white">{t('wellness.weight.weighIns')}</h3>
          <div className="flex gap-2">
            <button className="text-xs px-3 py-1.5 rounded border border-white/10 text-zinc-400 hover:text-white hover:border-white/20 transition-colors">
              {t('wellness.weight.setGoal')}
            </button>
            <button className="text-xs px-3 py-1.5 rounded border border-pierre-violet/50 bg-pierre-violet/10 text-pierre-violet-light hover:bg-pierre-violet/20 transition-colors">
              {t('wellness.weight.addWeight')}
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-zinc-500 border-b border-white/10">
                <th className="text-left py-2 px-4 font-medium">Date/Heure</th>
                <th className="text-right py-2 px-3 font-medium">Poids</th>
                <th className="text-right py-2 px-3 font-medium">Var.</th>
                <th className="text-right py-2 px-3 font-medium">IMC</th>
                <th className="text-right py-2 px-3 font-medium">Masse grasse</th>
                <th className="text-right py-2 px-3 font-medium">Masse musc.</th>
                <th className="text-right py-2 px-3 font-medium">Masse osseuse</th>
                <th className="text-right py-2 px-3 font-medium">Masse hydr.</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {tableEntries.map((entry, i) => {
                const origIndex = weightHistory.entries.length - 1 - i;
                const variation = getVariation(weightHistory.entries, origIndex);
                return (
                  <tr key={`${entry.date}-${entry.time}-${i}`} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                    <td className="py-2.5 px-4 text-zinc-300">
                      {new Date(entry.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {entry.time && <span className="text-zinc-600 ml-2">{entry.time}</span>}
                    </td>
                    <td className="py-2.5 px-3 text-right text-white font-medium">{entry.weight_kg} kg</td>
                    <td className="py-2.5 px-3 text-right">
                      {variation && variation.value > 0 ? (
                        <span className={variation.dir === 'down' ? 'text-green-400' : 'text-red-400'}>
                          {variation.dir === 'down' ? '\u2193' : '\u2191'} {variation.value} kg
                        </span>
                      ) : (
                        <span className="text-zinc-600">-</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right text-zinc-400">{entry.bmi ?? '-'}</td>
                    <td className="py-2.5 px-3 text-right text-zinc-400">{entry.body_fat_pct ? `${entry.body_fat_pct}%` : '-'}</td>
                    <td className="py-2.5 px-3 text-right text-zinc-400">{entry.muscle_mass_kg ? `${entry.muscle_mass_kg} kg` : '-'}</td>
                    <td className="py-2.5 px-3 text-right text-zinc-400">{entry.bone_mass_kg ? `${entry.bone_mass_kg} kg` : '-'}</td>
                    <td className="py-2.5 px-3 text-right text-zinc-400">{entry.body_water_pct ? `${entry.body_water_pct}%` : '-'}</td>
                    <td className="py-2.5 px-1">
                      <button className="p-1 text-zinc-600 hover:text-red-400 transition-colors" title="Supprimer">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
