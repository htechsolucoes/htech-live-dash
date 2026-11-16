// Função da Vercel: GET /api/snapshot?department=<id>
// Confere quem está acessando, busca os dados na API, calcula o painel e responde.
// Guarda o resultado por alguns segundos na memória da função, para várias telas
// abertas não multiplicarem as chamadas à API.
import { authorize, collect, credentialsFrom, snapshotFor } from '../server/core.js';

const CACHE_MS = Number(process.env.REFRESH_SECONDS ?? 15) * 1000;
let cached = null; // { at, raw }
let inflight = null;

async function getRaw() {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.raw;
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
    return res.status(500).json({ error: 'HTECH_TOKEN não configurado nas variáveis de ambiente do projeto.' });
  }

  try {
    const auth = await authorize(credentialsFrom(req.headers), async () => (await getRaw()).agents);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error, reason: auth.reason });

    const raw = await getRaw();
    const dept = typeof req.query.department === 'string' ? req.query.department : '';
    return res.status(200).json(snapshotFor(raw, dept));
  } catch (err) {
    return res.status(502).json({ error: String(err?.message ?? err) });
  }
}
