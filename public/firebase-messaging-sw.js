/* Service worker notifikasi push Daily Job (Firebase Cloud Messaging). Pesan berbentuk data saja; tampilannya diatur di sini. */
importScripts("https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js", "https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js");
firebase.initializeApp({ apiKey: "AIzaSyACncDGAWhLlGL67kz43hIh9xbLPYN9cns", projectId: "system-marketing-bd-isl-2026", messagingSenderId: "776976432858", appId: "1:776976432858:web:efc2abc96f73bc63a5efe3" });
const pesan = firebase.messaging();
pesan.onBackgroundMessage((p) => {
  const d = p.data || {};
  return self.registration.showNotification(d.title || "ISL HUB", { body: d.body || "", icon: "assets/icon-192.png", badge: "assets/icon-192.png", tag: d.tag || "dailyjob", data: { url: d.url || "app.html#dailyjob" } });
});
/* Ketuk notifikasi: fokus ke jendela aplikasi yang sudah terbuka, atau buka yang baru. */
self.addEventListener("notificationclick", (ev) => {
  ev.notification.close();
  const url = new URL((ev.notification.data && ev.notification.data.url) || "app.html#dailyjob", self.registration.scope).href;
  ev.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((ws) => {
    const w = ws.find((x) => x.url.startsWith(self.registration.scope + "app.html"));
    return w ? w.focus().then((c) => { c.navigate && c.navigate(url); return c; }) : self.clients.openWindow(url);
  }));
});
