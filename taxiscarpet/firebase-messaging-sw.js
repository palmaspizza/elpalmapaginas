importScripts("https://www.gstatic.com/firebasejs/12.6.0/firebase-app-compat.js")
importScripts("https://www.gstatic.com/firebasejs/12.6.0/firebase-messaging-compat.js")

const firebaseConfig = {
  apiKey: "AIzaSyDGKaUNwsZcbR-ZiX7EFaIe-GNJuMU4J1Y",
  authDomain: "comedorelnano.firebaseapp.com",
  databaseURL: "https://comedorelnano-default-rtdb.firebaseio.com",
  projectId: "comedorelnano",
  storageBucket: "comedorelnano.firebasestorage.app",
  messagingSenderId: "97043404893",
  appId: "1:97043404893:web:239bf2c53ae336519ed5b4",
  measurementId: "G-1MYL204D0P"
};

const app = firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging(app);

messaging.onBackgroundMessage(payload => {
  const notificationTitle = payload?.notification?.title || 'TAXIS';
  const notificationOptions = {
    body: payload?.notification?.body || '',
    icon: "https://i.ibb.co/m5WDvjFm/imagen-2025-10-22-173714897.png",
    badge: "https://i.ibb.co/m5WDvjFm/imagen-2025-10-22-173714897.png",
    tag: 'taxi-reserva-aviso',
    renotify: true,
    requireInteraction: true,
    silent: false,
    vibrate: [200, 100, 200, 100, 200],
    data: payload?.data || {}
  }

  return self.registration.showNotification(
    notificationTitle,
    notificationOptions
  )
})

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const targetUrl = (event.notification && event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      for (let client of windowClients) {
        if (client.url === targetUrl && 'focus' in client) {
          client.postMessage({ type: 'PLAY_SOUND' });
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl).then(newClient => {
          if (newClient) {
            newClient.postMessage({ type: 'PLAY_SOUND' });
          }
        });
      }
    })
  );
});