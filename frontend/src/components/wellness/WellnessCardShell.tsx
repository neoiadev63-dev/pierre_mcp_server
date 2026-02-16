// SPDX-License-Identifier: MIT OR Apache-2.0
// Copyright (c) 2025 Pierre Fitness Intelligence

import type { ReactNode } from 'react';

interface WellnessCardShellProps {
  icon: ReactNode;
  title: string;
  accent?: 'recovery' | 'activity' | 'nutrition';
  children: ReactNode;
}

const accentClasses = {
  recovery: 'card-recovery',
  activity: 'card-activity',
  nutrition: 'card-nutrition',
};

export default function WellnessCardShell({ icon, title, accent, children }: WellnessCardShellProps) {
  const cls = accent ? accentClasses[accent] : 'card-dark';

  return (
    <div className={`${cls} flex flex-col gap-3`}>
      <div className="flex items-center gap-2">
        <span className="text-lg">{icon}</span>
        <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide">{title}</h3>
      </div>
      {children}
    </div>
  );
}
