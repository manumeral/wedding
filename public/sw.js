/* global self */
self.addEventListener('push', (event) => {
  let data = { title: 'Wedding portal', body: '', url: '/' }
  try {
    const raw = event.data?.json()
    if (raw && typeof raw === 'object') {
      data = {
        title: typeof raw.title === 'string' ? raw.title : data.title,
        body: typeof raw.body === 'string' ? raw.body : data.body,
        url: typeof raw.url === 'string' ? raw.url : data.url,
      }
    }
  } catch {
    /* use defaults */
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/images/wedding-illustration.png',
      data: { url: data.url },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const raw = event.notification?.data?.url || '/'
  const path = typeof raw === 'string' ? raw : '/'
  const targetUrl = path.startsWith('http') ? path : new URL(path, self.location.origin).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          return client.focus()
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl)
    }),
  )
})
