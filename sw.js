/* BeBê a CaMinHo – service worker: instalar na tela inicial e receber o bom dia das 9h.
   Não guarda dados em cache: tudo vem sempre atualizado do servidor.
   Sem internet, mostra um aviso simples em vez da página de erro do navegador. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));
/* Compartilhar → BeBê a CaMinHo (galeria / WhatsApp): guarda as fotos com o nome original
   (que traz a data) e abre o app, que pergunta onde colocar. */
function shareDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open("bebe-share", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("f", {autoIncrement: true});
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
async function receiveShare(req) {
  try {
    const form = await req.formData();
    const files = form.getAll("fotos").filter(f => f && typeof f !== "string");
    const db = await shareDB();
    await new Promise((res, rej) => {
      const tx = db.transaction("f", "readwrite"), st = tx.objectStore("f");
      st.clear();
      for (const f of files) st.add({blob: f, name: f.name, type: f.type, lastModified: f.lastModified});
      tx.oncomplete = res; tx.onerror = () => rej(tx.error);
    });
  } catch (_) {}
  return Response.redirect(new URL("./?compartilhado=1", req.url).href, 303);
}
self.addEventListener("fetch", e => {
  if (e.request.method === "POST" && new URL(e.request.url).pathname.endsWith("/compartilhar")) {
    e.respondWith(receiveShare(e.request)); return;
  }
  if (e.request.mode !== "navigate") return;
  e.respondWith(fetch(e.request).catch(() => new Response(
    '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>BeBê a CaMinHo</title><body style="font-family:sans-serif;background:#F5F3ED;color:#33372F;display:grid;place-items:center;min-height:90vh;text-align:center;padding:24px">' +
    '<div><h2 style="color:#5F7F5A">BeBê a CaMinHo</h2><p>Sem internet agora. Conecte-se e abra o app de novo.</p></div>',
    {headers: {"Content-Type": "text/html; charset=utf-8"}})));
});
/* bom dia das 9h */
self.addEventListener("push", e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = {body: e.data ? e.data.text() : ""}; }
  e.waitUntil(self.registration.showNotification(d.title || "☀️ Bom dia!", {
    body: d.body || "", icon: "icon-192.png", badge: "icon-192.png", tag: d.tag || "bom-dia",
    data: {url: d.url || "./"},
  }));
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "./";
  e.waitUntil(self.clients.matchAll({type: "window", includeUncontrolled: true}).then(list => {
    for (const c of list) if ("focus" in c) return c.focus();
    return self.clients.openWindow(url);
  }));
});
