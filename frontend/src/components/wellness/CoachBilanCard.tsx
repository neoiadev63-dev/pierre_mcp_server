// SPDX-License-Identifier: MIT OR Apache-2.0
// Copyright (c) 2025 Pierre Fitness Intelligence

import { useState } from 'react';
import type { CoachBilan } from '../../types/wellness';

interface CoachBilanCardProps {
  bilan: CoachBilan;
}

function getTypeLabel(type: string): { label: string; icon: string; color: string } {
  if (type.includes('vtt')) return { label: 'Sortie VTT', icon: '🚵', color: '#4ADE80' };
  if (type === 'repos') return { label: 'Repos', icon: '🛌', color: '#818CF8' };
  if (type.includes('marche')) return { label: 'Marche active', icon: '🚶', color: '#22D3EE' };
  return { label: type, icon: '🏋️', color: '#F59E0B' };
}

export default function CoachBilanCard({ bilan }: CoachBilanCardProps) {
  const [expanded, setExpanded] = useState(true);
  const rec = bilan.trainingRecommendation;
  const recStyle = getTypeLabel(rec.type);
  const hrTarget = rec.hr_target_bpm || rec.hr_target || '';

  return (
    <div className="card-dark !p-0 overflow-hidden border border-pierre-violet/30">
      {/* Header with gradient */}
      <div className="px-5 py-3 bg-gradient-to-r from-pierre-violet/20 via-pierre-cyan/10 to-transparent flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pierre-violet to-pierre-cyan flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Bilan Coach Pierre</h3>
            <span className="text-[10px] text-zinc-500">
              {new Date(bilan.generated_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-zinc-400 hover:text-white transition-colors p-1"
        >
          <svg className={`w-5 h-5 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      <div className="px-5 py-4 space-y-4">
        {/* Training recommendation - always visible */}
        <div className="p-4 rounded-xl bg-white/[0.04] border border-white/5">
          <div className="flex items-start gap-3">
            <span className="text-2xl flex-shrink-0 mt-0.5">{recStyle.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <span className="text-base font-bold" style={{ color: recStyle.color }}>
                  {recStyle.label}
                </span>
                {rec.duration_min > 0 && (
                  <span className="text-xs px-2.5 py-1 rounded-full bg-white/10 text-white font-medium">
                    ⏱ {rec.duration_min} min
                  </span>
                )}
                {rec.hr_zone && rec.type !== 'repos' && (
                  <span className="text-xs px-2.5 py-1 rounded-full bg-pierre-activity/20 text-pierre-activity font-medium">
                    {rec.hr_zone}
                  </span>
                )}
                {hrTarget && rec.type !== 'repos' && (
                  <span className="text-xs px-2.5 py-1 rounded-full bg-red-500/20 text-red-300 font-bold">
                    ❤️ {hrTarget}
                  </span>
                )}
                {rec.intensity && (
                  <span className="text-xs px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 font-medium">
                    {rec.intensity}
                  </span>
                )}
              </div>
              <p className="text-sm text-zinc-300">{rec.summary}</p>
            </div>
          </div>

          {/* Structured training plan - warmup / main / cooldown */}
          {(rec.warmup || rec.main_effort || rec.cooldown) && (
            <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2">
              {rec.warmup && (
                <div className="px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <span className="text-[10px] text-blue-400 uppercase font-semibold tracking-wider">Échauffement</span>
                  <p className="text-xs text-zinc-300 mt-1">{rec.warmup}</p>
                </div>
              )}
              {rec.main_effort && (
                <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
                  <span className="text-[10px] text-red-400 uppercase font-semibold tracking-wider">Effort principal</span>
                  <p className="text-xs text-zinc-300 mt-1">{rec.main_effort}</p>
                </div>
              )}
              {rec.cooldown && (
                <div className="px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20">
                  <span className="text-[10px] text-green-400 uppercase font-semibold tracking-wider">Retour au calme</span>
                  <p className="text-xs text-zinc-300 mt-1">{rec.cooldown}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Night summary - always visible */}
        <div className="flex items-start gap-3">
          <div className="w-7 h-7 rounded-lg bg-pierre-recovery/20 flex items-center justify-center flex-shrink-0 mt-0.5">
            <svg className="w-4 h-4 text-pierre-recovery" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          </div>
          <div>
            <span className="text-xs font-semibold text-pierre-recovery uppercase tracking-wider">Nuit</span>
            <p className="text-sm text-zinc-300 mt-0.5">{bilan.nightSummary}</p>
          </div>
        </div>

        {/* Expandable sections */}
        {expanded && (
          <>
            {/* Fitness status */}
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-lg bg-pierre-activity/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-4 h-4 text-pierre-activity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <span className="text-xs font-semibold text-pierre-activity uppercase tracking-wider">Condition physique</span>
                <p className="text-sm text-zinc-300 mt-0.5">{bilan.fitnessStatus}</p>
              </div>
            </div>

            {/* Training details */}
            {rec.details && (
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-pierre-cyan/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg className="w-4 h-4 text-pierre-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <div>
                  <span className="text-xs font-semibold text-pierre-cyan uppercase tracking-wider">Entraînement</span>
                  <p className="text-sm text-zinc-300 mt-0.5">{rec.details}</p>
                </div>
              </div>
            )}

            {/* Hydration */}
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
              </div>
              <div>
                <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">Hydratation</span>
                <p className="text-sm text-zinc-300 mt-0.5">{bilan.hydration}</p>
              </div>
            </div>

            {/* Nutrition */}
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-lg bg-pierre-nutrition/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-4 h-4 text-pierre-nutrition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                </svg>
              </div>
              <div>
                <span className="text-xs font-semibold text-pierre-nutrition uppercase tracking-wider">Nutrition</span>
                <p className="text-sm text-zinc-300 mt-0.5">{bilan.nutrition}</p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
