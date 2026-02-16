// SPDX-License-Identifier: MIT OR Apache-2.0
// Copyright (c) 2025 Pierre Fitness Intelligence
// ABOUTME: Floating chat window for interactive conversation with Coach Pierre via Gemini.
// ABOUTME: Supports SSE streaming, markdown rendering, welcome debriefing, and smart scroll.

import { useState, useRef, useEffect, useCallback } from 'react';
import Markdown from 'react-markdown';
import type { WellnessSummary } from '../../types/wellness';

interface ChatMessage {
  role: 'user' | 'model';
  parts: [{ text: string }];
}

interface WellnessChatWindowProps {
  wellnessData: WellnessSummary;
}

const SUGGESTED_QUESTIONS = [
  'Compare mes performances oct/nov vs ma reprise',
  'Quel entraînement pour demain ?',
  'Comment optimiser ma perte de gras ?',
  'Analyse ma dernière sortie VTT',
];

function buildWellnessContext(data: WellnessSummary) {
  const latest = data.latest;
  const sleep = latest?.sleep;
  const stress = latest?.stress;
  const hr = latest?.heartRate;
  const steps = latest?.steps;
  const cal = latest?.calories;
  const bb = latest?.bodyBattery;
  const act = data.latestActivity;
  const wi = data.weeklyIntensity;

  const profile = [
    `Poids: ${data.biometrics?.weight_kg ?? '?'} kg`,
    data.fitnessAge ? `Âge fitness: ${data.fitnessAge.fitnessAge} ans (chrono: ${data.fitnessAge.chronologicalAge})` : '',
    data.fitnessAge ? `IMC: ${data.fitnessAge.bmi}, Masse grasse: ${data.fitnessAge.bodyFat}%` : '',
    data.vo2max ? `VO2max: ${data.vo2max.vo2max} ml/kg/min` : '',
  ].filter(Boolean).join(', ');

  const todaySummary = latest ? [
    `Date: ${latest.date}`,
    sleep ? `Sommeil: score ${sleep.score}/100, durée ${(sleep.duration_seconds / 3600).toFixed(1)}h, profond ${Math.round(sleep.deep_seconds / 60)}min, REM ${Math.round(sleep.rem_seconds / 60)}min, récup ${sleep.recovery_score}/100` : 'Pas de données sommeil',
    `Pas: ${steps?.count ?? 0}, Distance: ${((steps?.distance_m ?? 0) / 1000).toFixed(1)} km`,
    `Calories: ${cal?.total ?? 0} kcal (actives: ${cal?.active ?? 0})`,
    `Stress moy: ${stress?.average ?? '?'}, BB: ${bb?.estimate ?? '?'}/100`,
    `FC repos: ${hr?.resting ?? '?'} bpm`,
    `Minutes intensives semaine: ${wi?.total ?? 0}/${wi?.goal ?? 150}`,
  ].join('\n') : 'Pas de données';

  const activitySummary = act ? [
    `${act.name} (${act.date})`,
    `Distance: ${act.distance_km} km, Durée: ${Math.round(act.duration_s / 60)} min, D+: ${act.elevation_gain_m} m`,
    `FC moy: ${act.avg_hr ?? '?'} bpm, FC max: ${act.max_hr ?? '?'} bpm`,
    `TE aérobie: ${act.aerobic_te ?? '?'}, Calories: ${act.calories} kcal`,
  ].join('\n') : 'Pas d\'activité récente';

  // Activity history for trend analysis
  let activityHistory = '';
  if (data.activityHistory && data.activityHistory.length > 1) {
    activityHistory = data.activityHistory.map(a =>
      `${a.date} | ${a.name} | ${a.distance_km}km | ${Math.round(a.duration_s / 60)}min | D+${a.elevation_gain_m}m | FC moy ${a.avg_hr ?? '?'} / max ${a.max_hr ?? '?'} bpm | ${a.calories}kcal | TE ${a.aerobic_te ?? '?'} | ${a.source === 'strava' ? '[Strava]' : '[Garmin]'}`
    ).join('\n');
  }

  return {
    profile,
    todaySummary,
    activitySummary,
    metrics: activityHistory ? `Historique activités (${data.activityHistory?.length} sorties):\n${activityHistory}` : '',
  };
}

function buildWelcomeMessage(data: WellnessSummary): string {
  const parts: string[] = [];
  const d = data.coachDebriefing;
  const latest = data.latest;
  const sleep = latest?.sleep;

  parts.push('**Salut ChefFamille !** Voici ton debriefing complet du jour.\n');

  // Sleep
  if (d?.sleepAnalysis) {
    parts.push(`**Sommeil** : ${d.sleepAnalysis}\n`);
  } else if (sleep) {
    parts.push(`**Sommeil** : Score ${sleep.score}/100, ${(sleep.duration_seconds / 3600).toFixed(1)}h de sommeil.\n`);
  }

  // Activity
  if (d?.activityAnalysis) {
    parts.push(`**Dernière activité** : ${d.activityAnalysis}\n`);
  }

  // Progress comparison
  if (d?.progressComparison) {
    parts.push(`**Progression Oct/Nov vs Reprise** : ${d.progressComparison}\n`);
  }

  // Fitness
  if (d?.fitnessAssessment) {
    parts.push(`**Condition physique** : ${d.fitnessAssessment}\n`);
  }

  // Weight
  if (d?.weightAnalysis) {
    parts.push(`**Poids** : ${d.weightAnalysis}\n`);
  }

  // Stress
  if (d?.stressRecovery) {
    parts.push(`**Stress & Récup** : ${d.stressRecovery}\n`);
  }

  // Hydration + Nutrition
  if (d?.hydrationPlan) {
    parts.push(`**Hydratation** : ${d.hydrationPlan}\n`);
  }
  if (d?.nutritionPlan) {
    parts.push(`**Nutrition** : ${d.nutritionPlan}\n`);
  }

  // Next training
  if (d?.nextTraining) {
    const nt = d.nextTraining;
    parts.push(`**Prochain entraînement** : ${nt.type.replace(/_/g, ' ')} - ${nt.duration_min} min (${nt.hr_target_bpm})\n${nt.rationale}\n`);
  }

  if (parts.length <= 1) {
    // No debriefing data, build from raw data
    parts.push('Les données de debriefing ne sont pas encore disponibles. Pose-moi une question et je t\'analyserai tes données en direct !');
  } else {
    parts.push('---\n*Pose-moi une question pour approfondir un point.*');
  }

  return parts.join('\n');
}

export default function WellnessChatWindow({ wellnessData }: WellnessChatWindowProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [selectedModel, setSelectedModel] = useState('gemini-2.5-flash');
  const [hasInitialized, setHasInitialized] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const userScrolledUpRef = useRef(false);

  // Smart scroll: only auto-scroll if user hasn't scrolled up
  const scrollToBottom = useCallback(() => {
    if (!userScrolledUpRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const threshold = 100;
    const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
    userScrolledUpRef.current = !isAtBottom;
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Initialize welcome message when chat opens
  useEffect(() => {
    if (isOpen && !hasInitialized) {
      const welcome = buildWelcomeMessage(wellnessData);
      setMessages([{ role: 'model', parts: [{ text: welcome }] }]);
      setHasInitialized(true);
    }
    if (isOpen) inputRef.current?.focus();
  }, [isOpen, hasInitialized, wellnessData]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming) return;

    userScrolledUpRef.current = false;
    const userMsg: ChatMessage = { role: 'user', parts: [{ text: text.trim() }] };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setIsStreaming(true);

    const assistantMsg: ChatMessage = { role: 'model', parts: [{ text: '' }] };
    setMessages([...newMessages, assistantMsg]);

    try {
      const wellnessContext = buildWellnessContext(wellnessData);
      const res = await fetch('/wellness-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages,
          wellnessContext,
          model: selectedModel,
          stream: true,
        }),
      });

      if (!res.ok) {
        let errMsg = 'Impossible de contacter le serveur';
        try {
          const err = await res.json();
          errMsg = err.error || errMsg;
        } catch { /* use default */ }
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'model', parts: [{ text: `**Erreur:** ${errMsg}` }] };
          return updated;
        });
        setIsStreaming(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        setIsStreaming(false);
        return;
      }

      const decoder = new TextDecoder();
      let fullText = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr || jsonStr === '[DONE]') continue;

          try {
            const parsed = JSON.parse(jsonStr);
            const chunk = parsed.candidates?.[0]?.content?.parts?.[0]?.text || '';
            if (chunk) {
              fullText += chunk;
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: 'model', parts: [{ text: fullText }] };
                return updated;
              });
            }
          } catch {
            // Skip malformed SSE chunks
          }
        }
      }
    } catch {
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: 'model', parts: [{ text: '**Erreur de connexion au serveur.**' }] };
        return updated;
      });
    } finally {
      setIsStreaming(false);
    }
  }, [messages, isStreaming, wellnessData, selectedModel]);

  return (
    <>
      {/* FAB button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 ${
          isOpen
            ? 'bg-zinc-700 hover:bg-zinc-600 rotate-0'
            : 'bg-gradient-to-br from-emerald-500 to-pierre-cyan hover:from-emerald-400 hover:to-pierre-cyan/80'
        }`}
      >
        {isOpen ? (
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        )}
      </button>

      {/* Chat window */}
      {isOpen && (
        <div className="fixed bottom-20 right-4 left-4 md:left-auto md:right-6 z-50 md:w-[420px] h-[600px] max-h-[80vh] flex flex-col bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 bg-gradient-to-r from-emerald-500/20 via-pierre-cyan/10 to-transparent border-b border-zinc-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-pierre-cyan flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <span className="text-sm font-semibold text-white">Coach Pierre</span>
            </div>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="text-xs bg-zinc-800 text-zinc-300 border border-zinc-600 rounded-lg px-2 py-1 focus:outline-none focus:border-pierre-cyan"
            >
              <option value="gemini-2.5-flash">Flash</option>
              <option value="gemini-2.5-pro">Pro</option>
            </select>
          </div>

          {/* Messages */}
          <div
            ref={messagesContainerRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto px-4 py-3 space-y-3"
          >
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm ${
                    msg.role === 'user'
                      ? 'bg-pierre-cyan/20 text-white rounded-br-md'
                      : 'bg-zinc-800 text-zinc-200 rounded-bl-md'
                  }`}
                >
                  {msg.role === 'model' ? (
                    <div className="prose prose-sm prose-invert max-w-none [&>p]:my-1 [&>ul]:my-1 [&>ol]:my-1 [&>li]:my-0.5 [&>hr]:my-2 [&>hr]:border-zinc-600">
                      <Markdown>{msg.parts[0].text || (isStreaming && i === messages.length - 1 ? '...' : '')}</Markdown>
                    </div>
                  ) : (
                    <p>{msg.parts[0].text}</p>
                  )}
                </div>
              </div>
            ))}

            {/* Suggested questions after welcome message */}
            {messages.length === 1 && !isStreaming && (
              <div className="space-y-2 mt-2">
                <p className="text-xs text-zinc-500 text-center">Questions de suivi :</p>
                {SUGGESTED_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => sendMessage(q)}
                    className="block w-full text-left text-xs px-3 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-zinc-300 hover:bg-white/[0.08] hover:border-pierre-cyan/30 transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="px-4 py-3 border-t border-zinc-700">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendMessage(input);
              }}
              className="flex gap-2"
            >
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Pose ta question..."
                disabled={isStreaming}
                className="flex-1 bg-zinc-800 text-white text-sm px-4 py-2.5 rounded-xl border border-zinc-600 focus:outline-none focus:border-pierre-cyan placeholder-zinc-500 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={isStreaming || !input.trim()}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-pierre-cyan text-white text-sm font-medium disabled:opacity-30 hover:opacity-90 transition-opacity"
              >
                {isStreaming ? (
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
