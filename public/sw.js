// PecuáriaIA — Service Worker v4
const CACHE_NAME = 'pecuaria-ia-v4'

// Instalar
self.addEventListener('install', event => {
  self.skipWaiting()
})

// Ativar e limpar TODOS os caches antigos
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url)

  // Ignorar outros domínios (CDNs, Tesseract, fontes) — passa direto
  if (url.origin !== self.location.origin) return

  // API de IA e Supabase — sempre rede
  if (url.pathname.includes('/api/') || url.hostname.includes('supabase.co')) {
    event.respondWith(fetch(event.request).catch(() => caches.match(event.request)))
    return
  }

  // index.html e navegação (HTML) — SEMPRE da rede (Network First)
  // Isso garante que o HTML sempre aponte para o JS/CSS mais recente
  if (event.request.mode === 'navigate' || url.pathname === '/' || url.pathname.endsWith('.html')) {
    event.respondWith(
      fetch(event.request)
        .then(res => {
          const clone = res.clone()
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone))
          return res
        })
        .catch(() => caches.match(event.request).then(r => r || caches.match('/index.html')))
    )
    return
  }

  // Assets com hash (JS/CSS/imagens do Vite) — Network First, cacheia versão nova
  if (url.pathname.includes('/assets/') || url.pathname.match(/\.(js|css|png|jpg|svg|woff2?)$/)) {
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

  // Demais GET — tenta rede, cai no cache
  if (event.request.method === 'GET') {
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
  }
})

self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting()
})
