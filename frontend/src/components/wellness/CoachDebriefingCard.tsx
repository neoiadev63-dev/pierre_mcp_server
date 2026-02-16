// SPDX-License-Identifier: MIT OR Apache-2.0
// Copyright (c) 2025 Pierre Fitness Intelligence
// ABOUTME: Coach debriefing card with Chart.js graphs replacing text walls.
// ABOUTME: Shows VTT performance trends, weight/composition, sleep phases, stress/recovery.

import { useState, useMemo } from 'react';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import type { ChartOptions } from 'chart.js';
import type { CoachDebriefing, WellnessSummary, ActivitySummary } from '../../types/wellness';
import { useChartResponsive, createResponsiveChartOptions } from '../../hooks/useChartResponsive';

interface CoachDebriefingCardProps {
  debriefing: CoachDebriefing;
  data: WellnessSummary;
}

const gridColor = 'rgba(255,255,255,0.05)';
const tickColor = '#71717a';
const labelColor = '#a1a1aa';

function fmtDate(d: string) {
  const parts = d.split('-');
  return `${parts[2]}/${parts[1]}`;
}

function fmtDuration(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${m}min`;
}

export default function CoachDebriefingCard({ debriefing, data }: CoachDebriefingCardProps) {
  const [expanded, setExpanded] = useState(false);
  const nt = debriefing.nextTraining;
  const chartConfig = useChartResponsive();

  // ---------- VTT Performance Data (last 30 cycling activities) ----------
  const cyclingData = useMemo(() => {
    const activities = (data.activityHistory || [])
      .filter((a: ActivitySummary) =>
        a.distance_km > 3 &&
        (a.sportType?.toLowerCase().includes('cycling') ||
         a.sportType?.toLowerCase().includes('mountain') ||
         a.sportType?.toLowerCase().includes('ride') ||
         a.activityType?.toLowerCase() === 'cycling' ||
         a.name?.toLowerCase().includes('vtt'))
      )
      .slice(0, 30)
      .reverse();

    if (activities.length < 2) return null;

    const labels = activities.map((a: ActivitySummary) => fmtDate(a.date));
    return {
      labels,
      activities,
      speed: activities.map((a: ActivitySummary) => a.avg_speed_kmh || 0),
      hr: activities.map((a: ActivitySummary) => a.avg_hr || null),
      elevation: activities.map((a: ActivitySummary) => a.elevation_gain_m || 0),
      distance: activities.map((a: ActivitySummary) => a.distance_km || 0),
    };
  }, [data.activityHistory]);

  // ---------- Weight / Body Composition ----------
  const weightData = useMemo(() => {
    const entries = data.weightHistory?.entries;
    if (!entries || entries.length < 2) return null;
    const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
    return {
      labels: sorted.map(e => fmtDate(e.date)),
      weight: sorted.map(e => e.weight_kg),
      fat: sorted.map(e => e.body_fat_pct),
      muscle: sorted.map(e => e.muscle_mass_kg),
    };
  }, [data.weightHistory]);

  // ---------- Sleep Phases (last 14 days) ----------
  const sleepData = useMemo(() => {
    const daysWithSleep = data.days
      .filter(d => d.sleep && d.sleep.duration_seconds > 0)
      .slice(-14);
    if (daysWithSleep.length < 2) return null;
    return {
      labels: daysWithSleep.map(d => fmtDate(d.date)),
      deep: daysWithSleep.map(d => Math.round((d.sleep!.deep_seconds || 0) / 60)),
      light: daysWithSleep.map(d => Math.round((d.sleep!.light_seconds || 0) / 60)),
      rem: daysWithSleep.map(d => Math.round((d.sleep!.rem_seconds || 0) / 60)),
      awake: daysWithSleep.map(d => Math.round((d.sleep!.awake_seconds || 0) / 60)),
      scores: daysWithSleep.map(d => d.sleep!.score || 0),
    };
  }, [data.days]);

  // ---------- Stress & Body Battery (all days) ----------
  const stressData = useMemo(() => {
    const days = data.days.filter(d => d.stress?.average != null);
    if (days.length < 2) return null;
    return {
      labels: days.map(d => fmtDate(d.date)),
      stress: days.map(d => d.stress.average || 0),
      battery: days.map(d => d.bodyBattery?.estimate || null),
    };
  }, [data.days]);

  // ---------- Latest sleep breakdown for doughnut ----------
  const latestSleep = useMemo(() => {
    const s = data.latest?.sleep;
    if (!s || s.duration_seconds === 0) return null;
    return {
      deep: Math.round(s.deep_seconds / 60),
      light: Math.round(s.light_seconds / 60),
      rem: Math.round(s.rem_seconds / 60),
      awake: Math.round(s.awake_seconds / 60),
      score: s.score,
      total: fmtDuration(s.duration_seconds),
    };
  }, [data.latest]);

  // ---------- Chart options (responsive) ----------
  const lineOpts = (yLabel: string, beginAtZero = false): ChartOptions<'line'> => createResponsiveChartOptions(chartConfig, {
    maintainAspectRatio: false,
    plugins: {
      legend: {
        ...chartConfig.legend,
        labels: {
          color: labelColor,
          boxWidth: chartConfig.isMobile ? 30 : 40,
          padding: chartConfig.padding,
          font: { size: chartConfig.fontSize.legend },
        },
      },
      tooltip: {
        backgroundColor: '#1e1e2e',
        titleColor: '#fff',
        bodyColor: '#d4d4d8',
        borderColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        padding: chartConfig.padding,
        titleFont: { size: chartConfig.fontSize.tooltip },
        bodyFont: { size: chartConfig.fontSize.tooltip },
      },
    },
    scales: {
      x: {
        ticks: {
          color: tickColor,
          maxRotation: chartConfig.isMobile ? 45 : 45,
          minRotation: chartConfig.isMobile ? 45 : 0,
          font: { size: chartConfig.fontSize.axis },
        },
        grid: { color: gridColor },
      },
      y: {
        beginAtZero,
        title: {
          display: !!yLabel,
          text: yLabel,
          color: labelColor,
          font: { size: chartConfig.fontSize.axis },
        },
        ticks: {
          color: tickColor,
          font: { size: chartConfig.fontSize.axis },
        },
        grid: { color: gridColor },
      },
    },
  }) as ChartOptions<'line'>;

  const barOpts: ChartOptions<'bar'> = createResponsiveChartOptions(chartConfig, {
    maintainAspectRatio: false,
    plugins: {
      legend: {
        ...chartConfig.legend,
        labels: {
          color: labelColor,
          boxWidth: chartConfig.isMobile ? 30 : 40,
          padding: chartConfig.padding,
          font: { size: chartConfig.fontSize.legend },
        },
      },
      tooltip: {
        backgroundColor: '#1e1e2e',
        titleColor: '#fff',
        bodyColor: '#d4d4d8',
        borderColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        padding: chartConfig.padding,
        titleFont: { size: chartConfig.fontSize.tooltip },
        bodyFont: { size: chartConfig.fontSize.tooltip },
        callbacks: {
          label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y} min`,
        },
      },
    },
    scales: {
      x: {
        stacked: true,
        ticks: {
          color: tickColor,
          font: { size: chartConfig.fontSize.axis },
          maxRotation: chartConfig.isMobile ? 45 : 0,
          minRotation: chartConfig.isMobile ? 45 : 0,
        },
        grid: { color: gridColor },
      },
      y: {
        stacked: true,
        beginAtZero: true,
        title: {
          display: true,
          text: 'Minutes',
          color: labelColor,
          font: { size: chartConfig.fontSize.axis },
        },
        ticks: {
          color: tickColor,
          font: { size: chartConfig.fontSize.axis },
        },
        grid: { color: gridColor },
      },
    },
  }) as ChartOptions<'bar'>;

  const doughnutOpts: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: true,
    cutout: '65%',
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1e1e2e',
        titleColor: '#fff',
        bodyColor: '#d4d4d8',
        borderColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        padding: chartConfig.padding,
        titleFont: { size: chartConfig.fontSize.tooltip },
        bodyFont: { size: chartConfig.fontSize.tooltip },
        callbacks: {
          label: (ctx) => `${ctx.label}: ${ctx.parsed} min`,
        },
      },
    },
  };

  return (
    <div className="card-dark !p-0 overflow-hidden border border-emerald-500/30">
      {/* Header */}
      <div className="px-5 py-3 bg-gradient-to-r from-emerald-500/20 via-pierre-cyan/10 to-transparent flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-pierre-cyan flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Dashboard Performance</h3>
            <span className="text-[10px] text-zinc-500">
              {new Date(debriefing.generated_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-zinc-400 hover:text-white transition-colors p-1"
        >
          <svg className={`w-5 h-5 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {expanded && (
        <div className="px-5 py-4 space-y-6">

          {/* ===== 1. VTT Performance Trend ===== */}
          {cyclingData && (
            <div>
              <h4 className="text-xs font-semibold text-pierre-activity uppercase tracking-wider mb-3 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                Performance VTT (30 dernières sorties)
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                {/* Speed + HR */}
                <div className="bg-white/[0.03] rounded-xl p-3 border border-white/5">
                  <div className="h-52">
                    <Line
                      data={{
                        labels: cyclingData.labels,
                        datasets: [
                          {
                            label: 'Vitesse moy (km/h)',
                            data: cyclingData.speed,
                            borderColor: '#4ADE80',
                            backgroundColor: 'rgba(74,222,128,0.1)',
                            fill: true,
                            tension: 0.3,
                            pointRadius: 2,
                            pointHoverRadius: 5,
                          },
                          {
                            label: 'FC moy (bpm)',
                            data: cyclingData.hr,
                            borderColor: '#EF4444',
                            backgroundColor: 'transparent',
                            borderDash: [4, 2],
                            tension: 0.3,
                            pointRadius: 2,
                            pointHoverRadius: 5,
                            yAxisID: 'y1',
                          },
                        ],
                      }}
                      options={{
                        ...lineOpts('km/h'),
                        scales: {
                          ...lineOpts('km/h').scales,
                          y1: {
                            position: 'right',
                            title: { display: true, text: 'bpm', color: labelColor, font: { size: 11 } },
                            ticks: { color: '#EF4444', font: { size: 10 } },
                            grid: { drawOnChartArea: false },
                          },
                        },
                      }}
                    />
                  </div>
                </div>
                {/* Elevation + Distance */}
                <div className="bg-white/[0.03] rounded-xl p-3 border border-white/5">
                  <div className="h-52">
                    <Bar
                      data={{
                        labels: cyclingData.labels,
                        datasets: [
                          {
                            label: 'D+ (m)',
                            data: cyclingData.elevation,
                            backgroundColor: 'rgba(139,92,246,0.6)',
                            borderColor: '#8B5CF6',
                            borderWidth: 1,
                            borderRadius: 3,
                          },
                          {
                            label: 'Distance (km)',
                            data: cyclingData.distance,
                            backgroundColor: 'rgba(34,211,238,0.4)',
                            borderColor: '#22D3EE',
                            borderWidth: 1,
                            borderRadius: 3,
                          },
                        ],
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: { position: 'bottom', labels: { color: labelColor, boxWidth: 12, padding: 10, font: { size: 11 } } },
                          tooltip: { backgroundColor: '#1e1e2e', titleColor: '#fff', bodyColor: '#d4d4d8', borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1 },
                        },
                        scales: {
                          x: { ticks: { color: tickColor, maxRotation: 45, font: { size: 10 } }, grid: { color: gridColor } },
                          y: { beginAtZero: true, ticks: { color: tickColor, font: { size: 10 } }, grid: { color: gridColor } },
                        },
                      }}
                    />
                  </div>
                </div>
              </div>
              {/* AI summary condensed */}
              {debriefing.activityAnalysis && (
                <p className="text-xs text-zinc-400 mt-2 italic leading-relaxed">{debriefing.activityAnalysis}</p>
              )}
            </div>
          )}

          {/* ===== 2. Weight & Body Composition ===== */}
          {weightData && (
            <div>
              <h4 className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" /></svg>
                Poids & Composition Corporelle
              </h4>
              <div className="bg-white/[0.03] rounded-xl p-3 border border-white/5">
                <div className="h-52">
                  <Line
                    data={{
                      labels: weightData.labels,
                      datasets: [
                        {
                          label: 'Poids (kg)',
                          data: weightData.weight,
                          borderColor: '#F59E0B',
                          backgroundColor: 'rgba(245,158,11,0.1)',
                          fill: true,
                          tension: 0.3,
                          pointRadius: 3,
                          pointHoverRadius: 6,
                        },
                        ...(weightData.fat.some(v => v != null) ? [{
                          label: 'Masse grasse (%)',
                          data: weightData.fat,
                          borderColor: '#EF4444',
                          borderDash: [4, 2],
                          tension: 0.3,
                          pointRadius: 2,
                          pointHoverRadius: 5,
                          yAxisID: 'y1' as const,
                        }] : []),
                        ...(weightData.muscle.some(v => v != null) ? [{
                          label: 'Masse musculaire (kg)',
                          data: weightData.muscle,
                          borderColor: '#4ADE80',
                          borderDash: [6, 3],
                          tension: 0.3,
                          pointRadius: 2,
                          pointHoverRadius: 5,
                          yAxisID: 'y1' as const,
                        }] : []),
                      ],
                    }}
                    options={{
                      ...lineOpts('kg'),
                      scales: {
                        ...lineOpts('kg').scales,
                        ...(weightData.fat.some(v => v != null) ? {
                          y1: {
                            position: 'right' as const,
                            title: { display: true, text: '% / kg', color: labelColor, font: { size: 11 } },
                            ticks: { color: tickColor, font: { size: 10 } },
                            grid: { drawOnChartArea: false },
                          },
                        } : {}),
                      },
                    }}
                  />
                </div>
              </div>
              {debriefing.weightAnalysis && (
                <p className="text-xs text-zinc-400 mt-2 italic leading-relaxed">{debriefing.weightAnalysis}</p>
              )}
            </div>
          )}

          {/* ===== 3. Sleep Phases ===== */}
          {sleepData && (
            <div>
              <h4 className="text-xs font-semibold text-pierre-recovery uppercase tracking-wider mb-3 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
                Phases de Sommeil (14 dernières nuits)
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
                {/* Stacked bar chart */}
                <div className="md:col-span-2 bg-white/[0.03] rounded-xl p-3 border border-white/5">
                  <div className="h-52">
                    <Bar
                      data={{
                        labels: sleepData.labels,
                        datasets: [
                          { label: 'Profond', data: sleepData.deep, backgroundColor: '#6366F1', borderRadius: 2 },
                          { label: 'REM', data: sleepData.rem, backgroundColor: '#C084FC', borderRadius: 2 },
                          { label: 'Léger', data: sleepData.light, backgroundColor: '#818CF8', borderRadius: 2 },
                          { label: 'Éveil', data: sleepData.awake, backgroundColor: '#EF4444', borderRadius: 2 },
                        ],
                      }}
                      options={barOpts}
                    />
                  </div>
                </div>
                {/* Last night doughnut */}
                {latestSleep && (
                  <div className="bg-white/[0.03] rounded-xl p-3 border border-white/5 flex flex-col items-center justify-center">
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Dernière nuit</span>
                    <div className="w-32 h-32 relative">
                      <Doughnut
                        data={{
                          labels: ['Profond', 'REM', 'Léger', 'Éveil'],
                          datasets: [{
                            data: [latestSleep.deep, latestSleep.rem, latestSleep.light, latestSleep.awake],
                            backgroundColor: ['#6366F1', '#C084FC', '#818CF8', '#EF4444'],
                            borderWidth: 0,
                          }],
                        }}
                        options={doughnutOpts}
                      />
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-lg font-bold text-white">{latestSleep.score ?? '—'}</span>
                        <span className="text-[9px] text-zinc-400">{latestSleep.total}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 mt-2 text-[10px]">
                      <span className="text-indigo-400">Profond: {latestSleep.deep}m</span>
                      <span className="text-purple-400">REM: {latestSleep.rem}m</span>
                      <span className="text-indigo-300">Léger: {latestSleep.light}m</span>
                      <span className="text-red-400">Éveil: {latestSleep.awake}m</span>
                    </div>
                  </div>
                )}
              </div>
              {debriefing.sleepAnalysis && (
                <p className="text-xs text-zinc-400 mt-2 italic leading-relaxed">{debriefing.sleepAnalysis}</p>
              )}
            </div>
          )}

          {/* ===== 4. Stress & Body Battery ===== */}
          {stressData && (
            <div>
              <h4 className="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                Stress & Body Battery
              </h4>
              <div className="bg-white/[0.03] rounded-xl p-3 border border-white/5">
                <div className="h-44">
                  <Line
                    data={{
                      labels: stressData.labels,
                      datasets: [
                        {
                          label: 'Stress moyen',
                          data: stressData.stress,
                          borderColor: '#EF4444',
                          backgroundColor: 'rgba(239,68,68,0.08)',
                          fill: true,
                          tension: 0.3,
                          pointRadius: 2,
                        },
                        {
                          label: 'Body Battery',
                          data: stressData.battery,
                          borderColor: '#22D3EE',
                          backgroundColor: 'rgba(34,211,238,0.08)',
                          fill: true,
                          tension: 0.3,
                          pointRadius: 2,
                          yAxisID: 'y1',
                        },
                      ],
                    }}
                    options={{
                      ...lineOpts('Stress'),
                      scales: {
                        x: { ticks: { color: tickColor, maxRotation: 45, font: { size: 10 } }, grid: { color: gridColor } },
                        y: { beginAtZero: true, max: 100, title: { display: true, text: 'Stress', color: '#EF4444', font: { size: 11 } }, ticks: { color: '#EF4444', font: { size: 10 } }, grid: { color: gridColor } },
                        y1: { position: 'right', beginAtZero: true, max: 100, title: { display: true, text: 'Battery', color: '#22D3EE', font: { size: 11 } }, ticks: { color: '#22D3EE', font: { size: 10 } }, grid: { drawOnChartArea: false } },
                      },
                    }}
                  />
                </div>
              </div>
              {debriefing.stressRecovery && (
                <p className="text-xs text-zinc-400 mt-2 italic leading-relaxed">{debriefing.stressRecovery}</p>
              )}
            </div>
          )}

          {/* ===== 5. Key Metrics Summary Row ===== */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {data.vo2max && (
              <div className="bg-white/[0.03] rounded-xl p-3 border border-white/5 text-center">
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider">VO2max</span>
                <div className="text-2xl font-bold text-pierre-cyan mt-1">{data.vo2max.vo2max}</div>
                <span className="text-[10px] text-zinc-500">mL/kg/min</span>
              </div>
            )}
            {data.fitnessAge && (
              <div className="bg-white/[0.03] rounded-xl p-3 border border-white/5 text-center">
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Age Fitness</span>
                <div className="text-2xl font-bold text-pierre-activity mt-1">{data.fitnessAge.fitnessAge}</div>
                <span className="text-[10px] text-zinc-500">ans (chrono: {data.fitnessAge.chronologicalAge})</span>
              </div>
            )}
            {data.weeklyIntensity && (
              <div className="bg-white/[0.03] rounded-xl p-3 border border-white/5 text-center">
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Min. Intensives</span>
                <div className="text-2xl font-bold text-pierre-violet mt-1">{data.weeklyIntensity.total}</div>
                <span className="text-[10px] text-zinc-500">/ {data.weeklyIntensity.goal} min objectif</span>
              </div>
            )}
            {data.hrTrend7d && data.hrTrend7d.length > 0 && (
              <div className="bg-white/[0.03] rounded-xl p-3 border border-white/5 text-center">
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider">FC Repos</span>
                <div className="text-2xl font-bold text-red-400 mt-1">{data.hrTrend7d[data.hrTrend7d.length - 1].resting}</div>
                <span className="text-[10px] text-zinc-500">bpm (moy 7j: {Math.round(data.hrTrend7d.reduce((s, p) => s + p.resting, 0) / data.hrTrend7d.length)})</span>
              </div>
            )}
          </div>

          {/* ===== 6. Next Training ===== */}
          <div className="p-4 rounded-xl bg-white/[0.04] border border-white/5">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-7 h-7 rounded-lg bg-pierre-activity/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-4 h-4 text-pierre-activity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="flex-1">
                <span className="text-xs font-semibold text-pierre-activity uppercase tracking-wider">Prochain Entraînement</span>
                <div className="flex items-center gap-2 flex-wrap mt-1">
                  <span className="text-xs px-2.5 py-1 rounded-full bg-pierre-activity/20 text-pierre-activity font-medium">
                    {nt.type.replace(/_/g, ' ')}
                  </span>
                  {nt.duration_min > 0 && (
                    <span className="text-xs px-2.5 py-1 rounded-full bg-white/10 text-white font-medium">
                      {nt.duration_min} min
                    </span>
                  )}
                  {nt.hr_target_bpm && (
                    <span className="text-xs px-2.5 py-1 rounded-full bg-red-500/20 text-red-300 font-bold">
                      {nt.hr_target_bpm}
                    </span>
                  )}
                  {nt.recommended_date && (
                    <span className="text-xs px-2.5 py-1 rounded-full bg-zinc-500/20 text-zinc-300">
                      {nt.recommended_date}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <p className="text-sm text-zinc-300 mb-3">{nt.rationale}</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {nt.warmup && (
                <div className="px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <span className="text-[10px] text-blue-400 uppercase font-semibold tracking-wider">Echauffement</span>
                  <p className="text-xs text-zinc-300 mt-1">{nt.warmup}</p>
                </div>
              )}
              {nt.main_set && (
                <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
                  <span className="text-[10px] text-red-400 uppercase font-semibold tracking-wider">Effort principal</span>
                  <p className="text-xs text-zinc-300 mt-1">{nt.main_set}</p>
                </div>
              )}
              {nt.cooldown && (
                <div className="px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20">
                  <span className="text-[10px] text-green-400 uppercase font-semibold tracking-wider">Retour au calme</span>
                  <p className="text-xs text-zinc-300 mt-1">{nt.cooldown}</p>
                </div>
              )}
            </div>
          </div>

          {/* ===== 7. AI Insights (condensed) ===== */}
          {(debriefing.hydrationPlan || debriefing.nutritionPlan || debriefing.fitnessAssessment) && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {debriefing.hydrationPlan && (
                <div className="bg-white/[0.03] rounded-xl p-3 border border-blue-500/20">
                  <span className="text-[10px] text-blue-400 uppercase font-semibold tracking-wider flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                    Hydratation
                  </span>
                  <p className="text-xs text-zinc-300 mt-1.5 leading-relaxed">{debriefing.hydrationPlan}</p>
                </div>
              )}
              {debriefing.nutritionPlan && (
                <div className="bg-white/[0.03] rounded-xl p-3 border border-pierre-nutrition/20">
                  <span className="text-[10px] text-pierre-nutrition uppercase font-semibold tracking-wider flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" /></svg>
                    Nutrition
                  </span>
                  <p className="text-xs text-zinc-300 mt-1.5 leading-relaxed">{debriefing.nutritionPlan}</p>
                </div>
              )}
              {debriefing.fitnessAssessment && (
                <div className="bg-white/[0.03] rounded-xl p-3 border border-red-500/20">
                  <span className="text-[10px] text-red-400 uppercase font-semibold tracking-wider flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                    Condition Physique
                  </span>
                  <p className="text-xs text-zinc-300 mt-1.5 leading-relaxed">{debriefing.fitnessAssessment}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
