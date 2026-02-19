// SPDX-License-Identifier: MIT OR Apache-2.0
// Copyright (c) 2025 Pierre Fitness Intelligence

import { Bar } from 'react-chartjs-2';
import { useTranslation } from 'react-i18next';
import type { WellnessSteps, WellnessDay } from '../../types/wellness';
import WellnessCardShell from './WellnessCardShell';

interface StepsCardProps {
  steps: WellnessSteps;
  days?: WellnessDay[];
}

export default function StepsCard({ steps, days }: StepsCardProps) {
  const { t } = useTranslation();
  const pct = Math.min(100, Math.round((steps.count / steps.goal) * 100));
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;
  const color = pct >= 100 ? '#4ADE80' : pct >= 60 ? '#F59E0B' : '#EF4444';

  const last7 = (days ?? []).slice(-7);

  const chartData = {
    labels: last7.map(d => d.date.slice(8)),
    datasets: [{
      data: last7.map(d => d.steps.count),
      backgroundColor: last7.map(d =>
        d.steps.count >= d.steps.goal ? 'rgba(74,222,128,0.7)' :
        d.steps.count >= d.steps.goal * 0.6 ? 'rgba(245,158,11,0.7)' :
        'rgba(239,68,68,0.5)'
      ),
      borderRadius: 3,
      barPercentage: 0.7,
    }],
  };

  const maxSteps = Math.max(...last7.map(d => d.steps.count), steps.goal);
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: unknown) => {
            const item = ctx as { parsed: { y: number | null } };
            return `${(item.parsed.y ?? 0).toLocaleString()} pas`;
          },
        },
        titleFont: { size: 10 },
        bodyFont: { size: 10 },
        padding: 6,
      },
    },
    scales: {
      x: {
        ticks: { color: '#71717a', font: { size: 9 } },
        grid: { display: false },
      },
      y: {
        display: false,
        min: 0,
        max: maxSteps * 1.1,
      },
    },
  };

  return (
    <WellnessCardShell
      icon={<svg className="w-5 h-5 text-pierre-activity" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>}
      title={t('wellness.steps')}
      accent="activity"
    >
      <div className="flex items-center gap-3">
        {/* Circular progress */}
        <div className="relative flex-shrink-0">
          <svg width="84" height="84" viewBox="0 0 84 84">
            <circle cx="42" cy="42" r={radius} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="5" />
            <circle
              cx="42" cy="42" r={radius}
              fill="none" stroke={color} strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              transform="rotate(-90 42 42)"
              className="transition-all duration-700"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-lg font-bold text-white">{steps.count.toLocaleString()}</span>
            <span className="text-[9px] text-zinc-400">{pct}%</span>
          </div>
        </div>
        {/* 7-day bar chart */}
        {last7.length > 1 && (
          <div className="flex-1 h-[72px] min-w-0">
            <Bar data={chartData} options={chartOptions} />
          </div>
        )}
      </div>
      <div className="flex gap-4 text-xs text-zinc-400 mt-1">
        <span>{t('wellness.goal')}: <strong className="text-white">{steps.goal.toLocaleString()}</strong></span>
        <span>{t('wellness.distance')}: <strong className="text-white">{(steps.distance_m / 1000).toFixed(1)} km</strong></span>
      </div>
    </WellnessCardShell>
  );
}
