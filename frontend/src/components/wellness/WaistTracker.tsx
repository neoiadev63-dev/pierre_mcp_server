// SPDX-License-Identifier: MIT OR Apache-2.0
// Copyright (c) 2025 Pierre Fitness Intelligence

import { useState, useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import type { TooltipItem } from 'chart.js';
import { useWaist } from '../../hooks/useWaist';
import { useChartResponsive } from '../../hooks/useChartResponsive';

export default function WaistTracker() {
  const { data, isLoading, addMeasurement, deleteMeasurement } = useWaist();
  const [inputValue, setInputValue] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const chartConfig = useChartResponsive();

  const handleAdd = () => {
    const cm = parseFloat(inputValue);
    if (cm >= 50 && cm <= 150) {
      addMeasurement(cm);
      setInputValue('');
    }
  };

  // Delta vs previous
  const delta = useMemo(() => {
    if (data.entries.length < 2) return null;
    const latest = data.entries[data.entries.length - 1].waist_cm;
    const prev = data.entries[data.entries.length - 2].waist_cm;
    const diff = Math.round((latest - prev) * 10) / 10;
    return { value: Math.abs(diff), dir: diff > 0 ? 'up' : diff < 0 ? 'down' : 'same' as const };
  }, [data.entries]);

  // Chart data: last 30 entries
  const chartData = useMemo(() => {
    const entries = data.entries.slice(-30);
    return {
      labels: entries.map(e =>
        new Date(e.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
      ),
      datasets: [{
        label: 'Tour de taille',
        data: entries.map(e => e.waist_cm),
        borderColor: '#22C55E',
        backgroundColor: '#22C55E20',
        borderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 7,
        tension: 0.3,
        fill: true,
      }],
    };
  }, [data.entries]);

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
          label: (ctx: TooltipItem<'line'>) => `${ctx.parsed.y} cm`,
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
          callback: (v: string | number) => `${v} cm`,
        },
        grid: { color: 'rgba(255,255,255,0.05)' },
      },
    },
  };

  if (isLoading) {
    return (
      <div className="card-dark flex justify-center py-8">
        <div className="pierre-spinner" />
      </div>
    );
  }

  return (
    <div className="card-dark !p-0 overflow-hidden border border-pierre-activity/30">
      {/* Header */}
      <div className="px-5 py-3 bg-gradient-to-r from-pierre-activity/20 via-green-900/10 to-transparent flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pierre-activity to-green-700 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-white">Tour de taille</h3>
        </div>
        {data.latest && (
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-white">{data.latest.waist_cm} cm</span>
            {delta && delta.value > 0 && (
              <span className={`text-xs ${delta.dir === 'down' ? 'text-green-400' : 'text-red-400'}`}>
                {delta.dir === 'down' ? '\u2193' : '\u2191'} {delta.value} cm
              </span>
            )}
          </div>
        )}
      </div>

      <div className="p-4 sm:p-5 space-y-4">
        {/* Input */}
        <div className="flex items-center gap-2">
          <input
            type="number"
            min="50"
            max="150"
            step="0.5"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder="ex: 85"
            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-pierre-activity/50"
          />
          <span className="text-xs text-zinc-500">cm</span>
          <button
            onClick={handleAdd}
            disabled={!inputValue || parseFloat(inputValue) < 50 || parseFloat(inputValue) > 150}
            className="px-4 py-2.5 rounded-lg bg-pierre-activity/20 text-pierre-activity hover:bg-pierre-activity/30 transition-colors text-sm font-medium disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Enregistrer
          </button>
        </div>

        {/* Chart */}
        {data.entries.length > 1 && (
          <div className="h-48">
            <Line data={chartData} options={chartOptions} />
          </div>
        )}

        {/* History toggle */}
        {data.entries.length > 0 && (
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="w-full text-xs text-zinc-500 hover:text-zinc-300 transition-colors flex items-center justify-center gap-1 py-2 border-t border-white/5"
          >
            {showHistory ? 'Masquer' : 'Afficher'} l'historique ({data.entries.length})
            <svg className={`w-3.5 h-3.5 transition-transform ${showHistory ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        )}

        {/* History table */}
        {showHistory && (
          <div className="space-y-0.5 max-h-48 overflow-y-auto">
            {[...data.entries].reverse().map((entry, i) => {
              const origIndex = data.entries.length - 1 - i;
              return (
                <div key={`${entry.date}-${entry.time}-${i}`} className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-white/[0.02] group">
                  <span className="text-sm text-zinc-300">
                    {new Date(entry.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                    <span className="text-zinc-600 ml-2">{entry.time}</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">{entry.waist_cm} cm</span>
                    <button
                      onClick={() => deleteMeasurement(origIndex)}
                      className="text-zinc-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 p-1"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {data.entries.length === 0 && (
          <p className="text-sm text-zinc-500 text-center py-4">
            Aucune mesure enregistree. Entrez votre tour de taille pour commencer le suivi.
          </p>
        )}
      </div>
    </div>
  );
}
