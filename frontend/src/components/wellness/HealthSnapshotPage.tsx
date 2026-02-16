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
      title: `Aperçu santé : nuit du ${new Date(d.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`,
      sleepDuration: d.sleep!.duration_seconds,
      hrAvg: d.sleep!.hr_avg,
      spo2Avg: d.sleep!.spo2_avg,
      respirationAvg: d.sleep!.respiration_avg,
      stressAvg: d.stress.average,
    }))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export default function HealthSnapshotPage({ data }: HealthSnapshotPageProps) {
  const { t } = useTranslation();
  const [page, setPage] = useState(0);

  const rows = useMemo(() => buildRows(data.days), [data.days]);
  const totalPages = Math.ceil(rows.length / PAGE_SIZE);
  const pageRows = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

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
      {/* Header */}
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-medium text-white">{t('wellness.health.title')}</h3>
        <div className="group relative">
          <svg className="w-4 h-4 text-zinc-500 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="absolute left-0 top-6 z-10 hidden group-hover:block w-72 p-3 bg-zinc-800 border border-white/10 rounded-lg shadow-xl text-xs text-zinc-300">
            Les aperçus santé sont enregistrés pendant votre sommeil. Ils incluent la fréquence cardiaque, la SpO2, la respiration et le stress mesurés par votre montre Garmin.
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card-dark !p-0 overflow-hidden border border-white/10">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-zinc-500 border-b border-white/10">
                <th className="text-left py-2.5 px-4 font-medium">Titre</th>
                <th className="text-right py-2.5 px-3 font-medium">Date</th>
                <th className="text-right py-2.5 px-3 font-medium">Durée</th>
                <th className="text-right py-2.5 px-3 font-medium">{t('wellness.health.avgHr')}</th>
                <th className="text-right py-2.5 px-3 font-medium">{t('wellness.health.avgSpo2')}</th>
                <th className="text-right py-2.5 px-3 font-medium">{t('wellness.health.avgResp')}</th>
                <th className="text-right py-2.5 px-3 font-medium">{t('wellness.health.avgStress')}</th>
                <th className="text-right py-2.5 px-3 font-medium">{t('wellness.health.hrvRmssd')}</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row) => (
                <tr key={row.date} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                  <td className="py-2.5 px-4 text-pierre-cyan hover:text-pierre-cyan/80 cursor-pointer transition-colors">
                    {row.title}
                  </td>
                  <td className="py-2.5 px-3 text-right text-zinc-300 whitespace-nowrap">
                    {new Date(row.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
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
                  <td className="py-2.5 px-3 text-right text-zinc-600">--</td>
                  <td className="py-2.5 px-1">
                    <button className="p-1 text-zinc-600 hover:text-red-400 transition-colors" title="Supprimer">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
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
