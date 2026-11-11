/* Portal Novel - service worker
   Estratégia: a página (HTML) vem SEMPRE da internet primeiro, para que cada atualização
   que você subir apareça na hora. O cache só é usado quando o aparelho está sem internet.
   Os pedidos para outros sites (Supabase, bibliotecas) NÃO passam por aqui. */
var CACHE = "portal-novel-v1";
var ARQUIVOS = ["./", "./index.html", "./manifest.json", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", function (e) {
    e.waitUntil(
        caches.open(CACHE).then(function (c) {
            return Promise.all(ARQUIVOS.map(function (a) { return c.add(a).catch(function () { }); }));
        }).then(function () { return self.skipWaiting(); })
    );
});

self.addEventListener("activate", function (e) {
    e.waitUntil(
        caches.keys().then(function (nomes) {
            return Promise.all(nomes.filter(function (n) { return n !== CACHE; }).map(function (n) { return caches.delete(n); }));
        }).then(function () { return self.clients.claim(); })
    );
});

self.addEventListener("fetch", function (e) {
    var req = e.request;
    if (req.method !== "GET") return;

    var url = new URL(req.url);
    if (url.origin !== self.location.origin) return;   // Supabase e CDNs: direto da internet

    // Página: internet primeiro (sempre a versão mais nova); sem internet, usa a guardada
    if (req.mode === "navigate") {
        e.respondWith(
            fetch(req, { cache: "no-cache" }).then(function (res) {
                if (res && res.ok) {
                    var copia = res.clone();
                    caches.open(CACHE).then(function (c) { c.put("./index.html", copia); });
                }
                return res;
            }).catch(function () {
                return caches.match("./index.html").then(function (r) {
                    return r || new Response("Sem conexão e sem versão guardada. Abra o app com internet uma vez.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
                });
            })
        );
        return;
    }

    // Ícones e manifesto: usa o guardado e atualiza em segundo plano
    e.respondWith(
        caches.match(req).then(function (guardado) {
            var rede = fetch(req).then(function (res) {
                if (res && res.ok) {
                    var copia = res.clone();
                    caches.open(CACHE).then(function (c) { c.put(req, copia); });
                }
                return res;
            }).catch(function () { return guardado; });
            return guardado || rede;
        })
    );
});
