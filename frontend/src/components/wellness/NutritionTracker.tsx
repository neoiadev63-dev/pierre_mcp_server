// SPDX-License-Identifier: MIT OR Apache-2.0
// Copyright (c) 2025 Pierre Fitness Intelligence

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useNutrition, computeNutrients } from '../../hooks/useNutrition';
import type { MealType } from '../../hooks/useNutrition';
import type { MealFoodEntry, SavedRecipe, FoodItem, NutritionGoals } from '../../types/wellness';
import { searchOpenFoodFacts } from '../../utils/openFoodFacts';
import type { OffFoodResult } from '../../utils/openFoodFacts';

const LS_RECENT_FOODS_KEY = 'pierre_recent_foods';
const LS_FAVORITE_RECIPES_KEY = 'pierre_favorite_recipes';
const LS_GOALS_KEY = 'pierre_nutrition_goals';
const MAX_RECENT = 10;

// Quick quantity buttons
const QUICK_QUANTITIES = [
  { label: '1 pincée', grams: 1 },
  { label: '1 c.c.', grams: 5 },
  { label: '1 c.s.', grams: 15 },
  { label: '50g', grams: 50 },
  { label: '100g', grams: 100 },
  { label: '1 tasse', grams: 240 },
];

function loadRecentFoods(): { id: string; name: string }[] {
  try {
    const raw = localStorage.getItem(LS_RECENT_FOODS_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return [];
}

function saveRecentFood(food: { id: string; name: string }) {
  const recent = loadRecentFoods().filter(f => f.id !== food.id);
  recent.unshift(food);
  localStorage.setItem(LS_RECENT_FOODS_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
}

function loadFavoriteRecipeIds(): Set<string> {
  try {
    const raw = localStorage.getItem(LS_FAVORITE_RECIPES_KEY);
    if (raw) return new Set(JSON.parse(raw));
  } catch { /* ignore */ }
  return new Set();
}

function saveFavoriteRecipeIds(ids: Set<string>) {
  localStorage.setItem(LS_FAVORITE_RECIPES_KEY, JSON.stringify([...ids]));
}

// Micronutrient RDAs (static, independent of goals)
const MICRO_RDA: Record<string, number> = {
  vitA: 900, vitC: 90, vitD: 15, vitE: 15, vitK: 120,
  vitB1: 1.2, vitB6: 1.7, vitB9: 400, vitB12: 2.4,
  iron: 8, calcium: 1000, magnesium: 420, zinc: 11, potassium: 3400,
};

// Nutrition goal defaults and helpers
const DEFAULT_GOALS: NutritionGoals = {
  baseTdee: 2100,
  weightLossPerWeek: 0.5,
  carbsPct: 50,
  fatPct: 30,
  proteinPct: 20,
  fiberTarget: 30,
};

function loadGoals(): NutritionGoals {
  try {
    const raw = localStorage.getItem(LS_GOALS_KEY);
    if (raw) return { ...DEFAULT_GOALS, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...DEFAULT_GOALS };
}

function saveGoalsToStorage(goals: NutritionGoals) {
  localStorage.setItem(LS_GOALS_KEY, JSON.stringify(goals));
}

interface MacroTargets {
  calories: number;
  carbs: number;
  fat: number;
  protein: number;
  fiber: number;
}

function computeTargets(goals: NutritionGoals): MacroTargets {
  const deficit = goals.weightLossPerWeek * 1100; // 7700 kcal per kg fat / 7 days
  const cal = Math.max(1200, Math.round(goals.baseTdee - deficit));
  return {
    calories: cal,
    carbs: Math.round((cal * goals.carbsPct / 100) / 4),
    fat: Math.round((cal * goals.fatPct / 100) / 9),
    protein: Math.round((cal * goals.proteinPct / 100) / 4),
    fiber: goals.fiberTarget,
  };
}

const MACRO_PRESETS: Record<string, { label: string; carbsPct: number; fatPct: number; proteinPct: number }> = {
  balanced: { label: 'Équilibré', carbsPct: 50, fatPct: 30, proteinPct: 20 },
  lowCarb: { label: 'Low-carb', carbsPct: 25, fatPct: 45, proteinPct: 30 },
  highProtein: { label: 'Hyperprotéiné', carbsPct: 40, fatPct: 25, proteinPct: 35 },
  keto: { label: 'Keto', carbsPct: 5, fatPct: 70, proteinPct: 25 },
};

const MEAL_LABELS: Record<MealType, { label: string; icon: string }> = {
  breakfast: { label: 'Petit-déjeuner', icon: '🌅' },
  lunch: { label: 'Déjeuner', icon: '☀️' },
  dinner: { label: 'Dîner', icon: '🌙' },
};

const NUTRIENT_LABELS: Record<string, { label: string; unit: string }> = {
  calories: { label: 'Calories', unit: 'kcal' },
  protein: { label: 'Protéines', unit: 'g' },
  carbs: { label: 'Glucides', unit: 'g' },
  fat: { label: 'Lipides', unit: 'g' },
  fiber: { label: 'Fibres', unit: 'g' },
  vitA: { label: 'Vit. A', unit: 'µg' },
  vitC: { label: 'Vit. C', unit: 'mg' },
  vitD: { label: 'Vit. D', unit: 'µg' },
  vitE: { label: 'Vit. E', unit: 'mg' },
  vitK: { label: 'Vit. K', unit: 'µg' },
  vitB1: { label: 'Vit. B1', unit: 'mg' },
  vitB6: { label: 'Vit. B6', unit: 'mg' },
  vitB9: { label: 'Folate', unit: 'µg' },
  vitB12: { label: 'Vit. B12', unit: 'µg' },
  iron: { label: 'Fer', unit: 'mg' },
  calcium: { label: 'Calcium', unit: 'mg' },
  magnesium: { label: 'Magnésium', unit: 'mg' },
  zinc: { label: 'Zinc', unit: 'mg' },
  potassium: { label: 'Potassium', unit: 'mg' },
  curcumin: { label: 'Curcumine', unit: 'mg' },
};

// Normalize text for fuzzy French search: remove accents, collapse double letters
function normalizeSearch(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // strip accents
    .replace(/(.)\1+/g, '$1'); // collapse doubles: "carrotte" → "carote"
}

function rdaColor(pct: number): string {
  if (pct > 100) return '#EF4444'; // red - over RDA
  if (pct >= 80) return '#F59E0B'; // yellow - approaching
  return '#4ADE80'; // green - under
}

function ProgressBar({ value, max, color, autoColor }: { value: number; max: number; color?: string; autoColor?: boolean }) {
  const pct = Math.min(120, (value / max) * 100);
  const barColor = autoColor ? rdaColor(pct) : (color || '#4ADE80');
  return (
    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, pct)}%`, backgroundColor: barColor }} />
    </div>
  );
}

// SVG donut ring for calorie/macro circular displays
function DonutRing({ size, strokeWidth, value, max, color, children }: {
  size: number; strokeWidth: number; value: number; max: number; color: string; children?: React.ReactNode;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  const offset = circumference * (1 - pct);
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={strokeWidth} />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className="transition-all duration-700"
        />
      </svg>
      {children && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {children}
        </div>
      )}
    </div>
  );
}

// Goal configuration panel
function GoalSettingsPanel({ goals, onChange }: { goals: NutritionGoals; onChange: (goals: NutritionGoals) => void }) {
  const targets = computeTargets(goals);

  const updateField = <K extends keyof NutritionGoals>(key: K, value: NutritionGoals[K]) => {
    onChange({ ...goals, [key]: value });
  };

  const applyPreset = (preset: { carbsPct: number; fatPct: number; proteinPct: number }) => {
    onChange({ ...goals, carbsPct: preset.carbsPct, fatPct: preset.fatPct, proteinPct: preset.proteinPct });
  };

  return (
    <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-4">
      <h4 className="text-sm font-semibold text-white flex items-center gap-2">
        <svg className="w-4 h-4 text-pierre-nutrition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
        </svg>
        Objectifs nutritionnels
      </h4>

      {/* TDEE Input */}
      <div className="flex items-center gap-3">
        <label className="text-xs text-zinc-400 flex-shrink-0">Dépense calorique (TDEE)</label>
        <input
          type="number"
          value={goals.baseTdee}
          onChange={e => updateField('baseTdee', Math.max(1200, Number(e.target.value) || 1200))}
          className="w-24 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white text-center focus:outline-none focus:border-pierre-nutrition/50"
        />
        <span className="text-xs text-zinc-500">kcal/jour</span>
      </div>

      {/* Weight Loss Slider */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs text-zinc-400">Objectif de perte par semaine</label>
          <span className="text-sm font-bold text-pierre-nutrition">{goals.weightLossPerWeek.toFixed(1)} kg</span>
        </div>
        <input
          type="range"
          min={0}
          max={1}
          step={0.1}
          value={goals.weightLossPerWeek}
          onChange={e => updateField('weightLossPerWeek', Number(e.target.value))}
          className="w-full h-2 rounded-full appearance-none cursor-pointer bg-white/10
            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
            [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-pierre-nutrition
            [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white/20
            [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-lg
            [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full
            [&::-moz-range-thumb]:bg-pierre-nutrition [&::-moz-range-thumb]:border-2
            [&::-moz-range-thumb]:border-white/20 [&::-moz-range-thumb]:cursor-pointer"
        />
        <div className="flex justify-between text-[9px] text-zinc-600 mt-1">
          <span>0 kg (maintien)</span>
          <span>0.25 kg</span>
          <span>0.5 kg</span>
          <span>0.75 kg</span>
          <span>1 kg (rapide)</span>
        </div>
      </div>

      {/* Calculated Target Display */}
      <div className="text-center py-3 rounded-xl bg-pierre-nutrition/10 border border-pierre-nutrition/20">
        <span className="text-[10px] text-zinc-400 uppercase tracking-wider block">Objectif quotidien</span>
        <div className="text-3xl font-bold text-pierre-nutrition mt-1">{targets.calories.toLocaleString()}</div>
        <span className="text-xs text-zinc-500">kcal/jour</span>
        {goals.weightLossPerWeek > 0 && (
          <p className="text-[10px] text-zinc-500 mt-1">
            Déficit : {Math.round(goals.weightLossPerWeek * 1100)} kcal/jour
          </p>
        )}
      </div>

      {/* Macro Presets */}
      <div>
        <label className="text-xs text-zinc-400 mb-2 block">Répartition des macros</label>
        <div className="flex flex-wrap gap-2">
          {Object.entries(MACRO_PRESETS).map(([key, preset]) => {
            const isActive = goals.carbsPct === preset.carbsPct && goals.fatPct === preset.fatPct && goals.proteinPct === preset.proteinPct;
            return (
              <button
                key={key}
                onClick={() => applyPreset(preset)}
                className={`text-[11px] px-3 py-1.5 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-pierre-nutrition/30 text-pierre-nutrition border border-pierre-nutrition/40'
                    : 'bg-white/5 text-zinc-400 border border-white/10 hover:bg-white/10 hover:text-zinc-200'
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
        <div className="grid grid-cols-3 gap-3 mt-3">
          <div className="text-center">
            <span className="text-[10px] text-[#60A5FA] block">Glucides</span>
            <span className="text-sm font-bold text-white">{goals.carbsPct}%</span>
            <span className="text-[9px] text-zinc-500 block">{targets.carbs}g</span>
          </div>
          <div className="text-center">
            <span className="text-[10px] text-[#FBBF24] block">Lipides</span>
            <span className="text-sm font-bold text-white">{goals.fatPct}%</span>
            <span className="text-[9px] text-zinc-500 block">{targets.fat}g</span>
          </div>
          <div className="text-center">
            <span className="text-[10px] text-[#C084FC] block">Protéines</span>
            <span className="text-sm font-bold text-white">{goals.proteinPct}%</span>
            <span className="text-[9px] text-zinc-500 block">{targets.protein}g</span>
          </div>
        </div>
      </div>

      {/* Fiber Target */}
      <div className="flex items-center gap-3">
        <label className="text-xs text-zinc-400 flex-shrink-0">Objectif fibres</label>
        <input
          type="number"
          value={goals.fiberTarget}
          onChange={e => updateField('fiberTarget', Math.max(0, Number(e.target.value) || 0))}
          className="w-20 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white text-center focus:outline-none focus:border-pierre-nutrition/50"
        />
        <span className="text-xs text-zinc-500">g/jour</span>
      </div>
    </div>
  );
}

function MealSection({ mealType, entries, onAdd, onToggleExclude, onUpdateQuantity, onAddRecipe, onAddExtra, onAddOffFood, recipes, foods, favoriteRecipeIds, onToggleFavorite, onDuplicateYesterday }: {
  mealType: MealType;
  entries: MealFoodEntry[];
  onAdd: (entry: MealFoodEntry) => void;
  onToggleExclude: (index: number) => void;
  onUpdateQuantity: (index: number, newQuantity: number) => void;
  onAddRecipe: (recipe: SavedRecipe) => void;
  onAddExtra: (entry: MealFoodEntry) => void;
  onAddOffFood: (food: OffFoodResult, quantity_g: number) => void;
  recipes: SavedRecipe[];
  foods: { id: string; name: string }[];
  favoriteRecipeIds: Set<string>;
  onToggleFavorite: (id: string) => void;
  onDuplicateYesterday?: (mealType: MealType) => void;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [quantity, setQuantity] = useState('100');
  const [showRecipes, setShowRecipes] = useState(false);
  const [collapsed, setCollapsed] = useState(true);
  const [offResults, setOffResults] = useState<OffFoodResult[]>([]);
  const [offLoading, setOffLoading] = useState(false);
  const [searchMode, setSearchMode] = useState<'local' | 'online'>('local');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const { label, icon } = MEAL_LABELS[mealType];

  const recentFoods = useMemo(() => loadRecentFoods(), []);

  const filteredFoods = useMemo(() => {
    if (!searchQuery.trim()) {
      // Show recent foods first, then fill with all foods
      const recentIds = new Set(recentFoods.map(f => f.id));
      const rest = foods.filter(f => !recentIds.has(f.id)).slice(0, Math.max(0, 10 - recentFoods.length));
      return [...recentFoods.filter(rf => foods.some(f => f.id === rf.id)), ...rest].slice(0, 10);
    }
    const q = normalizeSearch(searchQuery);
    return foods.filter(f => normalizeSearch(f.name).includes(q)).slice(0, 10);
  }, [searchQuery, foods, recentFoods]);

  // Debounced OFF search
  useEffect(() => {
    if (searchMode !== 'online' || !searchQuery.trim() || searchQuery.length < 2) {
      setOffResults([]);
      return;
    }
    const timer = setTimeout(() => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setOffLoading(true);
      searchOpenFoodFacts(searchQuery, ctrl.signal)
        .then(results => { if (!ctrl.signal.aborted) setOffResults(results); })
        .catch(() => { /* aborted or error */ })
        .finally(() => { if (!ctrl.signal.aborted) setOffLoading(false); });
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery, searchMode]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <button
          onClick={() => entries.length > 0 && setCollapsed(!collapsed)}
          className="text-sm font-medium text-white flex items-center gap-2 hover:text-zinc-200 transition-colors"
        >
          <span>{icon}</span> {label}
          {entries.length > 0 && (
            <>
              <span className="text-[10px] text-zinc-500 font-normal">({entries.length})</span>
              <svg className={`w-3.5 h-3.5 text-zinc-500 transition-transform ${collapsed ? '' : 'rotate-180'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </>
          )}
        </button>
        <div className="flex gap-1">
          {recipes.length > 0 && (
            <button
              onClick={() => { setShowRecipes(!showRecipes); setIsAdding(false); }}
              className="text-xs px-3 py-2 min-h-[44px] rounded bg-pierre-nutrition/20 text-pierre-nutrition hover:bg-pierre-nutrition/30 transition-colors"
            >
              Recettes
            </button>
          )}
          <button
            onClick={() => { setIsAdding(!isAdding); setShowRecipes(false); }}
            className="text-xs px-3 py-2 min-h-[44px] rounded bg-white/10 text-zinc-300 hover:bg-white/20 transition-colors"
          >
            + Ajouter
          </button>
        </div>
      </div>

      {!collapsed && <>
      {/* Recipe picker with favorites */}
      {showRecipes && (
        <div className="space-y-1 p-2 rounded-lg bg-white/[0.03] border border-white/5">
          {/* Favorites first */}
          {recipes.filter(r => favoriteRecipeIds.has(r.id)).length > 0 && (
            <>
              <p className="text-[9px] text-pierre-nutrition px-3 py-0.5 uppercase tracking-wider">Favoris</p>
              {recipes.filter(r => favoriteRecipeIds.has(r.id)).map(recipe => (
                <div key={recipe.id}>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => { onAddRecipe(recipe); setShowRecipes(false); }}
                      className="flex-1 text-left px-3 py-2 rounded-lg hover:bg-white/5 transition-colors flex items-center justify-between"
                    >
                      <span className="text-sm text-zinc-300">{recipe.name}</span>
                      <span className="text-[10px] text-zinc-500">{recipe.items.length} items</span>
                    </button>
                    <button onClick={() => onToggleFavorite(recipe.id)} className="p-1 text-pierre-nutrition" title="Retirer des favoris">
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                    </button>
                  </div>
                  {recipe.extras && recipe.extras.length > 0 && (
                    <div className="flex flex-wrap gap-1 px-3 pb-1">
                      {recipe.extras.map(extra => (
                        <button
                          key={extra.foodId}
                          onClick={() => { onAddExtra(extra); }}
                          className="text-[10px] px-2 py-1 rounded-md bg-pierre-activity/10 text-pierre-activity border border-pierre-activity/20 hover:bg-pierre-activity/20 transition-colors flex items-center gap-1"
                          title={`Ajouter ${extra.name}`}
                        >
                          <span>+</span> {extra.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              <div className="border-t border-white/5 my-1" />
            </>
          )}
          {/* Duplicate yesterday */}
          {onDuplicateYesterday && (
            <button
              onClick={() => { onDuplicateYesterday(mealType); setShowRecipes(false); }}
              className="w-full text-left px-3 py-2 rounded-lg hover:bg-pierre-violet/10 transition-colors flex items-center gap-2 text-sm text-pierre-violet-light"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
              Dupliquer d'hier
            </button>
          )}
          {/* All recipes */}
          {recipes.filter(r => !favoriteRecipeIds.has(r.id)).map(recipe => (
            <div key={recipe.id}>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => { onAddRecipe(recipe); setShowRecipes(false); }}
                  className="flex-1 text-left px-3 py-2 rounded-lg hover:bg-white/5 transition-colors flex items-center justify-between"
                >
                  <span className="text-sm text-zinc-300">{recipe.name}</span>
                  <span className="text-[10px] text-zinc-500">{recipe.items.length} items</span>
                </button>
                <button onClick={() => onToggleFavorite(recipe.id)} className="p-1 text-zinc-600 hover:text-pierre-nutrition transition-colors" title="Ajouter aux favoris">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                </button>
              </div>
              {recipe.extras && recipe.extras.length > 0 && (
                <div className="flex flex-wrap gap-1 px-3 pb-1">
                  {recipe.extras.map(extra => (
                    <button
                      key={extra.foodId}
                      onClick={() => { onAddExtra(extra); }}
                      className="text-[10px] px-2 py-1 rounded-md bg-pierre-activity/10 text-pierre-activity border border-pierre-activity/20 hover:bg-pierre-activity/20 transition-colors flex items-center gap-1"
                      title={`Ajouter ${extra.name}`}
                    >
                      <span>+</span> {extra.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Food search & add */}
      {isAdding && (
        <div className="p-2 rounded-lg bg-white/[0.03] border border-white/5 space-y-2">
          {/* Search mode toggle */}
          <div className="flex gap-1 mb-1">
            <button
              onClick={() => setSearchMode('local')}
              className={`text-[10px] px-2 py-1 rounded transition-colors ${
                searchMode === 'local'
                  ? 'bg-pierre-violet/30 text-pierre-violet'
                  : 'bg-white/5 text-zinc-500 hover:text-zinc-300'
              }`}
            >
              Base locale
            </button>
            <button
              onClick={() => setSearchMode('online')}
              className={`text-[10px] px-2 py-1 rounded transition-colors flex items-center gap-1 ${
                searchMode === 'online'
                  ? 'bg-green-500/30 text-green-400'
                  : 'bg-white/5 text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9" />
              </svg>
              Open Food Facts
            </button>
          </div>

          <input
            type="text"
            placeholder={searchMode === 'local' ? 'Rechercher un aliment...' : 'Rechercher sur Open Food Facts...'}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-pierre-violet/50"
          />

          {/* Local results */}
          {searchMode === 'local' && (
            <div className="max-h-40 overflow-y-auto space-y-0.5">
              {!searchQuery.trim() && recentFoods.length > 0 && (
                <p className="text-[9px] text-zinc-600 px-3 py-0.5 uppercase tracking-wider">Récents</p>
              )}
              {filteredFoods.map(food => (
                <button
                  key={food.id}
                  onClick={() => {
                    onAdd({ foodId: food.id, name: food.name, quantity_g: Number(quantity) || 100 });
                    saveRecentFood({ id: food.id, name: food.name });
                    setSearchQuery('');
                  }}
                  className="w-full text-left px-3 py-1.5 rounded hover:bg-white/5 text-sm text-zinc-300 transition-colors"
                >
                  {food.name}
                </button>
              ))}
            </div>
          )}

          {/* OFF results */}
          {searchMode === 'online' && (
            <div className="max-h-48 overflow-y-auto space-y-0.5">
              {offLoading && (
                <div className="flex items-center justify-center py-3 gap-2">
                  <div className="w-3 h-3 border-2 border-green-400/30 border-t-green-400 rounded-full animate-spin" />
                  <span className="text-[11px] text-zinc-500">Recherche en cours...</span>
                </div>
              )}
              {!offLoading && searchQuery.length >= 2 && offResults.length === 0 && (
                <p className="text-[11px] text-zinc-600 px-3 py-2">Aucun résultat</p>
              )}
              {offResults.map(food => (
                <button
                  key={food.id}
                  onClick={() => {
                    onAddOffFood(food, Number(quantity) || 100);
                    setSearchQuery('');
                    setOffResults([]);
                  }}
                  className="w-full text-left px-3 py-1.5 rounded hover:bg-green-500/10 text-sm text-zinc-300 transition-colors flex items-center justify-between"
                >
                  <span className="truncate flex-1">{food.name}</span>
                  <span className="text-[9px] text-zinc-500 ml-2 flex-shrink-0">{Math.round(food.per100g.calories)} kcal</span>
                </button>
              ))}
              {!offLoading && searchQuery.length < 2 && (
                <p className="text-[11px] text-zinc-600 px-3 py-2">Tapez au moins 2 caractères...</p>
              )}
            </div>
          )}

          {/* Quick quantity buttons */}
          <div className="flex flex-wrap gap-1">
            {QUICK_QUANTITIES.map(q => (
              <button
                key={q.label}
                onClick={() => setQuantity(String(q.grams))}
                className={`text-[10px] px-2 py-1 rounded transition-colors ${
                  quantity === String(q.grams)
                    ? 'bg-pierre-violet/30 text-pierre-violet'
                    : 'bg-white/5 text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {q.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <label className="text-[10px] text-zinc-500">Quantité (g):</label>
            <input
              type="number"
              value={quantity}
              onChange={e => setQuantity(e.target.value)}
              className="w-20 bg-white/5 border border-white/10 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-pierre-violet/50"
            />
          </div>
        </div>
      )}

      {/* Food list */}
      {entries.length > 0 ? (
        <div className="space-y-0.5">
          {entries.map((entry, i) => (
            <div key={`${entry.foodId}-${i}`} className={`flex items-center justify-between px-3 py-1.5 rounded-lg transition-colors ${
              entry.excluded ? 'bg-red-500/5 border border-red-500/20' : 'bg-white/[0.02]'
            }`}>
              <div className="flex-1 min-w-0 flex items-center">
                <span className={`text-sm truncate ${entry.excluded ? 'text-red-400/60 line-through' : 'text-zinc-300'}`}>{entry.name}</span>
                {editingIndex === i ? (
                  <span className="ml-2 inline-flex items-center">
                    <input
                      ref={editInputRef}
                      type="number"
                      value={editingValue}
                      onChange={e => setEditingValue(e.target.value)}
                      onBlur={() => {
                        const val = Number(editingValue);
                        if (val > 0) onUpdateQuantity(i, val);
                        setEditingIndex(null);
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          const val = Number(editingValue);
                          if (val > 0) onUpdateQuantity(i, val);
                          setEditingIndex(null);
                        } else if (e.key === 'Escape') {
                          setEditingIndex(null);
                        }
                      }}
                      className="w-16 bg-white/10 border border-pierre-violet/50 rounded px-1.5 py-0.5 text-[11px] text-white text-center focus:outline-none"
                    />
                    <span className="text-[10px] text-zinc-500 ml-0.5">g</span>
                  </span>
                ) : (
                  <button
                    onClick={() => {
                      setEditingIndex(i);
                      setEditingValue(String(entry.quantity_g));
                      setTimeout(() => editInputRef.current?.select(), 0);
                    }}
                    className={`ml-2 text-[11px] px-2 py-0.5 rounded border border-dashed transition-colors cursor-pointer ${
                      entry.excluded
                        ? 'text-red-400/50 border-red-500/20 line-through'
                        : 'text-pierre-violet border-pierre-violet/30 hover:bg-pierre-violet/10 hover:text-pierre-violet'
                    }`}
                    title="Modifier la quantité"
                  >
                    {entry.quantity_g}g
                  </button>
                )}
              </div>
              <button
                onClick={() => onToggleExclude(i)}
                className={`p-1.5 rounded transition-colors ${
                  entry.excluded
                    ? 'text-green-400 hover:text-green-300'
                    : 'text-zinc-600 hover:text-red-400'
                }`}
                title={entry.excluded ? 'Réactiver' : 'Exclure du calcul'}
              >
                {entry.excluded ? (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                ) : (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-zinc-600 px-3 py-1">Aucun aliment ajouté</p>
      )}
      </>}
    </div>
  );
}

interface NutritionTrackerProps {
  exerciseCalories?: number;
}

export default function NutritionTracker({ exerciseCalories = 0 }: NutritionTrackerProps) {
  const {
    db, isLoading, foodsMap, meals, allRecipes,
    addFood, toggleExcludeFood, updateFoodQuantity, addRecipeToMeal,
    saveAsRecipe, deleteRecipe, addCustomFood, dayTotal, mealTotals,
  } = useNutrition();

  const handleAddOffFood = (mealType: MealType, offFood: OffFoodResult, quantity_g: number) => {
    const foodItem: FoodItem = {
      id: offFood.id,
      name: offFood.name,
      category: 'open_food_facts',
      per100g: offFood.per100g,
    };
    addCustomFood(foodItem);
    addFood(mealType, { foodId: offFood.id, name: offFood.name, quantity_g });
  };

  const [showMicros, setShowMicros] = useState(false);
  const [showGoals, setShowGoals] = useState(false);
  const [savingRecipe, setSavingRecipe] = useState<MealType | null>(null);
  const [recipeName, setRecipeName] = useState('');
  const [favoriteRecipeIds, setFavoriteRecipeIds] = useState<Set<string>>(loadFavoriteRecipeIds);
  const [goals, setGoalsState] = useState<NutritionGoals>(loadGoals);

  const updateGoals = useCallback((updated: NutritionGoals) => {
    setGoalsState(updated);
    saveGoalsToStorage(updated);
  }, []);

  const targets = useMemo(() => computeTargets(goals), [goals]);

  const toggleFavorite = useCallback((id: string) => {
    setFavoriteRecipeIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      saveFavoriteRecipeIds(next);
      return next;
    });
  }, []);

  // Duplicate yesterday's meal
  const handleDuplicateYesterday = useCallback((mealType: MealType) => {
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yStr = yesterday.toISOString().slice(0, 10);
      // Try to find yesterday's data in localStorage history
      const raw = localStorage.getItem('pierre_day_meals');
      if (raw) {
        const data = JSON.parse(raw);
        if (data.date === yStr && data[mealType]?.length > 0) {
          for (const entry of data[mealType]) {
            addFood(mealType, entry);
          }
          return;
        }
      }
    } catch { /* ignore */ }
  }, [addFood]);

  if (isLoading || !db) {
    return (
      <div className="card-dark flex justify-center py-8">
        <div className="pierre-spinner" />
      </div>
    );
  }

  const foodList = db.foods.map(f => ({ id: f.id, name: f.name }));
  const macroKeys = ['calories', 'protein', 'carbs', 'fat', 'fiber'] as const;
  const micros = Object.keys(NUTRIENT_LABELS).filter(k => !macroKeys.includes(k as typeof macroKeys[number]));

  const handleSaveRecipe = (mealType: MealType) => {
    if (recipeName.trim() && meals[mealType].length > 0) {
      saveAsRecipe(recipeName.trim(), meals[mealType]);
      setSavingRecipe(null);
      setRecipeName('');
    }
  };

  // Calorie computations (MyFitnessPal formula)
  const foodCalories = Math.round(dayTotal.calories || 0);
  const exerciseCal = Math.round(exerciseCalories);
  const remainingCalories = targets.calories - foodCalories + exerciseCal;

  return (
    <div className="card-dark !p-0 overflow-hidden border border-pierre-nutrition/30">
      {/* Header */}
      <div className="px-5 py-3 bg-gradient-to-r from-pierre-nutrition/20 via-amber-900/10 to-transparent flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pierre-nutrition to-amber-700 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-white">Tracker Nutritionnel</h3>
        </div>
        <button
          onClick={() => setShowGoals(!showGoals)}
          className={`text-xs px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
            showGoals
              ? 'bg-pierre-nutrition/30 text-pierre-nutrition'
              : 'bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200'
          }`}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
          </svg>
          Objectifs
        </button>
      </div>

      <div className="p-4 sm:p-5 space-y-4 sm:space-y-5">
        {/* Goal Settings Panel (collapsible) */}
        {showGoals && <GoalSettingsPanel goals={goals} onChange={updateGoals} />}

        {/* ── MyFitnessPal-style Dashboard ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Calorie Summary Card */}
          <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10">
            <div className="mb-3">
              <h4 className="text-sm font-semibold text-white">Calories</h4>
              <p className="text-[10px] text-zinc-500">Reste = Objectif - Aliments + Exercices</p>
            </div>
            <div className="flex items-center gap-5">
              <DonutRing
                size={130}
                strokeWidth={12}
                value={foodCalories}
                max={targets.calories}
                color={remainingCalories >= 0 ? '#4ADE80' : '#EF4444'}
              >
                <span className={`text-2xl font-bold ${remainingCalories >= 0 ? 'text-white' : 'text-red-400'}`}>
                  {Math.abs(remainingCalories).toLocaleString()}
                </span>
                <span className="text-[10px] text-zinc-400">{remainingCalories >= 0 ? 'Reste' : 'Excès'}</span>
              </DonutRing>
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-zinc-700/50 flex items-center justify-center flex-shrink-0">
                    <svg className="w-3.5 h-3.5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                    </svg>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-500 block leading-tight">Objectif de base</span>
                    <span className="text-sm font-medium text-white">{targets.calories.toLocaleString()}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-zinc-700/50 flex items-center justify-center flex-shrink-0">
                    <svg className="w-3.5 h-3.5 text-pierre-nutrition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-500 block leading-tight">Aliments</span>
                    <span className="text-sm font-medium text-white">{foodCalories.toLocaleString()}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-zinc-700/50 flex items-center justify-center flex-shrink-0">
                    <svg className="w-3.5 h-3.5 text-pierre-activity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-500 block leading-tight">Exercices</span>
                    <span className="text-sm font-medium text-white">{exerciseCal}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Macronutrients Card */}
          <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10">
            <h4 className="text-sm font-semibold text-white mb-3">Macronutriments</h4>
            <div className="flex items-start justify-around">
              {([
                { key: 'carbs', label: 'Glucides', color: '#60A5FA' },
                { key: 'fat', label: 'Lipides', color: '#FBBF24' },
                { key: 'protein', label: 'Protéines', color: '#C084FC' },
              ] as const).map(({ key, label, color }) => {
                const val = Math.round(dayTotal[key] || 0);
                const max = targets[key];
                const remaining = Math.max(0, max - val);
                return (
                  <div key={key} className="text-center flex flex-col items-center">
                    <span className="text-[10px] font-medium mb-1" style={{ color }}>{label}</span>
                    <DonutRing size={80} strokeWidth={8} value={val} max={max} color={color}>
                      <span className="text-lg font-bold text-white">{val}</span>
                      <span className="text-[8px] text-zinc-500">/{max} g</span>
                    </DonutRing>
                    <span className="text-[10px] text-zinc-500 mt-1">{remaining} g restant(e)s</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Summary Cards Row ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Résumé nutritionnel */}
          <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10">
            <h4 className="text-xs font-semibold text-white mb-3">Résumé nutritionnel</h4>
            {([
              { label: 'Glucides', val: dayTotal.carbs, max: targets.carbs, unit: 'g', color: '#60A5FA' },
              { label: 'Lipides', val: dayTotal.fat, max: targets.fat, unit: 'g', color: '#FBBF24' },
              { label: 'Protéines', val: dayTotal.protein, max: targets.protein, unit: 'g', color: '#C084FC' },
            ]).map(item => (
              <div key={item.label} className="mb-2.5">
                <div className="flex justify-between text-[10px] mb-0.5">
                  <span className="text-zinc-400">{item.label}</span>
                  <span className="text-zinc-300 font-medium">{Math.round(item.val || 0)}/{item.max}{item.unit}</span>
                </div>
                <ProgressBar value={item.val || 0} max={item.max} color={item.color} />
              </div>
            ))}
          </div>

          {/* Fibres & énergie */}
          <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10">
            <h4 className="text-xs font-semibold text-white mb-3">Fibres & énergie</h4>
            {([
              { label: 'Fibres', val: dayTotal.fiber, max: targets.fiber, unit: 'g', color: '#4ADE80' },
              { label: 'Calories nettes', val: foodCalories - exerciseCal, max: targets.calories, unit: 'kcal', color: '#F59E0B' },
            ]).map(item => (
              <div key={item.label} className="mb-2.5">
                <div className="flex justify-between text-[10px] mb-0.5">
                  <span className="text-zinc-400">{item.label}</span>
                  <span className="text-zinc-300 font-medium">{Math.round(item.val || 0)}/{item.max}{item.unit}</span>
                </div>
                <ProgressBar value={Math.max(0, item.val || 0)} max={item.max} color={item.color} />
              </div>
            ))}
          </div>

          {/* Vitamines clés */}
          <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10">
            <h4 className="text-xs font-semibold text-white mb-3">Vitamines clés</h4>
            {([
              { label: 'Vit. C', val: dayTotal.vitC, max: MICRO_RDA.vitC, unit: 'mg', color: '#F97316' },
              { label: 'Vit. D', val: dayTotal.vitD, max: MICRO_RDA.vitD, unit: 'µg', color: '#A78BFA' },
              { label: 'Fer', val: dayTotal.iron, max: MICRO_RDA.iron, unit: 'mg', color: '#FB7185' },
            ]).map(item => (
              <div key={item.label} className="mb-2.5">
                <div className="flex justify-between text-[10px] mb-0.5">
                  <span className="text-zinc-400">{item.label}</span>
                  <span className="text-zinc-300 font-medium">{(item.val || 0).toFixed(1)}/{item.max}{item.unit}</span>
                </div>
                <ProgressBar value={item.val || 0} max={item.max} autoColor />
              </div>
            ))}
          </div>
        </div>

        {/* ── Meals ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
          {(['breakfast', 'lunch', 'dinner'] as MealType[]).map(mealType => (
            <div key={mealType} className="space-y-2">
              <MealSection
                mealType={mealType}
                entries={meals[mealType]}
                onAdd={entry => addFood(mealType, entry)}
                onToggleExclude={index => toggleExcludeFood(mealType, index)}
                onUpdateQuantity={(index, qty) => updateFoodQuantity(mealType, index, qty)}
                onAddRecipe={recipe => addRecipeToMeal(mealType, recipe)}
                onAddExtra={entry => addFood(mealType, entry)}
                onAddOffFood={(food, qty) => handleAddOffFood(mealType, food, qty)}
                recipes={allRecipes}
                foods={foodList}
                favoriteRecipeIds={favoriteRecipeIds}
                onToggleFavorite={toggleFavorite}
                onDuplicateYesterday={handleDuplicateYesterday}
              />
              {/* Meal subtotal */}
              {meals[mealType].length > 0 && (
                <div className="flex items-center justify-between px-3 py-1 rounded bg-white/[0.03] text-[10px] text-zinc-400">
                  <span>{Math.round(mealTotals[mealType].calories || 0)} kcal</span>
                  <span>P:{Math.round(mealTotals[mealType].protein || 0)}g</span>
                  <span>G:{Math.round(mealTotals[mealType].carbs || 0)}g</span>
                  <span>L:{Math.round(mealTotals[mealType].fat || 0)}g</span>
                </div>
              )}
              {/* Save as recipe */}
              {meals[mealType].length >= 2 && (
                savingRecipe === mealType ? (
                  <div className="flex gap-1">
                    <input
                      type="text"
                      placeholder="Nom de la recette"
                      value={recipeName}
                      onChange={e => setRecipeName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSaveRecipe(mealType)}
                      className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-[11px] text-white placeholder-zinc-500 focus:outline-none"
                    />
                    <button
                      onClick={() => handleSaveRecipe(mealType)}
                      className="text-[10px] px-2 py-1 rounded bg-pierre-activity/20 text-pierre-activity hover:bg-pierre-activity/30"
                    >
                      OK
                    </button>
                    <button
                      onClick={() => setSavingRecipe(null)}
                      className="text-[10px] px-2 py-1 rounded bg-white/10 text-zinc-400"
                    >
                      X
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setSavingRecipe(mealType); setRecipeName(''); }}
                    className="w-full text-[10px] py-1 rounded border border-dashed border-white/10 text-zinc-500 hover:text-zinc-300 hover:border-white/20 transition-colors"
                  >
                    Sauvegarder comme recette
                  </button>
                )
              )}
            </div>
          ))}
        </div>

        {/* ── Micronutrients toggle ── */}
        <button
          onClick={() => setShowMicros(!showMicros)}
          className="w-full text-xs text-zinc-500 hover:text-zinc-300 transition-colors flex items-center justify-center gap-1 py-2 border-t border-white/5"
        >
          {showMicros ? 'Masquer' : 'Afficher'} vitamines & minéraux
          <svg className={`w-3.5 h-3.5 transition-transform ${showMicros ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Micronutrients grid */}
        {showMicros && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3">
            {micros.map(key => {
              const info = NUTRIENT_LABELS[key];
              if (!info) return null;
              const val = dayTotal[key] || 0;
              const rda = MICRO_RDA[key];
              const pct = rda ? Math.round((val / rda) * 100) : null;
              const color = pct === null ? '#71717a' : rdaColor(pct);
              return (
                <div key={key} className="px-3 py-2 rounded-lg bg-white/[0.02] border border-white/5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-zinc-400">{info.label}</span>
                    {pct !== null && <span className="text-[9px]" style={{ color }}>{pct}%</span>}
                  </div>
                  <span className="text-sm font-medium text-white">{val.toFixed(1)} {info.unit}</span>
                  {rda && <ProgressBar value={val} max={rda} autoColor />}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Saved recipes management ── */}
        {allRecipes.length > 0 && (
          <div className="border-t border-white/5 pt-3">
            <h4 className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">Recettes enregistrées</h4>
            <div className="flex flex-wrap gap-2">
              {allRecipes.map(recipe => {
                const total = computeNutrients(recipe.items, foodsMap);
                const isFav = favoriteRecipeIds.has(recipe.id);
                return (
                  <div key={recipe.id} className="px-3 py-2 rounded-lg bg-white/[0.03] border border-white/5 flex items-center gap-2 group">
                    <button
                      onClick={() => toggleFavorite(recipe.id)}
                      className={`transition-colors ${isFav ? 'text-pierre-nutrition' : 'text-zinc-600 hover:text-pierre-nutrition'}`}
                      title={isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                    >
                      <svg className="w-3.5 h-3.5" fill={isFav ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                      </svg>
                    </button>
                    <span className="text-sm text-zinc-300">{recipe.name}</span>
                    <span className="text-[9px] text-zinc-500">{Math.round(total.calories)} kcal</span>
                    {!recipe.id.startsWith('super_bowl') && (
                      <button
                        onClick={() => deleteRecipe(recipe.id)}
                        className="text-zinc-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
