importScripts('https://www.gstatic.com/firebasejs/9.22.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.2/firebase-messaging-compat.js');

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

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
  const title = payload?.notification?.title || payload?.data?.title || 'Aviso';
  const body = payload?.notification?.body || payload?.data?.body || '';
  const options = {
    body,
    icon: '/favicon.ico',
    vibrate: [200, 100, 200],
    tag: 'taxis-aviso',
    renotify: true
  };
  self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
    for (const client of clientList) {
      if (client.url && 'focus' in client) { return client.focus(); }
    }
    return clients.openWindow('/');
  }));
});
