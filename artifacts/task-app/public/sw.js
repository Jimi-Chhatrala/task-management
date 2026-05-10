self.addEventListener("push", function (event) {
  if (!event.data) return;
  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: "Task Tracker", body: event.data.text() };
  }
  const { title = "Task Tracker", body = "", url = "/" } = data;
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/logo.svg",
      badge: "/logo.svg",
      data: { url },
    })
  );
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (list) {
      for (const client of list) {
        if (client.url.includes(url) && "focus" in client) return client.focus();
      }
      return clients.openWindow(url);
    })
  );
});
