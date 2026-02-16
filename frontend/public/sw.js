// SPDX-License-Identifier: MIT OR Apache-2.0
// Copyright (c) 2025 Pierre Fitness Intelligence
// Pierre Coach - Service Worker
// PWA offline support et stratégies de cache

const CACHE_VERSION = 'v3';
const CACHE_NAME = `pierre-coach-${CACHE_VERSION}`;

// Assets à mettre en cache au moment de l'installation
const STATIC_ASSETS = [
  '/pierre-icon.svg',
  '/pierre-favicon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/manifest.json'
];

// Installation du service worker
self.addEventListener('install', (event) => {
  console.log('[SW] Installation...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Mise en cache des assets statiques');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activation du service worker
self.addEventListener('activate', (event) => {
  console.log('[SW] Activation...');
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => cacheName.startsWith('pierre-coach-') && cacheName !== CACHE_NAME)
            .map((cacheName) => {
              console.log('[SW] Suppression ancien cache:', cacheName);
              return caches.delete(cacheName);
            })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Stratégies de fetch
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Stratégie Network First pour les pages HTML/navigation (index.html)
  if (request.mode === 'navigate' || url.pathname === '/' || url.pathname === '/index.html') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Stratégie Network First pour les données JSON
  if (url.pathname.endsWith('.json') || url.pathname.includes('/wellness-chat')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Clone et mise en cache de la réponse réseau
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
          return response;
        })
        .catch(() => {
          // Fallback sur le cache si le réseau échoue
          return caches.match(request);
        })
    );
    return;
  }

  // Stratégie Cache First pour les assets statiques
  if (
    url.pathname.match(/\.(js|css|woff2?|svg|png|jpg|jpeg|gif|ico)$/) ||
    STATIC_ASSETS.includes(url.pathname)
  ) {
    event.respondWith(
      caches.match(request)
        .then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Si pas en cache, fetch et mise en cache
          return fetch(request).then((response) => {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
            return response;
          });
        })
    );
    return;
  }

  // Par défaut, Network Only
  event.respondWith(fetch(request));
});

// Message handler pour forcer la mise à jour
self.addEventListener('message', (event) => {
  if (event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});
