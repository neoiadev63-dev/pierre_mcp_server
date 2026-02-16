// SPDX-License-Identifier: MIT OR Apache-2.0
// Copyright (c) 2025 Pierre Fitness Intelligence

import { Line } from 'react-chartjs-2';
import { useTranslation } from 'react-i18next';
import type { HrTrendPoint } from '../../types/wellness';
import WellnessCardShell from './WellnessCardShell';
import { useChartResponsive } from '../../hooks/useChartResponsive';

interface HeartRateCardProps {
  resting: number | null;
  min: number | null;
  max: number | null;
  trend7d: HrTrendPoint[];
}

export default function HeartRateCard({ resting, min, max, trend7d }: HeartRateCardProps) {
  const { t } = useTranslation();
  const chartConfig = useChartResponsive();

  const chartData = {
    labels: trend7d.map(p => p.date.slice(5)),
    datasets: [{
      data: trend7d.map(p => p.resting),
      borderColor: '#EF4444',
      backgroundColor: 'rgba(239, 68, 68, 0.1)',
      tension: 0.4,
      fill: true,
      pointRadius: 3,
      pointBackgroundColor: '#EF4444',
      borderWidth: 2,
    }],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    aspectRatio: chartConfig.isMobile ? 1.5 : 2,
    plugins: {
      legend: { display: false },
      tooltip: {
        padding: chartConfig.padding,
        titleFont: { size: chartConfig.fontSize.tooltip },
        bodyFont: { size: chartConfig.fontSize.tooltip },
      },
    },
    scales: {
      x: {
        ticks: {
          color: '#71717a',
          font: { size: chartConfig.fontSize.axis },
          maxRotation: chartConfig.isMobile ? 45 : 0,
          minRotation: chartConfig.isMobile ? 45 : 0,
        },
        grid: { display: false },
      },
      y: {
        display: false,
        min: Math.max(0, Math.min(...trend7d.map(p => p.resting)) - 5),
        max: Math.max(...trend7d.map(p => p.resting)) + 5,
      },
    },
  };

  return (
    <WellnessCardShell
      icon={<svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>}
      title={t('wellness.heartRate')}
    >
      <div className="flex items-center gap-4">
        <div className="text-center flex-shrink-0">
          <span className="text-3xl font-bold text-red-400">{resting ?? '--'}</span>
          <span className="text-zinc-500 text-xs block">bpm repos</span>
        </div>
        <div className="flex-1 h-16">
          {trend7d.length > 1 && <Line data={chartData} options={chartOptions} />}
        </div>
      </div>
      <div className="flex gap-4 text-xs text-zinc-400">
        <span>{t('wellness.min')}: <strong className="text-white">{min ?? '--'}</strong></span>
        <span>{t('wellness.max')}: <strong className="text-white">{max ?? '--'}</strong></span>
      </div>
    </WellnessCardShell>
  );
}
