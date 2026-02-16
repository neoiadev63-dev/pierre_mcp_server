// SPDX-License-Identifier: MIT OR Apache-2.0
// Copyright (c) 2025 Pierre Fitness Intelligence

export interface WellnessSteps {
  count: number;
  goal: number;
  distance_m: number;
}

export interface WellnessHeartRate {
  resting: number | null;
  min: number | null;
  max: number | null;
}

export interface WellnessCalories {
  total: number;
  active: number;
  bmr: number;
}

export interface WellnessStress {
  average: number | null;
  max: number | null;
  low_minutes: number;
  medium_minutes: number;
  high_minutes: number;
  rest_minutes: number;
}

export interface WellnessIntensityMinutes {
  moderate: number;
  vigorous: number;
  goal: number;
}

export interface WellnessSleep {
  score: number | null;
  quality: number | null;
  duration_seconds: number;
  deep_seconds: number;
  light_seconds: number;
  rem_seconds: number;
  awake_seconds: number;
  recovery_score: number | null;
  restfulness_score: number | null;
  spo2_avg: number | null;
  hr_avg: number | null;
  respiration_avg: number | null;
  feedback: string | null;
}

export interface WellnessBodyBattery {
  estimate: number | null;
}

export interface WellnessDay {
  date: string;
  steps: WellnessSteps;
  heartRate: WellnessHeartRate;
  calories: WellnessCalories;
  stress: WellnessStress;
  intensityMinutes: WellnessIntensityMinutes;
  bodyBattery: WellnessBodyBattery;
  sleep: WellnessSleep | null;
  floors: {
    ascended_m: number;
    descended_m: number;
  };
}

export interface WeeklyIntensityDay {
  date: string;
  moderate: number;
  vigorous: number;
}

export interface WeeklyIntensity {
  moderate: number;
  vigorous: number;
  total: number;
  goal: number;
  days: WeeklyIntensityDay[];
}

export interface HrTrendPoint {
  date: string;
  resting: number;
}

export interface CoachBilanTrainingRec {
  type: string;
  summary: string;
  duration_min: number;
  intensity: string;
  hr_zone: string;
  hr_target?: string;
  hr_target_bpm?: string;
  details: string;
  warmup?: string;
  main_effort?: string;
  cooldown?: string;
}

export interface CoachBilan {
  nightSummary: string;
  fitnessStatus: string;
  trainingRecommendation: CoachBilanTrainingRec;
  hydration: string;
  nutrition: string;
  generated_at: string;
}

export interface CoachDebriefing {
  sleepAnalysis: string;
  activityAnalysis: string;
  weightAnalysis: string;
  fitnessAssessment: string;
  stressRecovery: string;
  hydrationPlan: string;
  nutritionPlan: string;
  progressComparison: string;
  nextTraining: {
    recommended_date: string;
    type: string;
    duration_min: number;
    warmup: string;
    main_set: string;
    cooldown: string;
    hr_target_bpm: string;
    rationale: string;
  };
  generated_at: string;
}

export interface NutrientsPer100g {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  vitA?: number;
  vitC?: number;
  vitD?: number;
  vitE?: number;
  vitK?: number;
  vitB1?: number;
  vitB6?: number;
  vitB9?: number;
  vitB12?: number;
  iron?: number;
  calcium?: number;
  magnesium?: number;
  zinc?: number;
  potassium?: number;
  curcumin?: number;
}

export interface FoodItem {
  id: string;
  name: string;
  category: string;
  per100g: NutrientsPer100g;
}

export interface MealFoodEntry {
  foodId: string;
  name: string;
  quantity_g: number;
}

export interface SavedRecipe {
  id: string;
  name: string;
  items: MealFoodEntry[];
}

export interface DayMeals {
  date: string;
  breakfast: MealFoodEntry[];
  lunch: MealFoodEntry[];
  dinner: MealFoodEntry[];
}

export interface NutritionDb {
  foods: FoodItem[];
  defaultRecipes: SavedRecipe[];
}

export interface WeightEntry {
  date: string;
  time: string;
  weight_kg: number;
  bmi: number | null;
  body_fat_pct: number | null;
  muscle_mass_kg: number | null;
  bone_mass_kg: number | null;
  body_water_pct: number | null;
  source: string;
}

export interface WeightHistory {
  entries: WeightEntry[];
  goal_kg: number | null;
  latest: WeightEntry | null;
}

export interface HrZone {
  zone: number;
  seconds: number;
}

export interface ActivitySummary {
  activityId: number;
  name: string;
  activityType: string;
  sportType: string;
  date: string;
  startTimeLocal: string;
  location: string | null;

  duration_s: number;
  moving_duration_s: number;
  elapsed_duration_s: number;
  distance_km: number;

  avg_speed_kmh: number;
  max_speed_kmh: number;

  elevation_gain_m: number;
  elevation_loss_m: number;
  min_elevation_m: number;
  max_elevation_m: number;

  avg_hr: number | null;
  max_hr: number | null;
  min_hr: number | null;
  hrZones: HrZone[];

  calories: number;
  calories_consumed: number | null;

  aerobic_te: number | null;
  anaerobic_te: number | null;
  training_load: number | null;
  te_label: string | null;

  min_temp_c: number | null;
  max_temp_c: number | null;

  avg_respiration: number | null;
  min_respiration: number | null;
  max_respiration: number | null;

  water_estimated_ml: number | null;
  water_consumed_ml: number | null;

  avg_cadence: number | null;
  max_cadence: number | null;

  avg_power: number | null;
  max_power: number | null;
  norm_power: number | null;

  grit: number | null;
  avg_flow: number | null;
  jump_count: number | null;

  suffer_score: number | null;
  source: 'garmin' | 'strava' | null;

  moderate_minutes: number;
  vigorous_minutes: number;

  startLatitude: number | null;
  startLongitude: number | null;
}

// ── Detailed sleep timeline types ──

export interface SleepLevelEpoch {
  start: string; // ISO datetime e.g. "2026-02-13T23:05:00.0"
  end: string;
  level: number; // 0=deep, 1=light, 2=awake/REM
}

export interface SleepMovementPoint {
  start: string;
  end: string;
  level: number; // activity level (float)
}

export interface TimelinePoint {
  epoch_ms: number;
  value: number;
}

export interface Spo2TimelinePoint {
  timestamp: string; // ISO datetime
  value: number;
}

export interface SleepDetail {
  sleepStartLocal: number; // epoch ms
  sleepEndLocal: number;
  sleepLevels: SleepLevelEpoch[];
  sleepMovement: SleepMovementPoint[];
  hrTimeline: TimelinePoint[];
  spo2Timeline: Spo2TimelinePoint[];
  respTimeline: TimelinePoint[];
  bbTimeline: TimelinePoint[];
  stressTimeline: TimelinePoint[];
  restlessMoments: { epoch_ms: number }[];
  restlessCount: number;
  restingHr: number | null;
  lowestSpo2: number | null;
  avgStress: number | null;
  lowestResp: number | null;
  bbChange: number | null;
}

export interface WellnessSummary {
  generated_at: string;
  days_count: number;
  latest: WellnessDay | null;
  days: WellnessDay[];
  weeklyIntensity: WeeklyIntensity;
  hrTrend7d: HrTrendPoint[];
  vo2max: {
    date: string;
    vo2max: number;
    maxMet: number;
  } | null;
  fitnessAge: {
    chronologicalAge: number;
    fitnessAge: number;
    bodyFat: number;
    bmi: number;
    rhr: number;
  } | null;
  biometrics: {
    weight_kg: number;
    height_cm: number | null;
    vo2max_running: number | null;
  } | null;
  coachBilan: CoachBilan | null;
  coachDebriefing: CoachDebriefing | null;
  weightHistory: WeightHistory | null;
  latestActivity: ActivitySummary | null;
  activityHistory: ActivitySummary[] | null;
  sleepDetail: SleepDetail | null;
}
