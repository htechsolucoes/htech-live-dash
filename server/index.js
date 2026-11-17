// Servidor Node para rodar localmente (npm run dev) ou num servidor próprio (npm start).
// Na Vercel quem responde é a função api/snapshot.js — este arquivo não é usado lá.
import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { authorize, collect, credentialsFrom, perfilMinimo, perfilPermitido, snapshotFor, TZ } from './core.js';

const PORT = Number(process.env.PORT ?? 3001);
const REFRESH_MS = Number(process.env.REFRESH_SECONDS ?? 15) * 1000;

if (!process.env.HTECH_TOKEN) {
  console.error('HTECH_TOKEN não definido. Crie o arquivo .env (veja .env.example) e reinicie.');
  process.exit(1);
}

let raw = null;
let rawAt = 0;
let printedLink = false;
const MIN_FORCE_MS = 5000; // botão "Atualizar": busca de novo no máximo a cada 5 s
let lastError = null;
let refreshing = null;

async function refresh() {
  if (refreshing) return refreshing; // evita chamadas simultâneas
  refreshing = collect()
    .then((r) => {
      raw = r;
      rawAt = Date.now();
      lastError = null;
      if (!printedLink) {
        // Link pronto para abrir no seu computador (o painel só abre com conta + admin na URL)
        printedLink = true;
        const user = r.agents.find((a) => perfilPermitido(a.profile));
        const companyId = r.agents.find((a) => a.companyId)?.companyId;
        if (user && companyId) {
          console.log(`Para testar: http://localhost:5173/${companyId}/${user.userId}  (${user.name}, ${user.profile})`);
        } else {
          console.log(`Nenhum usuário com perfil ${perfilMinimo()} (ou acima) encontrado na conta.`);
        }
      }
    })
    .catch((err) => {
      lastError = String(err.message ?? err);
      console.error('[refresh]', lastError);
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

const app = express();

app.get('/api/snapshot', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  if (!raw) await refresh();
  if (!raw || lastError) return res.status(502).json({ error: 'Erro' }); // detalhe só no terminal
  const auth = await authorize(credentialsFrom(req.headers), async () => raw.agents);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error, reason: auth.reason });
  if (req.query.fresh === '1' && Date.now() - rawAt >= MIN_FORCE_MS) {
    await refresh(); // botão "Atualizar"
    if (lastError) return res.status(502).json({ error: 'Erro' });
  }
  const dept = typeof req.query.department === 'string' ? req.query.department : '';
  const user = typeof req.query.user === 'string' ? req.query.user : '';
  res.json(snapshotFor(raw, dept, user));
});

// Em produção, o mesmo servidor entrega o front já compilado (npm run build)
const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
app.use(express.static(dist));
app.get(/^(?!\/api).*/, (_req, res, next) => res.sendFile(path.join(dist, 'index.html'), (e) => e && next()));

app.listen(PORT, () => {
  console.log(`Htech Live Dash em http://localhost:${PORT} (fuso ${TZ}, atualiza a cada ${REFRESH_MS / 1000}s, perfil mínimo ${perfilMinimo()})`);
  refresh();
  setInterval(refresh, REFRESH_MS);
});