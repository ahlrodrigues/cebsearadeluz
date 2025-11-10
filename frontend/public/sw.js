// Very small service worker for basic offline caching of static assets.
const CACHE_NAME = 'assistido-cache-v3'
const ASSETS = [
  '/',
  '/index.html',
  '/vite.svg',
  '/apple-touch-icon.png',
  '/icons/app-icon-120.png',
  '/icons/app-icon-152.png',
  '/icons/app-icon-167.png',
  '/icons/app-icon-180.png',
  '/icons/app-icon-192.png',
  '/icons/app-icon-512.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : Promise.resolve())))).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  // Network-first for API, cache-first for others
  if (req.url.includes('/users') || req.url.includes('/passes') || req.url.includes('/auth')) {
    event.respondWith(fetch(req).catch(() => caches.match(req)))
  } else {
    event.respondWith(
      caches.match(req).then((cached) => cached || fetch(req))
    )
  }
})
