// Calendário Mentorei: recebe fotos e vídeos do botão "Compartilhar" do celular (Android, app instalado).
// Guarda os arquivos no próprio aparelho e abre a aba Arquivos, onde a pessoa escolhe a pasta e envia.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

function abrirBanco() {
  return new Promise((ok, erro) => {
    const r = indexedDB.open('calendario-mentorei', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('compartilhados', { autoIncrement: true });
    r.onsuccess = () => ok(r.result);
    r.onerror = () => erro(r.error);
  });
}

async function guardar(arquivos) {
  const db = await abrirBanco();
  await new Promise((ok, erro) => {
    const tx = db.transaction('compartilhados', 'readwrite');
    arquivos.forEach((f) => tx.objectStore('compartilhados').add(f));
    tx.oncomplete = ok;
    tx.onerror = () => erro(tx.error);
  });
}

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method === 'POST' && url.pathname === '/compartilhar') {
    e.respondWith((async () => {
      try {
        const dados = await e.request.formData();
        const arquivos = dados.getAll('arquivos').filter((f) => f && typeof f === 'object' && f.size);
        await guardar(arquivos);
      } catch (erro) { /* se falhar, a pessoa ainda pode enviar pela aba Arquivos */ }
      return Response.redirect('/?compartilhado=1#arquivos', 303);
    })());
  }
});
