// SPDX-License-Identifier: MIT OR Apache-2.0
// Copyright (c) 2025 Pierre Fitness Intelligence

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { NutritionDb, FoodItem, MealFoodEntry, SavedRecipe, DayMeals, NutrientsPer100g } from '../types/wellness';

const LS_MEALS_KEY = 'pierre_day_meals';
const LS_RECIPES_KEY = 'pierre_saved_recipes';
const LS_CUSTOM_FOODS_KEY = 'pierre_custom_foods';

async function fetchNutritionDb(): Promise<NutritionDb> {
  const [baseRes, offRes] = await Promise.all([
    fetch('/data/nutrition_db.json'),
    fetch('/data/off_products.json').catch(() => null),
  ]);
  if (!baseRes.ok) throw new Error('Failed to load nutrition database');
  const base: NutritionDb = await baseRes.json();

  // Merge Open Food Facts products if available
  if (offRes && offRes.ok) {
    try {
      const off = await offRes.json();
      if (off?.foods?.length) {
        const existingIds = new Set(base.foods.map(f => f.id));
        const newFoods = off.foods.filter((f: FoodItem) => !existingIds.has(f.id));
        base.foods = [...base.foods, ...newFoods];
      }
    } catch { /* ignore parse errors */ }
  }

  return base;
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function emptyDayMeals(): DayMeals {
  return { date: todayStr(), breakfast: [], lunch: [], dinner: [] };
}

function loadMeals(): DayMeals {
  try {
    const raw = localStorage.getItem(LS_MEALS_KEY);
    if (raw) {
      const m = JSON.parse(raw) as DayMeals;
      if (m.date === todayStr()) return m;
    }
  } catch { /* ignore */ }
  return emptyDayMeals();
}

function saveMeals(meals: DayMeals) {
  localStorage.setItem(LS_MEALS_KEY, JSON.stringify(meals));
  // Sync to server (fire-and-forget)
  syncMealsToServer(meals);
}

async function syncMealsToServer(meals: DayMeals): Promise<void> {
  try {
    await fetch('/api/wellness/nutrition', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(meals),
    });
  } catch { /* fire-and-forget */ }
}

async function fetchMealsFromServer(date: string): Promise<DayMeals | null> {
  try {
    const res = await fetch(`/api/wellness/nutrition?date=${date}`, { credentials: 'include' });
    if (!res.ok) return null;
    const data = await res.json();
    if (data && data.date) return data as DayMeals;
  } catch { /* ignore */ }
  return null;
}

function loadRecipes(): SavedRecipe[] {
  try {
    const raw = localStorage.getItem(LS_RECIPES_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return [];
}

function saveRecipes(recipes: SavedRecipe[]) {
  localStorage.setItem(LS_RECIPES_KEY, JSON.stringify(recipes));
}

function loadCustomFoods(): FoodItem[] {
  try {
    const raw = localStorage.getItem(LS_CUSTOM_FOODS_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return [];
}

function saveCustomFoods(foods: FoodItem[]) {
  localStorage.setItem(LS_CUSTOM_FOODS_KEY, JSON.stringify(foods));
}

export type MealType = 'breakfast' | 'lunch' | 'dinner';

export interface ComputedNutrients extends NutrientsPer100g {
  [key: string]: number | undefined;
}

export function computeNutrients(entries: MealFoodEntry[], foodsMap: Map<string, FoodItem>): ComputedNutrients {
  const result: ComputedNutrients = {
    calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0,
  };
  for (const entry of entries) {
    if (entry.excluded) continue;
    const food = foodsMap.get(entry.foodId);
    if (!food) continue;
    const ratio = entry.quantity_g / 100;
    for (const [key, val] of Object.entries(food.per100g)) {
      if (typeof val === 'number') {
        result[key] = (result[key] || 0) + val * ratio;
      }
    }
  }
  return result;
}

export function useNutrition() {
  const { data: db, isLoading } = useQuery<NutritionDb>({
    queryKey: ['nutrition-db'],
    queryFn: fetchNutritionDb,
    staleTime: Infinity,
  });

  const [meals, setMealsState] = useState<DayMeals>(loadMeals);
  const [userRecipes, setUserRecipesState] = useState<SavedRecipe[]>(loadRecipes);
  const [customFoods, setCustomFoodsState] = useState<FoodItem[]>(loadCustomFoods);

  // On mount: try loading meals from server (prefer server data over localStorage)
  useEffect(() => {
    let cancelled = false;
    const today = todayStr();
    fetchMealsFromServer(today).then(serverMeals => {
      if (cancelled) return;
      if (serverMeals && serverMeals.date === today) {
        const totalItems = (serverMeals.breakfast?.length || 0) + (serverMeals.lunch?.length || 0) + (serverMeals.dinner?.length || 0);
        if (totalItems > 0) {
          setMealsState(serverMeals);
          localStorage.setItem(LS_MEALS_KEY, JSON.stringify(serverMeals));
        }
      }
    });
    return () => { cancelled = true; };
  }, []);

  // Merge default recipes with user recipes
  const allRecipes = useMemo(() => {
    const defaults = db?.defaultRecipes || [];
    const userIds = new Set(userRecipes.map(r => r.id));
    return [...defaults.filter(d => !userIds.has(d.id)), ...userRecipes];
  }, [db, userRecipes]);

  const foodsMap = useMemo(() => {
    const m = new Map<string, FoodItem>();
    for (const f of db?.foods || []) m.set(f.id, f);
    for (const f of customFoods) m.set(f.id, f);
    return m;
  }, [db, customFoods]);

  const setMeals = useCallback((m: DayMeals) => {
    setMealsState(m);
    saveMeals(m);
  }, []);

  // Reset meals if date changed
  useEffect(() => {
    if (meals.date !== todayStr()) {
      setMeals(emptyDayMeals());
    }
  }, [meals.date, setMeals]);

  const addFood = useCallback((mealType: MealType, entry: MealFoodEntry) => {
    setMeals({
      ...meals,
      [mealType]: [...meals[mealType], entry],
    });
  }, [meals, setMeals]);

  const removeFood = useCallback((mealType: MealType, index: number) => {
    setMeals({
      ...meals,
      [mealType]: meals[mealType].filter((_, i) => i !== index),
    });
  }, [meals, setMeals]);

  const updateFoodQuantity = useCallback((mealType: MealType, index: number, newQuantity: number) => {
    setMeals({
      ...meals,
      [mealType]: meals[mealType].map((entry, i) =>
        i === index ? { ...entry, quantity_g: newQuantity } : entry
      ),
    });
  }, [meals, setMeals]);

  const toggleExcludeFood = useCallback((mealType: MealType, index: number) => {
    setMeals({
      ...meals,
      [mealType]: meals[mealType].map((entry, i) =>
        i === index ? { ...entry, excluded: !entry.excluded } : entry
      ),
    });
  }, [meals, setMeals]);

  const addRecipeToMeal = useCallback((mealType: MealType, recipe: SavedRecipe) => {
    setMeals({
      ...meals,
      [mealType]: [...meals[mealType], ...recipe.items],
    });
  }, [meals, setMeals]);

  const saveAsRecipe = useCallback((name: string, items: MealFoodEntry[]) => {
    const recipe: SavedRecipe = {
      id: `recipe_${Date.now()}`,
      name,
      items: [...items],
    };
    const updated = [...userRecipes, recipe];
    setUserRecipesState(updated);
    saveRecipes(updated);
    return recipe;
  }, [userRecipes]);

  const deleteRecipe = useCallback((id: string) => {
    const updated = userRecipes.filter(r => r.id !== id);
    setUserRecipesState(updated);
    saveRecipes(updated);
  }, [userRecipes]);

  const addCustomFood = useCallback((food: FoodItem) => {
    if (customFoods.some(f => f.id === food.id)) return;
    const updated = [...customFoods, food];
    setCustomFoodsState(updated);
    saveCustomFoods(updated);
  }, [customFoods]);

  // Compute totals
  const allEntries = useMemo(() => [
    ...meals.breakfast, ...meals.lunch, ...meals.dinner,
  ], [meals]);

  const dayTotal = useMemo(() => computeNutrients(allEntries, foodsMap), [allEntries, foodsMap]);
  const mealTotals = useMemo(() => ({
    breakfast: computeNutrients(meals.breakfast, foodsMap),
    lunch: computeNutrients(meals.lunch, foodsMap),
    dinner: computeNutrients(meals.dinner, foodsMap),
  }), [meals, foodsMap]);

  return {
    db,
    isLoading,
    foodsMap,
    meals,
    allRecipes,
    addFood,
    removeFood,
    toggleExcludeFood,
    updateFoodQuantity,
    addRecipeToMeal,
    saveAsRecipe,
    deleteRecipe,
    addCustomFood,
    dayTotal,
    mealTotals,
  };
}
