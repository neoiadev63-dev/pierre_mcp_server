// SPDX-License-Identifier: MIT OR Apache-2.0
// Copyright (c) 2025 Pierre Fitness Intelligence

import { useState, useCallback, useEffect } from 'react';
import type { WaistEntry, WaistHistory } from '../types/wellness';

const LS_WAIST_KEY = 'pierre_waist_history';

function loadWaist(): WaistHistory {
  try {
    const raw = localStorage.getItem(LS_WAIST_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { entries: [], latest: null };
}

function saveWaistLocal(data: WaistHistory) {
  localStorage.setItem(LS_WAIST_KEY, JSON.stringify(data));
}

async function syncWaistToServer(waist_cm: number): Promise<void> {
  try {
    await fetch('/api/wellness/waist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ waist_cm }),
    });
  } catch { /* fire-and-forget */ }
}

async function fetchWaistFromServer(): Promise<WaistHistory | null> {
  try {
    const res = await fetch('/api/wellness/waist', { credentials: 'include' });
    if (!res.ok) return null;
    const data = await res.json();
    if (data && Array.isArray(data.entries)) return data as WaistHistory;
  } catch { /* ignore */ }
  return null;
}

export function useWaist() {
  const [data, setDataState] = useState<WaistHistory>(loadWaist);
  const [isLoading, setIsLoading] = useState(true);

  // On mount: try server first, fallback to localStorage
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const serverData = await fetchWaistFromServer();
      if (cancelled) return;
      if (serverData && serverData.entries.length > 0) {
        setDataState(serverData);
        saveWaistLocal(serverData);
      }
      setIsLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const setData = useCallback((d: WaistHistory) => {
    setDataState(d);
    saveWaistLocal(d);
  }, []);

  const addMeasurement = useCallback((waist_cm: number) => {
    const now = new Date();
    const entry: WaistEntry = {
      date: now.toISOString().slice(0, 10),
      time: now.toTimeString().slice(0, 5),
      waist_cm,
    };
    const newData: WaistHistory = {
      entries: [...data.entries, entry],
      latest: entry,
    };
    setData(newData);
    syncWaistToServer(waist_cm);
  }, [data, setData]);

  const deleteMeasurement = useCallback((index: number) => {
    const newEntries = data.entries.filter((_, i) => i !== index);
    const newData: WaistHistory = {
      entries: newEntries,
      latest: newEntries.length > 0 ? newEntries[newEntries.length - 1] : null,
    };
    setData(newData);
  }, [data, setData]);

  return {
    data,
    isLoading,
    addMeasurement,
    deleteMeasurement,
  };
}
