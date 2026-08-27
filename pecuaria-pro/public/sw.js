// PecuáriaIA — Service Worker v2.0
const CACHE_NAME = 'pecuaria-ia-v3'
const STATIC_ASSETS = ['/', '/index.html', '/manifest.json']

// Instalar e cachear assets estáticos
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  )
  self.skipWaiting()
})

// Ativar e limpar caches antigos
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url)

  // Ignorar requisições de outros domínios (CDNs, fontes, Tesseract, etc) — deixa passar direto
  if (url.origin !== self.location.origin) {
    return
  }

  // Nunca cachear a função de IA nem chamadas de API do Supabase (sempre rede)
  if (url.pathname.includes('/api/') || url.hostname.includes('supabase.co')) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    )
    return
  }

  // JS/CSS com hash (assets do Vite) — Network First para pegar versão nova
  if (url.pathname.includes('/assets/')) {
    event.respondWith(
      fetch(event.request)
        .then(res => {
          if (res.ok) {
            const clone = res.clone()
            caches.open(CACHE_NAME).then(c => c.put(event.request, clone))
          }
          return res
        })
        .catch(() => caches.match(event.request))
    )
    return
  }

  // Demais GET — Cache First
  if (event.request.method === 'GET') {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached
        return fetch(event.request).then(res => {
          if (res.ok) {
            const clone = res.clone()
            caches.open(CACHE_NAME).then(c => c.put(event.request, clone))
          }
          return res
        }).catch(() => caches.match('/index.html'))
      })
    )
  }
})

self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting()
})
