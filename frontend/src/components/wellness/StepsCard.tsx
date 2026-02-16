// SPDX-License-Identifier: MIT OR Apache-2.0
// Copyright (c) 2025 Pierre Fitness Intelligence

import { useTranslation } from 'react-i18next';
import type { WellnessSteps } from '../../types/wellness';
import WellnessCardShell from './WellnessCardShell';

interface StepsCardProps {
  steps: WellnessSteps;
}

export default function StepsCard({ steps }: StepsCardProps) {
  const { t } = useTranslation();
  const pct = Math.min(100, Math.round((steps.count / steps.goal) * 100));
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;
  const color = pct >= 100 ? '#4ADE80' : pct >= 60 ? '#F59E0B' : '#EF4444';

  return (
    <WellnessCardShell
      icon={<svg className="w-5 h-5 text-pierre-activity" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>}
      title={t('wellness.steps')}
      accent="activity"
    >
      <div className="flex items-center gap-4">
        <div className="relative flex-shrink-0">
          <svg width="96" height="96" viewBox="0 0 96 96">
            <circle cx="48" cy="48" r={radius} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="6" />
            <circle
              cx="48" cy="48" r={radius}
              fill="none" stroke={color} strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              transform="rotate(-90 48 48)"
              className="transition-all duration-700"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-bold text-white">{steps.count.toLocaleString()}</span>
            <span className="text-[10px] text-zinc-400">{pct}%</span>
          </div>
        </div>
        <div className="flex flex-col gap-1 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-zinc-400">{t('wellness.goal')}</span>
            <span className="text-white font-medium">{steps.goal.toLocaleString()}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-zinc-400">{t('wellness.distance')}</span>
            <span className="text-white font-medium">{(steps.distance_m / 1000).toFixed(1)} km</span>
          </div>
        </div>
      </div>
    </WellnessCardShell>
  );
}
