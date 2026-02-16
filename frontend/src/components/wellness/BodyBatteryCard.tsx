// SPDX-License-Identifier: MIT OR Apache-2.0
// Copyright (c) 2025 Pierre Fitness Intelligence

import { Line } from 'react-chartjs-2';
import { useTranslation } from 'react-i18next';
import type { WellnessDay } from '../../types/wellness';
import WellnessCardShell from './WellnessCardShell';
import { useChartResponsive } from '../../hooks/useChartResponsive';

interface BodyBatteryCardProps {
  days: WellnessDay[];
}

export default function BodyBatteryCard({ days }: BodyBatteryCardProps) {
  const { t } = useTranslation();
  const chartConfig = useChartResponsive();
  const last7 = days.slice(-7);
  const latest = last7[last7.length - 1];

  const level = latest?.bodyBattery?.estimate;
  const levelColor = (level ?? 0) >= 60 ? '#4ADE80' : (level ?? 0) >= 30 ? '#F59E0B' : '#EF4444';

  const chartData = {
    labels: last7.map(d => d.date.slice(5)),
    datasets: [{
      data: last7.map(d => d.bodyBattery.estimate),
      borderColor: '#818CF8',
      backgroundColor: 'rgba(129, 140, 248, 0.15)',
      tension: 0.4,
      fill: true,
      pointRadius: 2,
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
        enabled: true,
        padding: chartConfig.padding,
        titleFont: { size: chartConfig.fontSize.tooltip },
        bodyFont: { size: chartConfig.fontSize.tooltip },
      },
    },
    scales: {
      x: {
        display: true,
        ticks: {
          color: '#71717a',
          font: { size: chartConfig.fontSize.axis },
          maxRotation: chartConfig.isMobile ? 45 : 0,
          minRotation: chartConfig.isMobile ? 45 : 0,
        },
        grid: { display: false },
      },
      y: {
        min: 0,
        max: 100,
        display: false,
      },
    },
  };

  return (
    <WellnessCardShell
      icon={<svg className="w-5 h-5 text-pierre-recovery" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>}
      title={t('wellness.bodyBattery')}
      accent="recovery"
    >
      <div className="flex items-center gap-4">
        <div className="text-center">
          <span className="text-3xl font-bold" style={{ color: levelColor }}>{level ?? '--'}</span>
          <span className="text-zinc-500 text-xs block">/100</span>
        </div>
        <div className="flex-1 h-20">
          <Line data={chartData} options={chartOptions} />
        </div>
      </div>
    </WellnessCardShell>
  );
}
