// SPDX-License-Identifier: MIT OR Apache-2.0
// Copyright (c) 2025 Pierre Fitness Intelligence

import { useState, useCallback } from 'react';
import { formatDuration, SPORT_LABELS } from './sportUtils';
import type { ActivitySummary } from '../../types/wellness';

interface WeightEntry {
  date: string;
  time?: string;
  weight_kg: number;
  bmi?: number | null;
  body_fat_pct?: number | null;
  muscle_mass_kg?: number | null;
  bone_mass_kg?: number | null;
  body_water_pct?: number | null;
}

interface StatComparison {
  avg: number;
  min: number;
  max: number;
  thisRide: number;
  rank: number | null;
}

interface RideReport {
  ok: boolean;
  error?: string;
  generated_at?: string;
  activity?: ActivitySummary;
  weightComparison?: {
    before: WeightEntry | null;
    after: WeightEntry | null;
    diff_kg?: number;
    estimated_sweat_loss_ml?: number;
  } | null;
  historicalComparison?: {
    totalRides: number;
    comparedWith: number;
    stats: Record<string, StatComparison>;
  };
  vo2max?: { date: string; vo2max: number; maxMet?: number } | null;
  fitnessAge?: { chronologicalAge: number; fitnessAge: number; bodyFat?: number; bmi?: number; rhr?: number } | null;
  allRides?: { date: string; name: string; distance_km: number; avg_speed_kmh: number; elevation_gain_m: number; avg_hr: number | null; calories: number; grit: number | null; avg_flow: number | null; training_load: number | null }[];
  aiAnalysis?: {
    title: string;
    overallScore: number;
    overallVerdict: string;
    performanceAnalysis: string;
    weightAnalysis: string;
    comparisonAnalysis: string;
    technicalAnalysis: string;
    physiologicalAnalysis: string;
    calorieAnalysis: string;
    positives: string[];
    negatives: string[];
    recommendations: string[];
    recoveryPlan: string;
    nextRideAdvice: string;
  } | null;
}

function ScoreRing({ score }: { score: number }) {
  const r = 40;
  const c = 2 * Math.PI * r;
  const pct = score / 100;
  const color = score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : '#ef4444';
  return (
    <svg width="100" height="100" viewBox="0 0 100 100">
      <circle cx="50" cy="50" r={r} fill="none" stroke="#27272a" strokeWidth="8" />
      <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="8"
        strokeDasharray={`${pct * c} ${c}`} strokeLinecap="round"
        transform="rotate(-90 50 50)" className="transition-all duration-1000" />
      <text x="50" y="50" textAnchor="middle" dominantBaseline="central"
        className="fill-white text-2xl font-bold" style={{ fontSize: '24px' }}>{score}</text>
    </svg>
  );
}

function StatBar({ label, value, avg, rank }: { label: string; value: number; avg: number; rank: number | null }) {
  const ratio = avg > 0 ? (value / avg) * 100 : 0;
  const barColor = ratio >= 110 ? 'bg-emerald-500' : ratio >= 90 ? 'bg-cyan-500' : 'bg-amber-500';
  const rankLabel = rank !== null ? `top ${100 - rank}%` : '';
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-zinc-400">{label}</span>
        <span className="text-zinc-300">{value} <span className="text-zinc-500">/ moy {avg}</span> {rankLabel && <span className="text-emerald-400 ml-1">{rankLabel}</span>}</span>
      </div>
      <div className="h-2 bg-white/5 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${barColor} transition-all duration-700`} style={{ width: `${Math.min(ratio, 150) / 1.5}%` }} />
      </div>
    </div>
  );
}

function WeightComparisonCard({ data }: { data: NonNullable<RideReport['weightComparison']> }) {
  const { before, after, diff_kg, estimated_sweat_loss_ml } = data;
  return (
    <div className="card-dark space-y-4">
      <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide flex items-center gap-2">
        <span className="text-lg">&#9878;</span> Pesée avant / après
      </h3>
      <div className="grid grid-cols-2 gap-4">
        {before ? (
          <div className="bg-white/5 rounded-lg p-3 space-y-1">
            <div className="text-xs text-zinc-500 uppercase">Avant</div>
            <div className="text-xl font-bold text-white">{before.weight_kg} <span className="text-sm text-zinc-400">kg</span></div>
            <div className="text-xs text-zinc-400">{before.date} {before.time || ''}</div>
            {before.body_fat_pct && <div className="text-xs text-zinc-400">Graisse: {before.body_fat_pct}%</div>}
            {before.muscle_mass_kg && <div className="text-xs text-zinc-400">Muscle: {before.muscle_mass_kg} kg</div>}
            {before.body_water_pct && <div className="text-xs text-zinc-400">Eau: {before.body_water_pct}%</div>}
          </div>
        ) : <div className="bg-white/5 rounded-lg p-3 text-xs text-zinc-500">Pas de pesée avant</div>}
        {after ? (
          <div className="bg-white/5 rounded-lg p-3 space-y-1">
            <div className="text-xs text-zinc-500 uppercase">Après</div>
            <div className="text-xl font-bold text-white">{after.weight_kg} <span className="text-sm text-zinc-400">kg</span></div>
            <div className="text-xs text-zinc-400">{after.date} {after.time || ''}</div>
            {after.body_fat_pct && <div className="text-xs text-zinc-400">Graisse: {after.body_fat_pct}%</div>}
            {after.muscle_mass_kg && <div className="text-xs text-zinc-400">Muscle: {after.muscle_mass_kg} kg</div>}
            {after.body_water_pct && <div className="text-xs text-zinc-400">Eau: {after.body_water_pct}%</div>}
          </div>
        ) : <div className="bg-white/5 rounded-lg p-3 text-xs text-zinc-500">Pas de pesée après</div>}
      </div>
      {diff_kg !== undefined && (
        <div className="bg-white/5 rounded-lg p-3 flex items-center justify-between">
          <span className="text-sm text-zinc-300">Variation</span>
          <div className="text-right">
            <span className={`text-lg font-bold ${diff_kg < 0 ? 'text-amber-400' : 'text-emerald-400'}`}>{diff_kg > 0 ? '+' : ''}{diff_kg} kg</span>
            {estimated_sweat_loss_ml && (
              <div className="text-xs text-zinc-400">~{estimated_sweat_loss_ml} ml de sueur perdus</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function AnalysisSection({ icon, title, text, accent }: { icon: string; title: string; text: string; accent?: string }) {
  return (
    <div className="card-dark space-y-2">
      <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide flex items-center gap-2">
        <span className="text-lg">{icon}</span> {title}
      </h3>
      <p className={`text-sm leading-relaxed ${accent || 'text-zinc-300'}`}>{text}</p>
    </div>
  );
}

function BulletList({ items, color }: { items: string[]; color: 'green' | 'red' | 'cyan' }) {
  const colors = { green: 'text-emerald-400', red: 'text-red-400', cyan: 'text-cyan-400' };
  const dots = { green: 'bg-emerald-400', red: 'bg-red-400', cyan: 'bg-cyan-400' };
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2">
          <span className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${dots[color]}`} />
          <span className={`text-sm ${colors[color]}`}>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export default function RideReportPage() {
  const [report, setReport] = useState<RideReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers: HeadersInit = {};
      const csrfToken = localStorage.getItem('pierre_csrf_token');
      if (csrfToken) headers['X-CSRF-Token'] = csrfToken;

      const res = await fetch('/api/wellness/ride-report', {
        method: 'POST',
        headers,
        credentials: 'include',
      });
      const data = await res.json();
      if (data.ok) {
        setReport(data);
      } else {
        setError(data.error || 'Erreur lors de la génération du rapport');
      }
    } catch {
      setError('Impossible de contacter le serveur');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial state - show generate button
  if (!report && !loading) {
    return (
      <div className="space-y-6">
        <div className="card-dark text-center py-12 space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/10 flex items-center justify-center">
            <svg className="w-8 h-8 text-emerald-400" fill="currentColor" viewBox="0 0 24 24">
              <path d={`M15.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM5 12c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5-2.2-5-5-5zm0 8.5c-1.9 0-3.5-1.6-3.5-3.5s1.6-3.5 3.5-3.5 3.5 1.6 3.5 3.5-1.6 3.5-3.5 3.5zm5.8-10l2.4-2.4.8.8c1.3 1.3 3 2.1 5 2.1V9c-1.5 0-2.7-.6-3.6-1.5l-1.9-1.9c-.5-.4-1-.6-1.6-.6s-1.1.2-1.4.6L7.8 8.4c-.4.4-.6.9-.6 1.4 0 .6.2 1.1.6 1.4L11 14v5h2v-6.2l-2.2-2.3zM19 12c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5-2.2-5-5-5zm0 8.5c-1.9 0-3.5-1.6-3.5-3.5s1.6-3.5 3.5-3.5 3.5 1.6 3.5 3.5-1.6 3.5-3.5 3.5z`} />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-white">Rapport Sortie VTT</h3>
          <p className="text-sm text-zinc-400 max-w-md mx-auto">
            Analyse ultra-détaillée de ta dernière sortie : performance, poids avant/après,
            comparaison historique, VO2max, points forts et axes d'amélioration.
          </p>
          <button
            onClick={generateReport}
            className="mx-auto px-6 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Générer le rapport
          </button>
          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <div className="pierre-spinner" />
        <p className="text-sm text-zinc-400 animate-pulse">Analyse en cours... FC, poids, historique, IA coaching</p>
        <p className="text-xs text-zinc-500">Cela peut prendre 30-60 secondes</p>
      </div>
    );
  }

  if (!report || !report.activity) {
    return (
      <div className="card-dark text-center py-8">
        <p className="text-red-400">{error || 'Aucune donnée de rapport'}</p>
        <button onClick={generateReport} className="mt-4 text-sm text-cyan-400 hover:underline">Réessayer</button>
      </div>
    );
  }

  const { activity: act, weightComparison, historicalComparison, vo2max, fitnessAge, aiAnalysis, allRides } = report;
  const sportLabel = SPORT_LABELS[act.activityType] || act.activityType;

  return (
    <div className="space-y-4">
      {/* Header with score */}
      <div className="card-dark flex items-center gap-6">
        <div className="flex-shrink-0">
          {aiAnalysis ? <ScoreRing score={aiAnalysis.overallScore} /> : <ScoreRing score={0} />}
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          <h2 className="text-lg font-bold text-white truncate">
            {aiAnalysis?.title || act.name}
          </h2>
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 uppercase">{sportLabel}</span>
            <span>{act.date}</span>
            <span>{act.startTimeLocal}</span>
            {act.location && <span>- {act.location}</span>}
          </div>
          {aiAnalysis && <p className="text-sm text-zinc-300 mt-2">{aiAnalysis.overallVerdict}</p>}
        </div>
        <button onClick={generateReport} className="text-xs text-zinc-500 hover:text-cyan-400 transition-colors flex-shrink-0" title="Regénérer">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {/* Key metrics grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Distance', value: `${act.distance_km} km`, sub: `D+ ${act.elevation_gain_m}m` },
          { label: 'Durée', value: formatDuration(act.duration_s), sub: `mvt: ${formatDuration(act.moving_duration_s)}` },
          { label: 'Vitesse moy', value: `${act.avg_speed_kmh} km/h`, sub: `max: ${act.max_speed_kmh} km/h` },
          { label: 'FC moyenne', value: act.avg_hr ? `${act.avg_hr} bpm` : '-', sub: act.max_hr ? `max: ${act.max_hr} bpm` : '' },
          { label: 'Calories', value: `${act.calories} kcal`, sub: act.water_estimated_ml ? `eau: ~${act.water_estimated_ml} ml` : '' },
          { label: 'Training Load', value: act.training_load ? `${act.training_load}` : '-', sub: `TE aéro: ${act.aerobic_te || '-'}` },
          { label: 'Grit (technique)', value: act.grit ? `${act.grit}` : '-', sub: act.avg_flow ? `flow: ${act.avg_flow}` : '' },
          { label: 'Cadence', value: act.avg_cadence ? `${act.avg_cadence} rpm` : '-', sub: act.max_cadence ? `max: ${act.max_cadence} rpm` : '' },
        ].map((m, i) => (
          <div key={i} className="card-dark !p-3 space-y-1">
            <div className="text-[10px] text-zinc-500 uppercase">{m.label}</div>
            <div className="text-lg font-bold text-white">{m.value}</div>
            {m.sub && <div className="text-[10px] text-zinc-400">{m.sub}</div>}
          </div>
        ))}
      </div>

      {/* HR zones */}
      {act.hrZones && act.hrZones.some(z => z.seconds > 0) && (
        <div className="card-dark space-y-3">
          <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide">Zones FC</h3>
          <div className="space-y-1.5">
            {act.hrZones.filter(z => z.seconds > 0).map(z => {
              const total = act.hrZones.reduce((s, zz) => s + zz.seconds, 0);
              const pct = total > 0 ? (z.seconds / total) * 100 : 0;
              const colors = ['#71717A', '#3B82F6', '#22C55E', '#F59E0B', '#EF4444', '#DC2626', '#991B1B'];
              const names = ['Repos', 'Échauffement', 'Aérobie', 'Tempo', 'Seuil', 'VO2max', 'Anaérobie'];
              return (
                <div key={z.zone} className="flex items-center gap-2 text-xs">
                  <span className="w-20 text-zinc-400 text-right">Z{z.zone} {names[z.zone] || ''}</span>
                  <div className="flex-1 h-3 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: colors[z.zone] || '#666' }} />
                  </div>
                  <span className="w-16 text-zinc-300 text-right">{formatDuration(z.seconds)}</span>
                  <span className="w-10 text-zinc-500">{pct.toFixed(0)}%</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Weight comparison */}
      {weightComparison && <WeightComparisonCard data={weightComparison} />}

      {/* Historical comparison */}
      {historicalComparison && historicalComparison.comparedWith > 0 && (
        <div className="card-dark space-y-4">
          <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide flex items-center gap-2">
            <span className="text-lg">&#128202;</span> Comparaison avec {historicalComparison.comparedWith} sorties
          </h3>
          <div className="space-y-3">
            {Object.entries(historicalComparison.stats).map(([key, stat]) => {
              const labels: Record<string, string> = {
                distance: 'Distance (km)', duration: 'Durée (s)', speed: 'Vitesse (km/h)',
                heartRate: 'FC moy (bpm)', elevation: 'Dénivelé (m)', calories: 'Calories',
                grit: 'Grit', flow: 'Flow',
              };
              if (stat.avg === 0 && stat.thisRide === 0) return null;
              return (
                <StatBar key={key}
                  label={labels[key] || key}
                  value={Math.round(stat.thisRide * 10) / 10}
                  avg={stat.avg}
                  rank={stat.rank}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* VO2max & Fitness Age */}
      {(vo2max || fitnessAge) && (
        <div className="grid grid-cols-2 gap-3">
          {vo2max && (
            <div className="card-dark !p-3 space-y-1">
              <div className="text-[10px] text-zinc-500 uppercase">VO2max</div>
              <div className="text-2xl font-bold text-cyan-400">{vo2max.vo2max}</div>
              <div className="text-[10px] text-zinc-400">ml/kg/min ({vo2max.date})</div>
            </div>
          )}
          {fitnessAge && (
            <div className="card-dark !p-3 space-y-1">
              <div className="text-[10px] text-zinc-500 uppercase">Fitness Age</div>
              <div className="text-2xl font-bold text-emerald-400">{fitnessAge.fitnessAge} <span className="text-sm text-zinc-400">ans</span></div>
              <div className="text-[10px] text-zinc-400">Age réel: {fitnessAge.chronologicalAge} ans</div>
            </div>
          )}
        </div>
      )}

      {/* AI Analysis sections */}
      {aiAnalysis && (
        <>
          <AnalysisSection icon="&#127939;" title="Analyse de performance" text={aiAnalysis.performanceAnalysis} />
          <AnalysisSection icon="&#9878;" title="Analyse du poids" text={aiAnalysis.weightAnalysis} />
          <AnalysisSection icon="&#128202;" title="Comparaison historique" text={aiAnalysis.comparisonAnalysis} />
          <AnalysisSection icon="&#9881;" title="Analyse technique VTT" text={aiAnalysis.technicalAnalysis} />
          <AnalysisSection icon="&#129657;" title="Analyse physiologique" text={aiAnalysis.physiologicalAnalysis} />
          <AnalysisSection icon="&#128293;" title="Bilan calorique" text={aiAnalysis.calorieAnalysis} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="card-dark space-y-3">
              <h3 className="text-sm font-semibold text-emerald-400 uppercase tracking-wide">Points positifs</h3>
              <BulletList items={aiAnalysis.positives} color="green" />
            </div>
            <div className="card-dark space-y-3">
              <h3 className="text-sm font-semibold text-red-400 uppercase tracking-wide">Axes d'amélioration</h3>
              <BulletList items={aiAnalysis.negatives} color="red" />
            </div>
          </div>

          <div className="card-dark space-y-3">
            <h3 className="text-sm font-semibold text-cyan-400 uppercase tracking-wide">Recommandations</h3>
            <BulletList items={aiAnalysis.recommendations} color="cyan" />
          </div>

          <AnalysisSection icon="&#128164;" title="Plan de récupération" text={aiAnalysis.recoveryPlan} accent="text-emerald-300" />
          <AnalysisSection icon="&#127947;" title="Prochaine sortie" text={aiAnalysis.nextRideAdvice} accent="text-cyan-300" />
        </>
      )}

      {/* Recent rides table */}
      {allRides && allRides.length > 0 && (
        <div className="card-dark space-y-3">
          <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide">Historique des sorties</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-zinc-300">
              <thead>
                <tr className="text-zinc-500 border-b border-white/5">
                  <th className="text-left py-2 pr-2">Date</th>
                  <th className="text-left py-2 pr-2">Nom</th>
                  <th className="text-right py-2 pr-2">Dist</th>
                  <th className="text-right py-2 pr-2">Vit</th>
                  <th className="text-right py-2 pr-2">D+</th>
                  <th className="text-right py-2 pr-2">FC</th>
                  <th className="text-right py-2 pr-2">Cal</th>
                  <th className="text-right py-2">Grit</th>
                </tr>
              </thead>
              <tbody>
                {allRides.map((r, i) => (
                  <tr key={i} className={`border-b border-white/5 ${i === 0 ? 'bg-emerald-500/5 text-white font-medium' : ''}`}>
                    <td className="py-1.5 pr-2">{r.date}</td>
                    <td className="py-1.5 pr-2 max-w-[120px] truncate">{r.name}</td>
                    <td className="py-1.5 pr-2 text-right">{r.distance_km}</td>
                    <td className="py-1.5 pr-2 text-right">{r.avg_speed_kmh}</td>
                    <td className="py-1.5 pr-2 text-right">{r.elevation_gain_m}</td>
                    <td className="py-1.5 pr-2 text-right">{r.avg_hr || '-'}</td>
                    <td className="py-1.5 pr-2 text-right">{r.calories}</td>
                    <td className="py-1.5 text-right">{r.grit || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Generation timestamp */}
      {report.generated_at && (
        <p className="text-center text-xs text-zinc-600">
          Rapport généré le {new Date(report.generated_at).toLocaleString('fr-FR')}
        </p>
      )}
    </div>
  );
}
