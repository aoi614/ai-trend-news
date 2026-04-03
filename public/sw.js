// Service Worker for AIトレンド速報
// Push通知 + オフラインキャッシュ + 新記事チェック

const CACHE_NAME = 'ai-trend-news-v2';
const SITE_URL = self.location.origin;

// Assets to cache on install
const INITIAL_CACHED_RESOURCES = [
  '/',
  '/manifest.json',
  '/favicon.svg',
  '/icon-192.png',
  '/icon-512.png',
];

// Install Event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(INITIAL_CACHED_RESOURCES);
    })
  );
  self.skipWaiting();
});

// Activate Event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Event
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (
    url.hostname.includes('google') ||
    url.hostname.includes('hatena') ||
    url.hostname.includes('twitter')
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});

// ===== Push Notification: 新記事チェック =====
// 定期的にRSSを確認し、新記事があれば通知を表示

// 通知クリック時のハンドラ
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // 既に開いているタブがあればそこにフォーカス
      for (const client of windowClients) {
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }
      // なければ新しいタブを開く
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

// メッセージ受信（メインスレッドからの新記事チェック指示）
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'NEW_ARTICLE') {
    const { title, url } = event.data;
    self.registration.showNotification('🚀 AIトレンド速報 — 新着記事', {
      body: title,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'new-article',
      data: { url },
      actions: [
        { action: 'read', title: '📖 読む' },
        { action: 'dismiss', title: '後で' },
      ],
    });
  }
});
