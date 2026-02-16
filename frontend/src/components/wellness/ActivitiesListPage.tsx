// SPDX-License-Identifier: MIT OR Apache-2.0
// Copyright (c) 2025 Pierre Fitness Intelligence

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { ActivitySummary } from '../../types/wellness';
import { SPORT_ICONS, SPORT_LABELS, formatDuration } from './sportUtils';
import ActivityCard from './ActivityCard';

interface ActivitiesListPageProps {
  activities: ActivitySummary[];
}

type SortKey = 'date' | 'distance' | 'duration' | 'calories' | 'aerobic_te' | 'max_hr' | 'avg_power' | 'avg_cadence';
type SortDir = 'asc' | 'desc';
const PAGE_SIZE = 20;

function getSportIcon(type: string) {
  return SPORT_ICONS[type] || SPORT_ICONS['cycling'];
}

export default function ActivitiesListPage({ activities }: ActivitiesListPageProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sportFilter, setSportFilter] = useState<string>('all');
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(0);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [favorites, setFavorites] = useState<Set<number>>(() => {
    try {
      const saved = localStorage.getItem('pierre-activity-favorites');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch { return new Set(); }
  });

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Reset page when filters change
  useEffect(() => { setPage(0); }, [debouncedSearch, sportFilter, sortKey, sortDir]);

  // Available sports from data
  const sportTypes = useMemo(() => {
    const types = new Set(activities.map(a => a.activityType));
    return Array.from(types).sort();
  }, [activities]);

  // Filtered + sorted activities
  const filtered = useMemo(() => {
    let result = [...activities];

    // Search filter
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter(a =>
        a.name.toLowerCase().includes(q) ||
        (a.location && a.location.toLowerCase().includes(q))
      );
    }

    // Sport filter
    if (sportFilter !== 'all') {
      result = result.filter(a => a.activityType === sportFilter);
    }

    // Sort
    result.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'date': cmp = new Date(a.date).getTime() - new Date(b.date).getTime(); break;
        case 'distance': cmp = a.distance_km - b.distance_km; break;
        case 'duration': cmp = a.duration_s - b.duration_s; break;
        case 'calories': cmp = a.calories - b.calories; break;
        case 'aerobic_te': cmp = (a.aerobic_te ?? 0) - (b.aerobic_te ?? 0); break;
        case 'max_hr': cmp = (a.max_hr ?? 0) - (b.max_hr ?? 0); break;
        case 'avg_power': cmp = (a.avg_power ?? 0) - (b.avg_power ?? 0); break;
        case 'avg_cadence': cmp = (a.avg_cadence ?? 0) - (b.avg_cadence ?? 0); break;
      }
      return sortDir === 'desc' ? -cmp : cmp;
    });

    return result;
  }, [activities, debouncedSearch, sportFilter, sortKey, sortDir]);

  // Check if any activity has power or cadence data
  const hasPower = useMemo(() => activities.some(a => a.avg_power !== null), [activities]);
  const hasCadence = useMemo(() => activities.some(a => a.avg_cadence !== null), [activities]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageItems = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const toggleSort = useCallback((key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }, [sortKey]);

  const toggleFavorite = useCallback((id: number) => {
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      localStorage.setItem('pierre-activity-favorites', JSON.stringify([...next]));
      return next;
    });
  }, []);

  const SortHeader = ({ label, sortKeyVal }: { label: string; sortKeyVal: SortKey }) => (
    <th
      className="text-right py-2 px-2 font-medium cursor-pointer hover:text-zinc-200 transition-colors select-none"
      onClick={() => toggleSort(sortKeyVal)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {sortKey === sortKeyVal && (
          <svg className={`w-3 h-3 ${sortDir === 'asc' ? 'rotate-180' : ''}`} fill="currentColor" viewBox="0 0 20 20">
            <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
          </svg>
        )}
      </span>
    </th>
  );

  if (activities.length === 0) {
    return (
      <div className="card-dark text-center py-12">
        <svg className="w-12 h-12 mx-auto text-zinc-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        <p className="text-zinc-400">{t('wellness.activities.noResults')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder={t('wellness.activities.search')}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white/[0.03] border border-white/10 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-pierre-violet/50"
        />
      </div>

      {/* Sport filter pills */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setSportFilter('all')}
          className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
            sportFilter === 'all'
              ? 'border-pierre-violet bg-pierre-violet/20 text-white'
              : 'border-white/10 text-zinc-400 hover:text-white hover:border-white/20'
          }`}
        >
          {t('wellness.activities.all')} ({activities.length})
        </button>
        {sportTypes.map(type => {
          const count = activities.filter(a => a.activityType === type).length;
          return (
            <button
              key={type}
              onClick={() => setSportFilter(type)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors inline-flex items-center gap-1.5 ${
                sportFilter === type
                  ? 'border-pierre-violet bg-pierre-violet/20 text-white'
                  : 'border-white/10 text-zinc-400 hover:text-white hover:border-white/20'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                <path d={getSportIcon(type)} />
              </svg>
              {SPORT_LABELS[type] || type} ({count})
            </button>
          );
        })}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-zinc-500 border-b border-white/10">
              <th className="w-8 py-2 px-1" />
              <SortHeader label="Date" sortKeyVal="date" />
              <th className="text-left py-2 px-2 font-medium">Sport</th>
              <th className="text-left py-2 px-2 font-medium">Nom</th>
              <SortHeader label="Distance" sortKeyVal="distance" />
              <SortHeader label="Durée" sortKeyVal="duration" />
              <SortHeader label="Calories" sortKeyVal="calories" />
              {hasPower && <SortHeader label="Puissance" sortKeyVal="avg_power" />}
              {hasCadence && <SortHeader label="Cadence" sortKeyVal="avg_cadence" />}
              <SortHeader label={t('wellness.activities.teAerobic')} sortKeyVal="aerobic_te" />
              <SortHeader label={t('wellness.activities.maxHr')} sortKeyVal="max_hr" />
            </tr>
          </thead>
          <tbody>
            {pageItems.map(activity => (
              <TableRow
                key={activity.activityId}
                activity={activity}
                expanded={expandedId === activity.activityId}
                isFavorite={favorites.has(activity.activityId)}
                hasPower={hasPower}
                hasCadence={hasCadence}
                onToggleExpand={() => setExpandedId(expandedId === activity.activityId ? null : activity.activityId)}
                onToggleFavorite={() => toggleFavorite(activity.activityId)}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {pageItems.map(activity => (
          <MobileActivityCard
            key={activity.activityId}
            activity={activity}
            expanded={expandedId === activity.activityId}
            isFavorite={favorites.has(activity.activityId)}
            onToggleExpand={() => setExpandedId(expandedId === activity.activityId ? null : activity.activityId)}
            onToggleFavorite={() => toggleFavorite(activity.activityId)}
          />
        ))}
      </div>

      {/* No results */}
      {filtered.length === 0 && (
        <div className="text-center py-8 text-zinc-500 text-sm">{t('wellness.activities.noResults')}</div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="px-3 py-1.5 text-xs rounded border border-white/10 text-zinc-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
          >
            &laquo;
          </button>
          <span className="text-xs text-zinc-400">
            {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="px-3 py-1.5 text-xs rounded border border-white/10 text-zinc-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
          >
            &raquo;
          </button>
        </div>
      )}
    </div>
  );
}

// Table row component
function TableRow({ activity, expanded, isFavorite, hasPower, hasCadence, onToggleExpand, onToggleFavorite }: {
  activity: ActivitySummary;
  expanded: boolean;
  isFavorite: boolean;
  hasPower: boolean;
  hasCadence: boolean;
  onToggleExpand: () => void;
  onToggleFavorite: () => void;
}) {
  const sportIcon = SPORT_ICONS[activity.activityType] || SPORT_ICONS['cycling'];
  const sportLabel = SPORT_LABELS[activity.activityType] || activity.activityType;

  return (
    <>
      <tr
        className="border-b border-white/[0.03] hover:bg-white/[0.02] cursor-pointer transition-colors"
        onClick={onToggleExpand}
      >
        <td className="py-2 px-1" onClick={e => { e.stopPropagation(); onToggleFavorite(); }}>
          <svg
            className={`w-4 h-4 cursor-pointer transition-colors ${isFavorite ? 'text-yellow-400 fill-yellow-400' : 'text-zinc-600 hover:text-zinc-400'}`}
            fill={isFavorite ? 'currentColor' : 'none'}
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
          </svg>
        </td>
        <td className="py-2 px-2 text-right text-zinc-300 whitespace-nowrap">
          {new Date(activity.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
        </td>
        <td className="py-2 px-2">
          <div className="flex items-center gap-1.5">
            <svg className="w-4 h-4 text-emerald-400" fill="currentColor" viewBox="0 0 24 24">
              <path d={sportIcon} />
            </svg>
            <span className="text-zinc-400">{sportLabel}</span>
          </div>
        </td>
        <td className="py-2 px-2 text-white font-medium max-w-[200px] truncate">{activity.name}</td>
        <td className="py-2 px-2 text-right text-zinc-300">{activity.distance_km.toFixed(1)} km</td>
        <td className="py-2 px-2 text-right text-zinc-300">{formatDuration(activity.duration_s)}</td>
        <td className="py-2 px-2 text-right text-zinc-300">{activity.calories}</td>
        {hasPower && (
          <td className="py-2 px-2 text-right text-yellow-400">
            {activity.avg_power !== null ? `${Math.round(activity.avg_power)} W` : '-'}
          </td>
        )}
        {hasCadence && (
          <td className="py-2 px-2 text-right text-teal-400">
            {activity.avg_cadence !== null ? `${Math.round(activity.avg_cadence)} rpm` : '-'}
          </td>
        )}
        <td className="py-2 px-2 text-right text-zinc-300">{activity.aerobic_te?.toFixed(1) ?? '-'}</td>
        <td className="py-2 px-2 text-right text-zinc-300">{activity.max_hr ?? '-'}</td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={9 + (hasPower ? 1 : 0) + (hasCadence ? 1 : 0)} className="p-3 bg-white/[0.01]">
            <ActivityCard activity={activity} />
          </td>
        </tr>
      )}
    </>
  );
}

// Mobile card component
function MobileActivityCard({ activity, expanded, isFavorite, onToggleExpand, onToggleFavorite }: {
  activity: ActivitySummary;
  expanded: boolean;
  isFavorite: boolean;
  onToggleExpand: () => void;
  onToggleFavorite: () => void;
}) {
  const sportIcon = SPORT_ICONS[activity.activityType] || SPORT_ICONS['cycling'];
  const sportLabel = SPORT_LABELS[activity.activityType] || activity.activityType;

  return (
    <div className="card-dark !p-0 overflow-hidden border border-white/10">
      <div
        className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-white/[0.02]"
        onClick={onToggleExpand}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-emerald-400" fill="currentColor" viewBox="0 0 24 24">
              <path d={sportIcon} />
            </svg>
          </div>
          <div className="min-w-0">
            <div className="text-sm text-white font-medium truncate">{activity.name}</div>
            <div className="text-[11px] text-zinc-500">
              {new Date(activity.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
              {' · '}{sportLabel}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="text-right">
            <div className="text-sm text-white font-medium">{activity.distance_km.toFixed(1)} km</div>
            <div className="text-[11px] text-zinc-500">{formatDuration(activity.duration_s)}</div>
          </div>
          <button
            onClick={e => { e.stopPropagation(); onToggleFavorite(); }}
            className="p-1"
          >
            <svg
              className={`w-4 h-4 ${isFavorite ? 'text-yellow-400 fill-yellow-400' : 'text-zinc-600'}`}
              fill={isFavorite ? 'currentColor' : 'none'}
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          </button>
        </div>
      </div>
      {expanded && (
        <div className="border-t border-white/5">
          <ActivityCard activity={activity} />
        </div>
      )}
    </div>
  );
}
