// JavaScript original do Portal Novel, executado após a montagem da marcação.
function mostrarErroNaTela(texto) {
    var caixa = document.createElement("div");
    caixa.style.cssText = "position:fixed;top:70px;left:8px;right:8px;z-index:500;background:#B3261E;color:#fff;padding:12px;border-radius:8px;font-size:14px";
    caixa.textContent = texto;
    caixa.onclick = function () { caixa.remove(); };
    document.body.appendChild(caixa);
}
window.onerror = function (mensagem, arquivo, linha) {
    mostrarErroNaTela("Erro: " + mensagem + " (linha " + linha + ")");
};
window.addEventListener("unhandledrejection", function (e) {
    mostrarErroNaTela("Erro: " + ((e.reason && e.reason.message) || e.reason));
});

/* =====================================================
   CONEXÃO COM O SUPABASE
   A chave publishable pode ficar aqui; a proteção vem das regras RLS do banco.
===================================================== */
var SUPABASE_URL = "https://fcqpmvwgujwjuxksrtsi.supabase.co";
var SUPABASE_KEY = "sb_publishable_mDSMdIZL5e0apM5i35S7lQ_6kkGkfxP";
var semConexao = !window.supabase;
var db = semConexao ? criarBancoVazio() : supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Substituto usado só se a biblioteca do Supabase não carregar: o site continua abrindo e navegando
function criarBancoVazio() {
    var falha = { data: null, error: { message: "sem conexão" }, count: 0 };
    function cadeia() {
        var c = {};
        ["select", "eq", "in", "order", "limit", "insert", "update", "upsert", "delete", "single", "maybeSingle"].forEach(function (m) {
            c[m] = function () { return c; };
        });
        c.then = function (ok) { ok(falha); };
        return c;
    }
    return {
        from: cadeia,
        rpc: async function () { return falha; },
        auth: {
            onAuthStateChange: function (f) { setTimeout(function () { f("INITIAL_SESSION", null); }, 0); return { data: { subscription: {} } }; },
            signUp: async function () { return { data: {}, error: { message: "sem conexão" } }; },
            signInWithPassword: async function () { return { data: {}, error: { message: "sem conexão" } }; },
            signOut: async function () { return { error: null }; }
        }
    };
}


var usuarioLogado = null;

/* =====================================================
   DADOS E ESTADO
===================================================== */
var GENEROS = [
    { id: "isekai", nome: "Isekai" },
    { id: "tensei", nome: "Tensei" },
    { id: "drama", nome: "Drama" },
    { id: "comedia", nome: "Comédia" },
    { id: "terror", nome: "Terror / Horror" },
    { id: "guerra", nome: "Guerra" },
    { id: "epico", nome: "Épico" },
    { id: "fantasia", nome: "Fantasia" },
    { id: "romance", nome: "Romance" },
    { id: "acao", nome: "Ação" },
    { id: "misterio", nome: "Suspense / Mistério" },
    { id: "policial", nome: "Policial" },
    { id: "poesia", nome: "Poesia" },
    { id: "lgbtqia", nome: "LGBTQIA+" },
    { id: "religioso-fe", nome: "Religioso / Fé" },
    { id: "aventura", nome: "Aventura" },
    { id: "ficcao-cientifica", nome: "Ficção Científica" },
    { id: "historico", nome: "Histórico" },
    { id: "fanfic", nome: "Fanfic" }
];

var TELAS = ["inicio", "buscar", "biblioteca", "escrever", "avisos", "perfil", "configuracoes", "livro", "nova", "capitulos", "editor", "entrar", "termos", "privacidade", "publicar", "denunciar", "ler", "editarperfil", "preferencias", "notificacoes", "ajuda", "excluirconta", "gestao", "autor", "seguidores", "mensagens", "conversa", "comunidades", "comunidade", "novacomunidade"];

var HISTORIAS = [];          // histórias publicadas (lista do início e da busca)
var FUNDADORES = {};         // id do autor -> número do selo Fundador
var NOMES = {};              // id do autor -> nome
var erroListas = "";
var ultimaCargaHist = 0;
var minhaHistoria = null;    // a história da conta logada
var meusCapitulos = [];      // capítulos da minha história (rascunhos e publicados)
var mapaLeiturasMeu = {};
var generoSel = { inicio: "", busca: "" };
var RANKING = [];
var capaDados = "";
var editandoId = null;
var temporizador = null;
var tokenRota = 0;

var CH_PERFIL = "webnovel_perfil";
var CH_CONFIG = "webnovel_config";
var CH_BACKUP = "webnovel_backup_capitulo";
var CH_TEMPO = "webnovel_tempo_leitura";

var PALETAS = [["#FF9966", "#FF5E62"], ["#434343", "#1a1a1a"], ["#FF5E62", "#B0305C"], ["#F2994A", "#E65C00"], ["#2C3E50", "#4CA1AF"]];

/* =====================================================
   FERRAMENTAS BÁSICAS
===================================================== */
function pegar(id) { return document.getElementById(id); }

function criar(tag, classe, texto) {
    var e = document.createElement(tag);
    if (classe) e.className = classe;
    if (texto !== undefined) e.textContent = texto;
    return e;
}

function acharPorId(lista, id) {
    for (var i = 0; i < lista.length; i++) {
        if (lista[i].id === id) return lista[i];
    }
    return null;
}

function lerDados(chave, padrao) {
    try {
        var v = JSON.parse(localStorage.getItem(chave));
        return (v === null || v === undefined) ? padrao : v;
    } catch (erro) {
        return padrao;
    }
}

function gravar(chave, valor) {
    try {
        localStorage.setItem(chave, JSON.stringify(valor));
        return true;
    } catch (erro) {
        return false;
    }
}

function apagarLocal(chave) {
    try { localStorage.removeItem(chave); } catch (erro) { }
}

function aviso(id, texto, deuErro) {
    var e = pegar(id);
    if (!e) return;
    e.textContent = texto;
    e.className = "aviso " + (deuErro ? "erro" : "ok");
}

function contar(texto) {
    var limpo = (texto || "").trim();
    return limpo ? limpo.split(/\s+/).length : 0;
}

function dataBonita(iso) {
    try { return new Date(iso).toLocaleDateString("pt-BR"); }
    catch (erro) { return ""; }
}

function lerIdDaRota(texto) {
    return /^[0-9]+$/.test(texto) ? parseInt(texto, 10) : texto;
}

function rotuloLeituras(n) {
    return n + (n === 1 ? " leitura" : " leituras");
}

// Só aceita imagens no formato esperado (evita conteúdo estranho vindo do banco)
function imagemSegura(s) {
    return (typeof s === "string" && /^data:image\/(jpeg|png|webp|gif);base64,[A-Za-z0-9+\/=]+$/.test(s)) ? s : "";
}

function cores(id) {
    var n = parseInt(id, 10) || 0;
    return PALETAS[n % PALETAS.length];
}

function pintarCapa(el, h) {
    var img = imagemSegura(h.capa);
    if (img) {
        el.textContent = "";
        el.style.backgroundImage = "url(" + img + ")";
    } else {
        el.style.background = "linear-gradient(135deg," + h.cor1 + "," + h.cor2 + ")";
    }
}

function ordenarCapitulos(lista) {
    lista.sort(function (a, b) {
        if (a.parte !== b.parte) return a.parte - b.parte;
        if (a.ordem !== b.ordem) return a.ordem - b.ordem;
        return a.id - b.id;
    });
}

/* =====================================================
   BANCO DE DADOS: LEITURA DE HISTÓRIAS E CAPÍTULOS
===================================================== */
async function carregarNomes(ids) {
    var faltam = ids.filter(function (id, i) { return id && !NOMES[id] && ids.indexOf(id) === i; });
    if (!faltam.length) return;
    var r = await db.from("perfis").select("id,nome,usuario").in("id", faltam);
    (r.data || []).forEach(function (p) { NOMES[p.id] = p.nome || p.usuario || "Autor"; });
    await carregarFundadores(faltam);
}

async function carregarFundadores(ids) {
    if (!ids || !ids.length) return;
    try {
        var f = await db.from("fundadores").select("user_id,numero").in("user_id", ids);
        (f.data || []).forEach(function (x) { FUNDADORES[x.user_id] = x.numero; });
    } catch (e) { }
}

function seloFundador(numero) {
    var img = document.createElement("img");
    img.src = "selos/selo-fundador-mini.svg";
    img.className = "selo-fundador";
    img.alt = "Escritor Fundador";
    img.title = "Escritor Fundador nº " + numero + " de 30";
    img.onerror = function () { img.remove(); };
    return img;
}

function normalizar(h) {
    var c = cores(h.id);
    h.cor1 = c[0];
    h.cor2 = c[1];
    h.autor = NOMES[h.autor_id] || "Autor";
    h.generos = h.generos || [];
    return h;
}

async function carregarHistorias() {
    var r = await db.from("historias")
        .select("id,titulo,sinopse,capa,generos,idade,status,autor_id,criado_em")
        .eq("publicada", true)
        .order("criado_em", { ascending: false })
        .limit(60);
    if (r.error) {
        HISTORIAS = [];
        erroListas = "Não foi possível carregar as histórias agora.";
        return;
    }
    erroListas = "";
    await carregarNomes(r.data.map(function (h) { return h.autor_id; }));
    HISTORIAS = r.data.map(normalizar);
}

async function atualizarListas(forcar) {
    if (!forcar && Date.now() - ultimaCargaHist < 30000) {
        desenharInicio(false);
        desenharBusca();
        return;
    }
    desenharInicio(true);
    await carregarHistorias();
    await carregarRanking();
    ultimaCargaHist = Date.now();
    desenharInicio(false);
    desenharBusca();
}

async function buscarHistoria(id) {
    if (typeof id !== "number") return null;
    var r = await db.from("historias").select("*").eq("id", id).maybeSingle();
    if (r.error || !r.data) return null;
    await carregarNomes([r.data.autor_id]);
    return normalizar(r.data);
}

async function listarCapitulos(historiaId, soPublicados, comTexto) {
    var colunas = "id,historia_id,parte,ordem,titulo,publicado,publicado_em" + (comTexto ? ",texto" : "");
    var q = db.from("capitulos").select(colunas).eq("historia_id", historiaId);
    if (soPublicados) q = q.eq("publicado", true);
    var r = await q.order("parte", { ascending: true }).order("ordem", { ascending: true }).order("id", { ascending: true });
    return r.error ? null : r.data;
}

async function contagemLeituras(ids) {
    var mapa = {};
    if (!ids.length) return mapa;
    try {
        var r = await db.from("leituras_por_capitulo").select("capitulo_id,total").in("capitulo_id", ids);
        (r.data || []).forEach(function (x) { mapa[x.capitulo_id] = x.total; });
    } catch (erro) { }
    return mapa;
}

function somar(mapa) {
    var s = 0;
    for (var k in mapa) { if (mapa.hasOwnProperty(k)) s += mapa[k]; }
    return s;
}

/* =====================================================
   INÍCIO, BUSCA E LIVRO
===================================================== */
function nomeGenero(id) {
    for (var i = 0; i < GENEROS.length; i++) {
        if (GENEROS[i].id === id) return GENEROS[i].nome;
    }
    return id;
}

function criarCard(h) {
    var a = criar("a", "book-card");
    a.href = "#livro-" + h.id;
    var capa = criar("div", "capa book-cover", h.titulo);
    pintarCapa(capa, h);
    a.appendChild(capa);
    var info = criar("div", "book-info");
    info.appendChild(criar("div", "book-title", h.titulo));
    info.appendChild(criar("div", "book-genre", h.generos.length ? nomeGenero(h.generos[0]) : h.autor));
    a.appendChild(info);
    return a;
}

function fecharGaveta() {
    var c = pegar("menu-toggle");
    if (c) c.checked = false;
}

function desenharInicio(carregando) {
    var area = pegar("prateleiras");
    area.innerHTML = "";

    if (carregando && !HISTORIAS.length) {
        area.appendChild(criar("p", "vazio", "Carregando histórias..."));
        return;
    }

    if (!HISTORIAS.length) {
        var vazio = criar("div", "empty-state");
        vazio.appendChild(criar("h3", "", "Em breve, novas histórias"));
        vazio.appendChild(criar("p", "", erroListas || "Volte daqui a pouco para ver os novos livros."));
        area.appendChild(vazio);
        return;
    }

    var g = generoSel.inicio;
    var lista = HISTORIAS.filter(function (h) { return !g || h.generos.indexOf(g) !== -1; }).slice(0, 30);

    area.appendChild(criar("h2", "section-title", "Novidades"));
    if (!lista.length) {
        area.appendChild(criar("p", "vazio", "Nenhuma história neste gênero ainda."));
    } else {
        var grade = criar("div", "books-grid");
        lista.forEach(function (h) { grade.appendChild(criarCard(h)); });
        area.appendChild(grade);
    }

    if (RANKING.length) {
        area.appendChild(criar("h2", "section-title", "Top Leitura"));
        var top = criar("div", "bestsellers-list");
        RANKING.slice(0, 6).forEach(function (h, i) {
            var a = criar("a", "bestseller-item");
            a.href = "#livro-" + h.id;
            a.appendChild(criar("div", "rank-number" + (i < 2 ? " top" : ""), String(i + 1)));
            var info = criar("div", "bs-info");
            info.appendChild(criar("div", "bs-title", h.titulo));
            info.appendChild(criar("div", "bs-desc", h.sinopse || ""));
            a.appendChild(info);
            top.appendChild(a);
        });
        area.appendChild(top);
    }
}

// Ranking por leituras (precisa da view leituras_por_historia; se não existir, a seção some)
async function carregarRanking() {
    RANKING = [];
    if (!HISTORIAS.length) return;
    try {
        var r = await db.from("leituras_por_historia").select("historia_id,total").in("historia_id", HISTORIAS.map(function (h) { return h.id; })).order("total", { ascending: false }).limit(10);
        if (r.error) return;
        var porId = {};
        HISTORIAS.forEach(function (h) { porId[h.id] = h; });
        RANKING = (r.data || []).filter(function (x) { return x.total > 0 && porId[x.historia_id]; }).map(function (x) { return porId[x.historia_id]; });
    } catch (erro) { }
}

function desenharChips(idArea, tipo) {
    var area = pegar(idArea);
    area.innerHTML = "";

    var todos = [{ id: "", nome: "Todos" }].concat(GENEROS);
    todos.forEach(function (g) {
        var chip = criar("button", "chip" + (g.id === generoSel[tipo] ? " ativo" : ""), g.nome);
        chip.addEventListener("click", function () {
            generoSel[tipo] = g.id;
            var irmaos = area.children;
            for (var i = 0; i < irmaos.length; i++) irmaos[i].classList.toggle("ativo", irmaos[i] === chip);
            if (tipo === "inicio") desenharInicio(false);
            else desenharBusca();
        });
        area.appendChild(chip);
    });
}

function desenharBusca() {
    var termo = pegar("campoBusca").value.trim().toLowerCase();
    var g = generoSel.busca;
    var lista = pegar("resultado");
    lista.innerHTML = "";
    var achou = 0;

    HISTORIAS.forEach(function (h) {
        if (g && h.generos.indexOf(g) === -1) return;
        if (termo) {
            var alvo = (h.titulo + " " + h.autor + " " + h.generos.map(nomeGenero).join(" ")).toLowerCase();
            if (alvo.indexOf(termo) === -1) return;
        }
        lista.appendChild(criarCard(h));
        achou++;
    });

    pegar("vazioBusca").style.display = achou ? "none" : "block";
}

pegar("campoBusca").addEventListener("input", desenharBusca);

var estadoCurtida = { id: null, n: 0, curtiu: false, ocupado: false };

async function contarCurtidas(id) {
    var r = await db.from("curtidas").select("historia_id", { count: "exact", head: true }).eq("historia_id", id);
    return r.count || 0;
}

async function euCurti(id) {
    if (!usuarioLogado) return false;
    var r = await db.from("curtidas").select("historia_id").eq("historia_id", id).eq("usuario_id", usuarioLogado.id).maybeSingle();
    return !!(r.data);
}

async function mostrarLivro(id, token) {
    var area = pegar("livro");
    area.innerHTML = "";
    area.appendChild(criar("p", "vazio", "Carregando..."));

    var h = await buscarHistoria(id);
    if (token !== tokenRota) return;
    area.innerHTML = "";

    if (!h) {
        area.appendChild(criar("p", "vazio", "História não encontrada."));
        return;
    }

    var capa = criar("div", "capa livro-capa", h.titulo);
    pintarCapa(capa, h);
    area.appendChild(capa);
    area.appendChild(criar("h1", "", h.titulo));
    var pAutor = criar("p", "autor");
    var linkAutor = criar("a", "", "por " + h.autor);
    linkAutor.href = "#autor-" + h.autor_id;
    pAutor.appendChild(linkAutor);
    if (FUNDADORES[h.autor_id]) pAutor.appendChild(seloFundador(FUNDADORES[h.autor_id]));
    area.appendChild(pAutor);

    var chips = criar("div", "chips");
    GENEROS.forEach(function (g) {
        if (h.generos.indexOf(g.id) !== -1) chips.appendChild(criar("span", "chip", g.nome));
    });
    area.appendChild(chips);
    area.appendChild(criar("p", "sinopse", h.sinopse || "Sem sinopse."));

    if (!h.publicada) area.appendChild(criar("p", "ajuda", "Rascunho: só você vê esta página."));

    var caps = (await listarCapitulos(h.id, true, false)) || [];
    var mapa = await contagemLeituras(caps.map(function (c) { return c.id; }));
    var nCurtidas = await contarCurtidas(h.id);
    var jaCurti = await euCurti(h.id);
    if (token !== tokenRota) return;

    area.appendChild(criar("p", "autor", "Leituras: " + somar(mapa)));

    if (caps.length) {
        var comecar = criar("button", "btn", "Começar a ler");
        comecar.style.width = "100%";
        comecar.addEventListener("click", function () { location.hash = "ler-" + h.id + "-1"; });
        area.appendChild(comecar);
    }

    area.appendChild(criar("h2", "", "Capítulos (" + caps.length + ")"));
    if (!caps.length) area.appendChild(criar("p", "vazio", "Esta história ainda não tem capítulos publicados."));

    var partesUsadas = {};
    caps.forEach(function (c) { partesUsadas[c.parte] = true; });
    var variasPartes = Object.keys(partesUsadas).length > 1;
    var parteAtual = null;

    caps.forEach(function (c, i) {
        if (variasPartes && c.parte !== parteAtual) {
            area.appendChild(criar("h3", "parte-titulo", "Parte " + c.parte));
            parteAtual = c.parte;
        }
        var linha = criar("button", "bloco linha-cap");
        linha.appendChild(criar("strong", "", "Capítulo " + (i + 1) + (c.titulo ? ": " + c.titulo : "")));
        linha.appendChild(criar("span", "ajuda", rotuloLeituras(mapa[c.id] || 0)));
        linha.addEventListener("click", function () { location.hash = "ler-" + h.id + "-" + (i + 1); });
        area.appendChild(linha);
    });

    var acoes = criar("div", "acoes-livro");
    acoes.id = "blocoAcoes";
    area.appendChild(acoes);

    var avisoAcoes = criar("p", "aviso");
    avisoAcoes.id = "avisoAcoes";
    avisoAcoes.style.textAlign = "center";
    area.appendChild(avisoAcoes);

    var comentarios = criar("div");
    comentarios.id = "blocoComentarios";
    area.appendChild(comentarios);

    estadoCurtida = { id: h.id, n: nCurtidas, curtiu: jaCurti, ocupado: false, titulo: h.titulo, autor: h.autor };
    desenharAcoes();
    desenharComentarios(h.id, h.titulo, token);
}

/* =====================================================
   PÁGINA DO AUTOR E SEGUIDORES
===================================================== */
var estadoSeguir = { id: null, seguindo: false, total: 0, ocupado: false };

async function contarSeguidores(id) {
    try {
        var r = await db.rpc("numero_seguidores", { p_autor: id });
        return (!r.error && typeof r.data === "number") ? r.data : 0;
    } catch (erro) { return 0; }
}

async function euSigoAutor(id) {
    if (!usuarioLogado || usuarioLogado.id === id) return false;
    try {
        var r = await db.from("seguidores").select("autor_id").eq("seguidor_id", usuarioLogado.id).eq("autor_id", id).maybeSingle();
        return !r.error && !!r.data;
    } catch (erro) { return false; }
}

function itemStat(numero, rotulo) {
    var d = criar("div", "stat-item");
    d.appendChild(criar("strong", "stat-number", numero));
    d.appendChild(criar("span", "stat-label", rotulo));
    return d;
}

async function atualizarMeusSeguidores() {
    var el = pegar("numSeguidores");
    if (!el) return;
    if (!usuarioLogado) { el.textContent = "0"; return; }
    var n = await contarSeguidores(usuarioLogado.id);
    el.textContent = String(n);
}

function desenharBotaoSeguir() {
    var area = pegar("autorAcao");
    if (!area) return;
    area.innerHTML = "";
    if (!usuarioLogado) {
        var a = criar("a", "btn", "Entrar para seguir");
        a.href = "#entrar";
        a.style.width = "100%";
        area.appendChild(a);
        return;
    }
    if (usuarioLogado.id === estadoSeguir.id) {
        var b = criar("a", "btn claro", "Este é o seu perfil");
        b.href = "#perfil";
        b.style.width = "100%";
        area.appendChild(b);
        return;
    }
    var botao = criar("button", estadoSeguir.seguindo ? "btn claro" : "btn", estadoSeguir.seguindo ? "Seguindo" : "Seguir");
    botao.type = "button";
    botao.style.width = "100%";
    botao.addEventListener("click", alternarSeguir);
    area.appendChild(botao);
}

async function alternarSeguir() {
    if (!usuarioLogado || estadoSeguir.ocupado || !estadoSeguir.id) return;
    var alvo = estadoSeguir.id;
    var estavaSeguindo = estadoSeguir.seguindo;
    estadoSeguir.ocupado = true;
    var aviso = pegar("avisoSeguir");
    aviso.textContent = "";
    var r;
    if (estavaSeguindo) {
        r = await db.from("seguidores").delete().eq("seguidor_id", usuarioLogado.id).eq("autor_id", alvo);
    } else {
        r = await db.from("seguidores").insert({ seguidor_id: usuarioLogado.id, autor_id: alvo });
    }
    if (estadoSeguir.id !== alvo) return;
    estadoSeguir.ocupado = false;
    if (r.error) {
        aviso.className = "aviso erro";
        aviso.textContent = "Não foi possível agora. Tente de novo.";
        return;
    }
    estadoSeguir.seguindo = !estavaSeguindo;
    estadoSeguir.total = Math.max(0, estadoSeguir.total + (estadoSeguir.seguindo ? 1 : -1));
    var n = pegar("autorNumSeguidores");
    if (n) n.textContent = String(estadoSeguir.total);
    desenharBotaoSeguir();
}

async function mostrarAutor(id, token) {
    var cab = pegar("autorCabeca");
    var lista = pegar("autorHistorias");
    cab.innerHTML = "";
    lista.innerHTML = "";
    cab.appendChild(criar("p", "vazio", "Carregando..."));

    if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) {
        cab.innerHTML = "";
        cab.appendChild(criar("p", "vazio", "Autor não encontrado."));
        return;
    }

    var r = await db.from("perfis").select("id,nome,usuario,sobre,foto").eq("id", id).maybeSingle();
    if (token !== tokenRota) return;
    if (r.error || !r.data) {
        cab.innerHTML = "";
        cab.appendChild(criar("p", "vazio", "Autor não encontrado."));
        return;
    }
    var p = r.data;
    NOMES[id] = p.nome || p.usuario || "Autor";
    await carregarFundadores([id]);

    var hs = await db.from("historias")
        .select("id,titulo,sinopse,capa,generos,idade,status,autor_id,criado_em")
        .eq("autor_id", id).eq("publicada", true)
        .order("criado_em", { ascending: false });
    var total = await contarSeguidores(id);
    var sigo = await euSigoAutor(id);
    if (token !== tokenRota) return;

    estadoSeguir = { id: id, seguindo: sigo, total: total, ocupado: false };
    var historias = (hs.data || []).map(normalizar);

    cab.innerHTML = "";
    var topo = criar("div", "profile-header");
    var foto = criar("div", "autor-foto");
    var url = imagemSegura(p.foto);
    if (url) foto.style.backgroundImage = "url(" + url + ")";
    else foto.textContent = (p.nome || p.usuario || "?").charAt(0).toUpperCase();
    topo.appendChild(foto);
    var nome = criar("h2", "", p.nome || p.usuario || "Autor");
    if (FUNDADORES[id]) nome.appendChild(seloFundador(FUNDADORES[id]));
    topo.appendChild(nome);
    if (p.usuario) {
        var u = criar("p", "ajuda", "@" + p.usuario);
        u.style.margin = "2px 0 0";
        topo.appendChild(u);
    }
    if (p.sobre) {
        var sobre = criar("p", "", p.sobre);
        sobre.style.cssText = "margin:10px 0 0;color:var(--text-secondary);line-height:1.5";
        topo.appendChild(sobre);
    }
    cab.appendChild(topo);

    var stats = criar("div", "profile-stats");
    stats.appendChild(itemStat(String(historias.length), "Obras"));
    var itemSeg = itemStat(String(total), "Seguidores");
    itemSeg.firstChild.id = "autorNumSeguidores";
    stats.appendChild(itemSeg);
    cab.appendChild(stats);

    var acao = criar("div");
    acao.id = "autorAcao";
    acao.style.textAlign = "center";
    cab.appendChild(acao);
    var aviso = criar("p", "aviso");
    aviso.id = "avisoSeguir";
    aviso.style.textAlign = "center";
    cab.appendChild(aviso);
    desenharBotaoSeguir();

    var divComp = criar("div");
    divComp.style.cssText = "text-align:center;margin-top:8px";
    var btnComp = criar("button", "btn claro mini", "Compartilhar perfil");
    btnComp.type = "button";
    btnComp.addEventListener("click", compartilharAutor);
    divComp.appendChild(btnComp);
    cab.appendChild(divComp);

    if (!historias.length) {
        lista.appendChild(criar("p", "vazio", "Este autor ainda não publicou histórias."));
    } else {
        historias.forEach(function (h) { lista.appendChild(criarCard(h)); });
    }
}

/* =====================================================
   MINHA HISTÓRIA (cartão na Biblioteca, Escrever e Perfil)
===================================================== */
async function carregarMinhaHistoria() {
    minhaHistoria = null;
    meusCapitulos = [];
    if (!usuarioLogado) return;
    var r = await db.from("historias").select("*").eq("autor_id", usuarioLogado.id).order("criado_em", { ascending: false }).limit(1);
    if (r.data && r.data.length) {
        minhaHistoria = r.data[0];
        meusCapitulos = (await listarCapitulos(minhaHistoria.id, false, true)) || [];
    }
}

function desenharRascunho(idArea) {
    var area = pegar(idArea);
    area.innerHTML = "";

    if (!usuarioLogado) {
        if (idArea !== "escreverRascunho") area.appendChild(criar("p", "vazio", "Entre na sua conta para ver as suas histórias."));
        return;
    }

    var r = minhaHistoria;
    if (!r || !r.titulo) {
        if (idArea !== "escreverRascunho") area.appendChild(criar("p", "vazio", "Você ainda não criou nenhuma história."));
        return;
    }

    var bloco = criar("div", "bloco rascunho");
    var capa = criar("div", "capa", r.titulo);
    pintarCapa(capa, { capa: r.capa, cor1: "#FF9966", cor2: "#FF5E62" });
    bloco.appendChild(capa);

    var texto = criar("div");
    texto.appendChild(criar("strong", "", r.titulo));
    var estado = criar("p", "vazio", r.publicada ? "Publicada" : "Rascunho");
    texto.appendChild(estado);

    var continuar = criar("a", "btn mini", "Continuar");
    continuar.href = "#capitulos";
    var info = criar("a", "btn claro mini", "Informações");
    info.href = "#nova";
    info.style.marginLeft = "8px";

    texto.appendChild(continuar);
    texto.appendChild(info);

    var ver = criar("a", "btn claro mini", "Ver como leitor");
    ver.href = "#livro-" + r.id;
    ver.style.marginTop = "8px";
    texto.appendChild(ver);
    bloco.appendChild(texto);
    area.appendChild(bloco);
}

function atualizarRascunhos() {
    desenharRascunho("bibliotecaRascunho");
    desenharRascunho("escreverRascunho");
    desenharRascunho("perfilRascunho");

    var tem = !!(usuarioLogado && minhaHistoria && minhaHistoria.titulo);
    pegar("numObras").textContent = tem ? "1" : "0";
    // Por enquanto o app guarda uma história por conta
    pegar("blocoNova").style.display = (usuarioLogado && !tem) ? "block" : "none";
    pegar("blocoEscreverLogin").style.display = usuarioLogado ? "none" : "block";
}

/* =====================================================
   NOVA HISTÓRIA (formulário)
===================================================== */
function montarGeneros() {
    var area = pegar("listaGeneros");
    GENEROS.forEach(function (g) {
        var rotulo = criar("label", "opcao");
        var caixa = document.createElement("input");
        caixa.type = "checkbox";
        caixa.name = "genero";
        caixa.value = g.id;
        rotulo.appendChild(caixa);
        rotulo.appendChild(document.createTextNode(" " + g.nome));
        area.appendChild(rotulo);
    });
}

function mostrarPrevia() {
    var previa = pegar("previaCapa");
    var img = imagemSegura(capaDados);
    if (img) {
        previa.src = img;
        previa.classList.add("visivel");
    } else {
        previa.classList.remove("visivel");
    }
}

pegar("capa").addEventListener("change", function () {
    var arquivo = this.files[0];
    if (!arquivo) return;

    var leitor = new FileReader();
    leitor.onload = function () {
        var img = new Image();
        img.onload = function () {
            var largura = Math.min(360, img.width);
            var altura = Math.round(img.height * largura / img.width);
            var quadro = document.createElement("canvas");
            quadro.width = largura;
            quadro.height = altura;
            quadro.getContext("2d").drawImage(img, 0, 0, largura, altura);
            capaDados = quadro.toDataURL("image/jpeg", 0.75);
            mostrarPrevia();
        };
        img.src = leitor.result;
    };
    leitor.readAsDataURL(arquivo);
});

function carregarForm() {
    var d = minhaHistoria || {};
    pegar("titulo").value = d.titulo || "";
    pegar("sinopse").value = d.sinopse || "";
    pegar("idade").value = d.idade || "";

    var generos = document.querySelectorAll('input[name="genero"]');
    for (var i = 0; i < generos.length; i++) {
        generos[i].checked = (d.generos || []).indexOf(generos[i].value) !== -1;
    }

    var status = document.querySelectorAll('input[name="status"]');
    for (var j = 0; j < status.length; j++) {
        status[j].checked = (status[j].value === d.status);
    }

    capaDados = d.capa || "";
    mostrarPrevia();
    pegar("avisoForm").textContent = usuarioLogado ? "" : "Entre na sua conta para salvar a história.";
    pegar("avisoForm").className = "aviso" + (usuarioLogado ? "" : " erro");
}

var salvandoForm = false;

async function salvarForm(continuar) {
    if (salvandoForm) return;

    if (!usuarioLogado) {
        aviso("avisoForm", "Entre na sua conta para salvar a história.", true);
        return;
    }

    var marcados = document.querySelectorAll('input[name="genero"]:checked');
    var generos = [];
    for (var i = 0; i < marcados.length; i++) generos.push(marcados[i].value);
    var status = document.querySelector('input[name="status"]:checked');

    var dados = {
        titulo: pegar("titulo").value.trim(),
        sinopse: pegar("sinopse").value.trim(),
        generos: generos,
        idade: pegar("idade").value || null,
        status: status ? status.value : null,
        capa: capaDados || null
    };

    if (!dados.titulo) {
        aviso("avisoForm", "Digite o título da história para salvar.", true);
        pegar("titulo").focus();
        return;
    }

    salvandoForm = true;
    aviso("avisoForm", "Salvando...", false);

    var r;
    if (minhaHistoria) {
        r = await db.from("historias").update(dados).eq("id", minhaHistoria.id).select().single();
    } else {
        dados.autor_id = usuarioLogado.id;
        dados.publicada = false;
        r = await db.from("historias").insert(dados).select().single();
    }
    salvandoForm = false;

    if (r.error) {
        aviso("avisoForm", "Não foi possível salvar. Tente uma capa menor ou tente de novo.", true);
        return;
    }

    minhaHistoria = r.data;
    if (continuar) location.hash = "capitulos";
    else aviso("avisoForm", "Rascunho salvo na sua conta.", false);
}

/* =====================================================
   CAPÍTULOS (lista do autor)
===================================================== */
function abrirCapitulos() {
    var sem = !usuarioLogado || !minhaHistoria;
    pegar("semHistoria").style.display = sem ? "block" : "none";
    pegar("vistaLista").style.display = sem ? "none" : "block";

    if (sem) {
        pegar("semHistoriaTexto").textContent = usuarioLogado ? "Crie a sua história antes de escrever os capítulos." : "Entre na sua conta para escrever capítulos.";
        var b = pegar("semHistoriaBtn");
        b.textContent = usuarioLogado ? "Criar história" : "Entrar ou criar conta";
        b.setAttribute("href", usuarioLogado ? "#nova" : "#entrar");
        return;
    }

    var h = minhaHistoria;
    pegar("topoTitulo").textContent = h.titulo;
    pegar("statusHistoria").textContent = h.publicada ? "História publicada: os leitores já podem encontrá-la." : "História em rascunho: ainda não aparece para os leitores.";
    pegar("statusAceite").textContent = h.aceite_autor
        ? "Declaração do autor registrada em " + dataBonita(h.aceite_autor.data) + "."
        : "Declaração do autor ainda não registrada. Ela é pedida ao publicar a história.";

    var img = pegar("topoCapa");
    var capa = imagemSegura(h.capa);
    if (capa) {
        img.src = capa;
        img.style.display = "block";
    } else {
        img.style.display = "none";
    }

    pegar("avisoLista").textContent = "";
    pegar("totalLeituras").textContent = "";
    desenharLista();

    var token = tokenRota;
    contagemLeituras(meusCapitulos.map(function (c) { return c.id; })).then(function (mapa) {
        if (token !== tokenRota) return;
        mapaLeiturasMeu = mapa;
        pegar("totalLeituras").textContent = "Total: " + rotuloLeituras(somar(mapa));
        desenharLista();
    });
}

function desenharLista() {
    var area = pegar("lista");
    area.innerHTML = "";

    if (!meusCapitulos.length) {
        area.appendChild(criar("p", "vazio", "Nenhum capítulo ainda. Comece o primeiro."));
        return;
    }

    meusCapitulos.forEach(function (c, i) {
        var linha = criar("div", "bloco capitulo");

        var info = criar("div");
        var titulo = criar("strong", "", "Parte " + c.parte + " · Capítulo " + (i + 1) + (c.titulo ? ": " + c.titulo : ""));
        info.appendChild(titulo);
        info.appendChild(criar("span", "selo" + (c.publicado ? " ok" : ""), c.publicado ? "Publicado" : "Rascunho"));
        info.appendChild(criar("p", "ajuda", contar(c.texto) + " palavras · " + rotuloLeituras(mapaLeiturasMeu[c.id] || 0)));
        linha.appendChild(info);

        var botoes = criar("div", "botoes");

        var editar = criar("button", "btn claro mini", "Editar");
        editar.addEventListener("click", function () {
            editandoId = c.id;
            location.hash = "editor";
        });

        var publicar = criar("button", "btn mini" + (c.publicado ? " claro" : ""), c.publicado ? "Despublicar" : "Publicar");
        publicar.addEventListener("click", function () { alternarPublicacaoCap(c, publicar); });

        var apagar = criar("button", "btn perigo mini", "Apagar");
        apagar.addEventListener("click", function () { apagarCap(c); });

        botoes.appendChild(editar);
        botoes.appendChild(publicar);
        botoes.appendChild(apagar);
        linha.appendChild(botoes);
        area.appendChild(linha);
    });
}

async function alternarPublicacaoCap(c, botao) {
    if (!c.publicado && !minhaHistoria.publicada) {
        aviso("avisoLista", "Antes, toque em Publicar história (declaração do autor). Depois publique cada capítulo.", true);
        return;
    }
    if (!c.publicado && !(c.texto || "").trim()) {
        aviso("avisoLista", "Este capítulo está sem texto. Escreva algo antes de publicar.", true);
        return;
    }

    var novo = !c.publicado;
    botao.disabled = true;
    var r = await db.from("capitulos").update({ publicado: novo, publicado_em: novo ? new Date().toISOString() : null }).eq("id", c.id).select().single();
    botao.disabled = false;

    if (r.error) {
        aviso("avisoLista", "Não foi possível alterar a publicação. Tente de novo.", true);
        return;
    }

    c.publicado = r.data.publicado;
    c.publicado_em = r.data.publicado_em;
    aviso("avisoLista", novo ? "Capítulo publicado." : "Capítulo voltou para rascunho.", false);
    desenharLista();
}

async function apagarCap(c) {
    if (!confirm("Apagar este capítulo? Não dá para desfazer.")) return;
    var r = await db.from("capitulos").delete().eq("id", c.id);
    if (r.error) {
        aviso("avisoLista", "Não foi possível apagar. Tente de novo.", true);
        return;
    }
    meusCapitulos = meusCapitulos.filter(function (x) { return x.id !== c.id; });
    aviso("avisoLista", "Capítulo apagado.", false);
    desenharLista();
}

function novoCapitulo() {
    editandoId = null;
    location.hash = "editor";
}

/* =====================================================
   EDITOR DE CAPÍTULO
   O texto é guardado também neste aparelho enquanto você digita,
   e só é apagado de lá quando o salvamento na conta dá certo.
===================================================== */
var fila = Promise.resolve();

function statusAutoSave(texto, tipo) {
    var el = pegar("statusAutoSave");
    if (!el) return;
    el.textContent = texto;
    el.className = "ajuda autosave-status" + (tipo ? " " + tipo : "");
}

function montarPartes() {
    var s = pegar("capParte");
    for (var i = 1; i <= 10; i++) {
        var o = document.createElement("option");
        o.value = String(i);
        o.textContent = "Parte " + i;
        s.appendChild(o);
    }
}

function prepararEditor() {
    var cap = acharPorId(meusCapitulos, editandoId);
    if (!cap) editandoId = null;

    var parte = cap ? cap.parte : (meusCapitulos.length ? meusCapitulos[meusCapitulos.length - 1].parte : 1);
    var titulo = cap ? (cap.titulo || "") : "";
    var texto = cap ? (cap.texto || "") : "";
    var recuperou = false;

    var b = lerDados(CH_BACKUP, null);
    if (b && b.id === editandoId && (b.titulo !== titulo || b.texto !== texto) && (b.texto || b.titulo)) {
        parte = b.parte || parte;
        titulo = b.titulo || "";
        texto = b.texto || "";
        recuperou = true;
    }

    pegar("capParte").value = String(parte);
    pegar("capTitulo").value = titulo;
    pegar("capTexto").value = texto;
    pegar("contaPalavras").textContent = contar(texto);
    pegar("avisoCap").textContent = "";
    statusAutoSave(recuperou ? "Rascunho recuperado deste aparelho. Vamos sincronizá-lo quando você editar ou salvar." : "Salvamento automático ativo: guardamos neste aparelho enquanto você digita e sincronizamos com sua conta.", recuperou ? "pendente" : "");

    if (!usuarioLogado || !minhaHistoria) {
        aviso("avisoCap", "Entre na conta e crie a história para poder salvar capítulos.", true);
    } else if (recuperou) {
        aviso("avisoCap", "Recuperamos um texto que não tinha sido salvo. Toque em Salvar capítulo.", true);
    }
}

function enfileirarSalvar(avisar) {
    var p = fila.then(function () { return salvarCap(avisar); });
    fila = p.catch(function () { });
    return p;
}

// Retorna true (salvou), false (falhou) ou null (não havia nada para salvar)
async function salvarCap(avisar) {
    if (!usuarioLogado || !minhaHistoria) {
        if (avisar) aviso("avisoCap", "Entre na conta e crie a história primeiro.", true);
        return false;
    }

    var titulo = pegar("capTitulo").value.trim();
    var texto = pegar("capTexto").value;
    var parte = parseInt(pegar("capParte").value, 10) || 1;

    if (!titulo && !texto.trim()) {
        statusAutoSave("Comece a escrever para ativar o salvamento automático.", "");
        if (avisar) aviso("avisoCap", "Escreva um título ou um texto para salvar.", true);
        return null;
    }

    statusAutoSave("Salvando na sua conta...", "salvando");
    var cap = acharPorId(meusCapitulos, editandoId);
    var r;

    if (!cap) {
        var ordem = 0;
        meusCapitulos.forEach(function (c) { if (c.parte === parte && c.ordem >= ordem) ordem = c.ordem + 1; });
        r = await db.from("capitulos").insert({ historia_id: minhaHistoria.id, parte: parte, ordem: ordem, titulo: titulo, texto: texto, publicado: false }).select().single();
    } else {
        r = await db.from("capitulos").update({ parte: parte, titulo: titulo, texto: texto }).eq("id", cap.id).select().single();
    }

    if (r.error) {
        statusAutoSave("Não foi possível sincronizar. Seu texto continua guardado neste aparelho; tente salvar novamente.", "erro");
        aviso("avisoCap", "Não foi possível salvar na conta. Seu texto está guardado neste aparelho; tente de novo.", true);
        return false;
    }

    if (cap) {
        Object.assign(cap, r.data);
    } else {
        meusCapitulos.push(r.data);
    }
    editandoId = r.data.id;
    ordenarCapitulos(meusCapitulos);
    apagarLocal(CH_BACKUP);

    var agora = new Date();
    var horario = agora.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    statusAutoSave("Salvo na sua conta às " + horario + ".", "salvo");
    if (avisar) aviso("avisoCap", "Capítulo salvo na sua conta.", false);
    return true;
}

async function voltarLista() {
    clearTimeout(temporizador);
    var ok = await enfileirarSalvar(false);
    if (ok === false) return;
    location.hash = "capitulos";
}

function aoDigitar() {
    pegar("contaPalavras").textContent = contar(pegar("capTexto").value);
    var guardouLocal = gravar(CH_BACKUP, {
        id: editandoId,
        parte: parseInt(pegar("capParte").value, 10) || 1,
        titulo: pegar("capTitulo").value.trim(),
        texto: pegar("capTexto").value
    });
    statusAutoSave(guardouLocal ? "Alterações guardadas neste aparelho. Sincronizando em instantes..." : "Não foi possível guardar neste aparelho. Salve na sua conta agora.", guardouLocal ? "pendente" : "erro");
    clearTimeout(temporizador);
    temporizador = setTimeout(function () { enfileirarSalvar(false); }, 2000);
}

pegar("capTitulo").addEventListener("input", aoDigitar);
pegar("capTexto").addEventListener("input", aoDigitar);
pegar("capParte").addEventListener("change", aoDigitar);

/* =====================================================
   COMUNIDADES: CADA PESSOA CRIA A SUA (NOME E CAPA ESCOLHIDOS POR QUEM CRIA)
   A comunidade fica na tabela "comunidades". O CHAT não salva nada: usa o Realtime do Supabase
   (Broadcast + Presence). Ao sair da página ou do app, o canal fecha e o chat zera.
===================================================== */
var CAPA_PADRAO_COMUNIDADE="/comunidade-capa.svg",COMUNIDADE_MAX_MSG=100,canalComunidade=null,comunidadeAtual=null,comunidadeAtualId=null,ultimoEnvioComunidade=0,capaComunidadeForm="",comunidadeEditandoId=null,membrosComunidadeAtual=[],modsComunidadeAtual=[],euSouMembroComunidade=false;
function capaSegura(s){return(typeof s==="string"&&s.indexOf("data:image/jpeg;base64,")===0&&s.length<60000)?s:CAPA_PADRAO_COMUNIDADE;}
async function carregarComunidades(){var a=pegar("listaComunidades");if(!a)return;a.innerHTML="";a.appendChild(criar("p","vazio","Carregando comunidades..."));var r=await db.from("comunidades").select("id,nome,descricao,capa,criador_id,created_at").order("created_at",{ascending:false}).limit(100);a.innerHTML="";if(r.error){a.appendChild(criar("p","vazio","Não foi possível carregar as comunidades."));return;}if(!r.data||!r.data.length){a.appendChild(criar("p","vazio","Ainda não há comunidades. Crie a primeira!"));return;}r.data.forEach(function(c){var it=criar("a","bloco comunidade-item");it.href="#comunidade-"+c.id;var img=criar("img","comunidade-capa");img.src=capaSegura(c.capa);img.alt="";img.width=56;img.height=56;var info=criar("div");info.appendChild(criar("strong","",c.nome));if(c.descricao)info.appendChild(criar("p","ajuda",c.descricao));it.appendChild(img);it.appendChild(info);a.appendChild(it);});}
function mostrarCapaForm(){var img=pegar("comCapaPrevia");if(img)img.src=capaSegura(capaComunidadeForm);}
function removerCapaComunidade(){capaComunidadeForm="";mostrarCapaForm();}
pegar("comCapaArquivo").addEventListener("change",function(){var arq=this.files;if(!arq)return;var l=new FileReader();l.onload=function(){var img=new Image();img.onload=function(){var lado=Math.min(img.width,img.height),q=document.createElement("canvas");q.width=128;q.height=128;q.getContext("2d").drawImage(img,(img.width-lado)/2,(img.height-lado)/2,lado,lado,0,0,128,128);capaComunidadeForm=q.toDataURL("image/jpeg",0.8);mostrarCapaForm();};img.src=l.result;};l.readAsDataURL(arq);});
async function prepararFormComunidade(id){comunidadeEditandoId=null;capaComunidadeForm="";pegar("comNome").value="";pegar("comDescricao").value="";aviso("avisoComForm","",false);pegar("tituloFormComunidade").textContent=id?"Editar comunidade":"Criar comunidade";mostrarCapaForm();if(!usuarioLogado){aviso("avisoComForm","Entre na sua conta para criar uma comunidade.",true);return;}if(!id)return;var r=await db.from("comunidades").select("id,nome,descricao,capa,criador_id").eq("id",id).maybeSingle();if(r.error||!r.data){aviso("avisoComForm","Comunidade não encontrada.",true);return;}if(r.data.criador_id!==usuarioLogado.id){aviso("avisoComForm","Apenas o ADM (criador) pode alterar a foto ou dados da comunidade.",true);return;}comunidadeEditandoId=r.data.id;pegar("comNome").value=r.data.nome||"";pegar("comDescricao").value=r.data.descricao||"";capaComunidadeForm=r.data.capa||"";mostrarCapaForm();}
async function salvarComunidade(){if(!usuarioLogado){aviso("avisoComForm","Entre na sua conta para criar uma comunidade.",true);return;}var nome=(pegar("comNome").value||"").replace(/\s+/g," ").trim(),desc=(pegar("comDescricao").value||"").trim();if(nome.length<3){aviso("avisoComForm","O nome precisa ter pelo menos 3 letras.",true);return;}var dados={nome:nome,descricao:desc,capa:capaComunidadeForm||""},r;if(comunidadeEditandoId){r=await db.from("comunidades").update(dados).eq("id",comunidadeEditandoId).eq("criador_id",usuarioLogado.id).select("id").single();}else{dados.criador_id=usuarioLogado.id;r=await db.from("comunidades").insert(dados).select("id").single();if(!r.error&&r.data)await db.from("comunidade_membros").insert({comunidade_id:r.data.id,user_id:usuarioLogado.id});}if(r.error){var msg="Não foi possível salvar a comunidade.";if(r.error.code==="23505")msg="Já existe uma comunidade com esse nome.";aviso("avisoComForm",msg,true);return;}location.hash="comunidade-"+r.data.id;}
async function excluirComunidade(){if(!comunidadeAtual||!usuarioLogado)return;if(comunidadeAtual.criador_id!==usuarioLogado.id){aviso("avisoComunidadeChat","Apenas o ADM da comunidade pode excluí-la.",true);return;}if(!confirm("Excluir a comunidade \""+comunidadeAtual.nome+"\"? Não dá para desfazer."))return;var r=await db.from("comunidades").delete().eq("id",comunidadeAtual.id).eq("criador_id",usuarioLogado.id).select("id");if(r.error||!r.data||!r.data.length){aviso("avisoComunidadeChat","Não foi possível excluir a comunidade.",true);return;}location.hash="comunidades";}
async function pedirParaEntrarComunidade(){if(!usuarioLogado||!comunidadeAtual)return;var ban=await db.from("comunidade_banidos").select("user_id").eq("comunidade_id",comunidadeAtual.id).eq("user_id",usuarioLogado.id).maybeSingle();if(ban.data){aviso("avisoComunidadeChat","Você foi banido desta comunidade e não pode entrar.",true);return;}var r=await db.from("comunidade_membros").insert({comunidade_id:comunidadeAtual.id,user_id:usuarioLogado.id});if(r.error){aviso("avisoComunidadeChat","Não foi possível entrar na comunidade.",true);return;}var idAtual=comunidadeAtual.id;sairComunidade();entrarComunidade(idAtual);}
async function tornarModerador(uid){if(!comunidadeAtual||!usuarioLogado||comunidadeAtual.criador_id!==usuarioLogado.id)return;if(modsComunidadeAtual.length>=2){aviso("avisoComunidadeChat","Você já escolheu o máximo de 2 moderadores.",true);return;}var r=await db.from("comunidade_moderadores").insert({comunidade_id:comunidadeAtual.id,user_id:uid});if(r.error){aviso("avisoComunidadeChat",r.error.message||"Erro ao adicionar moderador.",true);return;}await atualizarPainelMembrosComunidade();}
async function removerModerador(uid){if(!comunidadeAtual||!usuarioLogado||comunidadeAtual.criador_id!==usuarioLogado.id)return;await db.from("comunidade_moderadores").delete().eq("comunidade_id",comunidadeAtual.id).eq("user_id",uid);await atualizarPainelMembrosComunidade();}
async function banirMembroComunidade(alvoId,nomeAlvo){if(!comunidadeAtual||!usuarioLogado)return;var ehAdm=comunidadeAtual.criador_id===usuarioLogado.id,ehMod=modsComunidadeAtual.indexOf(usuarioLogado.id)!==-1;if(!ehAdm&&!ehMod)return;if(alvoId===comunidadeAtual.criador_id){aviso("avisoComunidadeChat","O ADM não pode ser banido.",true);return;}if(modsComunidadeAtual.indexOf(alvoId)!==-1){aviso("avisoComunidadeChat","Moderadores não podem ser banidos.",true);return;}if(!confirm("Banir "+(nomeAlvo||"este membro")+" da comunidade?"))return;await db.from("comunidade_banidos").insert({comunidade_id:comunidadeAtual.id,user_id:alvoId,banido_por:usuarioLogado.id});await db.from("comunidade_membros").delete().eq("comunidade_id",comunidadeAtual.id).eq("user_id",alvoId);if(canalComunidade)canalComunidade.send({type:"broadcast",event:"ban",payload:{uid:alvoId}});await atualizarPainelMembrosComunidade();aviso("avisoComunidadeChat","Membro banido da comunidade.",false);}
async function atualizarPainelMembrosComunidade(){var p=pegar("comunidadePainelMembros");if(!p||!comunidadeAtual)return;var rM=await db.from("comunidade_membros").select("user_id").eq("comunidade_id",comunidadeAtual.id),rD=await db.from("comunidade_moderadores").select("user_id").eq("comunidade_id",comunidadeAtual.id);membrosComunidadeAtual=(rM.data||[]).map(function(x){return x.user_id;});modsComunidadeAtual=(rD.data||[]).map(function(x){return x.user_id;});await carregarNomes(membrosComunidadeAtual);p.innerHTML="";p.appendChild(criar("h3","","Membros ("+membrosComunidadeAtual.length+") · Moderadores ("+modsComunidadeAtual.length+"/2)"));var euAdm=!!usuarioLogado&&comunidadeAtual.criador_id===usuarioLogado.id,euMod=!!usuarioLogado&&modsComunidadeAtual.indexOf(usuarioLogado.id)!==-1;membrosComunidadeAtual.forEach(function(uid){var l=criar("div","bloco");l.style.cssText="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap";var info=criar("div"),nome=NOMES[uid]||"Membro";info.appendChild(criar("strong","",nome));var aAdm=uid===comunidadeAtual.criador_id,aMod=modsComunidadeAtual.indexOf(uid)!==-1;if(aAdm)info.appendChild(criar("span","selo ok","ADM"));else if(aMod)info.appendChild(criar("span","selo","Moderador"));l.appendChild(info);var bts=criar("div","botoes");if(euAdm&&!aAdm){if(aMod){var b1=criar("button","btn claro mini","Tirar Mod");b1.onclick=function(){removerModerador(uid);};bts.appendChild(b1);}else if(modsComunidadeAtual.length<2){var b2=criar("button","btn claro mini","Tornar Mod");b2.onclick=function(){tornarModerador(uid);};bts.appendChild(b2);}}if((euAdm||euMod)&&!aAdm&&!aMod){var b3=criar("button","btn perigo mini","Banir");b3.onclick=function(){banirMembroComunidade(uid,nome);};bts.appendChild(b3);}l.appendChild(bts);p.appendChild(l);});}
function limparChatComunidade(){var a=pegar("comunidadeMensagens");if(a)a.innerHTML="";}
function sairComunidade(){if(canalComunidade){try{db.removeChannel(canalComunidade);}catch(e){}canalComunidade=null;}comunidadeAtual=null;comunidadeAtualId=null;euSouMembroComunidade=false;limparChatComunidade();}
async function entrarComunidade(id){if(!id){location.hash="comunidades";return;}if(canalComunidade&&comunidadeAtualId===id)return;sairComunidade();comunidadeAtualId=id;var login=pegar("comunidadeLogin"),chat=pegar("comunidadeChat"),on=pegar("comunidadeOnline"),bEnt=pegar("comunidadeBlocoEntrar");if(!login||!chat||!on)return;pegar("comunidadeNome").textContent="Comunidade";pegar("comunidadeDescricao").textContent="";pegar("comunidadeCapa").src=CAPA_PADRAO_COMUNIDADE;pegar("comunidadeGestao").style.display="none";if(bEnt)bEnt.style.display="none";login.style.display="none";chat.style.display="none";on.textContent="Conectando...";aviso("avisoComunidadeChat","",false);var r=await db.from("comunidades").select("id,nome,descricao,capa,criador_id").eq("id",id).maybeSingle();if(comunidadeAtualId!==id)return;if(r.error||!r.data){on.textContent="Comunidade não encontrada.";return;}comunidadeAtual=r.data;pegar("comunidadeNome").textContent=r.data.nome;pegar("comunidadeDescricao").textContent=r.data.descricao||"";pegar("comunidadeCapa").src=capaSegura(r.data.capa);var dono=!!usuarioLogado&&r.data.criador_id===usuarioLogado.id;if(dono){pegar("comunidadeGestao").style.display="block";var ed=pegar("comunidadeEditar");ed.href="#editarcomunidade-"+r.data.id;ed.style.display="";}if(!usuarioLogado){login.style.display="block";on.textContent="Entre na conta para participar.";return;}var ban=await db.from("comunidade_banidos").select("user_id").eq("comunidade_id",id).eq("user_id",usuarioLogado.id).maybeSingle();if(ban.data){on.textContent="Você foi banido desta comunidade.";return;}var mem=await db.from("comunidade_membros").select("user_id").eq("comunidade_id",id).eq("user_id",usuarioLogado.id).maybeSingle();euSouMembroComunidade=dono||!!(mem&&mem.data);if(!euSouMembroComunidade){on.textContent="Apenas membros podem conversar neste chat.";if(bEnt)bEnt.style.display="block";return;}if(semConexao||typeof db.channel!=="function"){on.textContent="Chat indisponível sem conexão.";return;}chat.style.display="block";await atualizarPainelMembrosComunidade();var canal=db.channel("comunidade-"+r.data.id,{config:{broadcast:{self:true},presence:{key:usuarioLogado.id}}});canal.on("broadcast",{event:"msg"},function(ev){if(canal===canalComunidade)mostrarMensagemComunidade(ev.payload);});canal.on("broadcast",{event:"ban"},function(ev){if(canal===canalComunidade&&ev.payload&&ev.payload.uid===usuarioLogado.id){alert("Você foi banido desta comunidade.");sairComunidade();location.hash="comunidades";}});canal.on("presence",{event:"sync"},function(){if(canal!==canalComunidade)return;var n=Object.keys(canal.presenceState()).length;on.textContent=n+(n===1?" membro online":" membros online");});canalComunidade=canal;canal.subscribe(function(st){if(canal!==canalComunidade)return;if(st==="SUBSCRIBED")canal.track({entrou:Date.now()});else if(st==="CHANNEL_ERROR"||st==="TIMED_OUT")on.textContent="Sem conexão com o chat.";});}
function mostrarMensagemComunidade(p){var a=pegar("comunidadeMensagens");if(!a||!p||typeof p.texto!=="string")return;var meu=!!usuarioLogado&&p.uid===usuarioLogado.id,it=criar("div","chat-msg"+(meu?" minha":"")),t=String(p.nome||"Membro").slice(0,40);if(comunidadeAtual&&p.uid===comunidadeAtual.criador_id)t+=" [ADM]";else if(modsComunidadeAtual.indexOf(p.uid)!==-1)t+=" [MOD]";it.appendChild(criar("strong","",t));it.appendChild(criar("p","",p.texto.slice(0,300)));var perto=a.scrollHeight-a.scrollTop-a.clientHeight<80;a.appendChild(it);while(a.children.length>COMUNIDADE_MAX_MSG)a.removeChild(a.firstChild);if(perto||meu)a.scrollTop=a.scrollHeight;}
async function enviarMensagemComunidade(){var c=canalComunidade;if(!usuarioLogado||!c||!euSouMembroComunidade){aviso("avisoComunidadeChat","Você precisa ser membro da comunidade para falar no chat.",true);return;}var cp=pegar("comunidadeTexto"),tx=(cp.value||"").replace(/\s+/g," ").trim();if(!tx)return;var ag=Date.now();if(ag-ultimoEnvioComunidade<1500){aviso("avisoComunidadeChat","Aguarde um instante para enviar de novo.",true);return;}ultimoEnvioComunidade=ag;var pf=lerPerfil(),r=await c.send({type:"broadcast",event:"msg",payload:{uid:usuarioLogado.id,nome:String(pf.nome||pf.usuario||"Membro").slice(0,40),texto:tx.slice(0,300),ts:ag}});if(r!=="ok"){aviso("avisoComunidadeChat","Não foi possível enviar. Verifique a conexão.",true);return;}cp.value="";aviso("avisoComunidadeChat","",false);}
document.addEventListener("visibilitychange",function(){if(document.visibilityState==="hidden"){sairComunidade();return;}var h=(location.hash||"").replace("#","");if(h.indexOf("comunidade-")===0)entrarComunidade(lerIdDaRota(h.substring(11)));});
window.addEventListener("pagehide",sairComunidade);
document.addEventListener("keydown",function(e){if(e.key==="Enter"&&!e.shiftKey&&e.target&&e.target.id==="comunidadeTexto"){e.preventDefault();enviarMensagemComunidade();}});
/* =====================================================
   TROCA DE TELAS (pelo endereço: #inicio, #buscar, #livro-3, #nova ...)
===================================================== */
function rota() {
    tokenRota++;
    var token = tokenRota;
    fecharGaveta();

    var h = location.hash.replace("#", "") || "inicio";
    var tela = h;
    var id = null;

    if (h.indexOf("livro-") === 0) {
        tela = "livro";
        id = lerIdDaRota(h.split("-")[1]);
    }
    if (h.indexOf("ler-") === 0) {
        tela = "ler";
        var partes = h.split("-");
        leituraAtual = { id: lerIdDaRota(partes[1]), n: parseInt(partes[2], 10) };
    }
    if (h.indexOf("autor-") === 0) {
        tela = "autor";
        id = h.substring(6);
    }
    if (h.indexOf("conversa-") === 0) {
        tela = "conversa";
        id = h.substring(9);
    }
    if (h.indexOf("comunidade-") === 0) {
        tela = "comunidade";
        id = lerIdDaRota(h.substring(11));
    }
    if (h.indexOf("editarcomunidade-") === 0) {
        tela = "novacomunidade";
        id = lerIdDaRota(h.substring(17));
    }
    if (TELAS.indexOf(tela) === -1) tela = "inicio";

    TELAS.forEach(function (t) {
        pegar("tela-" + t).classList.toggle("ativa", t === tela);
    });

    var destaque = tela;
    if (tela === "livro" || tela === "autor") destaque = "inicio";
    if (tela === "conversa") destaque = "mensagens";
    if (tela === "comunidade" || tela === "novacomunidade") destaque = "comunidades";
    if (tela === "nova" || tela === "capitulos" || tela === "editor" || tela === "publicar") destaque = "escrever";

    var gaveta = destaque;
    if (["editarperfil", "preferencias", "notificacoes", "ajuda", "termos", "privacidade", "excluirconta", "gestao"].indexOf(tela) !== -1) gaveta = "configuracoes";
    var itens = document.querySelectorAll(".bottom-nav .nav-item, .drawer-menu a[data-tela]");
    for (var i = 0; i < itens.length; i++) {
        var alvoItem = itens[i].getAttribute("data-tela");
        var naGaveta = !!itens[i].closest(".drawer");
        itens[i].classList.toggle("active", alvoItem === (naGaveta ? gaveta : destaque));
    }

    document.body.classList.toggle("escrita", tela === "editor" || tela === "nova" || tela === "entrar" || tela === "denunciar" || tela === "ler" || tela === "editarperfil");

    pegar("vinheta").style.display = "none";
    clearTimeout(relogioLeitura);
    clearInterval(relogioTempo);

    if (tela === "inicio" || tela === "buscar") atualizarListas(false);
    if (tela === "livro") mostrarLivro(id, token);
    if (tela === "autor") mostrarAutor(id, token);
    if (tela === "perfil") atualizarMeusSeguidores();
    if (tela === "seguidores") carregarListaSeguidores();
    if (tela === "avisos") carregarAvisos();
    if (tela === "mensagens") carregarConversas();
    if (tela === "conversa") mostrarConversa(id, token);
    if (tela === "ler") prepararLeitor(token);
    if (tela === "nova") carregarForm();
    if (tela === "capitulos") abrirCapitulos();
    if (tela === "editor") prepararEditor();
    if (tela === "publicar") prepararPublicar();
    if (tela === "denunciar") prepararDenuncia();
    if (tela === "editarperfil") prepararEditarPerfil();
    if (tela === "preferencias") prepararPreferencias();
    if (tela === "notificacoes") prepararNotificacoes();
    if (tela === "excluirconta") prepararExcluirConta();
    if (tela === "gestao") prepararGestao(token);

    if (tela === "comunidades") carregarComunidades();
    if (tela === "novacomunidade") prepararFormComunidade(id);
    if (tela === "comunidade") entrarComunidade(id); else sairComunidade();

    atualizarRascunhos();
    aplicarTema();
    desenharAvatares();
    desenharPerfil();
    window.scrollTo(0, 0);
}

window.addEventListener("hashchange", rota);

/* =====================================================
   ENTRAR, TERMOS DE USO E POLÍTICA DE PRIVACIDADE
   Troque os dois textos abaixo pelos seus dados reais.
===================================================== */
var NOME_RESPONSAVEL = "Tomazini";
var EMAIL_CONTATO = "xegg.tmz@gmail.com";
var DATA_TEXTOS = "19 de novembro de 2026";

var TERMOS = [
    { t: "1. Aceite dos termos", p: [
        "Ao criar uma conta ou usar o PORTAL NOVEL, você concorda com estes Termos de Uso e com a Política de Privacidade. Se não concordar, não use o serviço."
    ] },
    { t: "2. Sua conta", p: [
        "Para criar uma conta é preciso ter pelo menos 14 anos. Informe dados verdadeiros e guarde a sua senha: você é responsável por tudo o que acontece na sua conta."
    ] },
    { t: "3. O autor é o único responsável pela obra", p: [
        "Tudo o que você publica (histórias, capítulos, capas, sinopses e comentários) é de responsabilidade exclusiva do autor. Ao publicar, você declara que a obra é sua ou que você tem autorização para usá-la, e que ela não viola direitos autorais nem direitos de terceiros.",
        "O PORTAL NOVEL não escreve, não edita e não aprova previamente as obras publicadas. A obra continua sendo sua; você nos autoriza apenas a exibi-la no aplicativo, para os leitores, enquanto ela estiver publicada."
    ] },
    { t: "4. O que não é permitido", p: [
        "Não é permitido publicar: conteúdo sexualmente explícito; qualquer conteúdo sexual envolvendo menores de 18 anos; apologia à violência, ao ódio ou à discriminação; conteúdo ilegal; plágio; spam; dados pessoais de outras pessoas sem autorização.",
        "Histórias com temas maduros devem receber a classificação indicativa correta."
    ] },
    { t: "5. Comentários e mensagens privadas", p: [
        "Comente com respeito. Ofensas, ameaças e assédio podem levar à remoção do comentário e à suspensão da conta.",
        "Você só pode enviar mensagem privada a quem segue você ou em resposta a quem escreveu para você. Não use mensagens para assediar, ameaçar, enviar spam, pedir dados pessoais ou fazer contato de natureza sexual com qualquer pessoa. Quem descumprir pode ter a conta suspensa ou banida."
    ] },
    { t: "6. Denúncias e remoção", p: [
        "Qualquer pessoa pode denunciar uma obra ou um comentário. Podemos remover conteúdo que viole estes termos e suspender contas, com ou sem aviso prévio. Para denúncias, escreva para " + EMAIL_CONTATO + "."
    ] },
    { t: "7. Anúncios", p: [
        "O PORTAL NOVEL poderá exibir anúncios para se manter gratuito para os leitores. Não clique nos anúncios para gerar ganhos e não peça para outras pessoas fazerem isso: cliques artificiais podem levar à suspensão da conta."
    ] },
    { t: "8. Selos e incentivos para autores", p: [
        "O PORTAL NOVEL pode conceder selos, como o de Escritor Fundador, que é dado por convite e não pode ser comprado. O selo é vitalício, mas pode ser retirado em caso de violação grave destes termos.",
        "No futuro, o PORTAL NOVEL poderá criar programas de incentivo e reconhecimento para autores. Se isso acontecer, as regras serão divulgadas com aviso prévio, e a participação dependerá de cumpri-las. Ter um selo não garante participação nem qualquer pagamento."
    ] },
    { t: "9. Mudanças e contato", p: [
        "Podemos atualizar estes termos e, quando isso acontecer, a data abaixo será alterada. Dúvidas: " + EMAIL_CONTATO + ".",
        "Responsável: " + NOME_RESPONSAVEL + ". Última atualização: " + DATA_TEXTOS + "."
    ] }
];

var PRIVACIDADE = [
    { t: "1. Quem é o responsável", p: [
        "O PORTAL NOVEL é mantido por " + NOME_RESPONSAVEL + ". Contato sobre dados pessoais: " + EMAIL_CONTATO + "."
    ] },
    { t: "2. Quais dados coletamos", p: [
        "Conta: e-mail, nome de usuário e senha (a senha é protegida e nunca fica visível para nós).",
        "Perfil: foto e descrição, se você enviar.",
        "Conteúdo e relações: histórias, capítulos, capas, comentários, curtidas e os autores que você segue.",
        "Mensagens e avisos: as mensagens privadas que você envia e recebe e as notificações da sua conta. Elas aparecem no app só para quem participa da conversa e ficam guardadas enquanto a conta existir.",
        "Uso: quais capítulos foram abertos (para o contador de leituras) e dados técnicos básicos do aparelho e do navegador."
    ] },
    { t: "3. Para que usamos os dados", p: [
        "Para criar e manter a sua conta, exibir obras, comentários, curtidas e leituras, manter o serviço seguro, moderar conteúdo e cumprir obrigações legais."
    ] },
    { t: "4. Anúncios e cookies", p: [
        "O PORTAL NOVEL poderá exibir anúncios do Google. O Google e seus parceiros podem usar cookies e identificadores para mostrar e medir anúncios. O app também guarda informações no seu aparelho, como preferências e textos ainda não salvos.",
        "Você pode limpar esses dados nas configurações do navegador e gerenciar a personalização de anúncios na sua conta Google."
    ] },
    { t: "5. Com quem compartilhamos", p: [
        "Não vendemos os seus dados. Eles são tratados pelos serviços que o app usa para funcionar, como hospedagem e banco de dados, e pelo Google, no caso dos anúncios. Também podemos informar autoridades quando a lei exigir.",
        "O seu nome de usuário, o seu perfil e as suas obras publicadas são públicos."
    ] },
    { t: "6. Seus direitos", p: [
        "Você pode pedir acesso, correção e exclusão dos seus dados, portabilidade, informações sobre o tratamento e a retirada do seu consentimento, escrevendo para " + EMAIL_CONTATO + ". Você também pode excluir a sua conta direto no app, em Configurações › Excluir conta."
    ] },
    { t: "7. Por quanto tempo guardamos", p: [
        "Enquanto a sua conta existir. Ao excluir a conta, apagamos os seus dados, exceto o que precisarmos guardar por obrigação legal."
    ] },
    { t: "8. Idade mínima", p: [
        "O serviço é para pessoas com 14 anos ou mais. Histórias com classificação de 18 anos são destinadas a maiores de 18 anos."
    ] },
    { t: "9. Mudanças nesta política", p: [
        "Podemos atualizar esta política, e a data abaixo mostra a última versão. Última atualização: " + DATA_TEXTOS + "."
    ] }
];

function desenharLegal(idArea, titulo, secoes) {
    var area = pegar(idArea);
    area.innerHTML = "";
    area.appendChild(criar("h1", "", titulo));
    secoes.forEach(function (secao) {
        area.appendChild(criar("h2", "", secao.t));
        secao.p.forEach(function (paragrafo) {
            area.appendChild(criar("p", "", paragrafo));
        });
    });
}

var modoLogin = "entrar";

function trocarAba(modo) {
    modoLogin = modo;
    var criarConta = (modo === "criar");
    pegar("abaEntrar").classList.toggle("ativo", !criarConta);
    pegar("abaCriar").classList.toggle("ativo", criarConta);
    pegar("campoNome").style.display = criarConta ? "block" : "none";
    pegar("blocoAceite").style.display = criarConta ? "flex" : "none";
    pegar("btnLogin").textContent = criarConta ? "Criar conta" : "Entrar";
    pegar("avisoLogin").textContent = "";
}

function traduzirErro(m) {
    m = (m || "").toLowerCase();
    if (m.indexOf("sem conexão") > -1) return "Sem conexão com o servidor. Verifique a internet e recarregue a página.";
    if (m.indexOf("invalid login") > -1) return "E-mail ou senha incorretos.";
    if (m.indexOf("already registered") > -1) return "Este e-mail já tem conta. Use Entrar.";
    if (m.indexOf("rate limit") > -1) return "Muitas tentativas. Espere um pouco.";
    if (m.indexOf("not confirmed") > -1) return "Confirme o seu e-mail antes de entrar.";
    return "Não foi possível concluir: " + m;
}

async function enviarLogin() {
    var email = pegar("email").value.trim();
    var senha = pegar("senha").value;
    var usuario = pegar("nomeUsuario").value.trim().toLowerCase();

    if (modoLogin === "criar" && !/^[a-z0-9_.]{3,20}$/.test(usuario)) {
        aviso("avisoLogin", "Usuário: de 3 a 20 caracteres (letras sem acento, números, _ ou ponto).", true);
        return;
    }
    if (email.indexOf("@") === -1) {
        aviso("avisoLogin", "Digite um e-mail válido.", true);
        return;
    }
    if (senha.length < 6) {
        aviso("avisoLogin", "A senha precisa ter pelo menos 6 caracteres.", true);
        return;
    }
    if (modoLogin === "criar" && !pegar("aceito").checked) {
        aviso("avisoLogin", "Para criar a conta, aceite os Termos de Uso e a Política de Privacidade.", true);
        return;
    }

    aviso("avisoLogin", "Aguarde...", false);

    if (modoLogin === "criar") {
        var r = await db.auth.signUp({ email: email, password: senha, options: { data: { usuario: usuario } } });
        if (r.error) { aviso("avisoLogin", traduzirErro(r.error.message), true); return; }
        if (!r.data.session) {
            aviso("avisoLogin", "Conta criada! Confirme o e-mail que enviamos e depois toque em Entrar.", false);
            return;
        }
        var p = await db.from("perfis").upsert({ id: r.data.user.id, nome: usuario, usuario: usuario });
        if (p.error) {
            var usado = p.error.code === "23505";
            aviso("avisoLogin", usado ? "Conta criada, mas esse nome de usuário já existe. Escolha outro em Editar perfil." : "Conta criada, mas o perfil não foi salvo.", true);
            return;
        }
    } else {
        var e = await db.auth.signInWithPassword({ email: email, password: senha });
        if (e.error) { aviso("avisoLogin", traduzirErro(e.error.message), true); return; }
    }

    location.hash = "perfil";
}

function voltarTela() {
    if (history.length > 1) history.back();
    else location.hash = "perfil";
}

desenharLegal("textoTermos", "Termos de Uso", TERMOS);
desenharLegal("textoPrivacidade", "Política de Privacidade", PRIVACIDADE);

/* =====================================================
   PUBLICAR A HISTÓRIA: DECLARAÇÃO DO AUTOR
   Depois de publicada a história, cada capítulo é publicado na lista de capítulos.
===================================================== */
var DECLARACAO = [
    "Sou o autor desta obra, ou tenho autorização para publicá-la.",
    "A obra não é plágio e não viola direitos autorais nem direitos de terceiros.",
    "A obra não tem conteúdo sexual explícito, nem conteúdo sexual envolvendo menores de 18 anos, e a classificação indicativa está correta.",
    "Sou o único responsável pelo conteúdo da obra e sei que o PORTAL NOVEL pode removê-la se ela violar os Termos de Uso."
];

function montarDeclaracao() {
    var area = pegar("listaDecl");
    DECLARACAO.forEach(function (texto) {
        var rotulo = criar("label", "decl");
        var caixa = document.createElement("input");
        caixa.type = "checkbox";
        caixa.name = "decl";
        rotulo.appendChild(caixa);
        rotulo.appendChild(criar("span", "", texto));
        area.appendChild(rotulo);
    });
}

function desenharPreviaPublicacao(h) {
    var capa = pegar("pubPreviewCapa");
    var titulo = pegar("pubPreviewTitulo");
    var sinopse = pegar("pubPreviewSinopse");
    var meta = pegar("pubPreviewMeta");
    var generos = pegar("pubPreviewGeneros");
    if (!capa || !titulo || !sinopse || !meta || !generos) return;

    if (!h) {
        capa.style.display = "none";
        titulo.textContent = "Sua história";
        sinopse.textContent = "A sinopse aparecerá aqui.";
        meta.textContent = "";
        generos.textContent = "";
        return;
    }

    titulo.textContent = h.titulo || "Sem título";
    sinopse.textContent = h.sinopse || "Nenhuma sinopse informada.";
    var classificacao = h.idade === "livre" ? "Livre" : (h.idade ? h.idade + " anos" : "Não definida");
    var status = h.status === "completa" ? "Completa" : (h.status === "andamento" ? "Em andamento" : "Status não definido");
    meta.textContent = classificacao + " · " + status + " · " + meusCapitulos.length + (meusCapitulos.length === 1 ? " capítulo" : " capítulos");
    var nomesGeneros = (h.generos || []).map(function (id) {
        var genero = GENEROS.find(function (g) { return g.id === id; });
        return genero ? genero.nome : id;
    });
    generos.textContent = nomesGeneros.length ? "Gêneros: " + nomesGeneros.join(", ") : "Gêneros não selecionados.";

    var url = imagemSegura(h.capa);
    if (url) {
        capa.src = url;
        capa.style.display = "block";
    } else {
        capa.removeAttribute("src");
        capa.style.display = "none";
    }
}

function prepararPublicar() {
    var h = minhaHistoria;
    var caixas = document.querySelectorAll('input[name="decl"]');
    for (var i = 0; i < caixas.length; i++) caixas[i].checked = false;

    if (!usuarioLogado || !h) {
        pegar("pubTitulo").textContent = "Sem história";
        pegar("pubResumo").textContent = "";
        pegar("btnDespublicar").style.display = "none";
        desenharPreviaPublicacao(null);
        aviso("avisoPub", usuarioLogado ? "Crie a sua história antes de publicar." : "Entre na sua conta para publicar.", true);
        return;
    }

    pegar("pubTitulo").textContent = h.titulo || "Sem título";
    desenharPreviaPublicacao(h);

    var classificacao = "não escolhida";
    if (h.idade === "livre") classificacao = "Livre";
    else if (h.idade) classificacao = h.idade + " anos";

    var total = meusCapitulos.length;
    var publicados = meusCapitulos.filter(function (c) { return c.publicado; }).length;
    pegar("pubResumo").textContent = total + (total === 1 ? " capítulo" : " capítulos") + " (" + publicados + " publicados) · Classificação: " + classificacao + " · " + (h.publicada ? "História publicada" : "História em rascunho");

    pegar("btnDespublicar").style.display = h.publicada ? "block" : "none";

    if (h.publicada && h.aceite_autor) aviso("avisoPub", "Declaração confirmada em " + dataBonita(h.aceite_autor.data) + ". Publique cada capítulo na lista de capítulos.", false);
    else pegar("avisoPub").textContent = "";
}

async function confirmarPublicar() {
    var h = minhaHistoria;

    if (!usuarioLogado || !h || !h.titulo) {
        aviso("avisoPub", usuarioLogado ? "Dê um título à história em Informações da história." : "Entre na sua conta para publicar.", true);
        return;
    }
    if (!h.idade) {
        aviso("avisoPub", "Escolha a classificação indicativa em Informações da história.", true);
        return;
    }
    if (!meusCapitulos.length) {
        aviso("avisoPub", "Escreva pelo menos um capítulo antes de publicar.", true);
        return;
    }

    var caixas = document.querySelectorAll('input[name="decl"]');
    for (var i = 0; i < caixas.length; i++) {
        if (!caixas[i].checked) {
            aviso("avisoPub", "Confirme todos os itens da declaração para publicar.", true);
            return;
        }
    }

    aviso("avisoPub", "Publicando...", false);
    var r = await db.from("historias").update({ publicada: true, aceite_autor: { data: new Date().toISOString(), versao: DATA_TEXTOS } }).eq("id", h.id).select().single();

    if (r.error) {
        aviso("avisoPub", "Não foi possível publicar. Tente de novo.", true);
        return;
    }

    minhaHistoria = r.data;
    ultimaCargaHist = 0;
    prepararPublicar();
    aviso("avisoPub", "História publicada! Agora, na lista de capítulos, toque em Publicar em cada capítulo que os leitores devem ver.", false);
}

async function despublicarHistoria() {
    if (!minhaHistoria) return;
    if (!confirm("Despublicar a história? Ela some para os leitores, mas continua na sua conta.")) return;

    var r = await db.from("historias").update({ publicada: false }).eq("id", minhaHistoria.id).select().single();
    if (r.error) {
        aviso("avisoPub", "Não foi possível despublicar. Tente de novo.", true);
        return;
    }
    minhaHistoria = r.data;
    ultimaCargaHist = 0;
    prepararPublicar();
    aviso("avisoPub", "História despublicada.", false);
}

/* =====================================================
   CURTIR, COMENTAR E DENUNCIAR (tudo na conta)
===================================================== */
var MOTIVOS = [
    "Conteúdo sexual explícito",
    "Conteúdo sexual envolvendo menores de 18 anos",
    "Plágio ou violação de direitos autorais",
    "Violência, ódio ou discriminação",
    "Spam ou golpe",
    "Outro motivo"
];
var alvoDenuncia = null;

/* =====================================================
   COMPARTILHAR LINK (história e autor)
   Usa o menu de compartilhar do celular; no computador, copia o endereço.
===================================================== */
function copiarTexto(texto) {
    if (navigator.clipboard && window.isSecureContext) {
        return navigator.clipboard.writeText(texto);
    }
    return new Promise(function (ok, falha) {
        try {
            var t = document.createElement("textarea");
            t.value = texto;
            t.style.position = "fixed";
            t.style.opacity = "0";
            document.body.appendChild(t);
            t.select();
            var feito = document.execCommand("copy");
            document.body.removeChild(t);
            if (feito) ok(); else falha(new Error("copiar"));
        } catch (erro) { falha(erro); }
    });
}

async function compartilharLink(titulo, texto, link, idAviso) {
    if (navigator.share) {
        try {
            await navigator.share({ title: titulo, text: texto, url: link });
            return;
        } catch (erro) {
            if (erro && erro.name === "AbortError") return;   // a pessoa fechou o menu
        }
    }
    try {
        await copiarTexto(link);
        aviso(idAviso, "Link copiado!", false);
    } catch (erro) {
        aviso(idAviso, "Não foi possível copiar. Link: " + link, true);
    }
}

function compartilharHistoria() {
    var e = estadoCurtida;
    var link = location.origin + location.pathname + "#livro-" + e.id;
    var texto = e.titulo + (e.autor ? ", por " + e.autor : "") + ". Leia no Portal Novel.";
    compartilharLink(e.titulo, texto, link, "avisoAcoes");
}

function compartilharAutor() {
    var id = estadoSeguir.id;
    if (!id) return;
    var nome = NOMES[id] || "Autor";
    var link = location.origin + location.pathname + "#autor-" + id;
    compartilharLink(nome, nome + " no Portal Novel.", link, "avisoSeguir");
}

function desenharAcoes() {
    var area = pegar("blocoAcoes");
    if (!area) return;
    area.innerHTML = "";
    var e = estadoCurtida;

    var curtir = criar("button", "btn mini" + (e.curtiu ? "" : " claro"), (e.curtiu ? "♥ Curtido" : "♡ Curtir") + " · " + e.n);
    curtir.addEventListener("click", alternarCurtida);

    var denunciar = criar("button", "btn claro mini", "Denunciar");
    denunciar.addEventListener("click", function () { abrirDenuncia("historia", e.id, null, e.titulo); });

    var compartilhar = criar("button", "btn claro mini", "Compartilhar");
    compartilhar.addEventListener("click", compartilharHistoria);

    area.appendChild(curtir);
    area.appendChild(compartilhar);
    area.appendChild(denunciar);
}

async function alternarCurtida() {
    var e = estadoCurtida;
    if (e.ocupado) return;

    if (!usuarioLogado) {
        aviso("avisoAcoes", "Entre na sua conta para curtir.", true);
        return;
    }

    e.ocupado = true;
    var r;
    if (e.curtiu) {
        r = await db.from("curtidas").delete().eq("historia_id", e.id).eq("usuario_id", usuarioLogado.id);
        if (!r.error) { e.curtiu = false; e.n = Math.max(0, e.n - 1); }
    } else {
        r = await db.from("curtidas").insert({ historia_id: e.id, usuario_id: usuarioLogado.id });
        if (!r.error) { e.curtiu = true; e.n = e.n + 1; }
    }
    e.ocupado = false;

    if (r.error) aviso("avisoAcoes", "Não foi possível curtir agora.", true);
    else pegar("avisoAcoes").textContent = "";
    desenharAcoes();
}

async function desenharComentarios(id, titulo, token) {
    var area = pegar("blocoComentarios");
    if (!area) return;
    area.innerHTML = "";

    var cabecalho = criar("h2", "", "Comentários");
    area.appendChild(cabecalho);

    var caixa = criar("div", "bloco");
    var campo = document.createElement("textarea");
    campo.id = "campoComentario";
    campo.rows = 3;
    campo.maxLength = 500;
    campo.placeholder = "Escreva um comentário respeitoso...";
    caixa.appendChild(campo);

    var enviar = criar("button", "btn", "Comentar");
    enviar.style.width = "100%";
    enviar.addEventListener("click", function () { publicarComentario(id, titulo, enviar); });
    caixa.appendChild(enviar);

    var avisoCom = criar("p", "aviso");
    avisoCom.id = "avisoComentario";
    caixa.appendChild(avisoCom);
    area.appendChild(caixa);

    var lista = criar("div");
    lista.appendChild(criar("p", "vazio", "Carregando comentários..."));
    area.appendChild(lista);

    var r = await db.from("comentarios").select("id,usuario_id,texto,criado_em").eq("historia_id", id).order("criado_em", { ascending: false }).limit(50);
    if (token !== tokenRota) return;
    lista.innerHTML = "";

    if (r.error) {
        lista.appendChild(criar("p", "vazio", "Não foi possível carregar os comentários."));
        return;
    }

    var itens = r.data || [];
    cabecalho.textContent = "Comentários (" + itens.length + ")";
    await carregarNomes(itens.map(function (c) { return c.usuario_id; }));
    if (token !== tokenRota) return;

    if (!itens.length) {
        lista.appendChild(criar("p", "vazio", "Ainda não há comentários. Seja o primeiro."));
        return;
    }

    itens.forEach(function (c) {
        var item = criar("div", "bloco comentario");
        var nomeCom = criar("strong", "", NOMES[c.usuario_id] || "Leitor");
        if (FUNDADORES[c.usuario_id]) nomeCom.appendChild(seloFundador(FUNDADORES[c.usuario_id]));
        item.appendChild(nomeCom);
        item.appendChild(criar("span", "ajuda", " · " + dataBonita(c.criado_em)));
        item.appendChild(criar("p", "", c.texto));

        var botoes = criar("div", "botoes");

        var denunciar = criar("button", "btn claro mini", "Denunciar");
        denunciar.addEventListener("click", function () { abrirDenuncia("comentario", id, c.id, titulo); });
        botoes.appendChild(denunciar);

        if (usuarioLogado && c.usuario_id === usuarioLogado.id) {
            var apagar = criar("button", "btn perigo mini", "Apagar");
            apagar.addEventListener("click", function () { apagarComentario(id, titulo, c.id); });
            botoes.appendChild(apagar);
        }

        item.appendChild(botoes);
        lista.appendChild(item);
    });
}

async function publicarComentario(id, titulo, botao) {
    var texto = pegar("campoComentario").value.trim();

    if (!usuarioLogado) {
        aviso("avisoComentario", "Entre na sua conta para comentar.", true);
        return;
    }
    if (!texto) {
        aviso("avisoComentario", "Escreva algo antes de comentar.", true);
        return;
    }

    botao.disabled = true;
    var r = await db.from("comentarios").insert({ historia_id: id, usuario_id: usuarioLogado.id, texto: texto });
    botao.disabled = false;

    if (r.error) {
        aviso("avisoComentario", "Não foi possível enviar o comentário.", true);
        return;
    }
    desenharComentarios(id, titulo, tokenRota);
}

async function apagarComentario(id, titulo, comentarioId) {
    if (!confirm("Apagar este comentário?")) return;
    await db.from("comentarios").delete().eq("id", comentarioId);
    desenharComentarios(id, titulo, tokenRota);
}

function abrirDenuncia(tipo, historiaId, comentarioId, titulo, capituloId, capituloTitulo) {
    alvoDenuncia = {
        tipo: tipo,
        historiaId: historiaId,
        comentarioId: comentarioId,
        titulo: titulo || "",
        capituloId: capituloId || null,
        capituloTitulo: capituloTitulo || ""
    };
    location.hash = "denunciar";
}

function montarMotivos() {
    var area = pegar("listaMotivos");
    MOTIVOS.forEach(function (texto) {
        var rotulo = criar("label", "decl");
        var opcao = document.createElement("input");
        opcao.type = "radio";
        opcao.name = "motivo";
        opcao.value = texto;
        rotulo.appendChild(opcao);
        rotulo.appendChild(criar("span", "", texto));
        area.appendChild(rotulo);
    });
}

function prepararDenuncia() {
    if (!alvoDenuncia) {
        location.hash = "inicio";
        return;
    }

    var nome = alvoDenuncia.titulo;
    pegar("denAlvo").textContent = (alvoDenuncia.tipo === "comentario")
        ? "Você está denunciando um comentário na história “" + nome + "”."
        : (alvoDenuncia.tipo === "capitulo"
            ? "Você está denunciando o capítulo “" + (alvoDenuncia.capituloTitulo || "Sem título") + "”, da história “" + nome + "”."
            : "Você está denunciando a história “" + nome + "”.");

    var opcoes = document.querySelectorAll('input[name="motivo"]');
    for (var i = 0; i < opcoes.length; i++) opcoes[i].checked = false;

    pegar("denDetalhes").value = "";
    pegar("avisoDen").textContent = "";
}

async function enviarDenuncia() {
    var opcoes = document.querySelectorAll('input[name="motivo"]');
    var motivo = "";
    for (var i = 0; i < opcoes.length; i++) {
        if (opcoes[i].checked) motivo = opcoes[i].value;
    }

    if (!usuarioLogado) {
        aviso("avisoDen", "Entre na sua conta para enviar a denúncia.", true);
        return;
    }
    if (!motivo) {
        aviso("avisoDen", "Escolha o motivo da denúncia.", true);
        return;
    }

    var detalhesDenuncia = pegar("denDetalhes").value.trim();
    if (alvoDenuncia.tipo === "capitulo") {
        var contextoCapitulo = "[Capítulo: " + (alvoDenuncia.capituloTitulo || "Sem título") + "]";
        detalhesDenuncia = contextoCapitulo + (detalhesDenuncia ? " " + detalhesDenuncia : "");
    }

    var r = await db.from("denuncias").insert({
        usuario_id: usuarioLogado.id,
        historia_id: alvoDenuncia.historiaId,
        comentario_id: alvoDenuncia.comentarioId,
        motivo: motivo,
        detalhes: detalhesDenuncia
    });

    if (r.error) {
        aviso("avisoDen", "Não foi possível registrar a denúncia. Tente de novo.", true);
        return;
    }

    aviso("avisoDen", "Denúncia registrada. Obrigado por ajudar a manter o PORTAL NOVEL seguro.", false);
}

/* =====================================================
   LEITURA DE CAPÍTULOS E CONTADOR DE LEITURAS
   Uma leitura só conta depois de alguns segundos no capítulo, e uma vez por visita ao app.
===================================================== */
var SEGUNDOS_PARA_CONTAR = 10;
var leituraAtual = null;
var relogioLeitura = null;
var contadas = {};

function atualizarContadorLeitura() {
    pegar("lerContador").textContent = rotuloLeituras((leituraAtual && leituraAtual.total) || 0) + " neste capítulo";
}

async function prepararLeitor(token) {
    clearTimeout(relogioLeitura);

    if (!leituraAtual) {
        location.hash = "inicio";
        return;
    }

    pegar("lerHistoria").textContent = "Carregando...";
    pegar("lerTitulo").textContent = "";
    pegar("lerTexto").innerHTML = "";
    pegar("lerNavegacao").innerHTML = "";
    pegar("lerContador").textContent = "";

    var h = await buscarHistoria(leituraAtual.id);
    if (token !== tokenRota) return;

    var caps = h ? ((await listarCapitulos(h.id, true, false)) || []) : [];
    if (token !== tokenRota) return;

    var n = leituraAtual.n;
    if (!h || !(n >= 1 && n <= caps.length)) {
        location.hash = h ? "livro-" + h.id : "inicio";
        return;
    }

    var rc = await db.from("capitulos").select("id,titulo,texto").eq("id", caps[n - 1].id).maybeSingle();
    if (token !== tokenRota) return;
    if (!rc.data) {
        location.hash = "livro-" + h.id;
        return;
    }

    var c = rc.data;
    leituraAtual.idCap = c.id;
    var mapa = await contagemLeituras([c.id]);
    if (token !== tokenRota) return;
    leituraAtual.total = mapa[c.id] || 0;

    pegar("lerHistoria").textContent = h.titulo + " · Capítulo " + n + " de " + caps.length;
    pegar("lerTitulo").textContent = c.titulo || ("Capítulo " + n);

    var area = pegar("lerTexto");
    area.innerHTML = "";
    var pref = lerConfig();
    area.className = "leitura-texto tam-" + pref.tamanho + " fonte-" + pref.fonte;
    var linhas = (c.texto || "").split("\n");
    var escreveu = false;
    linhas.forEach(function (linha) {
        if (linha.trim()) {
            area.appendChild(criar("p", "", linha));
            escreveu = true;
        }
    });
    if (!escreveu) area.appendChild(criar("p", "", "Este capítulo ainda está vazio."));

    atualizarContadorLeitura();
    mostrarBanner(h);
    iniciarContagemDeTempo(h);

    var nav = pegar("lerNavegacao");
    nav.innerHTML = "";
    if (n > 1) {
        var anterior = criar("button", "btn claro", "← Anterior");
        anterior.addEventListener("click", function () { location.hash = "ler-" + h.id + "-" + (n - 1); });
        nav.appendChild(anterior);
    }
    if (n < caps.length) {
        var proximo = criar("button", "btn", "Próximo →");
        proximo.addEventListener("click", function () { irParaProximo(h, n); });
        nav.appendChild(proximo);
    } else {
        var fim = criar("button", "btn claro", "Fim · Voltar à história");
        fim.addEventListener("click", voltarDaLeitura);
        nav.appendChild(fim);
    }

    var denunciarCapitulo = criar("button", "btn claro mini", "Denunciar capítulo");
    denunciarCapitulo.type = "button";
    denunciarCapitulo.addEventListener("click", function () {
        abrirDenuncia("capitulo", h.id, null, h.titulo, c.id, c.titulo || ("Capítulo " + n));
    });
    nav.appendChild(denunciarCapitulo);

    var chave = h.id + "-" + c.id;
    if (!contadas[chave]) {
        relogioLeitura = setTimeout(async function () {
            var r = await db.from("leituras").insert({ capitulo_id: c.id, usuario_id: usuarioLogado ? usuarioLogado.id : null });
            if (!r.error) {
                contadas[chave] = true;
                if (leituraAtual && leituraAtual.idCap === c.id) {
                    leituraAtual.total = (leituraAtual.total || 0) + 1;
                    atualizarContadorLeitura();
                }
            }
        }, SEGUNDOS_PARA_CONTAR * 1000);
    }
}

function voltarDaLeitura() {
    location.hash = leituraAtual ? "livro-" + leituraAtual.id : "inicio";
}

/* =====================================================
   ANÚNCIOS: BANNER NO FIM DO CAPÍTULO E VINHETA A CADA 30 MINUTOS
   Por enquanto são só ESPAÇOS DE TESTE, sem anúncio de verdade.
   - MINUTOS_PARA_VINHETA: tempo de leitura até a vinheta aparecer
     (para testar rápido, troque 30 por 1).
   - MOSTRAR_ESPACOS_DE_ANUNCIO: false esconde tudo.
   Histórias com classificação de 18 anos nunca mostram anúncio.
===================================================== */
var MINUTOS_PARA_VINHETA = 30;
var MOSTRAR_ESPACOS_DE_ANUNCIO = false;
var tempoLido = lerDados(CH_TEMPO, 0);
var relogioTempo = null;
var depoisDaVinheta = null;

function anunciosPermitidos(h) {
    return MOSTRAR_ESPACOS_DE_ANUNCIO && h.idade !== "18";
}

function mostrarBanner(h) {
    var area = pegar("espacoBanner");
    area.innerHTML = "";

    if (!anunciosPermitidos(h)) {
        area.style.display = "none";
        return;
    }

    area.style.display = "block";
    area.appendChild(criar("p", "banner-rotulo", "Publicidade"));
    area.appendChild(criar("div", "banner-caixa", "Espaço do banner"));
}

// Soma o tempo em que você está de fato na tela de leitura (não conta com o app em segundo plano)
function iniciarContagemDeTempo(h) {
    clearInterval(relogioTempo);
    atualizarTesteVinheta(h);

    relogioTempo = setInterval(function () {
        if (document.hidden) return;
        tempoLido = tempoLido + 5000;
        gravar(CH_TEMPO, tempoLido);
        atualizarTesteVinheta(h);
    }, 5000);
}

function atualizarTesteVinheta(h) {
    var linha = pegar("lerTesteVinheta");
    if (!anunciosPermitidos(h)) {
        linha.textContent = "";
        return;
    }
    var falta = Math.ceil((MINUTOS_PARA_VINHETA * 60000 - tempoLido) / 60000);
    linha.textContent = falta > 0
        ? "(teste) Vinheta no próximo capítulo depois de mais " + falta + " min de leitura."
        : "(teste) A vinheta aparece ao tocar em Próximo.";
}

function irParaProximo(h, n) {
    var destino = "ler-" + h.id + "-" + (n + 1);

    if (anunciosPermitidos(h) && tempoLido >= MINUTOS_PARA_VINHETA * 60000) {
        depoisDaVinheta = function () { location.hash = destino; };
        pegar("vinheta").style.display = "flex";
    } else {
        location.hash = destino;
    }
}

function fecharVinheta() {
    pegar("vinheta").style.display = "none";
    tempoLido = 0;
    gravar(CH_TEMPO, 0);

    var seguir = depoisDaVinheta;
    depoisDaVinheta = null;
    if (seguir) seguir();
}

/* =====================================================
   PERFIL, PREFERÊNCIAS, NOTIFICAÇÕES E AJUDA
   O perfil fica na conta (Supabase) e uma cópia neste aparelho.
===================================================== */
var fotoPerfil = "";

var AJUDA = [
    { t: "Como publico uma história?", p: [
        "Entre na sua conta, toque em Escrever, preencha as informações da história e escreva os capítulos. Depois toque em Publicar história para confirmar a declaração do autor. Por fim, na lista de capítulos, toque em Publicar em cada capítulo que os leitores devem ver."
    ] },
    { t: "Posso publicar um capítulo por dia?", p: [
        "Sim. Escreva os capítulos com antecedência e deixe-os como rascunho. Todo dia, toque em Publicar no capítulo que quer liberar."
    ] },
    { t: "Como denuncio um conteúdo?", p: [
        "Na página da história ou em um comentário, toque em Denunciar, escolha o motivo e envie. É preciso estar com a conta."
    ] },
    { t: "Como mudo a minha foto e o meu nome?", p: [
        "Abra o seu perfil e toque em Editar perfil."
    ] },
    { t: "Quais dados o app guarda?", p: [
        "Veja a Política de Privacidade, no menu do perfil. Lá também está como pedir a exclusão dos seus dados."
    ] },
    { t: "Ainda precisa de ajuda?", p: [
        "Escreva para " + EMAIL_CONTATO + ". Vamos responder assim que possível."
    ] }
];

function lerPerfil() {
    var p = lerDados(CH_PERFIL, {});
    return { nome: p.nome || "", usuario: p.usuario || "", sobre: p.sobre || "", foto: p.foto || "" };
}

function lerConfig() {
    var c = lerDados(CH_CONFIG, {});
    var n = c.notif || {};
    return {
        tema: c.tema || "auto",
        tamanho: c.tamanho || "m",
        fonte: c.fonte || "serifa",
        notif: { comentarios: n.comentarios !== false, curtidas: n.curtidas !== false, capitulos: n.capitulos !== false }
    };
}

function salvarConfig(c) {
    return gravar(CH_CONFIG, c);
}

// ----- Modo escuro -----
function aplicarTema() {
    var tema = lerConfig().tema;
    var escuro = false;
    if (tema === "escuro") escuro = true;
    else if (tema === "auto" && window.matchMedia) escuro = !!window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.body.classList.toggle("escuro", escuro);
}

// ----- Foto e nome nas telas -----
function desenharAvatares() {
    var p = lerPerfil();
    var foto = imagemSegura(p.foto);
    var inicial = p.nome ? p.nome.charAt(0).toUpperCase() : "👤";
    var lista = document.querySelectorAll(".avatar");
    for (var i = 0; i < lista.length; i++) {
        if (foto) {
            lista[i].style.backgroundImage = "url(" + foto + ")";
            lista[i].textContent = "";
        } else {
            lista[i].style.backgroundImage = "";
            lista[i].textContent = inicial;
        }
    }
}

function desenharPerfil() {
    var p = lerPerfil();
    pegar("perfilNome").textContent = p.nome || "Seu perfil";
    pegar("perfilUsuario").textContent = p.usuario ? "@" + p.usuario : "Toque em Editar perfil para escolher seu nome";
    pegar("perfilSobre").textContent = p.sobre;
    var linkPublico = pegar("perfilPublicoBtn");
    if (linkPublico) {
        linkPublico.style.display = usuarioLogado ? "block" : "none";
        if (usuarioLogado) linkPublico.href = "#autor-" + usuarioLogado.id;
    }
    var areaSelo = pegar("perfilSelo");
    areaSelo.innerHTML = "";
    var num = usuarioLogado && FUNDADORES[usuarioLogado.id];
    if (num) areaSelo.appendChild(blocoSeloGrande(num));
}

function blocoSeloGrande(num) {
    var linha = criar("div", "selo-linha");
    var img = document.createElement("img");
    img.src = "selos/selo-fundador.svg";
    img.alt = "Selo Escritor Fundador";
    img.onerror = function () { img.remove(); };
    linha.appendChild(img);
    var t = criar("div", "");
    t.appendChild(criar("strong", "", "Escritor Fundador"));
    t.appendChild(criar("span", "ajuda", "Nº " + num + " de 30"));
    linha.appendChild(t);
    return linha;
}

function mostrarResgate() {
    var num = usuarioLogado && FUNDADORES[usuarioLogado.id];
    var atual = pegar("fundadorAtual");
    atual.innerHTML = "";
    if (num) atual.appendChild(blocoSeloGrande(num));
    pegar("fundadorResgate").style.display = num ? "none" : "";
    pegar("avisoConvite").textContent = "";
}

async function resgatarConvite() {
    var aviso = pegar("avisoConvite");
    function msg(texto, ok) { aviso.className = "aviso " + (ok ? "ok" : "erro"); aviso.textContent = texto; }
    if (!usuarioLogado) { msg("Entre na sua conta para resgatar o código.", false); return; }
    var codigo = pegar("campoConvite").value.trim().toUpperCase();
    if (!codigo) { msg("Digite o código do convite.", false); return; }
    var r = await db.rpc("resgatar_convite", { p_codigo: codigo });
    if (r.error) {
        var m = r.error.message || "";
        if (m.indexOf("ja_fundador") !== -1) msg("Esta conta já tem o selo de Fundador.", false);
        else if (m.indexOf("sem conex") !== -1) msg("Sem conexão. Tente de novo.", false);
        else msg("Esse código não é válido ou já foi usado.", false);
        return;
    }
    FUNDADORES[usuarioLogado.id] = r.data;
    pegar("campoConvite").value = "";
    mostrarResgate();
    desenharPerfil();
    msg("Parabéns! Você é o Escritor Fundador nº " + r.data + ".", true);
}

// ----- Perfil e conta -----
function mostrarFotoEdicao() {
    var a = pegar("avatarEdicao");
    var foto = imagemSegura(fotoPerfil);
    if (foto) {
        a.style.backgroundImage = "url(" + foto + ")";
        a.textContent = "";
    } else {
        var nome = pegar("perfNome").value.trim();
        a.style.backgroundImage = "";
        a.textContent = nome ? nome.charAt(0).toUpperCase() : "?";
    }
}

function prepararEditarPerfil() {
    var p = lerPerfil();
    pegar("perfNome").value = p.nome;
    pegar("perfUsuario").value = p.usuario;
    pegar("perfSobre").value = p.sobre;
    fotoPerfil = p.foto;
    mostrarFotoEdicao();
    pegar("avisoPerfil").textContent = "";
    var linkPublico = pegar("perfilPublicoEdicao");
    if (linkPublico) {
        linkPublico.style.display = usuarioLogado ? "block" : "none";
        if (usuarioLogado) linkPublico.href = "#autor-" + usuarioLogado.id;
    }
    mostrarResgate();
}

pegar("campoFoto").addEventListener("change", function () {
    var arquivo = this.files[0];
    if (!arquivo) return;

    var leitor = new FileReader();
    leitor.onload = function () {
        var img = new Image();
        img.onload = function () {
            // corta um quadrado no centro da imagem e reduz
            var lado = Math.min(img.width, img.height);
            var quadro = document.createElement("canvas");
            quadro.width = 256;
            quadro.height = 256;
            quadro.getContext("2d").drawImage(img, (img.width - lado) / 2, (img.height - lado) / 2, lado, lado, 0, 0, 256, 256);
            fotoPerfil = quadro.toDataURL("image/jpeg", 0.85);
            mostrarFotoEdicao();
        };
        img.src = leitor.result;
    };
    leitor.readAsDataURL(arquivo);
});

function removerFoto() {
    fotoPerfil = "";
    mostrarFotoEdicao();
}

async function salvarPerfil() {
    var nome = pegar("perfNome").value.trim();
    var usuario = pegar("perfUsuario").value.trim().toLowerCase().replace(/^@/, "");
    var sobre = pegar("perfSobre").value.trim();

    if (usuario && !/^[a-z0-9_.]{3,20}$/.test(usuario)) {
        aviso("avisoPerfil", "O nome de usuário precisa ter de 3 a 20 caracteres: letras sem acento, números, _ ou ponto.", true);
        return;
    }

    if (!gravar(CH_PERFIL, { nome: nome, usuario: usuario, sobre: sobre, foto: fotoPerfil })) {
        aviso("avisoPerfil", "Não foi possível salvar. Tente uma foto menor.", true);
        return;
    }

    desenharAvatares();
    desenharPerfil();

    if (usuarioLogado) {
        var r = await db.from("perfis").upsert({ id: usuarioLogado.id, nome: nome, usuario: usuario || null, sobre: sobre, foto: fotoPerfil || null });
        if (r.error) {
            aviso("avisoPerfil", r.error.code === "23505" ? "Esse nome de usuário já está em uso." : "Salvo aqui, mas não foi possível salvar na conta.", true);
            return;
        }
        NOMES[usuarioLogado.id] = nome || usuario || "Autor";
        aviso("avisoPerfil", "Perfil salvo na sua conta.", false);
    } else {
        aviso("avisoPerfil", "Perfil salvo neste aparelho. Entre na conta para guardá-lo online.", false);
    }
}

function apagarDadosDoAparelho() {
    if (!confirm("Apagar os dados deste aparelho (preferências e textos não salvos)? Suas histórias na conta continuam online.")) return;

    try {
        var chaves = [];
        for (var i = 0; i < localStorage.length; i++) {
            var chave = localStorage.key(i);
            if (chave.indexOf("webnovel_") === 0) chaves.push(chave);
        }
        chaves.forEach(function (chave) { localStorage.removeItem(chave); });
    } catch (erro) { }

    location.hash = "inicio";
    if (location.reload) location.reload();
}

// ----- Aparência e leitura -----
function montarOpcoes(idArea, nome, lista, atual, aoEscolher) {
    var area = pegar(idArea);
    area.innerHTML = "";
    lista.forEach(function (item) {
        var rotulo = criar("label", "opcao");
        var radio = document.createElement("input");
        radio.type = "radio";
        radio.name = nome;
        radio.value = item[0];
        radio.checked = (item[0] === atual);
        radio.addEventListener("change", function () { aoEscolher(item[0]); });
        rotulo.appendChild(radio);
        rotulo.appendChild(document.createTextNode(" " + item[1]));
        area.appendChild(rotulo);
    });
}

function aplicarAmostra() {
    var c = lerConfig();
    pegar("lerAmostra").className = "leitura-texto amostra tam-" + c.tamanho + " fonte-" + c.fonte;
}

function prepararPreferencias() {
    var c = lerConfig();

    montarOpcoes("opcoesTema", "tema", [["auto", "Automático"], ["claro", "Claro"], ["escuro", "Escuro"]], c.tema, function (v) {
        var x = lerConfig();
        x.tema = v;
        salvarConfig(x);
        aplicarTema();
    });

    montarOpcoes("opcoesTamanho", "tamanho", [["p", "Pequeno"], ["m", "Médio"], ["g", "Grande"]], c.tamanho, function (v) {
        var x = lerConfig();
        x.tamanho = v;
        salvarConfig(x);
        aplicarAmostra();
    });

    montarOpcoes("opcoesFonte", "fonte", [["serifa", "Com serifa"], ["simples", "Simples"]], c.fonte, function (v) {
        var x = lerConfig();
        x.fonte = v;
        salvarConfig(x);
        aplicarAmostra();
    });

    aplicarAmostra();
}

// ----- Notificações -----
function prepararNotificacoes() {
    var c = lerConfig();
    var area = pegar("listaNotif");
    area.innerHTML = "";

    [["comentarios", "Comentários nas minhas histórias"], ["curtidas", "Curtidas nas minhas histórias"], ["capitulos", "Novos capítulos de histórias que acompanho"]].forEach(function (item) {
        var rotulo = criar("label", "decl");
        var caixa = document.createElement("input");
        caixa.type = "checkbox";
        caixa.checked = c.notif[item[0]];
        caixa.addEventListener("change", function () {
            var x = lerConfig();
            x.notif[item[0]] = caixa.checked;
            salvarConfig(x);
        });
        rotulo.appendChild(caixa);
        rotulo.appendChild(criar("span", "", item[1]));
        area.appendChild(rotulo);
    });
}

/* =====================================================
   SESSÃO DA CONTA (Supabase)
===================================================== */
async function carregarPerfilDaConta() {
    if (!usuarioLogado) return;
    await carregarFundadores([usuarioLogado.id]);
    atualizarMeusSeguidores();
    var r = await db.from("perfis").select("*").eq("id", usuarioLogado.id).maybeSingle();

    if (r.data) {
        NOMES[usuarioLogado.id] = r.data.nome || r.data.usuario || "Autor";
        gravar(CH_PERFIL, { nome: r.data.nome || "", usuario: r.data.usuario || "", sobre: r.data.sobre || "", foto: r.data.foto || "" });
        return;
    }

    // Conta sem perfil ainda (por exemplo, criada com confirmação de e-mail): cria agora
    var meta = (usuarioLogado.user_metadata && usuarioLogado.user_metadata.usuario) || "";
    if (meta && /^[a-z0-9_.]{3,20}$/.test(meta)) {
        var n = await db.from("perfis").upsert({ id: usuarioLogado.id, nome: meta, usuario: meta });
        if (!n.error) {
            NOMES[usuarioLogado.id] = meta;
            gravar(CH_PERFIL, { nome: meta, usuario: meta, sobre: "", foto: "" });
        }
    }
}

function atualizarBotaoConta() {
    var b = pegar("btnConta");
    var topoEntrar = pegar("btnEntrarTopo");
    var topoAvatar = pegar("btnAvatarTopo");
    var gaveta = pegar("drawerConta");

    topoEntrar.style.display = usuarioLogado ? "none" : "inline-block";
    topoAvatar.style.display = usuarioLogado ? "flex" : "none";

    if (usuarioLogado) {
        b.textContent = "Sair da conta";
        b.setAttribute("href", "#perfil");
        b.onclick = async function () { await db.auth.signOut(); };
        gaveta.textContent = "🚪 Sair";
        gaveta.setAttribute("href", "#perfil");
        gaveta.onclick = async function () { fecharGaveta(); await db.auth.signOut(); };
    } else {
        b.textContent = "Entrar ou criar conta";
        b.setAttribute("href", "#entrar");
        b.onclick = null;
        gaveta.textContent = "🔑 Entrar";
        gaveta.setAttribute("href", "#entrar");
        gaveta.onclick = fecharGaveta;
    }
}

var idAnterior;

db.auth.onAuthStateChange(function (evento, sessao) {
    var novo = (sessao && sessao.user) ? sessao.user : null;
    var novoId = novo ? novo.id : null;
    usuarioLogado = novo;

    // Só refaz as telas quando a pessoa muda (entrou ou saiu), não a cada renovação da sessão
    if (novoId === idAnterior) return;
    idAnterior = novoId;

    setTimeout(async function () {
        if (!novoId) {
            gravar(CH_PERFIL, {});
            minhaHistoria = null;
            meusCapitulos = [];
        }
        atualizarBotaoConta();
        await carregarPerfilDaConta();
        await carregarMinhaHistoria();
        await verificarAdmin();
        await atualizarContadorNotificacoes();
        ultimaCargaHist = 0;
        rota();
    }, 0);
});

desenharLegal("textoAjuda", "Ajuda e suporte", AJUDA);
pegar("linkSuporte").href = "mailto:" + EMAIL_CONTATO;

montarMotivos();
montarDeclaracao();
montarGeneros();
montarPartes();
desenharChips("chipsInicio", "inicio");
desenharChips("chips", "busca");
rota();
if (semConexao) mostrarErroNaTela("Não foi possível carregar o servidor. Verifique a internet e recarregue a página.");


/* =====================================================
   EXCLUIR A PRÓPRIA CONTA
   A exclusão acontece no Supabase (função excluir_minha_conta).
===================================================== */
function limparDadosLocais() {
    try {
        var chaves = [];
        for (var i = 0; i < localStorage.length; i++) {
            var chave = localStorage.key(i);
            if (chave.indexOf("webnovel_") === 0) chaves.push(chave);
        }
        chaves.forEach(function (chave) { localStorage.removeItem(chave); });
    } catch (erro) { }
}

function prepararExcluirConta() {
    var logado = !!usuarioLogado;
    pegar("excluirForm").style.display = logado ? "block" : "none";
    pegar("excluirDeslogado").style.display = logado ? "none" : "block";
    pegar("excSenha").value = "";
    pegar("excConfirma").value = "";
    pegar("avisoExcluir").textContent = "";
    pegar("btnExcluirConta").disabled = false;
    pegar("linkExcluirEmail").href = "mailto:" + EMAIL_CONTATO + "?subject=" +
        encodeURIComponent("Pedido de exclusão de conta - Portal Novel") +
        "&body=" + encodeURIComponent("Quero excluir a minha conta no Portal Novel.\n\nE-mail do cadastro:\nNome de usuário:");
}

async function excluirMinhaConta() {
    if (!usuarioLogado) { aviso("avisoExcluir", "Entre na sua conta para excluir.", true); return; }

    var senha = pegar("excSenha").value;
    var conf = pegar("excConfirma").value.trim().toUpperCase();
    if (!senha) { aviso("avisoExcluir", "Digite a sua senha.", true); return; }
    if (conf !== "EXCLUIR") { aviso("avisoExcluir", "Digite EXCLUIR para confirmar.", true); return; }

    var botao = pegar("btnExcluirConta");
    botao.disabled = true;
    aviso("avisoExcluir", "Conferindo a senha...", false);

    var v = await db.auth.signInWithPassword({ email: usuarioLogado.email, password: senha });
    if (v.error) {
        aviso("avisoExcluir", "Senha incorreta.", true);
        botao.disabled = false;
        return;
    }

    if (!confirm("Última confirmação: excluir a sua conta e todas as suas histórias para sempre?")) {
        aviso("avisoExcluir", "", false);
        botao.disabled = false;
        return;
    }

    aviso("avisoExcluir", "Excluindo...", false);
    var r = await db.rpc("excluir_minha_conta");
    if (r.error) {
        if (window.console) console.error("excluir_minha_conta:", r.error);
        aviso("avisoExcluir", "Não foi possível excluir agora. Tente de novo ou peça por e-mail.", true);
        botao.disabled = false;
        return;
    }

    try { await db.auth.signOut({ scope: "local" }); } catch (erro) { }
    limparDadosLocais();
    alert("Sua conta foi excluída.");
    location.hash = "inicio";
    if (location.reload) location.reload();
}

/* =====================================================
   GESTÃO (só administrador)
   Esta tela só mostra o que o Supabase entrega. Quem não é admin recebe "acesso negado" lá.
===================================================== */
var souAdmin = false;
var abaGestao = "resumo";

async function verificarAdmin() {
    souAdmin = false;
    if (usuarioLogado) {
        var r = await db.rpc("eh_admin");
        souAdmin = !!(r && !r.error && r.data === true);
    }
    var item = pegar("itemGestao");
    if (item) item.style.display = souAdmin ? "" : "none";
}

var adminErro = false;

async function chamarAdmin(nome, args) {
    var r = await db.rpc(nome, args || {});
    adminErro = !!r.error;
    if (r.error) {
        aviso("avisoGestao", "Erro: " + (r.error.message || "tente de novo"), true);
        return null;
    }
    aviso("avisoGestao", "", false);
    return r.data;
}

async function prepararGestao(token) {
    var acesso = pegar("gestaoAcesso");
    var corpo = pegar("gestaoCorpo");
    acesso.innerHTML = "";
    corpo.style.display = "none";
    pegar("avisoGestao").textContent = "";

    if (!usuarioLogado) {
        var b1 = criar("div", "bloco");
        b1.appendChild(criar("p", "ajuda", "Entre na sua conta para continuar."));
        var l1 = criar("a", "btn", "Entrar");
        l1.href = "#entrar";
        b1.appendChild(l1);
        acesso.appendChild(b1);
        return;
    }

    if (!souAdmin) await verificarAdmin();
    if (token !== tokenRota) return;

    if (!souAdmin) {
        var b2 = criar("div", "bloco");
        b2.appendChild(criar("p", "ajuda", "Acesso restrito."));
        acesso.appendChild(b2);
        return;
    }

    corpo.style.display = "block";
    desenharAbasGestao();
    abrirAbaGestao(abaGestao);
}

function desenharAbasGestao() {
    var area = pegar("abasGestao");
    area.innerHTML = "";
    [["resumo", "Resumo"], ["denuncias", "Denúncias"], ["usuarios", "Usuários"], ["historias", "Histórias"], ["anuncios", "Concursos / avisos"]].forEach(function (a) {
        var chip = criar("button", "chip" + (a[0] === abaGestao ? " ativo" : ""), a[1]);
        chip.type = "button";
        chip.addEventListener("click", function () { abrirAbaGestao(a[0]); });
        area.appendChild(chip);
    });
}

async function abrirAbaGestao(aba) {
    abaGestao = aba;
    desenharAbasGestao();
    var area = pegar("gestaoConteudo");
    area.innerHTML = "";
    area.appendChild(criar("p", "vazio", "Carregando..."));
    if (aba === "resumo") await gestaoResumo();
    if (aba === "denuncias") await gestaoDenuncias();
    if (aba === "usuarios") await gestaoUsuarios("");
    if (aba === "historias") await gestaoHistorias("");
    if (aba === "anuncios") gestaoAnuncios();
}

function linhaInfo(rotulo, valor) {
    var p = criar("p", "ajuda");
    p.style.margin = "4px 0";
    var forte = criar("strong", "", rotulo + ": ");
    p.appendChild(forte);
    p.appendChild(document.createTextNode(String(valor === null || valor === undefined || valor === "" ? "-" : valor)));
    return p;
}

function botaoGestao(texto, classe, aoClicar) {
    var b = criar("button", "btn mini " + classe, texto);
    b.type = "button";
    b.addEventListener("click", aoClicar);
    return b;
}

async function gestaoResumo() {
    var d = await chamarAdmin("admin_resumo");
    var area = pegar("gestaoConteudo");
    area.innerHTML = "";
    if (!d) return;
    var bloco = criar("div", "bloco");
    bloco.appendChild(criar("h3", "", "Visão geral"));
    bloco.appendChild(linhaInfo("Contas", d.usuarios));
    bloco.appendChild(linhaInfo("Histórias publicadas", d.historias_publicadas));
    bloco.appendChild(linhaInfo("Leituras no total", d.leituras));
    bloco.appendChild(linhaInfo("Denúncias em aberto", d.denuncias_abertas));
    bloco.appendChild(linhaInfo("Contas banidas", d.banidos));
    area.appendChild(bloco);
}

async function gestaoDenuncias() {
    var lista = await chamarAdmin("admin_denuncias");
    var area = pegar("gestaoConteudo");
    area.innerHTML = "";
    if (!lista) return;
    if (!lista.length) { area.appendChild(criar("p", "vazio", "Nenhuma denúncia.")); return; }

    lista.forEach(function (d) {
        var bloco = criar("div", "bloco");
        var ehComentario = !!d.comentario_id;
        var contextoCapitulo = !ehComentario && /^\[Capítulo:/i.test(d.detalhes || "");
        var topo = criar("strong", "", (ehComentario ? "Comentário em: " : (contextoCapitulo ? "Denúncia de capítulo em: " : "História: ")) + (d.historia_titulo || "(removida)"));
        bloco.appendChild(topo);
        bloco.appendChild(criar("span", "selo" + (d.resolvida ? " ok" : ""), d.resolvida ? "Resolvida" : "Aberta"));
        bloco.appendChild(linhaInfo("Motivo", d.motivo));
        if (d.detalhes) bloco.appendChild(linhaInfo("Detalhes", d.detalhes));
        bloco.appendChild(linhaInfo("Denunciado por", d.denunciante_nome));
        if (d.criado_em) bloco.appendChild(linhaInfo("Data", dataBonita(d.criado_em)));
        if (ehComentario) {
            bloco.appendChild(linhaInfo("Comentário", d.comentario_texto || "(já apagado)"));
            bloco.appendChild(linhaInfo("Autor do comentário", d.comentario_autor_nome));
        } else {
            bloco.appendChild(linhaInfo("Autor da história", d.autor_nome));
        }

        var botoes = criar("div", "botoes");
        botoes.style.cssText = "display:flex;flex-wrap:wrap;gap:8px;margin-top:10px";

        if (d.historia_id) {
            var ver = criar("a", "btn claro mini", "Ver história");
            ver.href = "#livro-" + d.historia_id;
            botoes.appendChild(ver);
        }
        if (ehComentario && d.comentario_texto) {
            botoes.appendChild(botaoGestao("Apagar comentário", "perigo", async function () {
                if (!confirm("Apagar este comentário?")) return;
                await chamarAdmin("admin_apagar_comentario", { p_id: String(d.comentario_id) });
                if (!adminErro) { await gestaoDenuncias(); aviso("avisoGestao", "Comentário apagado.", false); }
            }));
        }
        if (!ehComentario && d.historia_id) {
            botoes.appendChild(botaoGestao(contextoCapitulo ? "Despublicar história relacionada" : "Despublicar história", "perigo", async function () {
                if (!confirm("Tirar esta história do ar?")) return;
                await chamarAdmin("admin_despublicar_historia", { p_id: String(d.historia_id) });
                if (!adminErro) aviso("avisoGestao", "História despublicada.", false);
            }));
            botoes.appendChild(botaoGestao("Excluir história definitivamente", "perigo", async function () {
                var confirmacao = prompt("Esta ação apaga a história e seus capítulos. Digite EXCLUIR para confirmar:");
                if (confirmacao !== "EXCLUIR") return;
                await chamarAdmin("admin_excluir_historia", { p_id: Number(d.historia_id) });
                if (!adminErro) { aviso("avisoGestao", "História e capítulos excluídos.", false); await gestaoDenuncias(); }
            }));
        }
        var alvoBan = ehComentario ? d.comentario_autor_id : d.autor_id;
        var nomeBan = ehComentario ? d.comentario_autor_nome : d.autor_nome;
        if (alvoBan) {
            botoes.appendChild(botaoGestao("Banir autor", "perigo", function () { banirUsuario(alvoBan, nomeBan, gestaoDenuncias); }));
        }
        if (!d.resolvida) {
            botoes.appendChild(botaoGestao("Marcar resolvida", "", async function () {
                await chamarAdmin("admin_resolver_denuncia", { p_id: String(d.id) });
                if (!adminErro) gestaoDenuncias();
            }));
        }
        bloco.appendChild(botoes);
        area.appendChild(bloco);
    });
}

async function banirUsuario(id, nome, depois) {
    var motivo = prompt("Banir " + (nome || "este usuário") + "? Escreva o motivo (fica registrado). Cancelar para desistir.");
    if (motivo === null) return;
    await chamarAdmin("admin_banir", { p_user: id, p_motivo: motivo });
    if (!adminErro) {
        if (depois) await depois();
        aviso("avisoGestao", "Usuário banido e histórias despublicadas.", false);
    }
}

async function gestaoUsuarios(busca) {
    var lista = await chamarAdmin("admin_usuarios", { p_busca: busca });
    var area = pegar("gestaoConteudo");
    area.innerHTML = "";

    var caixa = criar("div", "bloco");
    var campo = document.createElement("input");
    campo.type = "text";
    campo.placeholder = "Buscar por nome, usuário ou e-mail";
    campo.value = busca || "";
    caixa.appendChild(campo);
    var ir = criar("button", "btn mini", "Buscar");
    ir.type = "button";
    ir.style.marginTop = "10px";
    ir.addEventListener("click", function () { gestaoUsuarios(campo.value.trim()); });
    caixa.appendChild(ir);
    area.appendChild(caixa);

    if (!lista) return;
    if (!lista.length) { area.appendChild(criar("p", "vazio", "Nenhum usuário encontrado.")); return; }

    lista.forEach(function (u) {
        var bloco = criar("div", "bloco");
        bloco.appendChild(criar("strong", "", (u.nome || "(sem nome)") + (u.usuario ? "  @" + u.usuario : "")));
        if (u.banido) bloco.appendChild(criar("span", "selo", "Banido"));
        if (u.admin) bloco.appendChild(criar("span", "selo ok", "Admin"));
        bloco.appendChild(linhaInfo("E-mail", u.email));
        bloco.appendChild(linhaInfo("Criada em", dataBonita(u.criado_em)));
        bloco.appendChild(linhaInfo("Histórias", u.historias));
        if (u.banido && u.motivo_ban) bloco.appendChild(linhaInfo("Motivo do ban", u.motivo_ban));

        if (!u.admin) {
            var botoes = criar("div", "botoes");
            botoes.style.cssText = "display:flex;flex-wrap:wrap;gap:8px;margin-top:10px";
            if (u.banido) {
                botoes.appendChild(botaoGestao("Desbanir", "claro", async function () {
                    if (!confirm("Desbanir este usuário? As histórias continuam despublicadas.")) return;
                    await chamarAdmin("admin_desbanir", { p_user: u.id });
                    if (!adminErro) await gestaoUsuarios(busca);
                }));
            } else {
                botoes.appendChild(botaoGestao("Banir", "perigo", function () { banirUsuario(u.id, u.nome || u.usuario, function () { gestaoUsuarios(busca); }); }));
            }
            bloco.appendChild(botoes);
        }
        area.appendChild(bloco);
    });
}

/* =====================================================
   APP INSTALÁVEL (PWA)
   Precisa dos arquivos manifest.json, sw.js e dos ícones na mesma pasta do index.html.
===================================================== */
var eventoInstalar = null;

function jaInstalado() {
    return (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || window.navigator.standalone === true;
}

if ("serviceWorker" in navigator && location.protocol.indexOf("http") === 0) {
    window.addEventListener("load", function () {
        navigator.serviceWorker.register("sw.js").catch(function () { });
    });
}

window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    eventoInstalar = e;
    if (!jaInstalado()) {
        pegar("textoInstalar").textContent = "Adicione o Portal Novel à tela inicial do seu celular e abra como um aplicativo.";
        pegar("btnInstalar").style.display = "block";
        pegar("blocoInstalar").style.display = "block";
    }
});

window.addEventListener("appinstalled", function () {
    eventoInstalar = null;
    pegar("blocoInstalar").style.display = "none";
});

// iPhone/iPad não tem botão de instalar: o jeito é pelo menu Compartilhar do Safari
if (/iphone|ipad|ipod/i.test(navigator.userAgent) && !jaInstalado()) {
    pegar("textoInstalar").textContent = "No iPhone: toque em Compartilhar (quadrado com seta) e depois em Adicionar à Tela de Início.";
    pegar("btnInstalar").style.display = "none";
    pegar("blocoInstalar").style.display = "block";
}

async function instalarApp() {
    if (!eventoInstalar) return;
    eventoInstalar.prompt();
    try { await eventoInstalar.userChoice; } catch (erro) { }
    eventoInstalar = null;
    pegar("blocoInstalar").style.display = "none";
}


/* =====================================================
   AVISO DE DIREITOS AUTORAIS AO ENTRAR EM ESCREVER
===================================================== */
(function configurarAvisoDireitos() {
    var modal = document.getElementById("avisoDireitos");
    var check = document.getElementById("confirmarDireitos");
    var aceitar = document.getElementById("aceitarDireitos");
    var cancelar = document.getElementById("cancelarDireitos");
    if (!modal || !check || !aceitar || !cancelar) return;

    function fecharAviso() {
        modal.classList.remove("aberto");
        modal.setAttribute("aria-hidden", "true");
        check.checked = false;
        aceitar.disabled = true;
    }

    document.addEventListener("click", function (evento) {
        var link = evento.target.closest && evento.target.closest('a[href="#escrever"]');
        if (!link) return;
        evento.preventDefault();
        evento.stopPropagation();
        modal.classList.add("aberto");
        modal.setAttribute("aria-hidden", "false");
        check.checked = false;
        aceitar.disabled = true;
        check.focus();
    }, true);

    check.addEventListener("change", function () {
        aceitar.disabled = !check.checked;
    });

    cancelar.addEventListener("click", fecharAviso);
    aceitar.addEventListener("click", function () {
        if (!check.checked) return;
        fecharAviso();
        if (location.hash !== "#escrever") location.hash = "escrever";
    });

    modal.addEventListener("click", function (evento) {
        if (evento.target === modal) fecharAviso();
    });
})();


/* =====================================================
   COMUNIDADE: SEGUIDORES, NOTIFICAÇÕES, MENSAGENS E ADMIN
   Requer executar supabase/portal-novel-comunidade.sql no SQL Editor.
===================================================== */
function avisoComunidade(area, texto, erro) {
    if (!area) return;
    area.textContent = texto || "";
    area.className = erro ? "aviso erro" : "aviso";
}

async function carregarListaSeguidores() {
    var area = pegar("listaMeusSeguidores");
    if (!area) return;
    area.innerHTML = "";
    if (!usuarioLogado) { area.appendChild(criar("p", "vazio", "Entre na sua conta para ver seus seguidores.")); return; }
    area.appendChild(criar("p", "vazio", "Carregando seguidores..."));
    var r = await db.from("seguidores").select("seguidor_id").eq("autor_id", usuarioLogado.id);
    area.innerHTML = "";
    if (r.error) { area.appendChild(criar("p", "vazio", "Não foi possível carregar seguidores. Confira as políticas RLS e a migração do banco.")); return; }
    var ids = (r.data || []).map(function (x) { return x.seguidor_id; });
    if (!ids.length) { area.appendChild(criar("p", "vazio", "Você ainda não tem seguidores.")); return; }
    var perfis = await db.from("perfis").select("id,nome,usuario,foto,sobre").in("id", ids);
    if (perfis.error) { area.appendChild(criar("p", "vazio", "Não foi possível carregar os perfis.")); return; }
    var mapa = {};
    (perfis.data || []).forEach(function (x) { mapa[x.id] = x; });
    ids.forEach(function (id) {
        var u = mapa[id]; if (!u) return;
        var bloco = criar("div", "bloco follower-row");
        var avatar = criar("div", "follower-avatar", "👤");
        if (u.foto) { avatar.style.backgroundImage = "url('" + String(u.foto).replace(/'/g, "%27") + "')"; avatar.textContent = ""; }
        bloco.appendChild(avatar);
        var info = criar("div", "follower-info");
        info.appendChild(criar("strong", "", u.nome || u.usuario || "Leitor"));
        info.appendChild(criar("p", "ajuda", u.usuario ? "@" + u.usuario : "Membro do Portal Novel"));
        bloco.appendChild(info);
        var a = criar("a", "btn claro mini", "Ver perfil"); a.href = "#autor-" + u.id; bloco.appendChild(a);
        var m = criar("button", "btn mini", "Mensagem"); m.type = "button"; m.addEventListener("click", function () { location.hash = "conversa-" + u.id; }); bloco.appendChild(m);
        area.appendChild(bloco);
    });
}

async function atualizarContadorNotificacoes() {
    var badge = pegar("contadorNotificacoes");
    if (!badge) return;
    if (!usuarioLogado) { badge.style.display = "none"; return; }
    var r = await db.from("notificacoes").select("id", { count: "exact", head: true }).eq("user_id", usuarioLogado.id).is("read_at", null);
    if (r.error) { badge.style.display = "none"; return; }
    var n = Number(r.count || 0);
    badge.textContent = n > 99 ? "99+" : String(n);
    badge.style.display = n ? "inline-flex" : "none";
}

async function carregarAvisos() {
    var area = pegar("listaAvisos");
    if (!area) return;
    area.innerHTML = "";
    if (!usuarioLogado) { area.appendChild(criar("p", "vazio", "Entre na sua conta para receber notificações.")); return; }
    area.appendChild(criar("p", "vazio", "Carregando notificações..."));
    var r = await db.from("notificacoes").select("id,actor_id,tipo,titulo,mensagem,dados,created_at,read_at").eq("user_id", usuarioLogado.id).order("created_at", { ascending: false }).limit(100);
    area.innerHTML = "";
    if (r.error) { area.appendChild(criar("p", "vazio", "Não foi possível carregar notificações. Execute a migração SQL no Supabase.")); return; }
    if (!r.data || !r.data.length) { area.appendChild(criar("p", "vazio", "Nenhuma notificação por enquanto.")); await atualizarContadorNotificacoes(); return; }
    r.data.forEach(function (n) {
        var item = criar("article", "bloco notification-item" + (n.read_at ? " lida" : " nao-lida"));
        item.appendChild(criar("strong", "", n.titulo || "Notificação"));
        var textoAviso = n.mensagem || "";
        if (n.dados && n.dados.prazo) textoAviso += "\nPrazo: " + dataBonita(n.dados.prazo);
        item.appendChild(criar("p", "", textoAviso));
        item.appendChild(criar("small", "ajuda", n.created_at ? dataBonita(n.created_at) : ""));
        if (!n.read_at) {
            var lido = criar("button", "btn claro mini", "Marcar como lida"); lido.type = "button";
            lido.addEventListener("click", async function () {
                var up = await db.from("notificacoes").update({ read_at: new Date().toISOString() }).eq("id", n.id).eq("user_id", usuarioLogado.id);
                if (!up.error) { item.classList.remove("nao-lida"); item.classList.add("lida"); lido.remove(); await atualizarContadorNotificacoes(); }
            });
            item.appendChild(lido);
        }
        var dados = n.dados || {};
        if (dados.url) { var link = criar("a", "btn claro mini", "Abrir"); link.href = dados.url; item.appendChild(link); }
        area.appendChild(item);
    });
    await atualizarContadorNotificacoes();
}

async function marcarTodasNotificacoesLidas() {
    if (!usuarioLogado) return;
    var r = await db.from("notificacoes").update({ read_at: new Date().toISOString() }).eq("user_id", usuarioLogado.id).is("read_at", null);
    if (r.error) { alert("Não foi possível atualizar as notificações."); return; }
    await carregarAvisos();
}

async function buscarPessoasParaMensagem() {
    var area = pegar("resultadoPessoasMensagem");
    var termo = (pegar("buscarDestinatario").value || "").trim();
    area.innerHTML = "";
    if (!usuarioLogado) { area.appendChild(criar("p", "aviso erro", "Entre para enviar mensagens.")); return; }
    if (termo.length < 2) { area.appendChild(criar("p", "aviso", "Digite pelo menos 2 caracteres.")); return; }
    var limpo = termo.replace(/^@/, "").replace(/[%_]/g, "");
    var consulta = db.from("perfis").select("id,nome,usuario,foto");
    var r = termo.charAt(0) === "@" ? await consulta.ilike("usuario", "%" + limpo + "%").limit(15) : await consulta.ilike("nome", "%" + limpo + "%").limit(15);
    if (r.error) { area.appendChild(criar("p", "aviso erro", "Não foi possível buscar usuários.")); return; }
    var lista = (r.data || []).filter(function (u) { return u.id !== usuarioLogado.id; });
    if (!lista.length) { area.appendChild(criar("p", "vazio", "Nenhum usuário encontrado pelo nome.")); return; }
    lista.forEach(function (u) {
        var linha = criar("div", "follower-row");
        var nome = criar("strong", "", u.nome || u.usuario || "Usuário"); linha.appendChild(nome);
        var btn = criar("button", "btn mini", "Enviar mensagem"); btn.type = "button"; btn.addEventListener("click", function () { location.hash = "conversa-" + u.id; });
        linha.appendChild(btn); area.appendChild(linha);
    });
}

async function carregarConversas() {
    var area = pegar("listaConversas"); if (!area) return;
    area.innerHTML = "";
    if (!usuarioLogado) { area.appendChild(criar("p", "vazio", "Entre na sua conta para ver suas conversas.")); return; }
    area.appendChild(criar("p", "vazio", "Carregando conversas..."));
    var uid = usuarioLogado.id;
    var r = await db.from("mensagens_privadas").select("id,remetente_id,destinatario_id,texto,criado_em,lida_em").or("remetente_id.eq." + uid + ",destinatario_id.eq." + uid).order("criado_em", { ascending: false }).limit(200);
    area.innerHTML = "";
    if (r.error) { area.appendChild(criar("p", "vazio", "Não foi possível carregar mensagens. Confira a migração e as políticas RLS.")); return; }
    var ultimas = {};
    (r.data || []).forEach(function (m) { var outro = m.remetente_id === uid ? m.destinatario_id : m.remetente_id; if (!ultimas[outro]) ultimas[outro] = m; });
    var ids = Object.keys(ultimas);
    if (!ids.length) { area.appendChild(criar("p", "vazio", "Você ainda não tem conversas. Busque um usuário acima para começar.")); return; }
    var ps = await db.from("perfis").select("id,nome,usuario,foto").in("id", ids);
    var mapa = {}; (ps.data || []).forEach(function (p) { mapa[p.id] = p; });
    ids.forEach(function (id) {
        var p = mapa[id] || {}; var m = ultimas[id];
        var item = criar("button", "bloco conversation-row", ""); item.type = "button";
        var nome = p.nome || p.usuario || "Usuário";
        item.appendChild(criar("strong", "", nome));
        item.appendChild(criar("p", "ajuda", (m.remetente_id === uid ? "Você: " : "") + (m.texto || "").slice(0, 100)));
        item.appendChild(criar("small", "ajuda", dataBonita(m.criado_em)));
        item.addEventListener("click", function () { location.hash = "conversa-" + id; });
        area.appendChild(item);
    });
}

var destinatarioConversa = null;
async function mostrarConversa(id, token) {
    var area = pegar("historicoConversa"); if (!area) return;
    area.innerHTML = ""; destinatarioConversa = id;
    if (!usuarioLogado) { area.appendChild(criar("p", "vazio", "Entre para conversar.")); return; }
    if (!id || id === usuarioLogado.id) { area.appendChild(criar("p", "vazio", "Conversa inválida.")); return; }
    var p = await db.from("perfis").select("nome,usuario").eq("id", id).maybeSingle();
    if (token !== tokenRota) return;
    pegar("tituloConversa").textContent = "Conversa com " + (p.data ? (p.data.nome || p.data.usuario) : "usuário");
    var uid = usuarioLogado.id;
    var r = await db.from("mensagens_privadas").select("id,remetente_id,destinatario_id,texto,criado_em,lida_em").or("remetente_id.eq." + uid + ",destinatario_id.eq." + uid).order("criado_em", { ascending: true }).limit(500);
    if (token !== tokenRota) return;
    if (r.error) { area.appendChild(criar("p", "vazio", "Não foi possível carregar esta conversa.")); return; }
    var msgs = (r.data || []).filter(function (m) { return (m.remetente_id === uid && m.destinatario_id === id) || (m.remetente_id === id && m.destinatario_id === uid); });
    if (!msgs.length) area.appendChild(criar("p", "vazio", "Esta conversa começou agora. Envie a primeira mensagem."));
    msgs.forEach(function (m) {
        var bolha = criar("div", "message-bubble" + (m.remetente_id === uid ? " minha" : " recebida"));
        bolha.appendChild(criar("p", "", m.texto));
        bolha.appendChild(criar("small", "", dataBonita(m.criado_em)));
        area.appendChild(bolha);
    });
    await db.from("mensagens_privadas").update({ lida_em: new Date().toISOString() }).eq("remetente_id", id).eq("destinatario_id", uid).is("lida_em", null);
    area.scrollTop = area.scrollHeight;
}

async function enviarMensagemPrivada() {
    if (!usuarioLogado || !destinatarioConversa) { alert("Entre na sua conta para enviar mensagens."); return; }
    var campo = pegar("textoMensagem"); var texto = (campo.value || "").trim();
    if (!texto) return;
    var b = document.querySelector(".message-compose button"); if (b) b.disabled = true;
    var r = await db.from("mensagens_privadas").insert({ remetente_id: usuarioLogado.id, destinatario_id: destinatarioConversa, texto: texto });
    if (b) b.disabled = false;
    if (r.error) {
        var codErro = r.error.code || "", txtErro = r.error.message || "";
        if (/Muitas mensagens/i.test(txtErro)) alert("Muitas mensagens em pouco tempo. Aguarde um minuto.");
        else if (codErro === "42501" || /row-level security/i.test(txtErro)) alert("Você só pode escrever para quem segue você ou responder a quem já escreveu para você.");
        else alert("Não foi possível enviar. Confira a conexão e tente de novo.");
        return;
    }
    campo.value = "";
    await mostrarConversa(destinatarioConversa, tokenRota);
}

async function gestaoHistorias(busca) {
    var lista = await chamarAdmin("admin_listar_historias", { p_busca: busca || "" });
    var area = pegar("gestaoConteudo"); area.innerHTML = "";
    var box = criar("div", "bloco"); var input = document.createElement("input"); input.placeholder = "Buscar história pelo título"; input.value = busca || ""; box.appendChild(input);
    var bt = botaoGestao("Buscar", "", function () { gestaoHistorias(input.value.trim()); }); box.appendChild(bt); area.appendChild(box);
    if (!lista) return;
    if (!lista.length) { area.appendChild(criar("p", "vazio", "Nenhuma história encontrada.")); return; }
    lista.forEach(function (h) {
        var item = criar("div", "bloco"); item.appendChild(criar("strong", "", h.titulo || "Sem título"));
        item.appendChild(linhaInfo("Autor", h.autor_nome || h.autor_id)); item.appendChild(linhaInfo("Status", h.publicada ? "Publicada" : "Rascunho / despublicada"));
        item.appendChild(linhaInfo("Criada em", dataBonita(h.criado_em)));
        var actions = criar("div", "botoes");
        if (h.publicada) actions.appendChild(botaoGestao("Despublicar", "claro", async function () { await chamarAdmin("admin_despublicar_historia", { p_id: String(h.id) }); if (!adminErro) gestaoHistorias(busca); }));
        actions.appendChild(botaoGestao("Excluir definitivamente", "perigo", async function () {
            var c = prompt("Excluir '" + h.titulo + "' e todos os seus capítulos? Digite EXCLUIR:"); if (c !== "EXCLUIR") return;
            await chamarAdmin("admin_excluir_historia", { p_id: Number(h.id) }); if (!adminErro) { aviso("avisoGestao", "História excluída.", false); gestaoHistorias(busca); }
        }));
        item.appendChild(actions); area.appendChild(item);
    });
}

function gestaoAnuncios() {
    var area = pegar("gestaoConteudo"); area.innerHTML = "";
    var box = criar("div", "bloco"); box.appendChild(criar("h3", "", "Publicar concurso, premiação ou comunicado"));
    var l1 = criar("label", "rot", "Título do anúncio"); box.appendChild(l1);
    var titulo = document.createElement("input"); titulo.id = "tituloAnuncio"; titulo.maxLength = 120; titulo.placeholder = "Ex.: Concurso de fantasia 2026"; box.appendChild(titulo);
    box.appendChild(criar("label", "rot", "Descrição e regras"));
    var msg = document.createElement("textarea"); msg.id = "mensagemAnuncio"; msg.rows = 6; msg.maxLength = 5000; msg.placeholder = "Explique como participar, prazos e premiações..."; box.appendChild(msg);
    box.appendChild(criar("label", "rot", "Prazo (opcional)"));
    var prazo = document.createElement("input"); prazo.id = "prazoAnuncio"; prazo.type = "date"; box.appendChild(prazo);
    box.appendChild(criar("p", "ajuda", "O anúncio será enviado como notificação para todas as contas do Portal Novel."));
    var bt = botaoGestao("Enviar para todos os usuários", "", async function () {
        var t = titulo.value.trim(), m = msg.value.trim();
        if (!t || !m) { alert("Preencha o título e a descrição."); return; }
        if (!confirm("Enviar este anúncio para todos os usuários?")) return;
        await chamarAdmin("admin_publicar_anuncio", { p_titulo: t, p_mensagem: m, p_prazo: prazo.value || null });
        if (!adminErro) { aviso("avisoGestao", "Anúncio enviado para todos os usuários.", false); titulo.value = ""; msg.value = ""; prazo.value = ""; }
    });
    bt.style.width = "100%"; box.appendChild(bt); area.appendChild(box);
}


// Atualização periódica de notificações e conversas enquanto a página está aberta.
setInterval(function () {
    if (!usuarioLogado || document.hidden) return;
    atualizarContadorNotificacoes();
    var telaAtual = (location.hash || "#inicio").replace("#", "");
    if (telaAtual === "avisos") carregarAvisos();
    if (telaAtual === "mensagens") carregarConversas();
    if (telaAtual.indexOf("conversa-") === 0) mostrarConversa(telaAtual.substring(9), tokenRota);
}, 20000);
