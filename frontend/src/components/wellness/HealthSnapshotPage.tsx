// SPDX-License-Identifier: MIT OR Apache-2.0
// Copyright (c) 2025 Pierre Fitness Intelligence

import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { WellnessSummary, WellnessDay } from '../../types/wellness';

interface HealthSnapshotPageProps {
  data: WellnessSummary;
}

interface HealthRow {
  date: string;
  title: string;
  sleepDuration: number;
  hrAvg: number | null;
  spo2Avg: number | null;
  respirationAvg: number | null;
  stressAvg: number | null;
  hrvRmssd: number | null;
  hrvSdrr: number | null;
}

const PAGE_SIZE = 20;

function formatSleepDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h${m.toString().padStart(2, '0')}`;
}

function buildRows(days: WellnessDay[]): HealthRow[] {
  return days
    .filter(d => d.sleep)
    .map(d => ({
      date: d.date,
      title: `Nuit du ${new Date(d.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`,
      sleepDuration: d.sleep!.duration_seconds,
      hrAvg: d.sleep!.hr_avg,
      spo2Avg: d.sleep!.spo2_avg,
      respirationAvg: d.sleep!.respiration_avg,
      stressAvg: d.stress.average,
      hrvRmssd: d.sleep!.hrv_rmssd ?? null,
      hrvSdrr: d.sleep!.hrv_sdrr ?? null,
    }))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

// ── Compact HRV Gauge for Snapshot page ──
function HrvGaugeCompact({ rmssd, sdrr, avg7d }: {
  rmssd: number | null;
  sdrr: number | null;
  avg7d: number | null;
}) {
  if (rmssd === null) return null;

  let position: number;
  if (avg7d !== null && avg7d > 0) {
    const ratio = rmssd / avg7d;
    position = Math.max(0, Math.min(100, ((ratio - 0.6) / 0.7) * 100));
  } else {
    position = Math.max(0, Math.min(100, ((rmssd - 20) / 60) * 100));
  }

  const zones = [
    { end: 20, color: '#ef4444', label: 'Repos' },
    { end: 40, color: '#f97316', label: 'Leger' },
    { end: 60, color: '#eab308', label: 'Modere' },
    { end: 80, color: '#84cc16', label: 'Normal' },
    { end: 100, color: '#22c55e', label: 'Fonce !' },
  ];

  const currentZone = zones.find(z => position <= z.end) ?? zones[zones.length - 1];

  let interpretation: string;
  let emoji: string;
  if (position >= 80) {
    interpretation = "Systeme nerveux repose \u2014 seance intense possible !";
    emoji = "\u{1F680}";
  } else if (position >= 60) {
    interpretation = "Bonne recuperation \u2014 entrainement normal";
    emoji = "\u2705";
  } else if (position >= 40) {
    interpretation = "Recuperation partielle \u2014 effort modere";
    emoji = "\u26A1";
  } else if (position >= 20) {
    interpretation = "Fatigue detectee \u2014 entrainement leger";
    emoji = "\u26A0\uFE0F";
  } else {
    interpretation = "Stress eleve \u2014 repos recommande";
    emoji = "\u{1F6D1}";
  }

  return (
    <div className="card-dark !p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-medium text-zinc-400">Aptitude a l'effort (VFC)</h3>
        <span
          className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
          style={{ backgroundColor: currentZone.color + '25', color: currentZone.color }}
        >
          {currentZone.label}
        </span>
      </div>

      {/* Gauge bar */}
      <div className="relative h-6 mb-1">
        <div className="absolute inset-0 flex rounded-full overflow-hidden gap-px">
          {zones.map((zone, i) => (
            <div key={i} className="flex-1 h-full" style={{ backgroundColor: zone.color + '30' }} />
          ))}
        </div>
        <div
          className="absolute top-0 left-0 h-full rounded-l-full transition-all duration-700 ease-out"
          style={{
            width: `${position}%`,
            background: `linear-gradient(90deg, #ef4444 0%, ${currentZone.color} 100%)`,
            borderTopRightRadius: position >= 98 ? '9999px' : '4px',
            borderBottomRightRadius: position >= 98 ? '9999px' : '4px',
          }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 transition-all duration-700 ease-out z-10"
          style={{ left: `${position}%` }}
        >
          <div
            className="w-7 h-7 rounded-full bg-white shadow-lg shadow-black/50 border-[3px] flex items-center justify-center"
            style={{ borderColor: currentZone.color }}
          >
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: currentZone.color }} />
          </div>
        </div>
      </div>

      {/* Zone labels */}
      <div className="flex justify-between text-[9px] text-zinc-500 px-1 mb-3">
        {zones.map((zone) => (
          <span key={zone.label} style={{ color: position <= zone.end && position > (zone.end - 20) ? zone.color : undefined }}>
            {zone.label}
          </span>
        ))}
      </div>

      {/* Interpretation */}
      <div className="flex items-center gap-2.5 bg-white/[0.04] rounded-lg p-2.5 border border-white/[0.06]">
        <span className="text-lg flex-shrink-0">{emoji}</span>
        <div className="min-w-0">
          <p className="text-xs font-medium text-white">{interpretation}</p>
          <p className="text-[10px] text-zinc-500 mt-0.5">
            RMSSD: <span className="text-purple-400 font-mono">{rmssd} ms</span>
            {sdrr !== null && <>{' \u00B7 '}SDRR: <span className="text-indigo-400 font-mono">{sdrr} ms</span></>}
            {avg7d !== null && <>{' \u00B7 '}Moy 7j: <span className="text-zinc-300 font-mono">{Math.round(avg7d)} ms</span></>}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function HealthSnapshotPage({ data }: HealthSnapshotPageProps) {
  const { t } = useTranslation();
  const [page, setPage] = useState(0);

  const rows = useMemo(() => buildRows(data.days), [data.days]);
  const totalPages = Math.ceil(rows.length / PAGE_SIZE);
  const pageRows = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Latest HRV for gauge
  const latestRmssd = data.latest?.sleep?.hrv_rmssd ?? null;
  const latestSdrr = data.latest?.sleep?.hrv_sdrr ?? null;
  const hrvTrend = data.hrvTrend7d ?? [];
  const hrvAvg7d = hrvTrend.length > 0
    ? hrvTrend.reduce((sum, p) => sum + p.rmssd, 0) / hrvTrend.length
    : null;

  if (rows.length === 0) {
    return (
      <div className="card-dark text-center py-16">
        <svg className="w-12 h-12 mx-auto text-zinc-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
        <h3 className="text-lg font-medium text-white mb-2">{t('wellness.health.noData')}</h3>
        <p className="text-sm text-zinc-400 max-w-md mx-auto">
          Les aperçus santé sont générés à partir des données de sommeil. Portez votre montre la nuit pour obtenir des données.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* HRV Gauge */}
      <HrvGaugeCompact rmssd={latestRmssd} sdrr={latestSdrr} avg7d={hrvAvg7d} />

      {/* Header */}
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-medium text-white">{t('wellness.health.title')}</h3>
        <div className="group relative">
          <svg className="w-4 h-4 text-zinc-500 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="absolute left-0 top-6 z-10 hidden group-hover:block w-72 p-3 bg-zinc-800 border border-white/10 rounded-lg shadow-xl text-xs text-zinc-300">
            Les aperçus santé combinent données de sommeil et Health Snapshots Garmin.
            La jauge VFC indique votre aptitude a l'effort en comparant votre RMSSD du jour a votre moyenne 7 jours.
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card-dark !p-0 overflow-hidden border border-white/10">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-zinc-500 border-b border-white/10">
                <th className="text-left py-2.5 px-4 font-medium">Date</th>
                <th className="text-right py-2.5 px-3 font-medium">Sommeil</th>
                <th className="text-right py-2.5 px-3 font-medium">{t('wellness.health.avgHr')}</th>
                <th className="text-right py-2.5 px-3 font-medium">{t('wellness.health.avgSpo2')}</th>
                <th className="text-right py-2.5 px-3 font-medium">{t('wellness.health.avgResp')}</th>
                <th className="text-right py-2.5 px-3 font-medium">{t('wellness.health.avgStress')}</th>
                <th className="text-right py-2.5 px-3 font-medium">RMSSD</th>
                <th className="text-right py-2.5 px-3 font-medium">SDRR</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row) => (
                <tr key={row.date} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                  <td className="py-2.5 px-4 text-zinc-300 whitespace-nowrap">
                    {new Date(row.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
                  </td>
                  <td className="py-2.5 px-3 text-right text-zinc-300">{formatSleepDuration(row.sleepDuration)}</td>
                  <td className="py-2.5 px-3 text-right">
                    {row.hrAvg !== null ? (
                      <span className="text-red-400">{Math.round(row.hrAvg)} bpm</span>
                    ) : (
                      <span className="text-zinc-600">--</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    {row.spo2Avg !== null ? (
                      <span className="text-blue-400">{row.spo2Avg}%</span>
                    ) : (
                      <span className="text-zinc-600">--</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    {row.respirationAvg !== null ? (
                      <span className="text-green-400">{row.respirationAvg} rpm</span>
                    ) : (
                      <span className="text-zinc-600">--</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    {row.stressAvg !== null ? (
                      <span className={`${row.stressAvg > 50 ? 'text-orange-400' : 'text-zinc-300'}`}>
                        {Math.round(row.stressAvg)}
                      </span>
                    ) : (
                      <span className="text-zinc-600">--</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    {row.hrvRmssd !== null ? (
                      <span className="text-purple-400 font-mono">{row.hrvRmssd} ms</span>
                    ) : (
                      <span className="text-zinc-600">--</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    {row.hrvSdrr !== null ? (
                      <span className="text-indigo-400 font-mono">{row.hrvSdrr} ms</span>
                    ) : (
                      <span className="text-zinc-600">--</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="px-3 py-1.5 text-xs rounded border border-white/10 text-zinc-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
          >
            &laquo;
          </button>
          <span className="text-xs text-zinc-400">{page + 1} / {totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="px-3 py-1.5 text-xs rounded border border-white/10 text-zinc-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
          >
            &raquo;
          </button>
        </div>
      )}
    </div>
  );
}
