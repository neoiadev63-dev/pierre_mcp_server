// SPDX-License-Identifier: MIT OR Apache-2.0
// Copyright (c) 2025 Pierre Fitness Intelligence

import { useTranslation } from 'react-i18next';
import type { WellnessSummary } from '../../types/wellness';
import SleepCard from './SleepCard';
import BodyBatteryCard from './BodyBatteryCard';
import StepsCard from './StepsCard';
import HeartRateCard from './HeartRateCard';
import IntensityMinutesCard from './IntensityMinutesCard';
import CaloriesCard from './CaloriesCard';
import StressCard from './StressCard';
import CoachBilanCard from './CoachBilanCard';
import CoachDebriefingCard from './CoachDebriefingCard';
import HealthSnapshotCard from './HealthSnapshotCard';
import ActivityCard from './ActivityCard';
import WellnessChatWindow from './WellnessChatWindow';
import CoffeeTracker from './CoffeeTracker';
import HydrationTracker from './HydrationTracker';
import NutritionTracker from './NutritionTracker';

interface WellnessDashboardProps {
  data: WellnessSummary;
}

export default function WellnessDashboard({ data }: WellnessDashboardProps) {
  const { t } = useTranslation();
  const { latest, days, weeklyIntensity, hrTrend7d } = data;

  if (!latest) return null;

  return (
    <div className="space-y-4 sm:space-y-5 md:space-y-6 min-w-0">
      {/* AI Coach Bilan */}
      {data.coachBilan && <CoachBilanCard bilan={data.coachBilan} />}

      {/* Health Snapshot: VFC gauge + biometrics + recommendation */}
      <HealthSnapshotCard data={data} />

      {/* AI Coach Debriefing with charts */}
      {data.coachDebriefing && <CoachDebriefingCard debriefing={data.coachDebriefing} data={data} />}

      {/* Latest Activity */}
      {data.latestActivity && <ActivityCard activity={data.latestActivity} />}

      {/* FOCUS section */}
      <div>
        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
          {t('wellness.sections.focus')}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <SleepCard sleep={latest.sleep} />
          <BodyBatteryCard days={days} />
          <StepsCard steps={latest.steps} days={days} />
        </div>
      </div>

      {/* OVERVIEW section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
            {t('wellness.sections.overview')}
          </h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <HeartRateCard
            resting={latest.heartRate.resting}
            min={latest.heartRate.min}
            max={latest.heartRate.max}
            trend7d={hrTrend7d}
          />
          <IntensityMinutesCard weekly={weeklyIntensity} />
          <CaloriesCard calories={latest.calories} />
          <StressCard stress={latest.stress} />
        </div>
      </div>

      {/* Trackers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <CoffeeTracker />
        <HydrationTracker />
      </div>

      {/* Nutrition Tracker */}
      <NutritionTracker exerciseCalories={latest.calories.active} />

      {/* Bottom info row */}
      {data.fitnessAge && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: t('wellness.fitnessAge'), value: `${data.fitnessAge.fitnessAge} ans`, sub: `${t('wellness.chronoAge')}: ${data.fitnessAge.chronologicalAge}` },
            { label: t('wellness.bmi'), value: data.fitnessAge.bmi.toString(), sub: data.biometrics ? `${data.biometrics.weight_kg} kg` : '' },
            { label: t('wellness.bodyFat'), value: `${data.fitnessAge.bodyFat.toFixed(1)}%`, sub: '' },
            { label: t('wellness.rhr'), value: `${data.fitnessAge.rhr} bpm`, sub: '' },
          ].map((item) => (
            <div key={item.label} className="card-dark !p-3 text-center">
              <span className="text-[10px] text-zinc-400 uppercase tracking-wider">{item.label}</span>
              <div className="text-lg font-bold text-white mt-0.5">{item.value}</div>
              {item.sub && <span className="text-[10px] text-zinc-500">{item.sub}</span>}
            </div>
          ))}
        </div>
      )}

      {/* Interactive Chat with Coach Pierre */}
      <WellnessChatWindow wellnessData={data} />
    </div>
  );
}
