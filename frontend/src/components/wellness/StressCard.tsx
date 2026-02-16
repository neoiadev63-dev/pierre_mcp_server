// SPDX-License-Identifier: MIT OR Apache-2.0
// Copyright (c) 2025 Pierre Fitness Intelligence

import { useTranslation } from 'react-i18next';
import type { WellnessStress } from '../../types/wellness';
import WellnessCardShell from './WellnessCardShell';

interface StressCardProps {
  stress: WellnessStress;
}

export default function StressCard({ stress }: StressCardProps) {
  const { t } = useTranslation();
  const total = stress.rest_minutes + stress.low_minutes + stress.medium_minutes + stress.high_minutes;
  const segments = [
    { label: t('wellness.rest'), minutes: stress.rest_minutes, color: '#22D3EE' },
    { label: t('wellness.low'), minutes: stress.low_minutes, color: '#4ADE80' },
    { label: t('wellness.medium'), minutes: stress.medium_minutes, color: '#F59E0B' },
    { label: t('wellness.high'), minutes: stress.high_minutes, color: '#EF4444' },
  ];

  const avgColor = (stress.average ?? 0) <= 25 ? '#22D3EE'
    : (stress.average ?? 0) <= 50 ? '#4ADE80'
    : (stress.average ?? 0) <= 75 ? '#F59E0B'
    : '#EF4444';

  return (
    <WellnessCardShell
      icon={<svg className="w-5 h-5 text-pierre-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>}
      title={t('wellness.stress')}
    >
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl font-bold" style={{ color: avgColor }}>{stress.average ?? '--'}</span>
          <span className="text-zinc-400 text-sm">{t('wellness.average')}</span>
        </div>
        {/* Stacked horizontal bar */}
        <div className="h-4 rounded-full overflow-hidden flex" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>
          {segments.map(seg => {
            const w = total > 0 ? (seg.minutes / total) * 100 : 0;
            return w > 0 ? (
              <div
                key={seg.label}
                className="h-full transition-all duration-500"
                style={{ width: `${w}%`, backgroundColor: seg.color }}
                title={`${seg.label}: ${seg.minutes} min`}
              />
            ) : null;
          })}
        </div>
        {/* Legend */}
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
          {segments.map(seg => (
            <div key={seg.label} className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: seg.color }} />
              <span className="text-zinc-400">{seg.label}</span>
              <span className="text-white">{seg.minutes}m</span>
            </div>
          ))}
        </div>
      </div>
    </WellnessCardShell>
  );
}
