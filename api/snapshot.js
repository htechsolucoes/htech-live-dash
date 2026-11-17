// Função da Vercel: GET /api/snapshot?department=<id>&user=<id>[&fresh=1]
// Confere quem está acessando, busca os dados na API, calcula o painel e responde.
// Guarda o resultado por alguns segundos na memória da função, para várias telas
// abertas não multiplicarem as chamadas à API.
import { authorize, collect, credentialsFrom, snapshotFor } from '../server/core.js';

const CACHE_MS = Number(process.env.REFRESH_SECONDS ?? 15) * 1000;
const MIN_FORCE_MS = 5000; // botão "Atualizar": busca de novo no máximo a cada 5 s
let cached = null; // { at, raw }
let inflight = null;

async function getRaw(force = false) {
  const age = cached ? Date.now() - cached.at : Infinity;
  if (age < (force ? MIN_FORCE_MS : CACHE_MS)) return cached.raw;
  if (!inflight) {
    inflight = collect()
      .then((raw) => {
        cached = { at: Date.now(), raw };
        return raw;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store'); // nunca guardar em cache público: os dados são do cliente

  if (!process.env.HTECH_TOKEN) {
    console.error('[snapshot] HTECH_TOKEN não configurado nas variáveis de ambiente do projeto.');
    return res.status(500).json({ error: 'Erro' });
  }

  try {
    const auth = await authorize(credentialsFrom(req.headers), async () => (await getRaw()).agents);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error, reason: auth.reason });

    const raw = await getRaw(req.query.fresh === '1'); // ?fresh=1 = botão "Atualizar"
    const dept = typeof req.query.department === 'string' ? req.query.department : '';
    const user = typeof req.query.user === 'string' ? req.query.user : '';
    return res.status(200).json(snapshotFor(raw, dept, user));
  } catch (err) {
    // o detalhe fica só nos logs da Vercel (Project → Logs); a tela recebe um erro genérico
    console.error('[snapshot]', err);
    return res.status(502).json({ error: 'Erro' });
  }
}