// SPDX-License-Identifier: MIT OR Apache-2.0
// Copyright (c) 2025 Pierre Fitness Intelligence

import { useMemo } from 'react';
import type { WellnessSummary } from '../../types/wellness';
import { useWaist } from '../../hooks/useWaist';
import { useNutrition } from '../../hooks/useNutrition';

interface BilanCorporelPageProps {
  data: WellnessSummary;
}

// ── Karvonen HR Zone calculation ──
function computeKarvonenZones(age: number, rhr: number) {
  const fcMax = 220 - age;
  const reserve = fcMax - rhr;
  return {
    fcMax,
    rhr,
    reserve,
    z1: { low: Math.round(rhr + reserve * 0.50), high: Math.round(rhr + reserve * 0.60), label: 'Z1 Récupération' },
    z2: { low: Math.round(rhr + reserve * 0.60), high: Math.round(rhr + reserve * 0.70), label: 'Z2 Endurance' },
    z3: { low: Math.round(rhr + reserve * 0.70), high: Math.round(rhr + reserve * 0.80), label: 'Z3 Tempo' },
    z4: { low: Math.round(rhr + reserve * 0.80), high: Math.round(rhr + reserve * 0.90), label: 'Z4 Seuil' },
    z5: { low: Math.round(rhr + reserve * 0.90), high: fcMax, label: 'Z5 VO2max' },
  };
}

// ── Training Readiness Score ──
function computeReadinessScore(
  bodyBattery: number | null,
  sleepScore: number | null,
  stressAvg: number | null,
  hrvRmssd: number | null,
  hrvAvg7d: number | null,
  weightTrend: number | null, // delta last 7d
  waistTrend: number | null,  // delta last 7d
): number {
  let score = 0;
  let totalWeight = 0;

  // Body Battery (30%)
  if (bodyBattery !== null) {
    score += (bodyBattery / 100) * 30;
    totalWeight += 30;
  }

  // Sleep score (25%)
  if (sleepScore !== null) {
    score += (sleepScore / 100) * 25;
    totalWeight += 25;
  }

  // Stress inverted (15%) - lower stress = better
  if (stressAvg !== null) {
    const stressNorm = Math.max(0, Math.min(100, 100 - stressAvg));
    score += (stressNorm / 100) * 15;
    totalWeight += 15;
  }

  // HRV vs 7d average (15%)
  if (hrvRmssd !== null && hrvAvg7d !== null && hrvAvg7d > 0) {
    const ratio = Math.min(1.5, hrvRmssd / hrvAvg7d);
    score += Math.min(15, ratio * 10);
    totalWeight += 15;
  } else if (hrvRmssd !== null) {
    // Without 7d avg, use absolute value (40ms = good for age 51)
    const norm = Math.min(1, hrvRmssd / 50);
    score += norm * 15;
    totalWeight += 15;
  }

  // Weight/waist trend (15%) - losing = good
  {
    let trendScore = 7.5; // neutral
    if (weightTrend !== null) {
      trendScore += weightTrend < 0 ? Math.min(3.75, Math.abs(weightTrend) * 2.5) : -Math.min(3.75, weightTrend * 2.5);
    }
    if (waistTrend !== null) {
      trendScore += waistTrend < 0 ? Math.min(3.75, Math.abs(waistTrend) * 2.5) : -Math.min(3.75, waistTrend * 2.5);
    }
    score += Math.max(0, Math.min(15, trendScore));
    totalWeight += 15;
  }

  // Normalize if not all data available
  if (totalWeight > 0 && totalWeight < 100) {
    score = (score / totalWeight) * 100;
  }

  return Math.round(Math.max(0, Math.min(100, score)));
}

function getReadinessColor(score: number): string {
  if (score > 70) return '#22c55e'; // green
  if (score >= 50) return '#eab308'; // yellow
  return '#ef4444'; // red
}

function getReadinessLabel(score: number): string {
  if (score > 70) return 'Prêt pour l\'entraînement';
  if (score >= 50) return 'Entraînement léger uniquement';
  return 'Repos recommandé';
}

// ── HRV Readiness Gauge ──
function HrvReadinessGauge({ rmssd, sdrr, avg7d }: {
  rmssd: number | null;
  sdrr: number | null;
  avg7d: number | null;
}) {
  if (rmssd === null) return null;

  // Position 0-100 based on RMSSD vs 7-day average
  let position: number;
  if (avg7d !== null && avg7d > 0) {
    const ratio = rmssd / avg7d;
    // ratio 0.6 → 0%, ratio 0.9 → 43%, ratio 1.0 → 57%, ratio 1.3 → 100%
    position = Math.max(0, Math.min(100, ((ratio - 0.6) / 0.7) * 100));
  } else {
    // Absolute scale (for ~50yo active male: 20ms=bad, 50ms=ok, 80ms+=great)
    position = Math.max(0, Math.min(100, ((rmssd - 20) / 60) * 100));
  }

  const zones = [
    { end: 20, color: '#ef4444', label: 'Repos' },
    { end: 40, color: '#f97316', label: 'Léger' },
    { end: 60, color: '#eab308', label: 'Modéré' },
    { end: 80, color: '#84cc16', label: 'Normal' },
    { end: 100, color: '#22c55e', label: 'Fonce !' },
  ];

  const currentZone = zones.find(z => position <= z.end) ?? zones[zones.length - 1];

  let interpretation: string;
  let emoji: string;
  if (position >= 80) {
    interpretation = "Votre systeme nerveux est bien repose. Seance intense possible, foncez !";
    emoji = "\u{1F680}";
  } else if (position >= 60) {
    interpretation = "Bonne recuperation. Entrainement normal recommande.";
    emoji = "\u2705";
  } else if (position >= 40) {
    interpretation = "Recuperation partielle. Privilegiez un effort modere.";
    emoji = "\u26A1";
  } else if (position >= 20) {
    interpretation = "Fatigue detectee. Entrainement leger uniquement.";
    emoji = "\u26A0\uFE0F";
  } else {
    interpretation = "Stress ou fatigue eleve. Repos recommande aujourd'hui.";
    emoji = "\u{1F6D1}";
  }

  // SDRR/RMSSD ratio interpretation
  let ratioInfo: string | null = null;
  if (sdrr !== null && rmssd > 0) {
    const ratio = sdrr / rmssd;
    if (ratio > 1.8) ratioInfo = "Dominance sympathique (stress)";
    else if (ratio > 1.2) ratioInfo = "Equilibre autonomique";
    else ratioInfo = "Dominance parasympathique (recuperation)";
  }

  return (
    <div className="card-dark !p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-zinc-400">Jauge VFC &mdash; Aptitude a l'effort</h3>
        <span
          className="text-xs px-2.5 py-1 rounded-full font-semibold"
          style={{ backgroundColor: currentZone.color + '25', color: currentZone.color }}
        >
          {currentZone.label}
        </span>
      </div>

      {/* Gauge bar */}
      <div className="relative h-8 mb-1">
        {/* Background segments */}
        <div className="absolute inset-0 flex rounded-full overflow-hidden gap-px">
          {zones.map((zone, i) => (
            <div
              key={i}
              className="flex-1 h-full"
              style={{ backgroundColor: zone.color + '30' }}
            />
          ))}
        </div>

        {/* Filled bar */}
        <div
          className="absolute top-0 left-0 h-full rounded-l-full transition-all duration-700 ease-out"
          style={{
            width: `${position}%`,
            background: `linear-gradient(90deg, #ef4444 0%, ${currentZone.color} 100%)`,
            borderTopRightRadius: position >= 98 ? '9999px' : '4px',
            borderBottomRightRadius: position >= 98 ? '9999px' : '4px',
          }}
        />

        {/* Cursor thumb */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 transition-all duration-700 ease-out z-10"
          style={{ left: `${position}%` }}
        >
          <div
            className="w-9 h-9 rounded-full bg-white shadow-lg shadow-black/50 border-[3px] flex items-center justify-center"
            style={{ borderColor: currentZone.color }}
          >
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: currentZone.color }} />
          </div>
        </div>
      </div>

      {/* Zone labels */}
      <div className="flex justify-between text-[10px] text-zinc-500 px-1 mb-5">
        {zones.map((zone) => (
          <span key={zone.label} style={{ color: position <= zone.end && position > (zone.end - 20) ? zone.color : undefined }}>
            {zone.label}
          </span>
        ))}
      </div>

      {/* Interpretation card */}
      <div className="flex items-start gap-3 bg-white/[0.04] rounded-xl p-4 border border-white/[0.06]">
        <div
          className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 text-xl"
          style={{ backgroundColor: currentZone.color + '20' }}
        >
          {emoji}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-white leading-snug">{interpretation}</p>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5">
            <span className="text-xs text-zinc-500">
              RMSSD: <span className="text-purple-400 font-mono font-medium">{rmssd} ms</span>
            </span>
            {sdrr !== null && (
              <span className="text-xs text-zinc-500">
                SDRR: <span className="text-indigo-400 font-mono font-medium">{sdrr} ms</span>
              </span>
            )}
            {avg7d !== null && (
              <span className="text-xs text-zinc-500">
                Moy 7j: <span className="text-zinc-300 font-mono font-medium">{Math.round(avg7d)} ms</span>
              </span>
            )}
          </div>
          {ratioInfo && (
            <p className="text-[11px] text-zinc-500 mt-1">
              Ratio SDRR/RMSSD: <span className="text-zinc-300">{(sdrr! / rmssd).toFixed(1)}</span> &mdash; {ratioInfo}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Sparkline component ──
function Sparkline({ values, color = '#06b6d4', height = 32, width = 120 }: {
  values: number[];
  color?: string;
  height?: number;
  width?: number;
}) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = width / (values.length - 1);
  const points = values.map((v, i) => `${i * step},${height - ((v - min) / range) * (height - 4) - 2}`).join(' ');
  const trend = values[values.length - 1] - values[0];
  const arrow = trend > 0 ? '↑' : trend < 0 ? '↓' : '→';
  const arrowColor = trend < 0 ? '#22c55e' : trend > 0 ? '#ef4444' : '#a1a1aa';

  return (
    <div className="flex items-center gap-1.5">
      <svg width={width} height={height} className="flex-shrink-0">
        <polyline fill="none" stroke={color} strokeWidth={1.5} points={points} />
      </svg>
      <span style={{ color: arrowColor }} className="text-sm font-bold">{arrow}</span>
    </div>
  );
}

// ── Stat Card ──
function StatCard({ icon, label, value, unit, qualifier, trend, color }: {
  icon: string;
  label: string;
  value: string;
  unit?: string;
  qualifier?: string;
  trend?: string;
  color: string;
}) {
  const qualColor = qualifier === 'Bon' ? 'text-green-400' : qualifier === 'Moyen' ? 'text-yellow-400' : qualifier === 'Mauvais' ? 'text-red-400' : 'text-zinc-400';
  return (
    <div className="card-dark !p-3 flex flex-col gap-1.5 min-w-0">
      <div className="flex items-center gap-2 text-xs text-zinc-400">
        <span>{icon}</span>
        <span className="truncate">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-xl font-bold" style={{ color }}>{value}</span>
        {unit && <span className="text-xs text-zinc-500">{unit}</span>}
      </div>
      <div className="flex items-center justify-between gap-1 min-w-0">
        {qualifier && <span className={`text-xs font-medium ${qualColor}`}>{qualifier}</span>}
        {trend && <span className="text-xs text-zinc-500 truncate">{trend}</span>}
      </div>
    </div>
  );
}

export default function BilanCorporelPage({ data }: BilanCorporelPageProps) {
  const { data: waistData } = useWaist();
  const { meals, dayTotal } = useNutrition();

  const bilan = useMemo(() => {
    const latest = data.latest;
    if (!latest) return null;

    const age = data.fitnessAge?.chronologicalAge ?? 51;
    const rhr = latest.heartRate.resting ?? data.fitnessAge?.rhr ?? 44;
    const zones = computeKarvonenZones(age, rhr);

    // HRV
    const hrvRmssd = latest.sleep?.hrv_rmssd ?? null;
    const hrvSdrr = latest.sleep?.hrv_sdrr ?? null;
    const hrvStatus = latest.sleep?.hrv_status ?? null;
    const hrvTrend = data.hrvTrend7d ?? [];
    const hrvAvg7d = hrvTrend.length > 0
      ? hrvTrend.reduce((sum, p) => sum + p.rmssd, 0) / hrvTrend.length
      : null;
    const sdrrAvg7d = hrvTrend.length > 0
      ? hrvTrend.filter(p => p.sdrr !== null).reduce((sum, p) => sum + (p.sdrr ?? 0), 0) / (hrvTrend.filter(p => p.sdrr !== null).length || 1)
      : null;

    // Weight trend
    const weightEntries = data.weightHistory?.entries ?? [];
    const weightTrend = weightEntries.length >= 2
      ? weightEntries[weightEntries.length - 1].weight_kg - weightEntries[Math.max(0, weightEntries.length - 8)].weight_kg
      : null;

    // Waist trend
    const waistEntries = waistData.entries ?? [];
    const waistTrend = waistEntries.length >= 2
      ? waistEntries[waistEntries.length - 1].waist_cm - waistEntries[Math.max(0, waistEntries.length - 8)].waist_cm
      : null;

    const readiness = computeReadinessScore(
      latest.bodyBattery.estimate,
      latest.sleep?.score ?? null,
      latest.stress.average,
      hrvRmssd,
      hrvAvg7d,
      weightTrend,
      waistTrend,
    );

    return {
      latest,
      age,
      rhr,
      zones,
      readiness,
      hrvRmssd,
      hrvSdrr,
      hrvStatus,
      hrvTrend,
      hrvAvg7d,
      sdrrAvg7d,
      weightTrend,
      waistTrend,
      waistEntries,
      weightEntries,
    };
  }, [data, waistData]);

  if (!bilan) {
    return (
      <div className="card-dark text-center py-16">
        <p className="text-zinc-400">Aucune donnée disponible pour le bilan corporel.</p>
      </div>
    );
  }

  const { latest, zones, readiness, hrvRmssd, hrvSdrr, hrvStatus, hrvTrend, hrvAvg7d, sdrrAvg7d, waistEntries } = bilan;

  // ── VTT Recommendation ──
  const getVttRec = () => {
    if (readiness > 80) return { duration: '1h30 – 2h30', zone: 'Z2-Z3', label: `${zones.z2.low}-${zones.z3.high} bpm`, warmup: '15 min Z1', effort: `Z2 Endurance (${zones.z2.low}-${zones.z2.high} bpm)`, cooldown: '10 min Z1' };
    if (readiness > 65) return { duration: '1h00 – 1h30', zone: 'Z2', label: `${zones.z2.low}-${zones.z2.high} bpm`, warmup: '15 min Z1', effort: `Z2 Endurance (${zones.z2.low}-${zones.z2.high} bpm)`, cooldown: '10 min Z1' };
    if (readiness >= 50) return { duration: '30 min – 1h', zone: 'Z1-Z2', label: `${zones.z1.low}-${zones.z2.high} bpm`, warmup: '10 min Z1', effort: `Z1-Z2 (${zones.z1.low}-${zones.z2.high} bpm)`, cooldown: '5 min Z1' };
    return { duration: 'Repos ou marche 30 min', zone: 'Z1', label: `< ${zones.z1.high} bpm`, warmup: '-', effort: 'Marche active ou repos complet', cooldown: '-' };
  };
  const vttRec = getVttRec();

  // ── Build sparkline data ──
  const last7 = data.days.slice(-7);
  const bbValues = last7.map(d => d.bodyBattery.estimate).filter((v): v is number => v !== null);
  const hrvValues = hrvTrend.map(p => p.rmssd);
  const sdrrValues = hrvTrend.map(p => p.sdrr).filter((v): v is number => v !== null);
  const rhrValues = last7.map(d => d.heartRate.resting).filter((v): v is number => v !== null);
  const stressValues = last7.map(d => d.stress.average).filter((v): v is number => v !== null);
  const sleepValues = last7.map(d => d.sleep?.score).filter((v): v is number => v !== null && v !== undefined);

  // ── Stat cards data ──
  const latestWeight = data.weightHistory?.latest;
  const vo2max = data.vo2max;
  const fitnessAge = data.fitnessAge;

  // Nutrition totals
  const allNutritionEntries = [...(meals?.breakfast ?? []), ...(meals?.lunch ?? []), ...(meals?.dinner ?? [])];
  const hasMeals = allNutritionEntries.length > 0;

  // Readiness gauge
  const readinessColor = getReadinessColor(readiness);
  const circumference = 2 * Math.PI * 54;
  const dashOffset = circumference - (readiness / 100) * circumference;

  return (
    <div className="space-y-6">
      {/* Section 1: Score de préparation */}
      <div className="card-dark !p-6">
        <h3 className="text-sm font-medium text-zinc-400 mb-4">Score de préparation (Training Readiness)</h3>
        <div className="flex flex-col sm:flex-row items-center gap-6">
          {/* Gauge */}
          <div className="relative w-36 h-36 flex-shrink-0">
            <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
              <circle cx="60" cy="60" r="54" fill="none" stroke="#27272a" strokeWidth="8" />
              <circle
                cx="60" cy="60" r="54" fill="none"
                stroke={readinessColor}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                className="transition-all duration-700"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold" style={{ color: readinessColor }}>{readiness}</span>
              <span className="text-xs text-zinc-500">/100</span>
            </div>
          </div>
          {/* Label */}
          <div className="text-center sm:text-left">
            <p className="text-lg font-semibold" style={{ color: readinessColor }}>
              {getReadinessLabel(readiness)}
            </p>
            <p className="text-sm text-zinc-400 mt-1">
              Calculé à partir de : Body Battery ({latest.bodyBattery.estimate ?? '--'}/100),
              Sommeil ({latest.sleep?.score ?? '--'}/100),
              Stress ({latest.stress.average !== null ? Math.round(latest.stress.average) : '--'}),
              VFC RMSSD ({hrvRmssd ?? '--'} ms), VFC SDRR ({hrvSdrr ?? '--'} ms),
              Tendance poids/taille
            </p>
          </div>
        </div>
      </div>

      {/* ── Section 1b: Jauge VFC ── */}
      <HrvReadinessGauge rmssd={hrvRmssd} sdrr={hrvSdrr} avg7d={hrvAvg7d} />

      {/* ── Section 2: Recommandation VTT ── */}
      <div className="card-dark !p-6">
        <h3 className="text-sm font-medium text-zinc-400 mb-4">Recommandation VTT</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Zones FC */}
          <div>
            <h4 className="text-xs font-medium text-zinc-500 mb-2">Zones FC (Karvonen) &mdash; Âge {bilan.age}, FC repos {bilan.rhr} bpm</h4>
            <div className="space-y-1">
              {[zones.z1, zones.z2, zones.z3, zones.z4, zones.z5].map((z, i) => {
                const isRecommended = vttRec.zone.includes(`Z${i + 1}`);
                const colors = ['#3b82f6', '#22c55e', '#eab308', '#f97316', '#ef4444'];
                return (
                  <div
                    key={z.label}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs transition-all ${isRecommended ? 'ring-1 ring-white/20 bg-white/5' : ''}`}
                  >
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: colors[i] }} />
                    <span className={`flex-1 ${isRecommended ? 'text-white font-semibold' : 'text-zinc-400'}`}>{z.label}</span>
                    <span className={`font-mono ${isRecommended ? 'text-white' : 'text-zinc-500'}`}>{z.low}-{z.high} bpm</span>
                    {isRecommended && <span className="text-[10px] text-pierre-cyan font-medium">← Recommandé</span>}
                  </div>
                );
              })}
            </div>
          </div>
          {/* Plan de sortie */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-white">{vttRec.duration}</span>
              <span className="px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: readinessColor + '20', color: readinessColor }}>
                {vttRec.zone}
              </span>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex gap-2">
                <span className="text-blue-400 w-24 flex-shrink-0">Echauffement</span>
                <span className="text-zinc-300">{vttRec.warmup}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-green-400 w-24 flex-shrink-0">Effort</span>
                <span className="text-zinc-300">{vttRec.effort}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-cyan-400 w-24 flex-shrink-0">Retour calme</span>
                <span className="text-zinc-300">{vttRec.cooldown}</span>
              </div>
            </div>
            <p className="text-xs text-zinc-500">
              FC cible : <span className="text-white font-mono">{vttRec.label}</span> &mdash; FC max : {zones.fcMax} bpm
            </p>
          </div>
        </div>
      </div>

      {/* Section 3: Grille constantes santé */}
      <div>
        <h3 className="text-sm font-medium text-zinc-400 mb-3">Constantes de santé</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {/* 1. Sommeil */}
          <StatCard
            icon="💤"
            label="Sommeil"
            value={latest.sleep?.score !== null && latest.sleep?.score !== undefined ? String(latest.sleep.score) : '--'}
            unit="/100"
            qualifier={latest.sleep?.score ? (latest.sleep.score >= 75 ? 'Bon' : latest.sleep.score >= 50 ? 'Moyen' : 'Mauvais') : undefined}
            trend={latest.sleep ? `${Math.floor(latest.sleep.duration_seconds / 3600)}h${String(Math.floor((latest.sleep.duration_seconds % 3600) / 60)).padStart(2, '0')}` : undefined}
            color="#818cf8"
          />
          {/* 2. Poids */}
          <StatCard
            icon="⚖️"
            label="Poids"
            value={latestWeight ? String(latestWeight.weight_kg) : '--'}
            unit="kg"
            qualifier={latestWeight && data.weightHistory?.goal_kg
              ? (latestWeight.weight_kg <= data.weightHistory.goal_kg ? 'Bon' : latestWeight.weight_kg <= data.weightHistory.goal_kg + 5 ? 'Moyen' : 'Mauvais')
              : undefined}
            trend={bilan.weightTrend !== null ? `${bilan.weightTrend > 0 ? '+' : ''}${bilan.weightTrend.toFixed(1)} kg/7j` : undefined}
            color="#f59e0b"
          />
          {/* 3. Tour de taille */}
          <StatCard
            icon="📏"
            label="Tour de taille"
            value={waistEntries.length > 0 ? String(waistEntries[waistEntries.length - 1].waist_cm) : '--'}
            unit="cm"
            qualifier={waistEntries.length > 0
              ? (waistEntries[waistEntries.length - 1].waist_cm < 94 ? 'Bon' : waistEntries[waistEntries.length - 1].waist_cm < 102 ? 'Moyen' : 'Mauvais')
              : undefined}
            trend={bilan.waistTrend !== null ? `${bilan.waistTrend > 0 ? '+' : ''}${bilan.waistTrend.toFixed(1)} cm` : undefined}
            color="#fb923c"
          />
          {/* 4. FC repos */}
          <StatCard
            icon="❤️"
            label="FC repos"
            value={latest.heartRate.resting !== null ? String(latest.heartRate.resting) : '--'}
            unit="bpm"
            qualifier={latest.heartRate.resting !== null
              ? (latest.heartRate.resting < 50 ? 'Bon' : latest.heartRate.resting < 65 ? 'Moyen' : 'Mauvais')
              : undefined}
            trend={data.hrTrend7d.length >= 2 ? `${data.hrTrend7d[data.hrTrend7d.length - 1].resting - data.hrTrend7d[0].resting > 0 ? '+' : ''}${data.hrTrend7d[data.hrTrend7d.length - 1].resting - data.hrTrend7d[0].resting} bpm/7j` : undefined}
            color="#ef4444"
          />
          {/* 5. VFC RMSSD */}
          <StatCard
            icon="📊"
            label="VFC (RMSSD)"
            value={hrvRmssd !== null ? String(hrvRmssd) : '--'}
            unit="ms"
            qualifier={hrvStatus === 'BALANCED' ? 'Bon' : hrvStatus === 'LOW' ? 'Mauvais' : hrvStatus === 'UNBALANCED' ? 'Moyen' : undefined}
            trend={hrvAvg7d !== null ? `Moy 7j: ${Math.round(hrvAvg7d)} ms` : undefined}
            color="#a855f7"
          />
          {/* 5b. VFC SDRR */}
          <StatCard
            icon="📈"
            label="VFC (SDRR)"
            value={hrvSdrr !== null ? String(hrvSdrr) : '--'}
            unit="ms"
            qualifier={hrvSdrr !== null ? (hrvSdrr >= 50 ? 'Bon' : hrvSdrr >= 30 ? 'Moyen' : 'Mauvais') : undefined}
            trend={sdrrAvg7d !== null && sdrrAvg7d > 0 ? `Moy 7j: ${Math.round(sdrrAvg7d)} ms` : undefined}
            color="#818cf8"
          />
          {/* 6. Stress */}
          <StatCard
            icon="🧠"
            label="Stress"
            value={latest.stress.average !== null ? String(Math.round(latest.stress.average)) : '--'}
            unit=""
            qualifier={latest.stress.average !== null
              ? (latest.stress.average < 30 ? 'Bon' : latest.stress.average < 50 ? 'Moyen' : 'Mauvais')
              : undefined}
            trend={`Repos ${latest.stress.rest_minutes}min, Haut ${latest.stress.high_minutes}min`}
            color="#f97316"
          />
          {/* 7. Body Battery */}
          <StatCard
            icon="🔋"
            label="Body Battery"
            value={latest.bodyBattery.estimate !== null ? String(latest.bodyBattery.estimate) : '--'}
            unit="/100"
            qualifier={latest.bodyBattery.estimate !== null
              ? (latest.bodyBattery.estimate >= 60 ? 'Bon' : latest.bodyBattery.estimate >= 30 ? 'Moyen' : 'Mauvais')
              : undefined}
            color="#22c55e"
          />
          {/* 8. VO2max */}
          <StatCard
            icon="🏃"
            label="VO2max"
            value={vo2max?.vo2max !== null && vo2max?.vo2max !== undefined ? String(Math.round(vo2max.vo2max)) : '--'}
            unit="ml/kg/min"
            qualifier={vo2max?.vo2max
              ? (vo2max.vo2max >= 45 ? 'Bon' : vo2max.vo2max >= 35 ? 'Moyen' : 'Mauvais')
              : undefined}
            trend={fitnessAge ? `Âge fitness: ${fitnessAge.fitnessAge} ans` : undefined}
            color="#06b6d4"
          />
          {/* 9. Nutrition */}
          {hasMeals && (
            <StatCard
              icon="🍽️"
              label="Nutrition"
              value={String(Math.round(dayTotal.calories))}
              unit="kcal"
              trend={`P${Math.round(dayTotal.protein)}g C${Math.round(dayTotal.carbs)}g L${Math.round(dayTotal.fat)}g`}
              color="#10b981"
            />
          )}
        </div>
      </div>

      {/* ── Section 4: Sparklines tendances 7j ── */}
      <div className="card-dark !p-5">
        <h3 className="text-sm font-medium text-zinc-400 mb-4">Tendances 7 jours</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {bbValues.length >= 2 && (
            <div className="flex items-center gap-3">
              <span className="text-xs text-zinc-500 w-24">Body Battery</span>
              <Sparkline values={bbValues} color="#22c55e" />
            </div>
          )}
          {hrvValues.length >= 2 && (
            <div className="flex items-center gap-3">
              <span className="text-xs text-zinc-500 w-24">VFC (RMSSD)</span>
              <Sparkline values={hrvValues} color="#a855f7" />
            </div>
          )}
          {sdrrValues.length >= 2 && (
            <div className="flex items-center gap-3">
              <span className="text-xs text-zinc-500 w-24">VFC (SDRR)</span>
              <Sparkline values={sdrrValues} color="#818cf8" />
            </div>
          )}
          {rhrValues.length >= 2 && (
            <div className="flex items-center gap-3">
              <span className="text-xs text-zinc-500 w-24">FC repos</span>
              <Sparkline values={rhrValues} color="#ef4444" />
            </div>
          )}
          {stressValues.length >= 2 && (
            <div className="flex items-center gap-3">
              <span className="text-xs text-zinc-500 w-24">Stress</span>
              <Sparkline values={stressValues} color="#f97316" />
            </div>
          )}
          {sleepValues.length >= 2 && (
            <div className="flex items-center gap-3">
              <span className="text-xs text-zinc-500 w-24">Sommeil</span>
              <Sparkline values={sleepValues} color="#818cf8" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
