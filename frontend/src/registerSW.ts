// SPDX-License-Identifier: MIT OR Apache-2.0
// Copyright (c) 2025 Pierre Fitness Intelligence
/**
 * Enregistrement du Service Worker pour le support PWA
 * Auto-reload quand une nouvelle version est disponible
 */

export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    console.log('Service Workers non supportes par ce navigateur');
    return;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });

    console.log('Service Worker enregistre:', registration.scope);

    // Force check for updates immediately
    registration.update();

    // Check for updates every hour
    setInterval(() => {
      registration.update();
    }, 60 * 60 * 1000);

    // Auto-reload when new SW takes control
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });

    // Listen for new versions
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (!newWorker) return;

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          // New SW ready - tell it to activate immediately
          newWorker.postMessage({ action: 'skipWaiting' });
        }
      });
    });
  } catch (error) {
    console.error('Erreur enregistrement Service Worker:', error);
  }
}
