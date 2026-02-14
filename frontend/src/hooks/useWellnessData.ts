// SPDX-License-Identifier: MIT OR Apache-2.0
// Copyright (c) 2025 Pierre Fitness Intelligence

import { useQuery } from '@tanstack/react-query';
import type { WellnessSummary } from '../types/wellness';

async function fetchWellnessData(): Promise<WellnessSummary> {
  const token = localStorage.getItem('auth_token');
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch('/api/wellness/summary', {
    headers,
    credentials: 'include', // Include cookies for authentication
  });

  if (!res.ok) {
    throw new Error(`Failed to load wellness data: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

export function useWellnessData() {
  return useQuery<WellnessSummary>({
    queryKey: ['wellness-summary'],
    queryFn: fetchWellnessData,
    staleTime: 2 * 60 * 1000, // 2 minutes - more frequent refresh for real-time data
    refetchInterval: 5 * 60 * 1000, // Auto-refresh every 5 minutes
    retry: 2,
  });
}
