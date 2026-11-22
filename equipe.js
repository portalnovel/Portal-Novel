if(!window._eqV2){
window._eqV2=true;
var souCurador=false,souModerador=false,abaCuradoria="algoritmo",abaModeracao="robo";
if(typeof TELAS!=="undefined"){if(TELAS.indexOf("curadoria")===-1)TELAS.push("curadoria");if(TELAS.indexOf("moderacao")===-1)TELAS.push("moderacao");}
async function verificarCargosEquipe(){
  souCurador=false;souModerador=false;
  if(usuarioLogado){
    var rc=await db.from("curadores").select("user_id").eq("user_id",usuarioLogado.id).maybeSingle();
    if(rc&&rc.data)souCurador=true;
    var rm=await db.from("equipe").select("funcao").eq("user_id",usuarioLogado.id).maybeSingle();
    if(rm&&rm.data){if(rm.data.funcao==="moderador")souModerador=true;if(rm.data.funcao==="curador")souCurador=true;}
  }
  if(pegar("itemCuradoria"))pegar("itemCuradoria").style.display=(souCurador||souAdmin)?"":"none";
  if(pegar("itemModeracao"))pegar("itemModeracao").style.display=(souModerador||souAdmin)?"":"none";
}
function checarTelasEquipe(){
  verificarCargosEquipe();
  var h=(location.hash||"").replace("#","");
  if(h==="curadoria")prepararCuradoria();
  if(h==="moderacao")prepararModeracao();
  if(h==="gestao")injetarBotoesAdmEquipe();
  if(h==="editarperfil")carregarRedeSocialEdicao();
  if(h.indexOf("autor-")===0)mostrarRedeSocialAutor(h.substring(6));
}
window.addEventListener("hashchange",checarTelasEquipe);
setInterval(verificarCargosEquipe,3000);
setTimeout(checarTelasEquipe,600);
async function carregarRedeSocialEdicao(){
  var inp=pegar("perfRedeSocial");if(!inp||!usuarioLogado)return;
  var r=await db.from("perfis").select("rede_social").eq("id",usuarioLogado.id).maybeSingle();
  inp.value=(r.data&&r.data.rede_social)||"";
}
document.addEventListener("click",async function(e){
  var b=e.target.closest&&e.target.closest("#tela-editarperfil button.btn");
  if(b&&b.textContent.indexOf("Salvar")!==-1&&usuarioLogado&&pegar("perfRedeSocial")){
    var link=pegar("perfRedeSocial").value.trim();
    if(link&&link.indexOf("http")!==0)link="https://"+link;
    await db.from("perfis").update({rede_social:link||null}).eq("id",usuarioLogado.id);
  }
},true);
async function mostrarRedeSocialAutor(uid){
  setTimeout(async function(){
    var cab=pegar("autorCabeca");if(!cab||pegar("linkRedeAutor"))return;
    var r=await db.from("perfis").select("rede_social").eq("id",uid).maybeSingle();
    var url=r.data&&r.data.rede_social;
    if(url&&/^https?:\/\//i.test(url)){
      var d=criar("div");d.id="linkRedeAutor";d.style.cssText="text-align:center;margin-top:8px";
      var a=criar("a","btn claro mini","🔗 Rede social do autor");a.href=url;a.target="_blank";a.rel="noopener noreferrer";
      d.appendChild(a);cab.appendChild(d);
    }
  },400);
}
function injetarBotoesAdmEquipe(){
  setTimeout(function(){
    var abas=pegar("abasGestao");if(!abas||pegar("btnAbaEq"))return;
    var b1=criar("button","chip","Equipe");b1.id="btnAbaEq";b1.onclick=function(){abrirPainelEquipeAdm();};abas.appendChild(b1);
    var b2=criar("button","chip","Financeiro");b2.id="btnAbaFin";b2.onclick=function(){abrirPainelFinAdm();};abas.appendChild(b2);
  },300);
}
async function abrirPainelFinAdm(){
  var area=pegar("gestaoConteudo");area.innerHTML="Carregando...";
  var d=await chamarAdmin("admin_resumo");area.innerHTML="";
  var b=criar("div","bloco");b.appendChild(criar("h3","","Financeiro"));
  if(d)b.appendChild(linhaInfo("Leituras totais",d.leituras));
  area.appendChild(b);
}
async function abrirPainelEquipeAdm(){
  var area=pegar("gestaoConteudo");area.innerHTML="Carregando equipe...";
  var rCur=await db.from("curadores").select("user_id"),rEq=await db.from("equipe").select("user_id,funcao");
  var curs=(rCur.data||[]).map(function(x){return x.user_id;}),mods=(rEq.data||[]).filter(function(x){return x.funcao==="moderador";}).map(function(x){return x.user_id;});
  var todos=curs.concat(mods.filter(function(id){return curs.indexOf(id)===-1;}));
  await carregarNomes(todos);area.innerHTML="";
  var tit=criar("h3","","Membros da Equipe ("+todos.length+")");area.appendChild(tit);
  if(!todos.length)area.appendChild(criar("p","ajuda","Nenhum curador ou moderador cadastrado ainda."));
  todos.forEach(function(uid){
    var ehC=curs.indexOf(uid)!==-1,b=criar("div","bloco");
    b.appendChild(criar("strong","",(NOMES[uid]||uid)+(ehC?" · [Curador]":" · [Moderador]")));
    var bts=criar("div","botoes");bts.style.cssText="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px";
    var vp=criar("a","btn claro mini","Visitar Perfil");vp.href="#autor-"+uid;bts.appendChild(vp);
    bts.appendChild(botaoGestao("Trocar para "+(ehC?"Moderador":"Curador"),"claro",async function(){
      await db.from("curadores").delete().eq("user_id",uid);await db.from("equipe").delete().eq("user_id",uid);
      if(!ehC){await db.from("curadores").insert({user_id:uid});await db.from("equipe").insert({user_id:uid,funcao:"curador"});}
      else{await db.from("equipe").insert({user_id:uid,funcao:"moderador"});}
      abrirPainelEquipeAdm();
    }));
    bts.appendChild(botaoGestao("Excluir","perigo",async function(){
      if(!confirm("Excluir este membro da equipe?"))return;
      var d1=await db.from("curadores").delete().eq("user_id",uid);
      var d2=await db.from("equipe").delete().eq("user_id",uid);
      if(d1.error||d2.error){alert("Erro ao excluir: "+(d1.error||d2.error).message);return;}
      abrirPainelEquipeAdm();
    }));
    b.appendChild(bts);area.appendChild(b);
  });
  var box=criar("div","bloco");box.appendChild(criar("h3","","Eleger novo membro"));
  var inp=document.createElement("input");inp.placeholder="E-mail, nome ou @usuario...";box.appendChild(inp);
  var resDiv=criar("div");
  box.appendChild(botaoGestao("Buscar","",async function(){
    var q=inp.value.trim();if(!q)return;
    var listaU=await chamarAdmin("admin_usuarios",{p_busca:q});resDiv.innerHTML="";
    (listaU||[]).forEach(function(u){
      var it=criar("div","bloco");it.appendChild(criar("strong","",(u.nome||u.usuario||u.email)+" ("+u.email+")"));
      var bts=criar("div","botoes");bts.style.cssText="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px";
      var vp=criar("a","btn claro mini","Visitar Perfil");vp.href="#autor-"+u.id;bts.appendChild(vp);
      bts.appendChild(botaoGestao("Eleger Curador","",async function(){
        await db.from("curadores").delete().eq("user_id",u.id);await db.from("equipe").delete().eq("user_id",u.id);
        var e1=await db.from("curadores").insert({user_id:u.id});var e2=await db.from("equipe").insert({user_id:u.id,funcao:"curador"});
        if(e1.error||e2.error){alert("Erro: "+(e1.error||e2.error).message);return;}
        abrirPainelEquipeAdm();
      }));
      bts.appendChild(botaoGestao("Eleger Moderador","claro",async function(){
        await db.from("curadores").delete().eq("user_id",u.id);await db.from("equipe").delete().eq("user_id",u.id);
        var e2=await db.from("equipe").insert({user_id:u.id,funcao:"moderador"});
        if(e2.error){alert("Erro: "+e2.error.message);return;}
        abrirPainelEquipeAdm();
      }));
      it.appendChild(bts);resDiv.appendChild(it);
    });
  }));box.appendChild(resDiv);area.appendChild(box);
}
async function calcularScoreAlgoritmo(){
  var rh=await db.from("historias").select("id,titulo,publicada,destaque,bloqueio_algoritmo").eq("publicada",true).limit(60);
  var lista=rh.data||[];if(!lista.length)return[];
  var ids=lista.map(function(h){return h.id;}),mL={},mCu={},mCo={};
  var rl=await db.from("leituras_por_historia").select("historia_id,total").in("historia_id",ids);
  (rl.data||[]).forEach(function(x){mL[x.historia_id]=Number(x.total||0);});
  var rcu=await db.from("curtidas").select("historia_id").in("historia_id",ids);
  (rcu.data||[]).forEach(function(x){mCu[x.historia_id]=(mCu[x.historia_id]||0)+1;});
  var rco=await db.from("comentarios").select("historia_id").in("historia_id",ids);
  (rco.data||[]).forEach(function(x){mCo[x.historia_id]=(mCo[x.historia_id]||0)+1;});
  lista.forEach(function(h){h._score=(mL[h.id]||0)+((mCu[h.id]||0)*3)+((mCo[h.id]||0)*5);});
  return lista.sort(function(a,b){return b._score-a._score;});
}
async function prepararCuradoria(){
  var ac=pegar("curadoriaAcesso"),cp=pegar("curadoriaCorpo");if(!ac||!cp)return;
  ac.innerHTML="";cp.style.display="none";
  if(!usuarioLogado||(!souCurador&&!souAdmin)){ac.innerHTML="<div class=bloco><p class=ajuda>Acesso restrito.</p></div>";return;}
  cp.style.display="block";abrirAbaCuradoria(abaCuradoria);
}
async function abrirAbaCuradoria(aba){
  abaCuradoria=aba;var abas=pegar("abasCuradoria");abas.innerHTML="";
  [{id:"algoritmo",n:"Algoritmo"},{id:"fila",n:"Avaliar Obras"}].forEach(function(a){
    var c=criar("button","chip"+(a.id===aba?" ativo":""),a.n);c.onclick=function(){abrirAbaCuradoria(a.id);};abas.appendChild(c);
  });
  var area=pegar("curadoriaConteudo");area.innerHTML="Carregando...";
  if(aba==="algoritmo"){
    var list=await calcularScoreAlgoritmo();area.innerHTML="";
    var top=criar("div","bloco");
    top.appendChild(botaoGestao("Lançar Top 5 nos Destaques","",async function(){
      var el=list.filter(function(h){return !h.bloqueio_algoritmo&&h._score>0;}).slice(0,5);
      for(var i=0;i<el.length;i++){await db.from("historias").update({destaque:true}).eq("id",el[i].id);}
      aviso("avisoCuradoria","Top 5 lançado!",false);abrirAbaCuradoria("algoritmo");
    }));area.appendChild(top);
    list.forEach(function(h,i){
      var b=criar("div","bloco");b.appendChild(criar("strong","","#"+(i+1)+" "+h.titulo+" ("+h._score+" pts)"));
      var bts=criar("div","botoes");
      if(h.destaque){bts.appendChild(botaoGestao("Tirar","perigo",async function(){await db.from("historias").update({destaque:false,bloqueio_algoritmo:true}).eq("id",h.id);abrirAbaCuradoria("algoritmo");}));}
      else{bts.appendChild(botaoGestao("Acrescentar","",async function(){await db.from("historias").update({destaque:true,bloqueio_algoritmo:false}).eq("id",h.id);abrirAbaCuradoria("algoritmo");}));}
      b.appendChild(bts);area.appendChild(b);
    });
  }else{
    var r=await db.from("historias").select("*").order("criado_em",{ascending:false}).limit(30);area.innerHTML="";
    (r.data||[]).forEach(function(h){
      var b=criar("div","bloco");b.appendChild(criar("strong","",h.titulo));
      var bts=criar("div","botoes");
      bts.appendChild(botaoGestao("Aprovar","",async function(){await db.from("historias").update({publicada:true}).eq("id",h.id);aviso("avisoCuradoria","Aprovada!",false);}));
      bts.appendChild(botaoGestao("Recusar","perigo",async function(){await db.from("historias").update({publicada:false}).eq("id",h.id);abrirAbaCuradoria("fila");}));
      b.appendChild(bts);area.appendChild(b);
    });
  }
}
async function prepararModeracao(){
  var ac=pegar("moderacaoAcesso"),cp=pegar("moderacaoCorpo");if(!ac||!cp)return;
  ac.innerHTML="";cp.style.display="none";
  if(!usuarioLogado||(!souModerador&&!souAdmin)){ac.innerHTML="<div class=bloco><p class=ajuda>Acesso restrito.</p></div>";return;}
  cp.style.display="block";abrirAbaModeracao(abaModeracao);
}
async function abrirAbaModeracao(aba){
  abaModeracao=aba;var abas=pegar("abasModeracao");abas.innerHTML="";
  [{id:"robo",n:"Robô"},{id:"denuncias",n:"Denúncias"}].forEach(function(a){
    var c=criar("button","chip"+(a.id===aba?" ativo":""),a.n);c.onclick=function(){abrirAbaModeracao(a.id);};abas.appendChild(c);
  });
  var area=pegar("moderacaoConteudo");area.innerHTML="Carregando...";
  if(aba==="robo"){
    var rc=await db.from("comentarios").select("*").order("criado_em",{ascending:false}).limit(40);area.innerHTML="";
    var spam=(rc.data||[]).filter(function(c){return /(http|www\.|whatsapp|telegram|pix|porno|sexo|lixo|morra)/i.test(c.texto||"");});
    if(!spam.length){area.appendChild(criar("p","vazio","Sem spam."));return;}
    spam.forEach(function(c){
      var b=criar("div","bloco");b.appendChild(criar("strong","","Spam"));b.appendChild(linhaInfo("Texto",c.texto));
      b.appendChild(botaoGestao("Apagar","perigo",async function(){await db.from("comentarios").delete().eq("id",c.id);abrirAbaModeracao("robo");}));
      area.appendChild(b);
    });
  }else{
    var rd=await db.from("denuncias").select("*").order("criado_em",{ascending:false}).limit(30);area.innerHTML="";
    (rd.data||[]).forEach(function(d){
      var b=criar("div","bloco");b.appendChild(criar("strong","",d.motivo));
      if(!d.resolvida)b.appendChild(botaoGestao("Resolver","",async function(){await db.from("denuncias").update({resolvida:true}).eq("id",d.id);abrirAbaModeracao("denuncias");}));
      area.appendChild(b);
    });
  }
}
}

// Visitar perfil pelos comentários e pela busca de usuários
document.addEventListener("input", async function (e) {
  if (!e.target || e.target.id !== "campoBusca") return;
  var termo = e.target.value.trim().replace(/^@/, "");
  var res = pegar("resultado");
  if (!res) return;
  var ant = pegar("listaUsuariosBusca");
  if (ant) ant.remove();
  if (termo.length < 2) return;
  var r = await db.from("perfis").select("id,nome,usuario,sobre").or("nome.ilike.%" + termo + "%,usuario.ilike.%" + termo + "%").limit(8);
  if (!r.data || !r.data.length) return;
  var box = criar("div");
  box.id = "listaUsuariosBusca";
  box.style.cssText = "grid-column:1/-1;margin-bottom:12px";
  box.appendChild(criar("h3", "", "Perfis encontrados"));
  r.data.forEach(function (u) {
    var a = criar("a", "bloco");
    a.href = "#autor-" + u.id;
    a.style.display = "block";
    a.appendChild(criar("strong", "", (u.nome || u.usuario || "Leitor") + (u.usuario ? " (@" + u.usuario + ")" : "")));
    if (u.sobre) a.appendChild(criar("p", "ajuda", u.sobre));
    box.appendChild(a);
  });
  res.parentNode.insertBefore(box, res);
});

// Atalho direto na tela Perfil para compartilhar rede social
setInterval(function () {
  var h = (location.hash || "").replace("#", "");
  if (h !== "perfil" || !usuarioLogado || pegar("boxRedePerfil")) return;
  var pStats = document.querySelector("#tela-perfil .profile-stats");
  if (!pStats) return;
  var box = criar("div", "bloco");
  box.id = "boxRedePerfil";
  box.style.marginTop = "12px";
  box.appendChild(criar("label", "rot", "Compartilhar minha rede social"));
  var inp = document.createElement("input");
  inp.type = "url";
  inp.placeholder = "https://instagram.com";
  inp.style.marginBottom = "8px";
  box.appendChild(inp);
  var btn = criar("button", "btn claro mini", "Salvar rede social");
  btn.type = "button";
  btn.onclick = async function () {
    var link = inp.value.trim();
    if (link && link.indexOf("http") !== 0) link = "https://" + link;
    var r = await db.from("perfis").update({ rede_social: link || null }).eq("id", usuarioLogado.id);
    alert(r.error ? "Erro ao salvar." : "Rede social salva no seu perfil público!");
  };
  box.appendChild(btn);
  pStats.parentNode.insertBefore(box, pStats.nextSibling);
  db.from("perfis").select("rede_social").eq("id", usuarioLogado.id).maybeSingle().then(function (r) {
    if (r.data && r.data.rede_social) inp.value = r.data.rede_social;
  });
}, 1000);

// Prateleiras inteligentes na tela Início: Destaques, Descobertas e Pra Você
var carregandoPrateleirasExtra = false;
async function montarPrateleirasInteligentes() {
  var h = (location.hash || "#inicio").replace("#", "");
  if (h !== "" && h !== "inicio") return;
  var area = pegar("prateleiras");
  if (!area || carregandoPrateleirasExtra) return;
  if (pegar("blocoPrateleirasExtras") && area.firstChild === pegar("blocoPrateleirasExtras")) return;

  carregandoPrateleirasExtra = true;
  try {
    var r = await db.from("historias")
      .select("id,titulo,sinopse,capa,generos,idade,status,autor_id,destaque,criado_em")
      .eq("publicada", true)
      .order("criado_em", { ascending: false })
      .limit(80);

    var todas = (r.data || []);
    if (!todas.length) return;
    await carregarNomes(todas.map(function (x) { return x.autor_id; }));
    todas = todas.map(normalizar);

    // 1. Destaques (Curadoria / Algoritmo)
    var destaques = todas.filter(function (x) { return x.destaque === true; }).slice(0, 12);

    // 2. Descobertas (Obras fora dos destaques, embaralhadas para dar chance a novos autores)
    var descobertas = todas.filter(function (x) { return !x.destaque; })
      .sort(function () { return 0.5 - Math.random(); })
      .slice(0, 10);

    // 3. Pra Você (Baseado nos gêneros das obras curtidas pelo usuário ou variedade de gêneros)
    var favGeneros = [];
    if (usuarioLogado) {
      var rc = await db.from("curtidas").select("historia_id").eq("usuario_id", usuarioLogado.id).limit(20);
      var idsCurtidos = (rc.data || []).map(function (c) { return c.historia_id; });
      todas.forEach(function (x) {
        if (idsCurtidos.indexOf(x.id) !== -1 && x.generos) {
          x.generos.forEach(function (g) { if (favGeneros.indexOf(g) === -1) favGeneros.push(g); });
        }
      });
    }
    var praVoce = favGeneros.length
      ? todas.filter(function (x) { return (x.generos || []).some(function (g) { return favGeneros.indexOf(g) !== -1; }); }).slice(0, 10)
      : todas.slice().reverse().slice(0, 10);

    var wrap = pegar("blocoPrateleirasExtras") || criar("div");
    wrap.id = "blocoPrateleirasExtras";
    wrap.innerHTML = "";

    function renderSecao(titulo, lista) {
      if (!lista.length) return;
      wrap.appendChild(criar("h2", "section-title", titulo));
      var grade = criar("div", "books-grid");
      lista.forEach(function (item) { grade.appendChild(criarCard(item)); });
      wrap.appendChild(grade);
    }

    renderSecao("⭐ Destaques", destaques);
    renderSecao("✨ Pra você", praVoce);
    renderSecao("🧭 Descobertas", descobertas);

    if (area.firstChild) area.insertBefore(wrap, area.firstChild);
    else area.appendChild(wrap);
  } finally {
    carregandoPrateleirasExtra = false;
  }
}

setInterval(montarPrateleirasInteligentes, 1500);
setTimeout(montarPrateleirasInteligentes, 800);
