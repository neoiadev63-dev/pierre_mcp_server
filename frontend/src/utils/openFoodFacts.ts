// SPDX-License-Identifier: MIT OR Apache-2.0
// Copyright (c) 2025 Pierre Fitness Intelligence

import type { NutrientsPer100g } from '../types/wellness';

interface OffProduct {
  code: string;
  product_name?: string;
  product_name_fr?: string;
  brands?: string;
  nutriments?: Record<string, number>;
}

interface OffSearchResponse {
  products: OffProduct[];
}

export interface OffFoodResult {
  id: string;
  name: string;
  brand: string;
  per100g: NutrientsPer100g;
}

const OFF_SEARCH_URL = 'https://fr.openfoodfacts.org/cgi/search.pl';

function val(n: Record<string, number>, key: string): number | undefined {
  const v = n[key];
  if (v === undefined || v === null || isNaN(v)) return undefined;
  return v;
}

function mapNutriments(n: Record<string, number>): NutrientsPer100g {
  return {
    calories: n['energy-kcal_100g'] || n['energy_100g'] / 4.184 || 0,
    protein: n['proteins_100g'] || 0,
    carbs: n['carbohydrates_100g'] || 0,
    fat: n['fat_100g'] || 0,
    fiber: n['fiber_100g'] || 0,
    vitA: val(n, 'vitamin-a_100g'),
    vitC: val(n, 'vitamin-c_100g'),
    vitD: val(n, 'vitamin-d_100g'),
    vitE: val(n, 'vitamin-e_100g'),
    vitK: val(n, 'vitamin-k1_100g') ?? val(n, 'vitamin-k_100g'),
    vitB1: val(n, 'vitamin-b1_100g'),
    vitB6: val(n, 'vitamin-b6_100g'),
    vitB9: val(n, 'vitamin-b9_100g') ?? val(n, 'folates_100g'),
    vitB12: val(n, 'vitamin-b12_100g'),
    iron: val(n, 'iron_100g'),
    calcium: val(n, 'calcium_100g'),
    magnesium: val(n, 'magnesium_100g'),
    zinc: val(n, 'zinc_100g'),
    potassium: val(n, 'potassium_100g'),
  };
}

export async function searchOpenFoodFacts(query: string, signal?: AbortSignal): Promise<OffFoodResult[]> {
  if (!query.trim() || query.length < 2) return [];

  const url = new URL(OFF_SEARCH_URL);
  url.searchParams.set('search_terms', query);
  url.searchParams.set('search_simple', '1');
  url.searchParams.set('action', 'process');
  url.searchParams.set('json', '1');
  url.searchParams.set('page_size', '15');
  url.searchParams.set('lc', 'fr');
  url.searchParams.set('cc', 'fr');
  url.searchParams.set('fields', 'code,product_name,product_name_fr,brands,nutriments');

  const res = await fetch(url.toString(), {
    signal,
    headers: { 'User-Agent': 'PierreCoach/1.0 (contact@pierre-fitness.com)' },
  });
  if (!res.ok) throw new Error('Open Food Facts search failed');

  const data = (await res.json()) as OffSearchResponse;

  return data.products
    .filter(p => {
      const name = p.product_name_fr || p.product_name;
      return name && name.length > 0 && p.nutriments;
    })
    .map(p => {
      const name = p.product_name_fr || p.product_name || 'Inconnu';
      const brand = p.brands?.split(',')[0]?.trim() || '';
      return {
        id: `off_${p.code}`,
        name: brand ? `${name} (${brand})` : name,
        brand,
        per100g: mapNutriments(p.nutriments || {}),
      };
    })
    .filter(f => f.per100g.calories > 0 || f.per100g.protein > 0);
}
