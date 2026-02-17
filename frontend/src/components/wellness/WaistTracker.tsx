// SPDX-License-Identifier: MIT OR Apache-2.0
// Copyright (c) 2025 Pierre Fitness Intelligence

import { useState, useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import type { TooltipItem } from 'chart.js';
import { useWaist } from '../../hooks/useWaist';
import { useChartResponsive } from '../../hooks/useChartResponsive';

type RiskLevel = 'low' | 'increased' | 'high';

function getWaistRisk(cm: number): { level: RiskLevel; label: string; color: string; bgColor: string } {
  if (cm < 94) return { level: 'low', label: 'Faible risque', color: '#4ADE80', bgColor: 'bg-green-500/10 border-green-500/20' };
  if (cm <= 102) return { level: 'increased', label: 'Risque accru', color: '#F59E0B', bgColor: 'bg-amber-500/10 border-amber-500/20' };
  return { level: 'high', label: 'Risque élevé', color: '#EF4444', bgColor: 'bg-red-500/10 border-red-500/20' };
}

export default function WaistTracker() {
  const { data, isLoading, addMeasurement, deleteMeasurement } = useWaist();
  const [inputValue, setInputValue] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [showRecommendations, setShowRecommendations] = useState(false);
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

  const currentRisk = useMemo(() => {
    if (!data.latest) return null;
    return getWaistRisk(data.latest.waist_cm);
  }, [data.latest]);

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

        {/* Risk indicator when measurement exists */}
        {currentRisk && (
          <div className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${currentRisk.bgColor}`}>
            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: currentRisk.color }} />
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium" style={{ color: currentRisk.color }}>
                {currentRisk.label}
              </span>
              <span className="text-xs text-zinc-400 ml-2">
                {currentRisk.level === 'low' && '(< 94 cm)'}
                {currentRisk.level === 'increased' && '(94 - 102 cm)'}
                {currentRisk.level === 'high' && '(> 102 cm)'}
              </span>
            </div>
          </div>
        )}

        {/* Chart */}
        {data.entries.length > 1 && (
          <div className="h-48">
            <Line data={chartData} options={chartOptions} />
          </div>
        )}

        {/* Recommendations section */}
        <button
          onClick={() => setShowRecommendations(!showRecommendations)}
          className="w-full text-xs text-zinc-400 hover:text-zinc-200 transition-colors flex items-center justify-center gap-1.5 py-2 border-t border-white/5"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {showRecommendations ? 'Masquer' : 'Voir'} les recommandations
          <svg className={`w-3.5 h-3.5 transition-transform ${showRecommendations ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showRecommendations && (
          <div className="space-y-3 text-sm">
            {/* Risk zones */}
            <div className="rounded-lg bg-white/[0.03] border border-white/5 p-4 space-y-3">
              <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                Zones de risque (Homme - OMS/IDF)
              </h4>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-green-400 flex-shrink-0" />
                  <span className="text-zinc-300">&lt; 94 cm</span>
                  <span className="text-zinc-500 ml-auto text-xs">Faible risque</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-400 flex-shrink-0" />
                  <span className="text-zinc-300">94 - 102 cm</span>
                  <span className="text-zinc-500 ml-auto text-xs">Risque accru</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-400 flex-shrink-0" />
                  <span className="text-zinc-300">&gt; 102 cm</span>
                  <span className="text-zinc-500 ml-auto text-xs">Risque élevé</span>
                </div>
              </div>
              <p className="text-[11px] text-zinc-500 italic leading-relaxed">
                Tour de taille idéal pour un homme : inférieur à 94 cm. C'est un indicateur plus fiable que l'IMC pour évaluer la graisse abdominale (viscérale).
              </p>
            </div>

            {/* Health complications */}
            <div className="rounded-lg bg-white/[0.03] border border-white/5 p-4 space-y-3">
              <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                Complications associées
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  { name: 'Diabète de type 2', desc: 'La graisse viscérale augmente la résistance à l\'insuline' },
                  { name: 'Maladies cardiovasculaires', desc: 'Risque accru d\'infarctus et d\'AVC' },
                  { name: 'Hypertension artérielle', desc: 'L\'excès de graisse abdominale élève la pression' },
                  { name: 'Apnée du sommeil', desc: 'La graisse du cou et du tronc comprime les voies respiratoires' },
                  { name: 'Syndrome métabolique', desc: 'Combinaison de facteurs de risque métaboliques' },
                  { name: 'Stéatose hépatique', desc: 'Accumulation de graisse dans le foie (foie gras)' },
                ].map((c) => (
                  <div key={c.name} className="px-3 py-2 rounded-lg bg-white/[0.02]">
                    <span className="text-xs font-medium text-zinc-300">{c.name}</span>
                    <p className="text-[10px] text-zinc-500 leading-snug mt-0.5">{c.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Tips */}
            <div className="rounded-lg bg-white/[0.03] border border-white/5 p-4 space-y-2">
              <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                Conseils pour réduire le tour de taille
              </h4>
              <ul className="space-y-1.5 text-xs text-zinc-400">
                <li className="flex items-start gap-2">
                  <span className="text-pierre-activity mt-0.5">&#x2022;</span>
                  <span>Activité physique régulière : 150 min/semaine d'exercice modéré (marche rapide, vélo, natation)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-pierre-activity mt-0.5">&#x2022;</span>
                  <span>Réduire les sucres raffinés et les graisses saturées au profit de fibres, légumes et protéines maigres</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-pierre-activity mt-0.5">&#x2022;</span>
                  <span>Gérer le stress : le cortisol favorise le stockage de graisse abdominale</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-pierre-activity mt-0.5">&#x2022;</span>
                  <span>Dormir 7 à 9 heures par nuit : le manque de sommeil stimule la prise de poids abdominale</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-pierre-activity mt-0.5">&#x2022;</span>
                  <span>Limiter l'alcool : les calories de l'alcool se stockent en priorité autour de l'abdomen</span>
                </li>
              </ul>
            </div>
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
            Aucune mesure enregistrée. Entrez votre tour de taille pour commencer le suivi.
          </p>
        )}
      </div>
    </div>
  );
}
