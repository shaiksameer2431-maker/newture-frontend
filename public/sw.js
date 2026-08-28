self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};
  const title = data.title || 'NECN Support Update';
  const options = {
    body: data.body || 'You have a new response to your support ticket.',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: data.tag || 'ticket-update',
    data: {
      url: data.url || '/'
    }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});
