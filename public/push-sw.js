// Push handler appended to the Workbox SW (importScripts). Shows the notification;
// honesty: delivery requires the browser/OS push service, display is best-effort.
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = {}; }
  event.waitUntil(self.registration.showNotification(data.title || 'НарядAI', {
    body: data.body || '', tag: data.tag || undefined,
    icon: '/icon-192.png', badge: '/icon-192.png',
    requireInteraction: data.priority === 'emergency',
    vibrate: data.priority === 'emergency' ? [250,100,250,100,500] : [150],
    data: { order_id: data.order_id || null, priority: data.priority || 'normal' }
  }));
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.matchAll({type:'window', includeUncontrolled:true}).then((list) => {
    if (list.length) return list[0].focus();
    return clients.openWindow('/');
  }));
});
