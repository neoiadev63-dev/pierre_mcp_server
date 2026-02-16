// SPDX-License-Identifier: MIT OR Apache-2.0
// Copyright (c) 2025 Pierre Fitness Intelligence

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useNutrition, computeNutrients } from '../../hooks/useNutrition';
import type { MealType } from '../../hooks/useNutrition';
import type { MealFoodEntry, SavedRecipe, FoodItem } from '../../types/wellness';
import { searchOpenFoodFacts } from '../../utils/openFoodFacts';
import type { OffFoodResult } from '../../utils/openFoodFacts';

const LS_RECENT_FOODS_KEY = 'pierre_recent_foods';
const LS_FAVORITE_RECIPES_KEY = 'pierre_favorite_recipes';
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

// Recommended daily intake (homme 51 ans, 83.6 kg, perte de poids ~1800-1900 kcal)
const RDA = {
  calories: 1900, protein: 130, carbs: 220, fat: 60, fiber: 30,
  vitA: 900, vitC: 90, vitD: 15, vitE: 15, vitK: 120,
  vitB1: 1.2, vitB6: 1.7, vitB9: 400, vitB12: 2.4,
  iron: 8, calcium: 1000, magnesium: 420, zinc: 11, potassium: 3400,
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

function MealSection({ mealType, entries, onAdd, onRemove, onUpdateQuantity, onAddRecipe, onAddOffFood, recipes, foods, favoriteRecipeIds, onToggleFavorite, onDuplicateYesterday }: {
  mealType: MealType;
  entries: MealFoodEntry[];
  onAdd: (entry: MealFoodEntry) => void;
  onRemove: (index: number) => void;
  onUpdateQuantity: (index: number, newQuantity: number) => void;
  onAddRecipe: (recipe: SavedRecipe) => void;
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
  const [collapsed, setCollapsed] = useState(false);
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
                <div key={recipe.id} className="flex items-center gap-1">
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
            <div key={recipe.id} className="flex items-center gap-1">
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
            <div key={`${entry.foodId}-${i}`} className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-white/[0.02] group">
              <div className="flex-1 min-w-0 flex items-center">
                <span className="text-sm text-zinc-300 truncate">{entry.name}</span>
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
                      className="w-14 bg-white/10 border border-pierre-violet/50 rounded px-1.5 py-0.5 text-[11px] text-white text-center focus:outline-none"
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
                    className="ml-2 text-[10px] text-zinc-500 hover:text-pierre-violet hover:bg-white/5 rounded px-1.5 py-0.5 transition-colors cursor-pointer"
                    title="Modifier la quantité"
                  >
                    {entry.quantity_g}g
                  </button>
                )}
              </div>
              <button
                onClick={() => onRemove(i)}
                className="text-zinc-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 p-1"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
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

export default function NutritionTracker() {
  const {
    db, isLoading, foodsMap, meals, allRecipes,
    addFood, removeFood, updateFoodQuantity, addRecipeToMeal,
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
  const [savingRecipe, setSavingRecipe] = useState<MealType | null>(null);
  const [recipeName, setRecipeName] = useState('');
  const [favoriteRecipeIds, setFavoriteRecipeIds] = useState<Set<string>>(loadFavoriteRecipeIds);

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
  const macros = ['calories', 'protein', 'carbs', 'fat', 'fiber'] as const;
  const micros = Object.keys(NUTRIENT_LABELS).filter(k => !macros.includes(k as typeof macros[number]));

  const handleSaveRecipe = (mealType: MealType) => {
    if (recipeName.trim() && meals[mealType].length > 0) {
      saveAsRecipe(recipeName.trim(), meals[mealType]);
      setSavingRecipe(null);
      setRecipeName('');
    }
  };

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
      </div>

      <div className="p-4 sm:p-5 space-y-4 sm:space-y-5">
        {/* Macro summary bar */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 sm:gap-3">
          {macros.map(key => {
            const val = dayTotal[key] || 0;
            const rda = RDA[key as keyof typeof RDA] || 1;
            const pct = Math.round((val / rda) * 100);
            const color = key === 'calories' ? '#F59E0B'
              : key === 'protein' ? '#EF4444'
              : key === 'carbs' ? '#3B82F6'
              : key === 'fat' ? '#A855F7'
              : '#22C55E';
            return (
              <div key={key} className="text-center">
                <span className="text-lg sm:text-xl font-bold text-white">{Math.round(val)}</span>
                <span className="text-[11px] text-zinc-500 block">{NUTRIENT_LABELS[key].unit}</span>
                <ProgressBar value={val} max={rda} color={color} />
                <span className="text-[9px] text-zinc-500">{pct}%</span>
                <span className="text-[9px] text-zinc-600 block">{NUTRIENT_LABELS[key].label}</span>
              </div>
            );
          })}
        </div>

        {/* Meals */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
          {(['breakfast', 'lunch', 'dinner'] as MealType[]).map(mealType => (
            <div key={mealType} className="space-y-2">
              <MealSection
                mealType={mealType}
                entries={meals[mealType]}
                onAdd={entry => addFood(mealType, entry)}
                onRemove={index => removeFood(mealType, index)}
                onUpdateQuantity={(index, qty) => updateFoodQuantity(mealType, index, qty)}
                onAddRecipe={recipe => addRecipeToMeal(mealType, recipe)}
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

        {/* Micronutrients toggle */}
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
              const rda = RDA[key as keyof typeof RDA];
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

        {/* Saved recipes management */}
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
