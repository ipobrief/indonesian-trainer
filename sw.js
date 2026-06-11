// 서비스워커 — HTML은 항상 최신(network-first), 정적 자원은 캐시 우선
const CACHE = 'indo-trainer-v7';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // 번역 API는 항상 네트워크 (캐시하지 않음)
  if (url.hostname.includes('googleapis.com') || url.hostname.includes('kamus.net')) return;

  // 페이지/HTML 문서는 네트워크 우선 → 최신 버전 즉시 반영, 오프라인이면 캐시 폴백
  const isDoc = req.mode === 'navigate' ||
    (req.destination === 'document') ||
    url.pathname.endsWith('/') ||
    url.pathname.endsWith('index.html');
  if (isDoc && url.origin === location.origin) {
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
        return res;
      }).catch(() => caches.match(req).then(c => c || caches.match('./index.html')))
    );
    return;
  }

  // 그 외 정적 자원: 캐시 우선, 없으면 네트워크 후 저장
  e.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(res => {
      if (url.origin === location.origin) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
      }
      return res;
    }).catch(() => cached))
  );
});
