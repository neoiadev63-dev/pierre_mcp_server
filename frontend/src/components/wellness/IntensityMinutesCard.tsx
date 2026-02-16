// SPDX-License-Identifier: MIT OR Apache-2.0
// Copyright (c) 2025 Pierre Fitness Intelligence

import { useTranslation } from 'react-i18next';
import type { WeeklyIntensity } from '../../types/wellness';
import WellnessCardShell from './WellnessCardShell';

interface IntensityMinutesCardProps {
  weekly: WeeklyIntensity;
}

export default function IntensityMinutesCard({ weekly }: IntensityMinutesCardProps) {
  const { t } = useTranslation();
  const pct = Math.min(100, Math.round((weekly.total / weekly.goal) * 100));
  const barColor = pct >= 100 ? '#4ADE80' : pct >= 60 ? '#F59E0B' : '#EF4444';

  return (
    <WellnessCardShell
      icon={<svg className="w-5 h-5 text-pierre-activity" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
      title={t('wellness.intensityMinutes')}
      accent="activity"
    >
      <div className="space-y-3">
        <div className="flex items-end justify-between">
          <span className="text-2xl font-bold text-white">{weekly.total}</span>
          <span className="text-zinc-400 text-sm">/ {weekly.goal} min</span>
        </div>
        {/* Progress bar */}
        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${pct}%`, backgroundColor: barColor }}
          />
        </div>
        {/* Daily dots */}
        <div className="flex gap-1.5 justify-between">
          {weekly.days.map(day => {
            const dayTotal = day.moderate + day.vigorous * 2;
            const hasActivity = dayTotal > 0;
            return (
              <div key={day.date} className="flex flex-col items-center gap-1">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-medium"
                  style={{
                    backgroundColor: hasActivity ? (day.vigorous > 0 ? '#4ADE80' : '#22C55E33') : 'rgba(255,255,255,0.05)',
                    color: hasActivity ? '#fff' : '#71717a',
                  }}
                >
                  {dayTotal > 0 ? dayTotal : ''}
                </div>
                <span className="text-[9px] text-zinc-500">
                  {new Date(day.date).toLocaleDateString('fr-FR', { weekday: 'narrow' })}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </WellnessCardShell>
  );
}
