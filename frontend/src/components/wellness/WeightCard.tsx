// SPDX-License-Identifier: MIT OR Apache-2.0
// Copyright (c) 2025 Pierre Fitness Intelligence

import { useState, useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import type { TooltipItem } from 'chart.js';
import type { WeightHistory, WeightEntry } from '../../types/wellness';
import { useChartResponsive } from '../../hooks/useChartResponsive';

interface WeightCardProps {
  weightHistory: WeightHistory;
  bmi?: number;
  bodyFat?: number;
}

type MetricTab = 'weight' | 'bmi' | 'bodyFat' | 'muscle' | 'bone' | 'water';

const TABS: { key: MetricTab; label: string }[] = [
  { key: 'weight', label: 'Poids' },
  { key: 'bmi', label: 'IMC' },
  { key: 'bodyFat', label: 'Masse grasse' },
  { key: 'muscle', label: 'Masse musculaire' },
  { key: 'bone', label: 'Masse osseuse' },
  { key: 'water', label: 'Masse hydrique' },
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
    case 'weight': return '#F59E0B';
    case 'bmi': return '#3B82F6';
    case 'bodyFat': return '#EF4444';
    case 'muscle': return '#8B5CF6';
    case 'bone': return '#6B7280';
    case 'water': return '#22D3EE';
  }
}

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' });
}

function getVariation(entries: WeightEntry[], index: number, tab: MetricTab): { value: number; dir: 'up' | 'down' | 'same' } | null {
  if (index <= 0) return null;
  const curr = getMetricValue(entries[index], tab);
  const prev = getMetricValue(entries[index - 1], tab);
  if (curr === null || prev === null) return null;
  const diff = Math.round((curr - prev) * 10) / 10;
  return { value: Math.abs(diff), dir: diff > 0 ? 'up' : diff < 0 ? 'down' : 'same' };
}

export default function WeightCard({ weightHistory }: WeightCardProps) {
  const [activeTab, setActiveTab] = useState<MetricTab>('weight');
  const latest = weightHistory.latest;
  const chartConfig = useChartResponsive();

  // Group entries by date (take last entry per day for chart)
  const dailyEntries = useMemo(() => {
    const byDate = new Map<string, WeightEntry>();
    for (const e of weightHistory.entries) {
      byDate.set(e.date, e); // Last entry per date wins
    }
    return Array.from(byDate.values()).slice(-14); // Last 14 days
  }, [weightHistory.entries]);

  // Check if body composition data exists
  const hasBodyComp = latest && (latest.body_fat_pct !== null || latest.muscle_mass_kg !== null);

  // Available tabs (only show tabs with data)
  const availableTabs = useMemo(() => {
    if (!hasBodyComp) return TABS.filter(t => t.key === 'weight');
    return TABS.filter(t => {
      if (t.key === 'weight') return true;
      return weightHistory.entries.some(e => getMetricValue(e, t.key) !== null);
    });
  }, [hasBodyComp, weightHistory.entries]);

  // Chart data
  const chartData = useMemo(() => {
    const values = dailyEntries.map(e => getMetricValue(e, activeTab)).filter((v): v is number => v !== null);
    const labels = dailyEntries.map(e => formatDateShort(e.date));
    const color = getMetricColor(activeTab);

    const datasets: {
      label: string;
      data: (number | null)[];
      borderColor: string;
      backgroundColor: string;
      borderWidth: number;
      pointRadius: number;
      pointHoverRadius: number;
      tension: number;
      borderDash?: number[];
      pointStyle?: false;
    }[] = [
      {
        label: TABS.find(t => t.key === activeTab)?.label || '',
        data: dailyEntries.map(e => getMetricValue(e, activeTab)),
        borderColor: color,
        backgroundColor: `${color}20`,
        borderWidth: 2,
        pointRadius: 3,
        pointHoverRadius: 6,
        tension: 0.3,
      },
    ];

    // Add goal line for weight tab
    if (activeTab === 'weight' && weightHistory.goal_kg && values.length > 0) {
      datasets.push({
        label: `Objectif (${weightHistory.goal_kg} kg)`,
        data: dailyEntries.map(() => weightHistory.goal_kg!),
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
  }, [dailyEntries, activeTab, weightHistory.goal_kg]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    aspectRatio: chartConfig.isMobile ? 1.5 : 2,
    plugins: {
      legend: { display: false },
      tooltip: {
        padding: chartConfig.padding,
        titleFont: { size: chartConfig.fontSize.tooltip },
        bodyFont: { size: chartConfig.fontSize.tooltip },
        callbacks: {
          label: (ctx: TooltipItem<'line'>) =>
            `${ctx.dataset.label}: ${ctx.parsed.y} ${getMetricUnit(activeTab)}`,
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

  // Recent weigh-ins (last 5 entries, most recent first)
  const recentEntries = weightHistory.entries.slice(-5).reverse();

  if (!latest) return null;

  return (
    <div className="md:col-span-2 xl:col-span-2 card-dark !p-0 overflow-hidden border border-white/10">
      {/* Header */}
      <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-white/5">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
          </svg>
          <span className="text-sm font-medium text-white uppercase tracking-wider">Poids & Composition</span>
        </div>
        {latest.source === 'INDEX_SCALE' && (
          <span className="text-[9px] text-zinc-500 px-2 py-0.5 rounded bg-white/5">Index S2</span>
        )}
      </div>

      <div className="p-5">
        {/* Top: Latest values summary */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-4">
          <div className="text-center">
            <span className="text-2xl font-bold text-amber-400">{latest.weight_kg}</span>
            <span className="text-sm text-zinc-400 ml-1">kg</span>
            <span className="text-[10px] text-zinc-500 block">Poids</span>
          </div>
          {latest.bmi !== null && (
            <div className="text-center">
              <span className="text-2xl font-bold text-blue-400">{latest.bmi}</span>
              <span className="text-[10px] text-zinc-500 block">IMC</span>
            </div>
          )}
          {latest.body_fat_pct !== null && (
            <div className="text-center">
              <span className="text-2xl font-bold text-red-400">{latest.body_fat_pct}</span>
              <span className="text-sm text-zinc-400 ml-0.5">%</span>
              <span className="text-[10px] text-zinc-500 block">Masse grasse</span>
            </div>
          )}
          {latest.muscle_mass_kg !== null && (
            <div className="text-center">
              <span className="text-2xl font-bold text-purple-400">{latest.muscle_mass_kg}</span>
              <span className="text-sm text-zinc-400 ml-1">kg</span>
              <span className="text-[10px] text-zinc-500 block">Masse musc.</span>
            </div>
          )}
          {latest.bone_mass_kg !== null && (
            <div className="text-center">
              <span className="text-2xl font-bold text-zinc-400">{latest.bone_mass_kg}</span>
              <span className="text-sm text-zinc-400 ml-1">kg</span>
              <span className="text-[10px] text-zinc-500 block">Masse osseuse</span>
            </div>
          )}
          {latest.body_water_pct !== null && (
            <div className="text-center">
              <span className="text-2xl font-bold text-cyan-400">{latest.body_water_pct}</span>
              <span className="text-sm text-zinc-400 ml-0.5">%</span>
              <span className="text-[10px] text-zinc-500 block">Masse hydr.</span>
            </div>
          )}
        </div>

        {/* Metric tabs */}
        {availableTabs.length > 1 && (
          <div className="flex gap-1.5 mb-3 flex-wrap">
            {availableTabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`text-[10px] px-2.5 py-1 rounded-full border transition-colors ${
                  activeTab === tab.key
                    ? 'border-white/30 bg-white/10 text-white font-medium'
                    : 'border-white/5 bg-white/[0.02] text-zinc-500 hover:text-zinc-300 hover:border-white/10'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* Chart */}
        {dailyEntries.length > 1 && (
          <div className="h-48 mb-4">
            <Line data={chartData} options={chartOptions} />
          </div>
        )}

        {/* Goal info */}
        {activeTab === 'weight' && weightHistory.goal_kg && (
          <div className="flex items-center justify-center gap-4 mb-3 text-xs text-zinc-500">
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-0.5 bg-amber-400 rounded" />
              <span>Pesée</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-0.5 border-t border-dashed border-zinc-500" />
              <span>Objectif ({weightHistory.goal_kg} kg)</span>
            </div>
            {latest && (
              <span className="text-zinc-400">
                Reste : {(latest.weight_kg - weightHistory.goal_kg).toFixed(1)} kg
              </span>
            )}
          </div>
        )}

        {/* Recent weigh-ins table */}
        {recentEntries.length > 0 && (
          <div>
            <h4 className="text-[10px] text-zinc-400 uppercase tracking-wider mb-2">Dernières pesées</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-zinc-500 border-b border-white/5">
                    <th className="text-left py-1.5 pr-2 font-medium">Date</th>
                    <th className="text-right py-1.5 px-2 font-medium">Poids</th>
                    <th className="text-right py-1.5 px-2 font-medium">Var.</th>
                    {hasBodyComp && (
                      <>
                        <th className="text-right py-1.5 px-2 font-medium">IMC</th>
                        <th className="text-right py-1.5 px-2 font-medium">Graisse</th>
                        <th className="text-right py-1.5 px-2 font-medium hidden md:table-cell">Muscle</th>
                        <th className="text-right py-1.5 px-2 font-medium hidden md:table-cell">Os</th>
                        <th className="text-right py-1.5 px-2 font-medium hidden md:table-cell">Eau</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {recentEntries.map((entry, i) => {
                    const origIndex = weightHistory.entries.length - 1 - i;
                    const variation = getVariation(weightHistory.entries, origIndex, 'weight');
                    return (
                      <tr key={`${entry.date}-${entry.time}`} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                        <td className="py-2 pr-2 text-zinc-300">
                          {new Date(entry.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                          {entry.time && <span className="text-zinc-600 ml-1">{entry.time}</span>}
                        </td>
                        <td className="py-2 px-2 text-right text-white font-medium">{entry.weight_kg} kg</td>
                        <td className="py-2 px-2 text-right">
                          {variation && variation.value > 0 && (
                            <span className={variation.dir === 'down' ? 'text-green-400' : 'text-red-400'}>
                              {variation.value} kg {variation.dir === 'down' ? '\u2193' : '\u2191'}
                            </span>
                          )}
                        </td>
                        {hasBodyComp && (
                          <>
                            <td className="py-2 px-2 text-right text-zinc-400">{entry.bmi ?? '-'}</td>
                            <td className="py-2 px-2 text-right text-zinc-400">{entry.body_fat_pct ? `${entry.body_fat_pct}%` : '-'}</td>
                            <td className="py-2 px-2 text-right text-zinc-400 hidden md:table-cell">{entry.muscle_mass_kg ? `${entry.muscle_mass_kg} kg` : '-'}</td>
                            <td className="py-2 px-2 text-right text-zinc-400 hidden md:table-cell">{entry.bone_mass_kg ? `${entry.bone_mass_kg} kg` : '-'}</td>
                            <td className="py-2 px-2 text-right text-zinc-400 hidden md:table-cell">{entry.body_water_pct ? `${entry.body_water_pct}%` : '-'}</td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
