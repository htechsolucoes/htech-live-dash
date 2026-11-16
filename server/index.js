// Servidor Node para rodar localmente (npm run dev) ou num servidor próprio (npm start).
// Na Vercel quem responde é a função api/snapshot.js — este arquivo não é usado lá.
import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { authorize, collect, credentialsFrom, snapshotFor, TZ } from './core.js';

const PORT = Number(process.env.PORT ?? 3001);
const REFRESH_MS = Number(process.env.REFRESH_SECONDS ?? 15) * 1000;

if (!process.env.HTECH_TOKEN) {
  console.error('HTECH_TOKEN não definido. Crie o arquivo .env (veja .env.example) e reinicie.');
  process.exit(1);
}

let raw = null;
let printedLink = false;
let lastError = null;
let refreshing = null;

async function refresh() {
  if (refreshing) return refreshing; // evita chamadas simultâneas
  refreshing = collect()
    .then((r) => {
      raw = r;
      lastError = null;
      if (!printedLink) {
        // Link pronto para abrir no seu computador (o painel só abre com conta + admin na URL)
        printedLink = true;
        const admin = r.agents.find((a) => a.profile === 'Admin' || a.isOwner);
        const companyId = r.agents.find((a) => a.companyId)?.companyId;
        if (admin && companyId) {
          console.log(`Para testar: http://localhost:5173/?conta=${companyId}&usuario=${admin.userId}  (admin: ${admin.name})`);
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
  if (!raw || lastError) return res.status(502).json({ error: lastError ?? 'Sem dados' });
  const auth = await authorize(credentialsFrom(req.headers), async () => raw.agents);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error, reason: auth.reason });
  const dept = typeof req.query.department === 'string' ? req.query.department : '';
  res.json(snapshotFor(raw, dept));
});

// Em produção, o mesmo servidor entrega o front já compilado (npm run build)
const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
app.use(express.static(dist));
app.get(/^(?!\/api).*/, (_req, res, next) => res.sendFile(path.join(dist, 'index.html'), (e) => e && next()));

app.listen(PORT, () => {
  console.log(`Htech Live Dash em http://localhost:${PORT} (fuso ${TZ}, atualiza a cada ${REFRESH_MS / 1000}s)`);
  refresh();
  setInterval(refresh, REFRESH_MS);
});
