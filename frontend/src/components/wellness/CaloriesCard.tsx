// SPDX-License-Identifier: MIT OR Apache-2.0
// Copyright (c) 2025 Pierre Fitness Intelligence

import { Doughnut } from 'react-chartjs-2';
import { useTranslation } from 'react-i18next';
import type { WellnessCalories } from '../../types/wellness';
import WellnessCardShell from './WellnessCardShell';

interface CaloriesCardProps {
  calories: WellnessCalories;
}

export default function CaloriesCard({ calories }: CaloriesCardProps) {
  const { t } = useTranslation();

  const doughnutData = {
    labels: [t('wellness.activeCalories'), t('wellness.bmr')],
    datasets: [{
      data: [calories.active, calories.bmr],
      backgroundColor: ['#F59E0B', '#78350F'],
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
            `${ctx.label}: ${(ctx.raw as number).toLocaleString()} kcal`,
        },
      },
    },
  };

  return (
    <WellnessCardShell
      icon={<svg className="w-5 h-5 text-pierre-nutrition" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" /></svg>}
      title={t('wellness.calories')}
      accent="nutrition"
    >
      <div className="flex items-center gap-4">
        <div className="relative w-24 h-24 flex-shrink-0">
          <Doughnut data={doughnutData} options={doughnutOptions} />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-lg font-bold text-white">{calories.total.toLocaleString()}</span>
            <span className="text-[10px] text-zinc-400">kcal</span>
          </div>
        </div>
        <div className="flex flex-col gap-1.5 text-sm">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#F59E0B]" />
            <span className="text-zinc-400">{t('wellness.activeCalories')}</span>
            <span className="text-white font-medium ml-auto">{calories.active.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#78350F]" />
            <span className="text-zinc-400">{t('wellness.bmr')}</span>
            <span className="text-white font-medium ml-auto">{calories.bmr.toLocaleString()}</span>
          </div>
        </div>
      </div>
    </WellnessCardShell>
  );
}
