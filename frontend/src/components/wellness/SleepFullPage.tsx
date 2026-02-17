// SPDX-License-Identifier: MIT OR Apache-2.0
// Copyright (c) 2025 Pierre Fitness Intelligence

import { useState, useMemo, useRef, useEffect, useCallback, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { WellnessSummary, WellnessDay, SleepDetail } from '../../types/wellness';

// ── Sleep time adjustments (persisted in localStorage) ──────────────────────

interface SleepTimeAdjustment {
  bedtime?: string;  // "HH:MM"
  waketime?: string; // "HH:MM"
}

function getSleepAdjustmentKey(dateStr: string): string {
  return `pierre_sleep_adj_${dateStr}`;
}

function loadSleepAdjustment(dateStr: string): SleepTimeAdjustment {
  try {
    const raw = localStorage.getItem(getSleepAdjustmentKey(dateStr));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveSleepAdjustment(dateStr: string, adj: SleepTimeAdjustment) {
  const key = getSleepAdjustmentKey(dateStr);
  if (!adj.bedtime && !adj.waketime) {
    localStorage.removeItem(key);
  } else {
    localStorage.setItem(key, JSON.stringify(adj));
  }
}

interface SleepFullPageProps {
  data: WellnessSummary;
}

// ── Constants ────────────────────────────────────────────────────────────────

const PHASE_COLORS = {
  deep: '#6366F1',
  light: '#818CF8',
  rem: '#C084FC',
  awake: '#F472B6',
};

const PHASE_LABELS: Record<string, string> = {
  deep: 'Profond',
  light: 'Leger',
  rem: 'Sommeil paradoxal',
  awake: 'Eveille',
};

type OverlayType = 'hr' | 'spo2' | 'resp' | 'restless' | 'bb';

const OVERLAY_CONFIG: Record<OverlayType, { label: string; color: string; unit: string }> = {
  restless: { label: 'Eveil/Agitation', color: '#F472B6', unit: '' },
  hr: { label: 'Frequence cardiaque au repos', color: '#000000', unit: 'bpm' },
  bb: { label: 'Body Battery', color: '#4ADE80', unit: '' },
  spo2: { label: 'Oxymetre de pouls', color: '#60A5FA', unit: '%' },
  resp: { label: 'Respiration', color: '#10B981', unit: 'brpm' },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m.toString().padStart(2, '0')}m`;
}

function formatTime(epochMs: number): string {
  const d = new Date(epochMs);
  return `${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`;
}

function formatTime24(epochMs: number): string {
  const d = new Date(epochMs);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

function getScoreColor(score: number): string {
  if (score >= 80) return '#4ADE80';
  if (score >= 60) return '#818CF8';
  if (score >= 40) return '#F59E0B';
  return '#EF4444';
}

function getScoreLabel(score: number): string {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Bon';
  if (score >= 40) return 'Passable';
  return 'Mauvais';
}

function getPhaseRating(phase: string, seconds: number, totalSeconds: number): { text: string; color: string; stars: number } {
  const pct = totalSeconds > 0 ? (seconds / totalSeconds) * 100 : 0;
  if (phase === 'deep') {
    // Ideal: 15-20%+
    if (pct >= 20) return { text: 'Excellent', color: '#4ADE80', stars: 5 };
    if (pct >= 15) return { text: 'Tres bien', color: '#4ADE80', stars: 4 };
    if (pct >= 10) return { text: 'Bon', color: '#818CF8', stars: 3 };
    if (pct >= 5) return { text: 'Passable', color: '#F59E0B', stars: 2 };
    return { text: 'Insuffisant', color: '#EF4444', stars: 1 };
  }
  if (phase === 'light') {
    // Ideal: 40-60%
    if (pct >= 40 && pct <= 60) return { text: 'Excellent', color: '#4ADE80', stars: 5 };
    if (pct >= 35 && pct <= 65) return { text: 'Tres bien', color: '#4ADE80', stars: 4 };
    if (pct >= 30) return { text: 'Bon', color: '#818CF8', stars: 3 };
    if (pct >= 20) return { text: 'Passable', color: '#F59E0B', stars: 2 };
    return { text: 'Insuffisant', color: '#EF4444', stars: 1 };
  }
  if (phase === 'rem') {
    // Ideal: 20-25%+
    if (pct >= 25) return { text: 'Excellent', color: '#4ADE80', stars: 5 };
    if (pct >= 20) return { text: 'Tres bien', color: '#4ADE80', stars: 4 };
    if (pct >= 15) return { text: 'Bon', color: '#818CF8', stars: 3 };
    if (pct >= 10) return { text: 'Passable', color: '#F59E0B', stars: 2 };
    return { text: 'Insuffisant', color: '#EF4444', stars: 1 };
  }
  // awake: lower is better
  if (pct <= 2) return { text: 'Excellent', color: '#4ADE80', stars: 5 };
  if (pct <= 5) return { text: 'Tres bien', color: '#4ADE80', stars: 4 };
  if (pct <= 10) return { text: 'Bon', color: '#818CF8', stars: 3 };
  if (pct <= 15) return { text: 'Passable', color: '#F59E0B', stars: 2 };
  return { text: 'Mauvais', color: '#EF4444', stars: 1 };
}

function getDurationStars(durationH: number): number {
  if (durationH >= 8) return 5;
  if (durationH >= 7) return 4;
  if (durationH >= 6) return 3;
  if (durationH >= 5) return 2;
  return 1;
}

function getStressStars(stressAvg: number | null): number {
  if (stressAvg === null) return 0;
  if (stressAvg < 15) return 5;
  if (stressAvg < 25) return 4;
  if (stressAvg < 35) return 3;
  if (stressAvg < 50) return 2;
  return 1;
}

function getFeedbackText(score: number, durationH: number): string {
  if (durationH < 5) {
    if (score >= 60) return 'Court, continu';
    return 'Court et agite';
  }
  if (durationH < 7) {
    if (score >= 70) return 'Adequat et reparateur';
    return 'Duree correcte mais sommeil leger';
  }
  if (score >= 80) return 'Nuit reparatrice et continue';
  if (score >= 60) return 'Bonne nuit de sommeil';
  return 'Sommeil perturbe malgre une duree correcte';
}

function getFeedbackDesc(score: number, durationH: number): string {
  if (durationH < 5) {
    if (score >= 60) return 'Votre sommeil a ete court, mais continu et sans interruption.';
    return 'Votre sommeil a ete court et agite. Essayez de dormir plus longtemps.';
  }
  if (score >= 70) return 'Bonne nuit avec des phases equilibrees. Vous devriez vous sentir repose.';
  return 'Votre sommeil pourrait etre ameliore. Pensez a reguler votre heure de coucher.';
}

// Map sleep level number to phase key
function levelToPhase(level: number): string {
  if (level <= 0.3) return 'deep';
  if (level <= 1.5) return 'light';
  if (level <= 2.5) return 'rem';
  return 'awake';
}

// ── Sleep Timeline Canvas ────────────────────────────────────────────────────

interface TimelineCanvasProps {
  detail: SleepDetail;
  activeOverlay: OverlayType | null;
}

function SleepTimelineCanvas({ detail, activeOverlay }: TimelineCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);

  // IMPORTANT: Garmin ISO timestamps from sleepLevels are GMT (no timezone suffix).
  // JS parses them as local → we must append 'Z' to interpret as UTC.
  // epoch_ms values (HR, BB, resp, stress) are already real UTC epoch ms.
  const gmtIsoToMs = useCallback((iso: string): number => {
    // Append Z if not already timezone-aware
    if (!iso.endsWith('Z') && !iso.includes('+')) {
      return new Date(iso + 'Z').getTime();
    }
    return new Date(iso).getTime();
  }, []);

  // Derive chart time range from actual data (not sleepStartLocal which uses Garmin's "local-as-UTC" convention)
  const { chartStartMs, chartEndMs } = useMemo(() => {
    const allMs: number[] = [];

    // Sleep level boundaries
    for (const lv of detail.sleepLevels) {
      allMs.push(gmtIsoToMs(lv.start));
      allMs.push(gmtIsoToMs(lv.end));
    }
    // HR data boundaries
    if (detail.hrTimeline.length > 0) {
      allMs.push(detail.hrTimeline[0].epoch_ms);
      allMs.push(detail.hrTimeline[detail.hrTimeline.length - 1].epoch_ms);
    }

    if (allMs.length === 0) return { chartStartMs: 0, chartEndMs: 1 };

    const minMs = Math.min(...allMs);
    const maxMs = Math.max(...allMs);
    // Add small padding (2 min each side)
    return { chartStartMs: minMs - 120000, chartEndMs: maxMs + 120000 };
  }, [detail, gmtIsoToMs]);

  const totalMs = chartEndMs - chartStartMs;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    const W = rect.width;
    const H = 220;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    const padLeft = 65;
    const padRight = activeOverlay ? 45 : 15;
    const padTop = 10;
    const padBottom = 30;
    const chartW = W - padLeft - padRight;
    const chartH = H - padTop - padBottom;

    // Y levels for sleep stages (Garmin style: awake on top, deep on bottom)
    const stageY: Record<string, number> = {
      awake: padTop,
      rem: padTop + chartH * 0.25,
      light: padTop + chartH * 0.5,
      deep: padTop + chartH * 0.75,
    };

    // X scale: map UTC epoch ms to canvas x
    const xScale = (ms: number) => padLeft + ((ms - chartStartMs) / totalMs) * chartW;

    // Draw sleep level blocks
    for (const epoch of detail.sleepLevels) {
      const phase = levelToPhase(epoch.level);
      const x1 = xScale(gmtIsoToMs(epoch.start));
      const x2 = xScale(gmtIsoToMs(epoch.end));
      const y = stageY[phase] ?? stageY.light;
      const color = PHASE_COLORS[phase as keyof typeof PHASE_COLORS] || PHASE_COLORS.light;

      ctx.fillStyle = color;
      ctx.globalAlpha = 0.7;
      // Draw from this stage down to bottom
      const blockBottom = padTop + chartH;
      ctx.fillRect(x1, y, Math.max(x2 - x1, 1), blockBottom - y);
    }
    ctx.globalAlpha = 1;

    // Draw Y-axis labels
    ctx.fillStyle = '#71717A';
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('Eveille', padLeft - 8, stageY.awake + 12);
    ctx.fillText('Sommeil', padLeft - 8, stageY.rem + 6);
    ctx.fillText('...', padLeft - 8, stageY.rem + 18);
    ctx.fillText('Leger', padLeft - 8, stageY.light + 12);
    ctx.fillText('Profond', padLeft - 8, stageY.deep + 12);

    // Draw dashed vertical lines for start/end
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = '#52525B';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padLeft, padTop);
    ctx.lineTo(padLeft, padTop + chartH);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(padLeft + chartW, padTop);
    ctx.lineTo(padLeft + chartW, padTop + chartH);
    ctx.stroke();
    ctx.setLineDash([]);

    // X-axis time labels: show local clock times at each full hour
    ctx.fillStyle = '#71717A';
    ctx.font = '10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    // Find first full hour at or after chartStart
    const startDate = new Date(chartStartMs);
    const firstHourMs = new Date(
      startDate.getFullYear(), startDate.getMonth(), startDate.getDate(),
      startDate.getHours() + 1, 0, 0
    ).getTime();
    const hours = totalMs / 3600000;
    const hourStep = hours > 8 ? 2 : 1;
    for (let ms = firstHourMs; ms <= chartEndMs; ms += hourStep * 3600000) {
      const x = xScale(ms);
      if (x >= padLeft && x <= padLeft + chartW) {
        const d = new Date(ms);
        const label = `${d.getHours()}h`;
        ctx.fillText(label, x, H - 5);
        // Small tick
        ctx.fillStyle = '#3F3F46';
        ctx.fillRect(x - 0.5, padTop + chartH, 1, 5);
        ctx.fillStyle = '#71717A';
      }
    }

    // Draw overlay line if active
    if (activeOverlay) {
      const config = OVERLAY_CONFIG[activeOverlay];
      let points: { x: number; y: number; value: number }[] = [];

      if (activeOverlay === 'hr' && detail.hrTimeline.length > 0) {
        const vals = detail.hrTimeline.map(p => p.value);
        const minV = Math.min(...vals) - 2;
        const maxV = Math.max(...vals) + 2;
        points = detail.hrTimeline.map(p => ({
          x: xScale(p.epoch_ms),
          y: padTop + chartH - ((p.value - minV) / (maxV - minV)) * chartH,
          value: p.value,
        }));
        ctx.fillStyle = '#A1A1AA';
        ctx.font = '10px system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`${Math.round(maxV)}`, padLeft + chartW + 5, padTop + 10);
        ctx.fillText(`${Math.round(minV)}`, padLeft + chartW + 5, padTop + chartH);
      } else if (activeOverlay === 'resp' && detail.respTimeline.length > 0) {
        const vals = detail.respTimeline.map(p => p.value);
        const minV = Math.min(...vals) - 1;
        const maxV = Math.max(...vals) + 1;
        points = detail.respTimeline.map(p => ({
          x: xScale(p.epoch_ms),
          y: padTop + chartH - ((p.value - minV) / (maxV - minV)) * chartH,
          value: p.value,
        }));
        ctx.fillStyle = config.color;
        ctx.font = '10px system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`${Math.round(maxV)}`, padLeft + chartW + 5, padTop + 10);
        ctx.fillText(`${Math.round(minV)}`, padLeft + chartW + 5, padTop + chartH);
      } else if (activeOverlay === 'spo2' && detail.spo2Timeline.length > 0) {
        const vals = detail.spo2Timeline.map(p => p.value);
        const minV = Math.min(...vals) - 1;
        const maxV = 100;
        points = detail.spo2Timeline.map(p => ({
          x: xScale(gmtIsoToMs(p.timestamp)),
          y: padTop + chartH - ((p.value - minV) / (maxV - minV)) * chartH,
          value: p.value,
        }));
        ctx.fillStyle = config.color;
        ctx.font = '10px system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`${maxV}`, padLeft + chartW + 5, padTop + 10);
        ctx.fillText(`${Math.round(minV)}`, padLeft + chartW + 5, padTop + chartH);
      } else if (activeOverlay === 'bb' && detail.bbTimeline.length > 0) {
        const maxV = 100;
        const minV = 0;
        points = detail.bbTimeline.map(p => ({
          x: xScale(p.epoch_ms),
          y: padTop + chartH - ((p.value - minV) / (maxV - minV)) * chartH,
          value: p.value,
        }));
        ctx.fillStyle = config.color;
        ctx.font = '10px system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`${maxV}`, padLeft + chartW + 5, padTop + 10);
        ctx.fillText(`${minV}`, padLeft + chartW + 5, padTop + chartH);
      } else if (activeOverlay === 'restless') {
        // Draw restless moments as pink markers on the timeline
        ctx.fillStyle = '#F472B6';
        for (const moment of detail.restlessMoments) {
          const x = xScale(moment.epoch_ms);
          if (x >= padLeft && x <= padLeft + chartW) {
            ctx.globalAlpha = 0.8;
            ctx.fillRect(x - 1, padTop, 2, chartH);
          }
        }
        ctx.globalAlpha = 1;
      }

      // Draw overlay line
      if (points.length > 1 && activeOverlay !== 'restless') {
        ctx.beginPath();
        ctx.strokeStyle = config.color === '#000000' ? '#D4D4D8' : config.color;
        ctx.lineWidth = 1.5;
        let started = false;
        for (const p of points) {
          if (p.x >= padLeft && p.x <= padLeft + chartW) {
            if (!started) {
              ctx.moveTo(p.x, p.y);
              started = true;
            } else {
              ctx.lineTo(p.x, p.y);
            }
          }
        }
        ctx.stroke();
      }
    }
  }, [detail, chartStartMs, chartEndMs, totalMs, activeOverlay, gmtIsoToMs]);

  useEffect(() => {
    draw();
    const handleResize = () => draw();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [draw]);

  // Handle mouse move for tooltip
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const padLeft = 65;
    const padRight = activeOverlay ? 45 : 15;
    const chartW = rect.width - padLeft - padRight;

    if (x < padLeft || x > padLeft + chartW) {
      setTooltip(null);
      return;
    }

    const pct = (x - padLeft) / chartW;
    const ms = chartStartMs + pct * totalMs;
    const timeStr = formatTime(ms);

    // Find which sleep level we're in
    let phase = '';
    for (const epoch of detail.sleepLevels) {
      const s = gmtIsoToMs(epoch.start);
      const en = gmtIsoToMs(epoch.end);
      if (ms >= s && ms < en) {
        phase = PHASE_LABELS[levelToPhase(epoch.level)] || '';
        break;
      }
    }

    let overlayText = '';
    if (activeOverlay === 'hr' && detail.hrTimeline.length > 0) {
      const closest = findClosest(detail.hrTimeline, ms, p => p.epoch_ms);
      if (closest) overlayText = `${closest.value} bpm`;
    } else if (activeOverlay === 'resp' && detail.respTimeline.length > 0) {
      const closest = findClosest(detail.respTimeline, ms, p => p.epoch_ms);
      if (closest) overlayText = `${closest.value} brpm`;
    } else if (activeOverlay === 'spo2' && detail.spo2Timeline.length > 0) {
      const closest = findClosest(detail.spo2Timeline, ms, p => gmtIsoToMs(p.timestamp));
      if (closest) overlayText = `${closest.value}%`;
    } else if (activeOverlay === 'bb' && detail.bbTimeline.length > 0) {
      const closest = findClosest(detail.bbTimeline, ms, p => p.epoch_ms);
      if (closest) overlayText = `BB: ${closest.value}`;
    }

    setTooltip({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      text: `${timeStr} | ${phase}${overlayText ? ` | ${overlayText}` : ''}`,
    });
  }, [detail, chartStartMs, totalMs, activeOverlay, gmtIsoToMs]);

  return (
    <div ref={containerRef} className="relative">
      <canvas
        ref={canvasRef}
        className="w-full cursor-crosshair"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTooltip(null)}
      />
      {tooltip && (
        <div
          className="absolute pointer-events-none z-10 px-2.5 py-1.5 rounded bg-zinc-800 border border-white/10 text-[11px] text-zinc-200 whitespace-nowrap shadow-lg"
          style={{
            left: Math.min(tooltip.x, (containerRef.current?.clientWidth ?? 400) - 180),
            top: tooltip.y - 40,
          }}
        >
          {tooltip.text}
        </div>
      )}
    </div>
  );
}

function findClosest<T>(arr: T[], target: number, getMs: (item: T) => number): T | null {
  if (arr.length === 0) return null;
  let closest = arr[0];
  let minDiff = Math.abs(getMs(arr[0]) - target);
  for (let i = 1; i < arr.length; i++) {
    const diff = Math.abs(getMs(arr[i]) - target);
    if (diff < minDiff) {
      minDiff = diff;
      closest = arr[i];
    }
  }
  return minDiff < 300000 ? closest : null; // within 5 min
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function SleepFullPage({ data }: SleepFullPageProps) {
  const { t } = useTranslation();
  const [activeOverlay, setActiveOverlay] = useState<OverlayType | null>(null);

  // Get latest night's sleep data
  const latestDay = useMemo(() => {
    return [...data.days]
      .reverse()
      .find(d => d.sleep && d.sleep.duration_seconds > 0) || null;
  }, [data.days]);

  // Manual sleep time adjustments
  const nightDate = latestDay?.date ?? '';
  const [sleepAdj, setSleepAdj] = useState<SleepTimeAdjustment>(() => loadSleepAdjustment(nightDate));
  const [editingBed, setEditingBed] = useState(false);
  const [editingWake, setEditingWake] = useState(false);

  // Reload adjustment when night changes
  useEffect(() => {
    if (nightDate) setSleepAdj(loadSleepAdjustment(nightDate));
  }, [nightDate]);

  const handleAdjChange = useCallback((field: 'bedtime' | 'waketime', value: string) => {
    setSleepAdj(prev => {
      const next = { ...prev, [field]: value || undefined };
      if (nightDate) saveSleepAdjustment(nightDate, next);
      return next;
    });
  }, [nightDate]);

  const clearAdj = useCallback((field: 'bedtime' | 'waketime') => {
    setSleepAdj(prev => {
      const next = { ...prev };
      delete next[field];
      if (nightDate) saveSleepAdjustment(nightDate, next);
      return next;
    });
    if (field === 'bedtime') setEditingBed(false);
    else setEditingWake(false);
  }, [nightDate]);

  const sleep = latestDay?.sleep;
  const detail = data.sleepDetail;
  const stressAvg = latestDay?.stress.average ?? null;

  if (!sleep || !latestDay) {
    return (
      <div className="card-dark text-center py-16">
        <svg className="w-12 h-12 mx-auto text-zinc-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
        <h3 className="text-lg font-medium text-white mb-2">Aucune donnee de sommeil</h3>
        <p className="text-sm text-zinc-400">Portez votre montre la nuit pour obtenir des donnees de sommeil.</p>
      </div>
    );
  }

  const score = sleep.score ?? 0;
  const totalSleep = sleep.deep_seconds + sleep.light_seconds + sleep.rem_seconds + sleep.awake_seconds;
  const durationH = sleep.duration_seconds / 3600;
  const feedback = getFeedbackText(score, durationH);
  const feedbackDesc = getFeedbackDesc(score, durationH);
  const scoreColor = getScoreColor(score);

  const durationStars = getDurationStars(durationH);
  const stressStars = getStressStars(stressAvg);

  const phases = [
    { key: 'duration', label: 'Duree', value: formatDuration(sleep.duration_seconds), stars: durationStars, rating: durationStars >= 4 ? { text: 'Excellent', color: '#4ADE80' } : durationStars >= 3 ? { text: 'Bon', color: '#818CF8' } : { text: 'Mauvais', color: '#EF4444' } },
    { key: 'stress', label: 'Stress', value: stressAvg !== null ? `${Math.round(stressAvg)} moy.` : '--', stars: stressStars, rating: stressStars >= 4 ? { text: 'Excellent', color: '#4ADE80' } : stressStars >= 3 ? { text: 'Passable', color: '#F59E0B' } : stressStars > 0 ? { text: 'Mauvais', color: '#EF4444' } : { text: '--', color: '#71717A' } },
    { key: 'deep', label: t('wellness.deep'), value: formatDuration(sleep.deep_seconds), ...(() => { const r = getPhaseRating('deep', sleep.deep_seconds, totalSleep); return { stars: r.stars, rating: r }; })() },
    { key: 'light', label: t('wellness.light'), value: formatDuration(sleep.light_seconds), ...(() => { const r = getPhaseRating('light', sleep.light_seconds, totalSleep); return { stars: r.stars, rating: r }; })() },
    { key: 'rem', label: 'Sommeil paradoxal', value: formatDuration(sleep.rem_seconds), ...(() => { const r = getPhaseRating('rem', sleep.rem_seconds, totalSleep); return { stars: r.stars, rating: r }; })() },
    { key: 'awake', label: 'Eveil/Agitation', value: detail ? `${detail.restlessCount} periodes` : formatDuration(sleep.awake_seconds), ...(() => { const r = getPhaseRating('awake', sleep.awake_seconds, totalSleep); return { stars: r.stars, rating: r }; })() },
  ];

  const toggleOverlay = (type: OverlayType) => {
    setActiveOverlay(prev => prev === type ? null : type);
  };

  return (
    <div className="space-y-6">
      {/* ── Focus: Last Night ── */}
      <div className="card-dark border border-white/10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-1">
          {/* Left column: Score + feedback */}
          <div className="flex flex-col items-center lg:items-start gap-4">
            {/* Score circle */}
            <div className="text-center">
              <div className="text-6xl font-bold tabular-nums" style={{ color: scoreColor }}>{score}</div>
              <div className="text-sm text-zinc-500">100</div>
              <div className="text-xs text-zinc-500 mt-1">Score</div>
            </div>

            <div className="w-full h-px bg-white/10" />

            {/* Quality + Duration */}
            <div className="flex gap-8">
              <div>
                <span className="text-lg font-semibold" style={{ color: scoreColor }}>{getScoreLabel(score)}</span>
                <span className="text-[11px] text-zinc-500 block">Qualite</span>
              </div>
              <div>
                <span className="text-lg font-semibold text-white">{formatDuration(sleep.duration_seconds)}</span>
                <span className="text-[11px] text-zinc-500 block">Duree</span>
              </div>
            </div>

            {/* Feedback */}
            <div>
              <p className="text-sm font-medium text-white">{feedback}</p>
              <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{feedbackDesc}</p>
            </div>
          </div>

          {/* Right column: Phase breakdown cards */}
          <div className="flex flex-col gap-2">
            {phases.map((phase) => (
              <div
                key={phase.key}
                className="flex items-center justify-between px-4 py-3 rounded-lg bg-white/[0.03] border border-white/5"
              >
                <div>
                  <span className="text-sm font-medium text-white">{phase.label}</span>
                  <span className="text-xs text-zinc-500 block">{phase.value}</span>
                </div>
                <div className="flex items-center gap-2">
                  <StarRating stars={phase.stars} />
                  <span className="text-xs font-medium w-16 text-right" style={{ color: phase.rating.color }}>
                    {phase.rating.text}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Sleep Timeline ── */}
      {detail && detail.sleepLevels.length > 0 && (
        <div className="card-dark border border-white/10">
          {/* Bedtime / Waketime - derive from actual sleep levels, with manual override */}
          {(() => {
            const levels = detail.sleepLevels;
            if (levels.length === 0) return null;
            const garminBedMs = new Date(levels[0].start.endsWith('Z') ? levels[0].start : levels[0].start + 'Z').getTime();
            const garminWakeMs = new Date(
              (levels[levels.length - 1].end.endsWith('Z') ? levels[levels.length - 1].end : levels[levels.length - 1].end + 'Z')
            ).getTime();

            const garminBedTime = formatTime(garminBedMs);
            const garminWakeTime = formatTime(garminWakeMs);
            const displayBed = sleepAdj.bedtime ?? garminBedTime;
            const displayWake = sleepAdj.waketime ?? garminWakeTime;
            const bedIsAdjusted = !!sleepAdj.bedtime;
            const wakeIsAdjusted = !!sleepAdj.waketime;

            // Compute adjusted duration
            let adjDurationInfo: string | null = null;
            if (bedIsAdjusted || wakeIsAdjusted) {
              const [bH, bM] = (displayBed).split(':').map(Number);
              const [wH, wM] = (displayWake).split(':').map(Number);
              const bedMin = bH * 60 + bM;
              let wakeMin = wH * 60 + wM;
              if (wakeMin <= bedMin) wakeMin += 24 * 60; // crosses midnight
              const diffMin = wakeMin - bedMin;
              const h = Math.floor(diffMin / 60);
              const m = diffMin % 60;
              adjDurationInfo = `Duree ajustee : ${h}h ${m.toString().padStart(2, '0')}m`;
            }

            return (
              <div className="mb-3">
                <div className="flex items-center justify-between">
                  {/* Bedtime */}
                  <div className="text-center">
                    {editingBed ? (
                      <div className="flex flex-col items-center gap-1">
                        <input
                          type="time"
                          value={sleepAdj.bedtime ?? formatTime24(garminBedMs)}
                          onChange={(e: ChangeEvent<HTMLInputElement>) => handleAdjChange('bedtime', e.target.value)}
                          className="bg-zinc-800 border border-pierre-cyan/40 rounded px-2 py-1 text-white text-sm tabular-nums text-center w-24 focus:outline-none focus:border-pierre-cyan"
                        />
                        <div className="flex gap-1">
                          <button onClick={() => setEditingBed(false)} className="text-[10px] text-pierre-cyan">OK</button>
                          {bedIsAdjusted && (
                            <button onClick={() => clearAdj('bedtime')} className="text-[10px] text-zinc-500 hover:text-red-400">Reset</button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setEditingBed(true)}
                        className="group cursor-pointer"
                        title="Ajuster l'heure de coucher"
                      >
                        <span className={`text-lg font-semibold tabular-nums ${bedIsAdjusted ? 'text-pierre-cyan' : 'text-white'} group-hover:text-pierre-cyan transition-colors`}>
                          {displayBed}
                        </span>
                        <span className="text-[10px] text-zinc-500 block">
                          Heure de coucher
                          {bedIsAdjusted && <span className="text-pierre-cyan/60 ml-1">(ajuste)</span>}
                        </span>
                        <svg className="w-3 h-3 mx-auto mt-0.5 text-zinc-600 group-hover:text-pierre-cyan transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                    )}
                  </div>

                  <h3 className="text-sm font-medium text-zinc-400">Ligne du temps</h3>

                  {/* Waketime */}
                  <div className="text-center">
                    {editingWake ? (
                      <div className="flex flex-col items-center gap-1">
                        <input
                          type="time"
                          value={sleepAdj.waketime ?? formatTime24(garminWakeMs)}
                          onChange={(e: ChangeEvent<HTMLInputElement>) => handleAdjChange('waketime', e.target.value)}
                          className="bg-zinc-800 border border-pierre-cyan/40 rounded px-2 py-1 text-white text-sm tabular-nums text-center w-24 focus:outline-none focus:border-pierre-cyan"
                        />
                        <div className="flex gap-1">
                          <button onClick={() => setEditingWake(false)} className="text-[10px] text-pierre-cyan">OK</button>
                          {wakeIsAdjusted && (
                            <button onClick={() => clearAdj('waketime')} className="text-[10px] text-zinc-500 hover:text-red-400">Reset</button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setEditingWake(true)}
                        className="group cursor-pointer"
                        title="Ajuster l'heure de lever"
                      >
                        <span className={`text-lg font-semibold tabular-nums ${wakeIsAdjusted ? 'text-pierre-cyan' : 'text-white'} group-hover:text-pierre-cyan transition-colors`}>
                          {displayWake}
                        </span>
                        <span className="text-[10px] text-zinc-500 block">
                          Heure de lever
                          {wakeIsAdjusted && <span className="text-pierre-cyan/60 ml-1">(ajuste)</span>}
                        </span>
                        <svg className="w-3 h-3 mx-auto mt-0.5 text-zinc-600 group-hover:text-pierre-cyan transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

                {/* Adjusted duration info */}
                {adjDurationInfo && (
                  <div className="text-center mt-2">
                    <span className="text-xs text-pierre-cyan/80 bg-pierre-cyan/10 px-3 py-1 rounded-full border border-pierre-cyan/20">
                      {adjDurationInfo}
                    </span>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Canvas timeline */}
          <SleepTimelineCanvas
            detail={detail}
            activeOverlay={activeOverlay}
          />

          {/* Legend */}
          <div className="flex flex-wrap justify-center gap-4 mt-3 mb-4">
            <LegendDot color={PHASE_COLORS.deep} label={t('wellness.deep')} />
            <LegendDot color={PHASE_COLORS.light} label={t('wellness.light')} />
            <LegendDot color={PHASE_COLORS.rem} label="Sommeil paradoxal" />
            <LegendDot color={PHASE_COLORS.awake} label={t('wellness.awake')} />
            {activeOverlay && activeOverlay !== 'restless' && (
              <LegendDot
                color={OVERLAY_CONFIG[activeOverlay].color === '#000000' ? '#D4D4D8' : OVERLAY_CONFIG[activeOverlay].color}
                label={OVERLAY_CONFIG[activeOverlay].label}
                line
              />
            )}
          </div>

          {/* Toggle buttons */}
          <div className="flex flex-wrap justify-center gap-2">
            {(Object.keys(OVERLAY_CONFIG) as OverlayType[]).map((key) => {
              const cfg = OVERLAY_CONFIG[key];
              const isActive = activeOverlay === key;
              // Check if data exists for this overlay
              let hasData = true;
              if (key === 'hr') hasData = detail.hrTimeline.length > 0;
              if (key === 'resp') hasData = detail.respTimeline.length > 0;
              if (key === 'spo2') hasData = detail.spo2Timeline.length > 0;
              if (key === 'bb') hasData = detail.bbTimeline.length > 0;
              if (key === 'restless') hasData = detail.restlessMoments.length > 0;

              return (
                <button
                  key={key}
                  onClick={() => toggleOverlay(key)}
                  disabled={!hasData}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                    isActive
                      ? 'bg-zinc-700 text-white border-zinc-500'
                      : hasData
                        ? 'border-white/10 text-zinc-400 hover:text-white hover:border-white/30'
                        : 'border-white/5 text-zinc-600 cursor-not-allowed'
                  }`}
                >
                  {cfg.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Metrics Grid ── */}
      <div className="card-dark border border-white/10">
        <h3 className="text-sm font-medium text-white mb-4">Metriques de la ligne du temps du sommeil</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <MetricCard
            value={detail?.restlessCount?.toString() ?? '--'}
            label="Periodes de sommeil agite"
            color="#F472B6"
          />
          <MetricCard
            value={sleep.hr_avg !== null ? `${Math.round(sleep.hr_avg)} bpm` : (detail?.restingHr !== null ? `${detail?.restingHr} bpm` : '--')}
            label="Frequence cardiaque au repos"
            color="#F87171"
          />
          <MetricCard
            value={detail?.bbChange !== null ? `+${detail?.bbChange}` : '--'}
            label="Modification de Body Battery"
            color="#4ADE80"
          />
          <MetricCard
            value={sleep.spo2_avg !== null ? `${sleep.spo2_avg}%` : '--'}
            label="SpO2 moyenne"
            color="#60A5FA"
          />
          <MetricCard
            value={detail?.lowestSpo2 !== null ? `${detail?.lowestSpo2}%` : '--'}
            label="SpO2 la plus basse"
            color="#F59E0B"
          />
          <MetricCard
            value={sleep.respiration_avg !== null ? `${sleep.respiration_avg} brpm` : '--'}
            label="Respiration moyenne"
            color="#10B981"
          />
          <MetricCard
            value={detail?.lowestResp !== null ? `${detail?.lowestResp} brpm` : '--'}
            label="Respiration la plus faible"
            color="#EF4444"
          />
          <MetricCard
            value={stressAvg !== null ? `${Math.round(stressAvg)}` : '--'}
            label="Stress moyen"
            color="#FB923C"
          />
        </div>
      </div>

      {/* ── History: all nights timeline bars ── */}
      <SleepHistorySection days={data.days} />
    </div>
  );
}

// ── Sleep History Section ────────────────────────────────────────────────────

function SleepHistorySection({ days }: { days: WellnessDay[] }) {
  const nights = useMemo(() => {
    return days
      .filter(d => d.sleep && d.sleep.duration_seconds > 0)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [days]);

  if (nights.length <= 1) return null;

  return (
    <div className="card-dark border border-white/10">
      <h3 className="text-sm font-medium text-white mb-3">Historique ({nights.length} nuits)</h3>
      <div className="space-y-1 max-h-[350px] overflow-y-auto pr-1">
        {nights.map((night) => {
          const s = night.sleep!;
          const total = s.deep_seconds + s.light_seconds + s.rem_seconds + s.awake_seconds;
          if (total === 0) return null;
          const deepPct = (s.deep_seconds / total) * 100;
          const lightPct = (s.light_seconds / total) * 100;
          const remPct = (s.rem_seconds / total) * 100;
          const awakePct = (s.awake_seconds / total) * 100;

          return (
            <div key={night.date} className="flex items-center gap-3 py-1 px-1">
              <span className="text-[11px] text-zinc-400 w-16 flex-shrink-0 text-right tabular-nums">
                {new Date(night.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
              </span>
              <div className="flex-1 flex h-4 rounded-sm overflow-hidden">
                <div style={{ width: `${deepPct}%`, backgroundColor: PHASE_COLORS.deep }} />
                <div style={{ width: `${lightPct}%`, backgroundColor: PHASE_COLORS.light }} />
                <div style={{ width: `${remPct}%`, backgroundColor: PHASE_COLORS.rem }} />
                <div style={{ width: `${awakePct}%`, backgroundColor: PHASE_COLORS.awake }} />
              </div>
              <span className="text-[11px] text-zinc-500 w-10 flex-shrink-0 tabular-nums">
                {formatDuration(s.duration_seconds)}
              </span>
              <span className="text-[11px] font-medium w-7 flex-shrink-0 text-right tabular-nums" style={{ color: getScoreColor(s.score ?? 0) }}>
                {s.score ?? '--'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function StarRating({ stars }: { stars: number }) {
  if (stars <= 0) return <span className="text-zinc-600 text-xs">--</span>;
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <svg
          key={i}
          className="w-3.5 h-3.5"
          viewBox="0 0 20 20"
          fill={i <= stars ? '#FACC15' : '#3F3F46'}
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

function MetricCard({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <div className="text-center">
      <span className="text-xl font-bold tabular-nums" style={{ color }}>{value}</span>
      <span className="text-[10px] text-zinc-500 block mt-0.5 leading-tight">{label}</span>
    </div>
  );
}

function LegendDot({ color, label, line }: { color: string; label: string; line?: boolean }) {
  return (
    <div className="flex items-center gap-1.5 text-xs">
      {line ? (
        <span className="w-4 h-0.5 rounded" style={{ backgroundColor: color }} />
      ) : (
        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
      )}
      <span className="text-zinc-400">{label}</span>
    </div>
  );
}
