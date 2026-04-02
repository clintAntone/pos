
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installed');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activated');
});

self.addEventListener('push', (event) => {
  const data = event.data.json();
  console.log('Push Received...', data);
  self.registration.showNotification(data.title, {
    body: data.body
  });
});
