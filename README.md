# Portal Novel: React + Vite (versão 10.20)

## O que mudou na 10.20 (em relação à 10.19)

- **Comunidades criadas pelos usuários** (`#comunidades`): ícone 👥 no topo (ao lado do ✉️) e item no menu lateral. Cada pessoa cria a sua, escolhendo **nome, descrição e capa** (até 3 por conta; nome único). Quem criou edita; quem criou ou o ADM exclui. Rode `supabase/portal-novel-comunidades.sql` no SQL Editor (depois do `...-ajustado.sql`).
- **Chat sem salvar nada** em cada comunidade: usa o Realtime do Supabase (Broadcast), sem tabela. Saiu da página, trocou de aba, bloqueou a tela ou fechou o app: o chat é encerrado. Ao voltar, começa vazio. Só entra quem está logado. Limites: 300 caracteres e 1 mensagem a cada 1,5 s. A capa padrão é `public/comunidade-capa.svg`.
- **Avisos de novo capítulo e nova história** para quem segue o autor: rode `supabase/portal-novel-novidades.sql` no SQL Editor (depois do `...-ajustado.sql`).
- Já existiam desde a 10.19: mensagens entre usuários (✉️), anúncio do ADM para todas as contas e exclusão de livro inteiro pela Gestão.

---

App em React + Vite que carrega a lógica do site (`public/legacy.js`) e usa o Supabase como banco.

## O que mudou na 10.19 (em relação à etapa "comunidade-admin")

- **Mensagens privadas mais seguras.** Só dá para escrever para quem **segue você**, ou responder a quem escreveu para você nos últimos 30 dias. O site aceita 14 anos ou mais, e sem essa regra qualquer pessoa poderia escrever para qualquer outra, inclusive menores. Também há limite de 20 mensagens por minuto.
- **Sem aviso repetido:** seguir/deixar de seguir várias vezes, ou mandar várias mensagens seguidas, gera uma notificação só.
- **Registro da Gestão:** excluir história e enviar anúncio ficam anotados na tabela `admin_acoes`.
- **Termos e Privacidade** atualizados (mensagens privadas e notificações).
- **Arquivos de publicação dentro de `public/`:** `CNAME`, `manifest.json`, `sw.js`, `sitemap.xml`, `og-image.png`, `selos/` e `icon-180.png`. Tudo que está em `public/` vai para o site no build.

## 1) Antes de qualquer coisa: banco (Supabase)

1. **Faça backup.** SQL Editor > rode a consulta de backup (a que passei no chat) e baixe o resultado.
2. Abra `supabase/portal-novel-comunidade-ajustado.sql`, copie **só o conteúdo do arquivo** (sem nome de arquivo nem texto extra) e rode no SQL Editor.
3. Se der erro, **tire um print da mensagem inteira**. O arquivo confere os pré-requisitos no começo e para sem alterar nada se faltar algo (`eh_admin()`, `seguidores`, `perfis`).

O arquivo `...-ORIGINAL.sql` é o da etapa anterior, só para comparação. **Use o ajustado.**

## 2) No Termux: instalar e testar

```bash
pkg update && pkg install -y nodejs git
cd ~/portal-novel          # pasta onde descompactou
npm install
npm run dev                # abra http://localhost:5173 no navegador do celular
```

Para gerar a versão final: `npm run build` (cria a pasta `dist/`).

### Testar sem mexer nos dados reais
O banco fica no Supabase (na internet), então não existe "offline de verdade". Para testar sem risco:
1. Crie um **segundo projeto grátis** no Supabase (ex.: "portal-novel-teste").
2. Rode lá os seus SQLs e o `portal-novel-comunidade-ajustado.sql`.
3. No `public/legacy.js`, troque a URL e a chave do Supabase pelas do projeto de teste (a chave é a *publishable/anon*, nunca a *secret/service_role*).
4. Teste com contas de mentira. Depois volte a URL e a chave reais antes do build final.

## 3) Publicar no GitHub

**Antes do build, confira que `public/` tem tudo que o site usa na raiz:**
- `icon-192.png`, `icon-512.png`, `icon-maskable-512.png` (copie do repositório atual; o `icon-180.png` já está aqui)
- se existir no repositório um arquivo `google....html` (verificação do Search Console), copie também

Sem isso, esses arquivos somem do site na troca.

```bash
cd ~
git clone https://github.com/portalnovel/Portal-Novel.git site
cd site
git tag antes-react && git push origin antes-react      # ponto de volta, se algo der errado
find . -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +   # apaga os arquivos antigos (menos .git)
cp -r ~/portal-novel/dist/. .
git add -A
git commit -m "Versão 10.19 (React + Vite, comunidade)"
git push
```

O `git push` pede usuário e senha: a senha é um **token** do GitHub (Settings > Developer settings > Fine-grained tokens, só neste repositório, permissão *Contents: Read and write*). **Nunca cole o token em chats.**

Se algo quebrar, volte com: `git checkout antes-react -- . && git commit -am "voltar" && git push`.

### A cada versão nova
1. Troque o número em `src/App.jsx` (`legacy.js?v=10.20`) e o texto "versão" em `src/markup.js`.
2. `npm run build`, copie `dist/` para a pasta do site e faça `git push`.

## 4) Teste depois de publicar
1. `portalnovel.com.br` abre; em Configurações aparece **versão 10.19** (se mostrar outra, feche o app e abra de novo, ou use `?v=1` no endereço).
2. Duas contas de teste: A segue B; A manda mensagem para B → **deve falhar** (B não segue A). B segue A; A manda mensagem para B → **deve funcionar**; B responde.
3. Aviso de novo seguidor aparece uma vez só, mesmo seguindo e deixando de seguir.
4. Gestão: só aparece para a conta de gestão; abas Histórias e Concursos/avisos funcionam.
5. Excluir uma história de teste: confira em `select * from admin_acoes order by id desc;`.

## Ainda não existe (próximos passos recomendados)
- **Bloquear usuário** e **denunciar mensagem/conversa.**
- Apagar as próprias mensagens (hoje ninguém apaga; ao excluir a conta, as mensagens enviadas por ela somem para os dois lados).
- Notificação push com o app fechado (hoje atualiza a cada 20 s com o app aberto).
- Migrar a lógica de `legacy.js` para componentes React (hoje o React só carrega o código antigo).
