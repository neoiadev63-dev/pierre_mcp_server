// SPDX-License-Identifier: MIT OR Apache-2.0
// Copyright (c) 2025 Pierre Fitness Intelligence

import { useState, useEffect, useCallback } from 'react';

const LS_KEY = 'pierre_coffee_count';
const MAX_COFFEES = 10;

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

interface CoffeeData {
  date: string;
  count: number;
}

function load(): CoffeeData {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const d = JSON.parse(raw) as CoffeeData;
      if (d.date === todayStr()) return d;
    }
  } catch { /* ignore */ }
  return { date: todayStr(), count: 0 };
}

function save(data: CoffeeData) {
  localStorage.setItem(LS_KEY, JSON.stringify(data));
}

function getAdvice(count: number): { text: string; color: string } {
  if (count === 0) return { text: 'Pas encore de café', color: '#71717A' };
  if (count <= 2) return { text: 'Consommation modérée', color: '#4ADE80' };
  if (count <= 4) return { text: 'Attention à la déshydratation', color: '#F59E0B' };
  return { text: 'Trop de caféine ! Risque de troubles du sommeil', color: '#EF4444' };
}

export default function CoffeeTracker() {
  const [data, setData] = useState<CoffeeData>(load);

  useEffect(() => {
    if (data.date !== todayStr()) {
      const fresh = { date: todayStr(), count: 0 };
      setData(fresh);
      save(fresh);
    }
  }, [data.date]);

  const increment = useCallback(() => {
    setData(prev => {
      if (prev.count >= MAX_COFFEES) return prev;
      const next = { ...prev, count: prev.count + 1 };
      save(next);
      return next;
    });
  }, []);

  const decrement = useCallback(() => {
    setData(prev => {
      if (prev.count <= 0) return prev;
      const next = { ...prev, count: prev.count - 1 };
      save(next);
      return next;
    });
  }, []);

  const advice = getAdvice(data.count);

  return (
    <div className="card-dark !p-4 border border-white/10">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-amber-900/30 flex items-center justify-center flex-shrink-0">
          <span className="text-lg">&#9749;</span>
        </div>
        <div>
          <span className="text-[10px] text-zinc-400 uppercase tracking-wider">Café</span>
          <div className="text-sm font-medium text-white">Aujourd'hui</div>
        </div>
      </div>

      <div className="flex items-center justify-center gap-4 my-3">
        <button
          onClick={decrement}
          disabled={data.count <= 0}
          className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-white text-lg font-bold transition-colors"
        >
          -
        </button>
        <div className="flex items-baseline gap-1">
          <span className="text-4xl font-bold text-amber-400">{data.count}</span>
          <span className="text-sm text-zinc-500">tasse{data.count !== 1 ? 's' : ''}</span>
        </div>
        <button
          onClick={increment}
          disabled={data.count >= MAX_COFFEES}
          className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-white text-lg font-bold transition-colors"
        >
          +
        </button>
      </div>

      {/* Visual cups */}
      <div className="flex justify-center gap-1 mb-2">
        {Array.from({ length: MAX_COFFEES }, (_, i) => (
          <span
            key={i}
            className={`text-sm transition-opacity ${i < data.count ? 'opacity-100' : 'opacity-20'}`}
          >
            &#9749;
          </span>
        ))}
      </div>

      <p className="text-xs text-center mt-2" style={{ color: advice.color }}>
        {advice.text}
      </p>
    </div>
  );
}
