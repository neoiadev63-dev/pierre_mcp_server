// SPDX-License-Identifier: MIT OR Apache-2.0
// Copyright (c) 2025 Pierre Fitness Intelligence
//
// Health Snapshot card for the Wellness Dashboard.
// Shows last-night biometrics (FC, SpO2, respiration, stress, HRV)
// with mini sparkline graphs, a VFC gauge and a training recommendation.

import type { WellnessSummary, TimelinePoint, Spo2TimelinePoint } from '../../types/wellness';

interface HealthSnapshotCardProps {
  data: WellnessSummary;
}

// ── Mini SVG sparkline ──
function Sparkline({ points, color, height = 28, invert }: {
  points: number[];
  color: string;
  height?: number;
  invert?: boolean;
}) {
  if (points.length < 2) return null;
  const w = 60;
  const h = height;
  const pad = 2;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;

  // Downsample to ~30 points for performance
  const step = Math.max(1, Math.floor(points.length / 30));
  const sampled = points.filter((_, i) => i % step === 0);

  const toY = (v: number) => {
    const normalized = (v - min) / range;
    return invert
      ? pad + normalized * (h - 2 * pad)
      : h - pad - normalized * (h - 2 * pad);
  };

  const pathD = sampled.map((v, i) => {
    const x = (i / (sampled.length - 1)) * w;
    const y = toY(v);
    return i === 0 ? `M${x},${y}` : `L${x},${y}`;
  }).join(' ');

  const fillD = pathD + ` L${w},${h} L0,${h} Z`;

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="block mx-auto mt-1">
      <defs>
        <linearGradient id={`sp-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={fillD} fill={`url(#sp-${color.replace('#','')})`} />
      <path d={pathD} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

// ── VFC interpretation logic ──
function getVfcAnalysis(rmssd: number, avg7d: number | null) {
  let position: number;
  if (avg7d !== null && avg7d > 0) {
    const ratio = rmssd / avg7d;
    position = Math.max(0, Math.min(100, ((ratio - 0.6) / 0.7) * 100));
  } else {
    position = Math.max(0, Math.min(100, ((rmssd - 20) / 60) * 100));
  }

  if (position >= 80) {
    return {
      position,
      zone: 'optimal' as const,
      color: '#22c55e',
      label: 'Optimal',
      recommendation: 'Entraînement intensif possible',
      detail: 'Ton système nerveux est bien reposé. Tu peux te permettre une séance intense (intervalles, côtes, tempo).',
      action: 'ENTRAÎNEMENT',
    };
  }
  if (position >= 60) {
    return {
      position,
      zone: 'good' as const,
      color: '#84cc16',
      label: 'Bon',
      recommendation: 'Entraînement normal',
      detail: 'Bonne récupération globale. Entraînement modéré à soutenu sans risque. Écoute ton corps sur les dernières séries.',
      action: 'ENTRAÎNEMENT',
    };
  }
  if (position >= 40) {
    return {
      position,
      zone: 'moderate' as const,
      color: '#eab308',
      label: 'Modéré',
      recommendation: 'Récupération active',
      detail: 'Récupération partielle. Privilégie une sortie légère (marche, vélo Z1-Z2) pour stimuler la circulation sans stresser le système nerveux.',
      action: 'RÉCUPÉRATION ACTIVE',
    };
  }
  if (position >= 20) {
    return {
      position,
      zone: 'low' as const,
      color: '#f97316',
      label: 'Faible',
      recommendation: 'Récupération passive',
      detail: 'Fatigue détectée. Journée de repos actif : étirements, mobilité, respiration. Pas d\'effort cardiovasculaire intense.',
      action: 'RÉCUPÉRATION PASSIVE',
    };
  }
  return {
    position,
    zone: 'rest' as const,
    color: '#ef4444',
    label: 'Repos',
    recommendation: 'Repos absolu',
    detail: 'Stress élevé ou dette de sommeil importante. Repos complet recommandé. Hydratation, alimentation anti-inflammatoire, sieste si possible.',
    action: 'REPOS ABSOLU',
  };
}

const zones = [
  { end: 20, color: '#ef4444', label: 'Repos' },
  { end: 40, color: '#f97316', label: 'Passif' },
  { end: 60, color: '#eab308', label: 'Actif' },
  { end: 80, color: '#84cc16', label: 'Normal' },
  { end: 100, color: '#22c55e', label: 'Optimal' },
];

function extractValues(timeline: TimelinePoint[]): number[] {
  return timeline.map(p => p.value);
}

function extractSpo2Values(timeline: Spo2TimelinePoint[]): number[] {
  return timeline.map(p => p.value);
}

export default function HealthSnapshotCard({ data }: HealthSnapshotCardProps) {
  const sleep = data.latest?.sleep;
  if (!sleep) return null;

  const rmssd = sleep.hrv_rmssd;
  const sdrr = sleep.hrv_sdrr;
  if (rmssd === null || rmssd === undefined) return null;

  const hrvTrend = data.hrvTrend7d ?? [];
  const hrvAvg7d = hrvTrend.length > 0
    ? hrvTrend.reduce((sum, p) => sum + p.rmssd, 0) / hrvTrend.length
    : null;

  const analysis = getVfcAnalysis(rmssd, hrvAvg7d);

  const hrAvg = sleep.hr_avg;
  const spo2 = sleep.spo2_avg;
  const respiration = sleep.respiration_avg;
  const stressAvg = data.latest?.stress.average ?? null;

  // Sleep detail timeline data for sparklines
  const sd = data.sleepDetail;
  const hrPoints = sd?.hrTimeline ? extractValues(sd.hrTimeline) : [];
  const spo2Points = sd?.spo2Timeline ? extractSpo2Values(sd.spo2Timeline) : [];
  const respPoints = sd?.respTimeline ? extractValues(sd.respTimeline) : [];
  const stressPoints = sd?.stressTimeline ? extractValues(sd.stressTimeline) : [];

  // Action color mapping
  const actionColors: Record<string, string> = {
    'ENTRAÎNEMENT': '#22c55e',
    'RÉCUPÉRATION ACTIVE': '#eab308',
    'RÉCUPÉRATION PASSIVE': '#f97316',
    'REPOS ABSOLU': '#ef4444',
  };

  const metrics = [
    { label: 'FC moy.', value: hrAvg != null ? `${Math.round(hrAvg)}` : '--', unit: 'bpm', color: '#f87171', sparkPoints: hrPoints },
    { label: 'SpO2', value: spo2 != null ? `${spo2}` : '--', unit: '%', color: '#60a5fa', sparkPoints: spo2Points },
    { label: 'Respiration', value: respiration != null ? `${respiration}` : '--', unit: 'rpm', color: '#4ade80', sparkPoints: respPoints },
    { label: 'Stress', value: stressAvg != null ? `${Math.round(stressAvg)}` : '--', unit: '', color: stressAvg != null && stressAvg > 50 ? '#fb923c' : '#a1a1aa', sparkPoints: stressPoints, invert: true },
    { label: 'VFC', value: `${rmssd}`, unit: 'ms', color: '#c084fc', sparkPoints: [] },
  ];

  return (
    <div className="card-dark !p-0 overflow-hidden border border-white/10">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500/20 to-indigo-500/20 flex items-center justify-center">
            <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Aperçu Santé</h3>
            <p className="text-[10px] text-zinc-500">Données nocturnes</p>
          </div>
        </div>
        {/* Action badge */}
        <span
          className="text-[10px] font-bold px-2.5 py-1 rounded-full tracking-wide"
          style={{
            backgroundColor: (actionColors[analysis.action] ?? '#6b7280') + '20',
            color: actionColors[analysis.action] ?? '#6b7280',
          }}
        >
          {analysis.action}
        </span>
      </div>

      {/* Biometrics row with sparklines */}
      <div className="grid grid-cols-5 gap-0 px-2 py-2">
        {metrics.map((m) => (
          <div key={m.label} className="text-center px-1">
            <div className="text-[9px] text-zinc-500 mb-0.5 truncate">{m.label}</div>
            <div className="text-base font-bold font-mono" style={{ color: m.color }}>{m.value}</div>
            {m.unit && <div className="text-[8px] text-zinc-600 -mt-0.5">{m.unit}</div>}
            {m.sparkPoints.length > 2 && (
              <Sparkline points={m.sparkPoints} color={m.color} height={24} invert={m.invert} />
            )}
          </div>
        ))}
      </div>

      {/* VFC Gauge */}
      <div className="px-4 pb-2 pt-1">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] text-zinc-500 font-medium">Aptitude à l'effort (VFC)</span>
          <span
            className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
            style={{ backgroundColor: analysis.color + '25', color: analysis.color }}
          >
            {analysis.label}
          </span>
        </div>
        <div className="relative h-5 mb-1">
          <div className="absolute inset-0 flex rounded-full overflow-hidden gap-px">
            {zones.map((zone, i) => (
              <div key={i} className="flex-1 h-full" style={{ backgroundColor: zone.color + '30' }} />
            ))}
          </div>
          <div
            className="absolute top-0 left-0 h-full rounded-l-full transition-all duration-700 ease-out"
            style={{
              width: `${analysis.position}%`,
              background: `linear-gradient(90deg, #ef4444 0%, ${analysis.color} 100%)`,
              borderTopRightRadius: analysis.position >= 98 ? '9999px' : '4px',
              borderBottomRightRadius: analysis.position >= 98 ? '9999px' : '4px',
            }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 transition-all duration-700 ease-out z-10"
            style={{ left: `${analysis.position}%` }}
          >
            <div
              className="w-6 h-6 rounded-full bg-white shadow-lg shadow-black/50 border-[3px] flex items-center justify-center"
              style={{ borderColor: analysis.color }}
            >
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: analysis.color }} />
            </div>
          </div>
        </div>
        <div className="flex justify-between text-[8px] text-zinc-600 px-0.5">
          {zones.map((zone) => (
            <span key={zone.label}>{zone.label}</span>
          ))}
        </div>
      </div>

      {/* HRV details row */}
      <div className="flex items-center gap-4 px-4 py-2 text-[10px] text-zinc-500 border-t border-white/[0.04]">
        <span>RMSSD: <span className="text-purple-400 font-mono font-medium">{rmssd} ms</span></span>
        {sdrr !== null && <span>SDRR: <span className="text-indigo-400 font-mono font-medium">{sdrr} ms</span></span>}
        {hrvAvg7d !== null && <span>Moy. 7j: <span className="text-zinc-300 font-mono font-medium">{Math.round(hrvAvg7d)} ms</span></span>}
      </div>

      {/* Recommendation */}
      <div className="px-4 pb-4 pt-1">
        <div
          className="rounded-lg p-3 border"
          style={{
            backgroundColor: analysis.color + '08',
            borderColor: analysis.color + '20',
          }}
        >
          <div className="flex items-start gap-2">
            <span className="text-base flex-shrink-0 mt-0.5">
              {analysis.zone === 'optimal' ? '🚀' :
               analysis.zone === 'good' ? '✅' :
               analysis.zone === 'moderate' ? '⚡' :
               analysis.zone === 'low' ? '⚠️' : '🛑'}
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white mb-0.5">
                {analysis.recommendation}
              </p>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                {analysis.detail}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
