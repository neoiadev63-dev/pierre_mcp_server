// SPDX-License-Identifier: MIT OR Apache-2.0
// Copyright (c) 2025 Pierre Fitness Intelligence

import { useState } from 'react';
import type { ActivitySummary } from '../../types/wellness';
import { SPORT_ICONS, SPORT_LABELS, ZONE_COLORS, ZONE_LABELS, formatDuration, formatZoneDuration } from './sportUtils';

interface ActivityCardProps {
  activity: ActivitySummary;
}

function TeBar({ value, max, label, color }: { value: number; max: number; label: string; color: string }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-zinc-400 w-20 text-right">{label}</span>
      <div className="flex-1 min-w-0 h-3 bg-white/5 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs text-zinc-300 w-8">{value.toFixed(1)}</span>
    </div>
  );
}

export default function ActivityCard({ activity }: ActivityCardProps) {
  const [expanded, setExpanded] = useState(false);

  const sportIcon = SPORT_ICONS[activity.activityType] || SPORT_ICONS['cycling'];
  const sportLabel = SPORT_LABELS[activity.activityType] || activity.activityType;

  // Total HR zone time for percentage calculation
  const totalZoneTime = activity.hrZones.reduce((sum, z) => sum + z.seconds, 0);

  // Only show zones with time > 0
  const activeZones = activity.hrZones.filter(z => z.seconds > 0);

  return (
    <div className="card-dark !p-0 overflow-hidden border border-white/10">
      {/* Header */}
      <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-emerald-400" fill="currentColor" viewBox="0 0 24 24">
              <path d={sportIcon} />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-white">{activity.name}</span>
              <span className="text-[11px] text-emerald-400 px-2 py-0.5 rounded bg-emerald-500/10 uppercase">{sportLabel}</span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-zinc-400">
              <span>{new Date(activity.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
              <span>-</span>
              <span>{activity.startTimeLocal}</span>
              {activity.location && (
                <>
                  <span>-</span>
                  <svg className="w-3 h-3 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span>{activity.location}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-5">
        {/* Key metrics grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4 mb-4">
          {/* Distance */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              <span className="text-[10px] text-zinc-400 uppercase">Distance</span>
            </div>
            <span className="text-2xl font-bold text-blue-400">{activity.distance_km.toFixed(1)}</span>
            <span className="text-sm text-zinc-400 ml-1">km</span>
          </div>

          {/* Duration */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-[10px] text-zinc-400 uppercase">Durée</span>
            </div>
            <span className="text-2xl font-bold text-purple-400">{formatDuration(activity.duration_s)}</span>
          </div>

          {/* Speed */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span className="text-[10px] text-zinc-400 uppercase">Vitesse</span>
            </div>
            <span className="text-2xl font-bold text-cyan-400">{activity.avg_speed_kmh}</span>
            <span className="text-sm text-zinc-400 ml-1">km/h</span>
            <div className="text-[10px] text-zinc-500">max {activity.max_speed_kmh} km/h</div>
          </div>

          {/* Elevation */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15l5-7 4 4 4-6 5 7" />
              </svg>
              <span className="text-[10px] text-zinc-400 uppercase">Dénivelé</span>
            </div>
            <div>
              <span className="text-xl font-bold text-green-400">+{activity.elevation_gain_m}</span>
              <span className="text-sm text-zinc-400 ml-1">m</span>
            </div>
            <div className="text-[10px] text-red-400">-{activity.elevation_loss_m} m</div>
          </div>

          {/* Heart Rate */}
          {activity.avg_hr && (
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
                <span className="text-[10px] text-zinc-400 uppercase">FC</span>
              </div>
              <span className="text-2xl font-bold text-red-400">{Math.round(activity.avg_hr)}</span>
              <span className="text-sm text-zinc-400 ml-1">bpm</span>
              <div className="text-[10px] text-zinc-500">max {activity.max_hr} bpm</div>
            </div>
          )}

          {/* Calories */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <svg className="w-4 h-4 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
              </svg>
              <span className="text-[10px] text-zinc-400 uppercase">Calories</span>
            </div>
            <span className="text-2xl font-bold text-orange-400">{activity.calories}</span>
            <span className="text-sm text-zinc-400 ml-1">kcal</span>
          </div>

          {/* Power */}
          {activity.avg_power !== null && (
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <svg className="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span className="text-[10px] text-zinc-400 uppercase">Puissance</span>
              </div>
              <span className="text-2xl font-bold text-yellow-400">{Math.round(activity.avg_power)}</span>
              <span className="text-sm text-zinc-400 ml-1">W</span>
              {activity.max_power !== null && (
                <div className="text-[10px] text-zinc-500">max {Math.round(activity.max_power)} W</div>
              )}
            </div>
          )}

          {/* Cadence */}
          {activity.avg_cadence !== null && (
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <svg className="w-4 h-4 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span className="text-[10px] text-zinc-400 uppercase">Cadence</span>
              </div>
              <span className="text-2xl font-bold text-teal-400">{Math.round(activity.avg_cadence)}</span>
              <span className="text-sm text-zinc-400 ml-1">rpm</span>
              {activity.max_cadence !== null && (
                <div className="text-[10px] text-zinc-500">max {Math.round(activity.max_cadence)} rpm</div>
              )}
            </div>
          )}
        </div>

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-center gap-2 py-2 text-xs text-zinc-400 hover:text-zinc-200 transition-colors border-t border-white/5"
        >
          <span>{expanded ? 'Moins de détails' : 'Plus de détails'}</span>
          <svg
            className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Expanded details */}
        {expanded && (
          <div className="pt-4 space-y-5 border-t border-white/5">
            {/* Training Effect */}
            {(activity.aerobic_te !== null || activity.anaerobic_te !== null) && (
              <div>
                <h4 className="text-[10px] text-zinc-400 uppercase tracking-wider mb-2">Training Effect</h4>
                <div className="space-y-2">
                  {activity.aerobic_te !== null && (
                    <TeBar value={activity.aerobic_te} max={5} label="Aérobie" color="#22C55E" />
                  )}
                  {activity.anaerobic_te !== null && (
                    <TeBar value={activity.anaerobic_te} max={5} label="Anaérobie" color="#F59E0B" />
                  )}
                </div>
                <div className="flex items-center gap-3 mt-2 text-xs">
                  {activity.te_label && (
                    <span className="text-zinc-400">
                      {activity.te_label.replace(/_/g, ' ').toLowerCase()}
                    </span>
                  )}
                  {activity.training_load !== null && (
                    <span className="text-zinc-500">Charge : {activity.training_load}</span>
                  )}
                </div>
              </div>
            )}

            {/* HR Zones */}
            {activeZones.length > 0 && totalZoneTime > 0 && (
              <div>
                <h4 className="text-[10px] text-zinc-400 uppercase tracking-wider mb-2">Zones de fréquence cardiaque</h4>
                <div className="space-y-1.5">
                  {activeZones.map((z) => {
                    const pct = (z.seconds / totalZoneTime) * 100;
                    return (
                      <div key={z.zone} className="flex items-center gap-2">
                        <span className="text-[10px] text-zinc-400 w-6 text-right font-medium">{ZONE_LABELS[z.zone]}</span>
                        <div className="flex-1 h-4 bg-white/5 rounded overflow-hidden">
                          <div
                            className="h-full rounded transition-all flex items-center px-1.5"
                            style={{
                              width: `${Math.max(pct, 3)}%`,
                              backgroundColor: ZONE_COLORS[z.zone],
                            }}
                          >
                            {pct > 12 && (
                              <span className="text-[11px] text-white font-medium">{Math.round(pct)}%</span>
                            )}
                          </div>
                        </div>
                        <span className="text-[10px] text-zinc-400 w-16 text-right">{formatZoneDuration(z.seconds)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Power & Cadence detail */}
            {(activity.avg_power !== null || activity.avg_cadence !== null) && (
              <div>
                <h4 className="text-[10px] text-zinc-400 uppercase tracking-wider mb-2">Puissance & Cadence</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {activity.avg_power !== null && (
                    <div className="bg-yellow-500/5 rounded-lg p-3 border border-yellow-500/10">
                      <span className="text-[10px] text-zinc-400 uppercase block mb-1">Puissance moyenne</span>
                      <span className="text-lg font-bold text-yellow-400">{Math.round(activity.avg_power)}</span>
                      <span className="text-sm text-zinc-400 ml-1">W</span>
                    </div>
                  )}
                  {activity.max_power !== null && (
                    <div className="bg-yellow-500/5 rounded-lg p-3 border border-yellow-500/10">
                      <span className="text-[10px] text-zinc-400 uppercase block mb-1">Puissance max</span>
                      <span className="text-lg font-bold text-yellow-400">{Math.round(activity.max_power)}</span>
                      <span className="text-sm text-zinc-400 ml-1">W</span>
                    </div>
                  )}
                  {activity.norm_power !== null && (
                    <div className="bg-yellow-500/5 rounded-lg p-3 border border-yellow-500/10">
                      <span className="text-[10px] text-zinc-400 uppercase block mb-1">Puissance normalisée</span>
                      <span className="text-lg font-bold text-yellow-400">{Math.round(activity.norm_power)}</span>
                      <span className="text-sm text-zinc-400 ml-1">W</span>
                    </div>
                  )}
                  {activity.avg_cadence !== null && (
                    <div className="bg-teal-500/5 rounded-lg p-3 border border-teal-500/10">
                      <span className="text-[10px] text-zinc-400 uppercase block mb-1">Cadence moyenne</span>
                      <span className="text-lg font-bold text-teal-400">{Math.round(activity.avg_cadence)}</span>
                      <span className="text-sm text-zinc-400 ml-1">rpm</span>
                    </div>
                  )}
                  {activity.max_cadence !== null && (
                    <div className="bg-teal-500/5 rounded-lg p-3 border border-teal-500/10">
                      <span className="text-[10px] text-zinc-400 uppercase block mb-1">Cadence max</span>
                      <span className="text-lg font-bold text-teal-400">{Math.round(activity.max_cadence)}</span>
                      <span className="text-sm text-zinc-400 ml-1">rpm</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Additional metrics grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
              {/* Temperature */}
              {activity.min_temp_c !== null && activity.max_temp_c !== null && (
                <div className="bg-white/[0.02] rounded-lg p-3">
                  <span className="text-[10px] text-zinc-400 uppercase block mb-1">Température</span>
                  <span className="text-sm text-white">{activity.min_temp_c}° - {activity.max_temp_c}°C</span>
                </div>
              )}

              {/* Respiration */}
              {activity.avg_respiration !== null && (
                <div className="bg-white/[0.02] rounded-lg p-3">
                  <span className="text-[10px] text-zinc-400 uppercase block mb-1">Respiration</span>
                  <span className="text-sm text-white">{activity.avg_respiration} <span className="text-zinc-500">resp/min</span></span>
                  <div className="text-[10px] text-zinc-500">
                    {activity.min_respiration} - {activity.max_respiration}
                  </div>
                </div>
              )}

              {/* Hydration */}
              {activity.water_estimated_ml !== null && (
                <div className="bg-white/[0.02] rounded-lg p-3">
                  <span className="text-[10px] text-zinc-400 uppercase block mb-1">Hydratation</span>
                  <span className="text-sm text-white">{activity.water_estimated_ml} <span className="text-zinc-500">ml estimé</span></span>
                  {activity.water_consumed_ml !== null && (
                    <div className="text-[10px] text-zinc-500">Consommé : {activity.water_consumed_ml} ml</div>
                  )}
                </div>
              )}

              {/* Grit/Flow (VTT) */}
              {activity.grit !== null && (
                <div className="bg-white/[0.02] rounded-lg p-3">
                  <span className="text-[10px] text-zinc-400 uppercase block mb-1">Trail</span>
                  <div className="text-sm text-white">Grit : {activity.grit}</div>
                  {activity.avg_flow !== null && (
                    <div className="text-[10px] text-zinc-500">Flow moy : {activity.avg_flow}</div>
                  )}
                  {activity.jump_count !== null && activity.jump_count > 0 && (
                    <div className="text-[10px] text-zinc-500">Sauts : {activity.jump_count}</div>
                  )}
                </div>
              )}

              {/* Intensity minutes */}
              {(activity.moderate_minutes > 0 || activity.vigorous_minutes > 0) && (
                <div className="bg-white/[0.02] rounded-lg p-3">
                  <span className="text-[10px] text-zinc-400 uppercase block mb-1">Minutes intensives</span>
                  <div className="text-sm text-white">
                    <span className="text-green-400">{activity.moderate_minutes}</span>
                    <span className="text-zinc-500"> mod. + </span>
                    <span className="text-orange-400">{activity.vigorous_minutes}</span>
                    <span className="text-zinc-500"> vig.</span>
                  </div>
                </div>
              )}

              {/* Calories consumed */}
              {activity.calories_consumed !== null && (
                <div className="bg-white/[0.02] rounded-lg p-3">
                  <span className="text-[10px] text-zinc-400 uppercase block mb-1">Calories consommées</span>
                  <span className="text-sm text-white">{activity.calories_consumed} <span className="text-zinc-500">kcal</span></span>
                </div>
              )}

              {/* Moving duration */}
              <div className="bg-white/[0.02] rounded-lg p-3">
                <span className="text-[10px] text-zinc-400 uppercase block mb-1">Durée en mouvement</span>
                <span className="text-sm text-white">{formatDuration(activity.moving_duration_s)}</span>
              </div>

              {/* Elevation range */}
              <div className="bg-white/[0.02] rounded-lg p-3">
                <span className="text-[10px] text-zinc-400 uppercase block mb-1">Altitude</span>
                <span className="text-sm text-white">{activity.min_elevation_m} - {activity.max_elevation_m} m</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
