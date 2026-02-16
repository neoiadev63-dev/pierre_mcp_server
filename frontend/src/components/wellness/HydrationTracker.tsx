// SPDX-License-Identifier: MIT OR Apache-2.0
// Copyright (c) 2025 Pierre Fitness Intelligence

import { useState, useEffect, useCallback } from 'react';

const LS_KEY = 'pierre_hydration';
const DAILY_GOAL_ML = 2500;

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

interface HydrationEntry {
  ml: number;
  time: string;
}

interface HydrationData {
  date: string;
  entries: HydrationEntry[];
}

function load(): HydrationData {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const d = JSON.parse(raw) as HydrationData;
      if (d.date === todayStr()) return d;
    }
  } catch { /* ignore */ }
  return { date: todayStr(), entries: [] };
}

function save(data: HydrationData) {
  localStorage.setItem(LS_KEY, JSON.stringify(data));
}

const QUICK_ADD = [
  { label: '150 ml', ml: 150, icon: 'Verre' },
  { label: '250 ml', ml: 250, icon: 'Tasse' },
  { label: '500 ml', ml: 500, icon: 'Bouteille' },
  { label: '750 ml', ml: 750, icon: 'Gourde' },
];

export default function HydrationTracker() {
  const [data, setData] = useState<HydrationData>(load);
  const [customMl, setCustomMl] = useState('');

  useEffect(() => {
    if (data.date !== todayStr()) {
      const fresh: HydrationData = { date: todayStr(), entries: [] };
      setData(fresh);
      save(fresh);
    }
  }, [data.date]);

  const totalMl = data.entries.reduce((sum, e) => sum + e.ml, 0);
  const pct = Math.min((totalMl / DAILY_GOAL_ML) * 100, 100);

  const addWater = useCallback((ml: number) => {
    setData(prev => {
      const entry: HydrationEntry = {
        ml,
        time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      };
      const next = { ...prev, entries: [...prev.entries, entry] };
      save(next);
      return next;
    });
  }, []);

  const removeLastEntry = useCallback(() => {
    setData(prev => {
      if (prev.entries.length === 0) return prev;
      const next = { ...prev, entries: prev.entries.slice(0, -1) };
      save(next);
      return next;
    });
  }, []);

  const handleCustomAdd = () => {
    const val = parseInt(customMl, 10);
    if (val > 0 && val <= 5000) {
      addWater(val);
      setCustomMl('');
    }
  };

  const liters = (totalMl / 1000).toFixed(1);
  const goalLiters = (DAILY_GOAL_ML / 1000).toFixed(1);

  return (
    <div className="card-dark !p-4 border border-white/10">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
          <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
          </svg>
        </div>
        <div className="flex-1">
          <span className="text-[10px] text-zinc-400 uppercase tracking-wider">Hydratation</span>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-blue-400">{liters}</span>
            <span className="text-sm text-zinc-500">/ {goalLiters} L</span>
          </div>
        </div>
        {data.entries.length > 0 && (
          <button
            onClick={removeLastEntry}
            className="text-zinc-500 hover:text-red-400 transition-colors p-1"
            title="Annuler le dernier ajout"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
          </button>
        )}
      </div>

      {/* Progress bar */}
      <div className="w-full h-3 rounded-full bg-white/5 overflow-hidden mb-3">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            background: pct >= 100
              ? 'linear-gradient(90deg, #22D3EE, #4ADE80)'
              : 'linear-gradient(90deg, #3B82F6, #22D3EE)',
          }}
        />
      </div>

      {/* Quick add buttons */}
      <div className="grid grid-cols-4 gap-2 mb-3">
        {QUICK_ADD.map((qa) => (
          <button
            key={qa.ml}
            onClick={() => addWater(qa.ml)}
            className="flex flex-col items-center py-2 px-1 rounded-lg bg-white/[0.04] hover:bg-blue-500/20 border border-white/5 hover:border-blue-500/30 transition-colors"
          >
            <span className="text-xs font-medium text-blue-300">{qa.label}</span>
            <span className="text-[10px] text-zinc-500">{qa.icon}</span>
          </button>
        ))}
      </div>

      {/* Custom input */}
      <div className="flex gap-2">
        <input
          type="number"
          value={customMl}
          onChange={(e) => setCustomMl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCustomAdd()}
          placeholder="ml"
          min={1}
          max={5000}
          className="flex-1 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/10 text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-blue-500/50"
        />
        <button
          onClick={handleCustomAdd}
          disabled={!customMl || parseInt(customMl, 10) <= 0}
          className="px-3 py-1.5 rounded-lg bg-blue-500/20 text-blue-300 text-sm font-medium hover:bg-blue-500/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          Ajouter
        </button>
      </div>

      {/* Recent entries */}
      {data.entries.length > 0 && (
        <div className="mt-3 max-h-24 overflow-y-auto space-y-1">
          {data.entries.slice().reverse().map((entry, i) => (
            <div key={i} className="flex items-center justify-between text-xs px-2 py-1 rounded bg-white/[0.02]">
              <span className="text-zinc-500">{entry.time}</span>
              <span className="text-zinc-300">+{entry.ml} ml</span>
            </div>
          ))}
        </div>
      )}

      {pct >= 100 && (
        <p className="text-xs text-center text-green-400 mt-2 font-medium">
          Objectif atteint !
        </p>
      )}
    </div>
  );
}
