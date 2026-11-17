# Htech Live Dash

Painel ao vivo do atendimento do dia (React + Vite + Tailwind), em tema claro (branco, azul `#0492f7` e cinza `#9ca3af`):

- **Linha de cima:** filtro de equipe + recebidos, concluídos, em atendimento, na fila, tempo médio de atendimento e tempo médio de espera.
- **Fila de espera (card vermelho):** quem ainda aguarda atendente, com cronômetro. O cartão fica mais vermelho conforme a espera aumenta (5 min / 10 min).
- **Um card por atendente:** ✓ concluídos hoje e 💬 em andamento agora, com as conversas abertas e um aviso quando o cliente está aguardando resposta.
- Todos os cards têm a **mesma altura** (`--spacing-block` no `src/index.css`). Se passar do tamanho, o card ganha rolagem interna.
- **Filtro por equipe:** fica salvo no endereço (`?equipe=<id>`), então dá para deixar uma TV fixa numa equipe.
- **Acesso só pela plataforma:** o painel abre apenas pelo botão da plataforma, para os perfis definidos em `PERFIL_MINIMO` (padrão: só administradores). Veja "Botão na plataforma" abaixo. Aberto de qualquer outro jeito, mostra "Acesso restrito".

Só entram dados de **hoje** (a partir da meia-noite no fuso configurado), menos as conversas abertas, que aparecem mesmo que tenham começado ontem. A tela busca dados novos a cada **15 segundos**, e os cronômetros andam a cada segundo.

---

## Publicar na Vercel (um projeto por cliente)

O mesmo código serve para todos os clientes. Cada cliente é **um projeto na Vercel** ligado ao mesmo repositório do GitHub, com as suas próprias variáveis.

### Primeira vez

1. Suba este projeto para um repositório no GitHub.
2. Na Vercel: **Add New… → Project → Import** o repositório. A Vercel detecta o Vite sozinha, então não mude nada em Build/Output.
3. Antes de clicar em Deploy, abra **Environment Variables** e adicione:

   | Nome | Valor |
   |---|---|
   | `HTECH_TOKEN` | token do cliente |
   | `PERFIL_MINIMO` | quem pode ver o painel: `ADMIN` (padrão), `AGENT` ou `RESTRICTED_AGENT` — veja abaixo |
   | `SUPER_ADMIN_IDS` | opcional: IDs com acesso total (super admin), separados por vírgula — marque como **Sensitive** |
   | `TZ_DASH` | só se o cliente não estiver no horário de Brasília (ex.: `America/Manaus`) |

4. Clique em **Deploy**. Pronto: o painel fica em `https://<nome-do-projeto>.vercel.app`.

> Dê ao projeto um nome que identifique o cliente, por exemplo `htech-live-dash-clientea`. Esse nome vira o endereço.

### Botão na plataforma

Na tela de configuração do botão/menu da plataforma, cadastre a URL do painel do cliente com os dois IDs no caminho, usando os botões **Id da conta** e **Id do usuário** para inserir os valores:

```
https://<nome-do-projeto>.vercel.app/<Id da conta>/<Id do usuário>
```

O filtro de equipe vai depois, como `?equipe=<id>` (o próprio painel coloca ao escolher a equipe).

O servidor libera o painel quando:
1. a conta do link é a mesma do `HTECH_TOKEN` (comparada com o `companyId` dos usuários em `GET /core/v1/agent`); e
2. o usuário do link existe nessa conta e o **perfil** dele (`profile`) alcança o `PERFIL_MINIMO`:

| `PERFIL_MINIMO` | ADMIN | AGENT | RESTRICTED_AGENT |
|---|---|---|---|
| `ADMIN` (padrão) | ✅ | 🚫 | 🚫 |
| `AGENT` | ✅ | ✅ | 🚫 |
| `RESTRICTED_AGENT` | ✅ | ✅ | ✅ |

Vazio ou com valor inválido, vale `ADMIN`. Um perfil que não seja um desses três nunca passa.

**Super admin:** os IDs de usuário em `SUPER_ADMIN_IDS` (separados por vírgula) têm acesso a qualquer painel, mesmo sem aparecer na lista de usuários da API e independente do `PERFIL_MINIMO`. A conta do link continua tendo que ser a do token. Esses IDs ficam **só nas variáveis da Vercel**, nunca no código: trate como senha e marque a variável como **Sensitive**.

Qualquer outro caso mostra "Acesso restrito" com o motivo: aberto fora da plataforma, perfil sem acesso, usuário removido, link de outra conta ou link incompleto. Se o perfil de alguém muda ou a pessoa é removida, vale na próxima atualização (até ~15 s).

> ⚠️ Esses IDs não são uma senha: quem tiver o link completo de um administrador consegue abrir o painel. Por isso, não compartilhe esse link fora da plataforma.

### Adicionar um cliente novo

Repita os passos 2 a 4 importando **o mesmo repositório** com outro nome de projeto, e use o token do novo cliente.

### Atualizar o painel de todos os clientes

Faça `git push` no repositório. A Vercel publica de novo todos os projetos ligados a ele.

### Trocar o token de um cliente

Em **Settings → Environment Variables** do projeto do cliente, altere o valor e depois vá em **Deployments → ⋯ → Redeploy**. Variáveis novas só valem depois de um novo deploy.

---

## Rodar no seu computador

```bash
npm install
cp .env.example .env      # coloque o HTECH_TOKEN
npm run dev               # servidor (3001) + Vite (5173)
```

Como o painel só abre com conta + administrador na URL, o servidor mostra no terminal um link pronto para testar:
`Para testar: http://localhost:5173/<Id da conta>/<Id do usuário>`

> Alterou o `.env`? Pare (Ctrl+C) e rode de novo.

**Servidor próprio (AWS, VPS…):** `npm run build && npm start` sobe tudo em `http://localhost:${PORT}`, com o mesmo `.env`.

---

## Como funciona

```
Navegador (React)  —— a cada 15 s: GET /api/snapshot ——→  backend  —— Bearer HTECH_TOKEN ——→  api.wts.chat
                       cabeçalhos x-dash-conta + x-dash-usuario (IDs do caminho /<conta>/<usuario>)
```

- **O token nunca vai para o navegador.** Quem chama a API é o backend:
  - na Vercel, a função `api/snapshot.js`;
  - local ou em servidor próprio, o `server/index.js`.
  Os dois usam a mesma lógica (`server/core.js`).
- A cada consulta, o backend faz ~5 chamadas à API: conversas abertas, recebidas hoje, concluídas hoje, atendentes e equipes. O resultado é reaproveitado por `REFRESH_SECONDS` (15 s), então várias telas abertas não multiplicam as chamadas. O limite da conta é 1.000 chamadas a cada 5 min.
- A resposta nunca é guardada em cache público (`Cache-Control: no-store`), porque os dados são do cliente.

## Como as métricas são calculadas (`server/metrics.js`)

| Métrica | Regra |
|---|---|
| Recebidos | conversas com `startAt` (ou `createdAt`) a partir da meia-noite |
| Concluídos | `status = COMPLETED` e `endAt` hoje (inclui as que começaram ontem) |
| Na fila | `status = PENDING` |
| No chatbot | `status = STARTED` |
| Em atendimento | `status = IN_PROGRESS` |
| Tempo médio de atendimento | média de `timeService` das concluídas hoje; se vier vazio, `endAt − firstResponseAt` |
| Tempo médio de espera | média de `timeWait` das conversas de hoje já respondidas; se vier vazio, `firstResponseAt − startAt` |
| Cards por atendente | agrupa por `userId` da conversa; aparece quem tem conversa aberta ou atendeu hoje |
| Filtro de equipe | conversas com `departmentId` da equipe + atendentes cadastrados nela |

## Estrutura

```
vercel.json    faz a Vercel abrir o painel em qualquer caminho (/<conta>/<usuario>), menos /api
api/
  snapshot.js  função da Vercel (regras de acesso + cache + resposta)
server/
  core.js      busca na API, filtro por equipe, regras de acesso — compartilhado
  index.js     servidor Express (local / servidor próprio)
  api.js       chamadas à API (paginação + nova tentativa em 429)
  metrics.js   cálculo dos números e dos cards
  time.js      fuso / início do dia / leitura de durações
src/
  App.tsx, hooks.ts (consulta a cada 15 s, IDs do link, relógio, filtro na URL), format.ts, types.ts
  components/  Header (linha de cima + filtro), Board (fila + cards), AccessDenied (acesso restrito), Icons
```