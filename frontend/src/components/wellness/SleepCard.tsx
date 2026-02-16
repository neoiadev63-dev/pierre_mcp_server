// SPDX-License-Identifier: MIT OR Apache-2.0
// Copyright (c) 2025 Pierre Fitness Intelligence

import { Doughnut } from 'react-chartjs-2';
import { useTranslation } from 'react-i18next';
import type { WellnessSleep } from '../../types/wellness';
import WellnessCardShell from './WellnessCardShell';

interface SleepCardProps {
  sleep: WellnessSleep | null;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m.toString().padStart(2, '0')}m`;
}

function getScoreLabel(score: number): { text: string; color: string } {
  if (score >= 80) return { text: 'Excellent', color: '#4ADE80' };
  if (score >= 60) return { text: 'Bon', color: '#818CF8' };
  if (score >= 40) return { text: 'Passable', color: '#F59E0B' };
  return { text: 'Mauvais', color: '#EF4444' };
}

function getPhaseRating(phase: string, seconds: number, totalSeconds: number): { text: string; color: string } {
  const pct = totalSeconds > 0 ? (seconds / totalSeconds) * 100 : 0;
  if (phase === 'deep') {
    if (pct >= 15) return { text: 'Excellent', color: '#4ADE80' };
    if (pct >= 10) return { text: 'Bon', color: '#818CF8' };
    return { text: 'Passable', color: '#F59E0B' };
  }
  if (phase === 'light') {
    if (pct >= 40 && pct <= 60) return { text: 'Excellent', color: '#4ADE80' };
    if (pct >= 30) return { text: 'Bon', color: '#818CF8' };
    return { text: 'Passable', color: '#F59E0B' };
  }
  if (phase === 'rem') {
    if (pct >= 20) return { text: 'Excellent', color: '#4ADE80' };
    if (pct >= 15) return { text: 'Bon', color: '#818CF8' };
    return { text: 'Passable', color: '#F59E0B' };
  }
  // awake
  if (pct <= 5) return { text: 'Excellent', color: '#4ADE80' };
  if (pct <= 10) return { text: 'Bon', color: '#818CF8' };
  return { text: 'Passable', color: '#F59E0B' };
}

function getFeedbackText(feedback: string | null): string {
  switch (feedback) {
    case 'POSITIVE_REFRESHING': return 'Sommeil réparateur et continu. Vous devriez vous sentir reposé et alerte.';
    case 'POSITIVE_GOOD': return 'Bonne nuit de sommeil avec des phases équilibrées.';
    case 'NEGATIVE_SHORT': return 'Plus court que la durée idéale. Essayez de dormir plus longtemps.';
    case 'NEGATIVE_RESTLESS': return 'Sommeil agité avec de nombreuses interruptions.';
    case 'NEGATIVE_INTERRUPTED': return 'Sommeil interrompu. Votre repos a été fragmenté.';
    default: return 'Analyse du sommeil disponible.';
  }
}

export default function SleepCard({ sleep }: SleepCardProps) {
  const { t } = useTranslation();

  if (!sleep) {
    return (
      <WellnessCardShell
        icon={<svg className="w-5 h-5 text-pierre-recovery" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>}
        title={t('wellness.sleep')}
        accent="recovery"
      >
        <p className="text-zinc-500 text-sm">{t('wellness.noData')}</p>
      </WellnessCardShell>
    );
  }

  const score = sleep.score ?? 0;
  const scoreInfo = getScoreLabel(score);
  const totalSleep = sleep.deep_seconds + sleep.light_seconds + sleep.rem_seconds + sleep.awake_seconds;

  const doughnutData = {
    labels: [t('wellness.deep'), t('wellness.light'), t('wellness.rem'), t('wellness.awake')],
    datasets: [{
      data: [sleep.deep_seconds, sleep.light_seconds, sleep.rem_seconds, sleep.awake_seconds],
      backgroundColor: ['#6366F1', '#818CF8', '#C084FC', '#EF4444'],
      borderWidth: 0,
      cutout: '70%',
    }],
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: { label: string; raw: unknown }) =>
            `${ctx.label}: ${formatDuration(ctx.raw as number)}`,
        },
      },
    },
  };

  const phases = [
    { key: 'duration', label: 'Durée', value: formatDuration(sleep.duration_seconds), rating: score >= 80 ? getScoreLabel(80) : score >= 60 ? getScoreLabel(60) : getScoreLabel(40) },
    { key: 'deep', label: t('wellness.deep'), value: formatDuration(sleep.deep_seconds), rating: getPhaseRating('deep', sleep.deep_seconds, totalSleep) },
    { key: 'light', label: t('wellness.light'), value: formatDuration(sleep.light_seconds), rating: getPhaseRating('light', sleep.light_seconds, totalSleep) },
    { key: 'rem', label: 'Sommeil paradoxal', value: formatDuration(sleep.rem_seconds), rating: getPhaseRating('rem', sleep.rem_seconds, totalSleep) },
    { key: 'awake', label: 'Éveil/Agitation', value: formatDuration(sleep.awake_seconds), rating: getPhaseRating('awake', sleep.awake_seconds, totalSleep) },
  ];

  return (
    <div className="md:col-span-2 xl:col-span-2 card-dark !p-0 overflow-hidden border border-white/10">
      {/* Header */}
      <div className="px-5 pt-4 pb-3 flex items-center gap-2 border-b border-white/5">
        <svg className="w-5 h-5 text-pierre-recovery" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
        <span className="text-sm font-medium text-white uppercase tracking-wider">{t('wellness.sleep')}</span>
      </div>

      <div className="p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left column: Score + donut + feedback */}
          <div className="flex flex-col gap-4">
            {/* Score + Donut */}
            <div className="flex items-start gap-5">
              <div className="relative w-28 h-28 flex-shrink-0">
                <Doughnut data={doughnutData} options={doughnutOptions} />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-bold" style={{ color: scoreInfo.color }}>{score}</span>
                  <span className="text-[10px] text-zinc-500">/100</span>
                </div>
              </div>
              <div className="flex flex-col gap-1 pt-1">
                <div className="flex items-baseline gap-3">
                  <div>
                    <span className="text-lg font-semibold" style={{ color: scoreInfo.color }}>{scoreInfo.text}</span>
                    <span className="text-[11px] text-zinc-500 block">Qualité</span>
                  </div>
                  <div>
                    <span className="text-lg font-semibold text-white">{formatDuration(sleep.duration_seconds)}</span>
                    <span className="text-[11px] text-zinc-500 block">Durée</span>
                  </div>
                </div>
                {/* Legend */}
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-2 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#6366F1]" />
                    <span className="text-zinc-400">{t('wellness.deep')}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#818CF8]" />
                    <span className="text-zinc-400">{t('wellness.light')}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#C084FC]" />
                    <span className="text-zinc-400">REM</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#EF4444]" />
                    <span className="text-zinc-400">{t('wellness.awake')}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Feedback text */}
            <p className="text-sm text-zinc-400 italic leading-relaxed">
              {getFeedbackText(sleep.feedback)}
            </p>

            {/* Bottom metrics: SpO2, HR, Respiration */}
            <div className="flex gap-4 mt-auto">
              {sleep.hr_avg && (
                <div className="flex items-center gap-2 text-xs">
                  <svg className="w-4 h-4 text-red-400" fill="currentColor" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                  <div>
                    <span className="text-zinc-300 font-medium">{sleep.hr_avg.toFixed(0)} bpm</span>
                    <span className="text-zinc-500 block text-[10px]">FC moy.</span>
                  </div>
                </div>
              )}
              {sleep.spo2_avg && (
                <div className="flex items-center gap-2 text-xs">
                  <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" strokeWidth={2} /><path strokeWidth={2} d="M12 6v6l4 2" /></svg>
                  <div>
                    <span className="text-zinc-300 font-medium">{sleep.spo2_avg.toFixed(1)}%</span>
                    <span className="text-zinc-500 block text-[10px]">SpO2</span>
                  </div>
                </div>
              )}
              {sleep.respiration_avg && (
                <div className="flex items-center gap-2 text-xs">
                  <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth={2} strokeLinecap="round" d="M3 12h4l3-9 4 18 3-9h4" /></svg>
                  <div>
                    <span className="text-zinc-300 font-medium">{sleep.respiration_avg.toFixed(1)} rpm</span>
                    <span className="text-zinc-500 block text-[10px]">Respiration</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right column: Phase details (Garmin style) */}
          <div className="flex flex-col gap-2">
            {phases.map((phase) => (
              <div
                key={phase.key}
                className="flex items-center justify-between px-4 py-3 rounded-lg bg-white/[0.03] border border-white/5"
              >
                <div>
                  <span className="text-sm font-medium text-white">{phase.label}</span>
                  <span className="text-xs text-zinc-500 block">{phase.value}</span>
                </div>
                <span className="text-sm font-medium" style={{ color: phase.rating.color }}>
                  {phase.rating.text}
                </span>
              </div>
            ))}

            {/* Recovery & Restfulness scores */}
            {(sleep.recovery_score || sleep.restfulness_score) && (
              <div className="flex gap-2 mt-1">
                {sleep.recovery_score && (
                  <div className="flex-1 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/5 text-center">
                    <span className="text-lg font-bold text-pierre-recovery">{sleep.recovery_score}</span>
                    <span className="text-[10px] text-zinc-500 block">Récupération</span>
                  </div>
                )}
                {sleep.restfulness_score && (
                  <div className="flex-1 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/5 text-center">
                    <span className="text-lg font-bold text-pierre-cyan">{sleep.restfulness_score}</span>
                    <span className="text-[10px] text-zinc-500 block">Repos</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
