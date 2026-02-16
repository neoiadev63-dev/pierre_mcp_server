// SPDX-License-Identifier: MIT OR Apache-2.0
// Copyright (c) 2025 Pierre Fitness Intelligence
import { useEffect, useState } from 'react';
import type { ChartOptions } from 'chart.js';

/**
 * Hook pour obtenir des options Chart.js responsives selon la taille d'écran
 * Adapté pour mobile (Samsung Galaxy A52: 1080x2400, 6.5")
 */

const MOBILE_BREAKPOINT = 768; // tailwind md breakpoint

interface ResponsiveChartConfig {
  isMobile: boolean;
  fontSize: {
    title: number;
    axis: number;
    legend: number;
    tooltip: number;
  };
  legend: {
    position: 'top' | 'bottom' | 'left' | 'right';
    align: 'start' | 'center' | 'end';
  };
  padding: number;
}

export function useChartResponsive(): ResponsiveChartConfig {
  const [isMobile, setIsMobile] = useState(window.innerWidth < MOBILE_BREAKPOINT);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return {
    isMobile,
    fontSize: {
      title: isMobile ? 14 : 16,
      axis: isMobile ? 10 : 12,
      legend: isMobile ? 11 : 12,
      tooltip: isMobile ? 11 : 12,
    },
    legend: {
      position: isMobile ? 'bottom' : 'top',
      align: isMobile ? 'start' : 'center',
    },
    padding: isMobile ? 8 : 12,
  };
}

/**
 * Fonction helper pour créer des options Chart.js responsives
 */
export function createResponsiveChartOptions(
  config: ResponsiveChartConfig,
  baseOptions?: Partial<ChartOptions>
): ChartOptions {
  return {
    responsive: true,
    maintainAspectRatio: true,
    aspectRatio: config.isMobile ? 1.5 : 2,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        position: config.legend.position,
        align: config.legend.align,
        labels: {
          font: {
            size: config.fontSize.legend,
          },
          padding: config.padding,
          boxWidth: config.isMobile ? 30 : 40,
          usePointStyle: true,
        },
      },
      tooltip: {
        enabled: true,
        mode: 'index',
        intersect: false,
        padding: config.padding,
        titleFont: {
          size: config.fontSize.tooltip,
        },
        bodyFont: {
          size: config.fontSize.tooltip,
        },
        usePointStyle: true,
      },
      title: {
        display: false, // Généralement géré par le composant parent
      },
    },
    scales: {
      x: {
        ticks: {
          font: {
            size: config.fontSize.axis,
          },
          maxRotation: config.isMobile ? 45 : 0,
          minRotation: config.isMobile ? 45 : 0,
        },
        grid: {
          display: !config.isMobile,
        },
      },
      y: {
        ticks: {
          font: {
            size: config.fontSize.axis,
          },
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.05)',
        },
      },
    },
    ...baseOptions,
  } as ChartOptions;
}
