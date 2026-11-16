// Cliente mínimo da API flw.chat / wts.chat (o token fica só no servidor).

const BASE = process.env.HTECH_API_BASE ?? 'https://api.wts.chat';
const PAGE_SIZE = 100; // máximo aceito pela API

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function request(path, params = {}, attempt = 0) {
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(params)) {
    if (v == null) continue;
    // Arrays viram parâmetros repetidos: Status=PENDING&Status=IN_PROGRESS
    for (const item of Array.isArray(v) ? v : [v]) url.searchParams.append(k, String(item));
  }

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${process.env.HTECH_TOKEN}`,
      Accept: 'application/json',
    },
  });

  // Rate limit: 1.000 req / 5 min e 200 req / 5 s por conta → espera e tenta de novo
  if (res.status === 429 && attempt < 4) {
    const retryAfter = Number(res.headers.get('retry-after')) || 2 ** attempt * 2;
    await sleep(retryAfter * 1000);
    return request(path, params, attempt + 1);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`${res.status} ${res.statusText} em ${path}: ${body.slice(0, 300)}`);
  }
  return res.json();
}

/** Percorre todas as páginas de um endpoint paginado. */
async function listAll(path, params = {}, maxPages = 50) {
  const items = [];
  for (let page = 1; page <= maxPages; page++) {
    const data = await request(path, { ...params, PageNumber: page, PageSize: PAGE_SIZE });
    items.push(...(data.items ?? []));
    if (!data.hasMorePages) break;
  }
  return items;
}

const SESSION_DETAILS = ['AgentDetails', 'DepartmentsDetails', 'ContactDetails', 'ChannelDetails'];

/** Conversas ainda abertas (fila + em atendimento), independentemente do dia em que começaram. */
export const fetchActiveSessions = () =>
  listAll('/chat/v2/session', {
    Status: ['STARTED', 'PENDING', 'IN_PROGRESS'],
    Type: 'INDIVIDUAL',
    IncludeDetails: SESSION_DETAILS,
  });

/** Conversas criadas a partir de `sinceIso` (qualquer status). */
export const fetchSessionsCreatedSince = (sinceIso) =>
  listAll('/chat/v2/session', {
    'CreatedAt.After': sinceIso,
    Type: 'INDIVIDUAL',
    IncludeDetails: SESSION_DETAILS,
  });

/** Conversas concluídas a partir de `sinceIso` (pega também as que começaram ontem). */
export const fetchSessionsEndedSince = (sinceIso) =>
  listAll('/chat/v2/session', {
    Status: ['COMPLETED'],
    'EndAt.After': sinceIso,
    Type: 'INDIVIDUAL',
    IncludeDetails: SESSION_DETAILS,
  });

/** Lista de usuários (atendentes). */
export const fetchAgents = () => request('/core/v1/agent');

/** Equipes da conta (para o filtro). */
export const fetchDepartments = () => request('/core/v2/department');
