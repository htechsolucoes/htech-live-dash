// Lógica compartilhada entre o servidor Node (server/index.js) e a função da Vercel (api/snapshot.js).
import { timingSafeEqual } from 'node:crypto';
import { fetchActiveSessions, fetchAgents, fetchDepartments, fetchSessionsCreatedSince, fetchSessionsEndedSince } from './api.js';
import { buildSnapshot } from './metrics.js';
import { startOfTodayUtc } from './time.js';

export const TZ = process.env.TZ_DASH ?? 'America/Sao_Paulo';

/** Busca tudo o que o painel precisa na API (≈5 chamadas). */
export async function collect() {
  const now = new Date();
  const dayStart = startOfTodayUtc(TZ, now);
  const since = dayStart.toISOString();

  const [active, created, ended, agents, departments] = await Promise.all([
    fetchActiveSessions(),
    fetchSessionsCreatedSince(since),
    fetchSessionsEndedSince(since),
    fetchAgents(),
    fetchDepartments().catch(() => []), // sem a lista, as equipes saem das próprias conversas
  ]);
  const byId = new Map();
  for (const s of [...created, ...ended, ...active]) byId.set(s.id, s); // ativas por último = estado mais novo
  return { sessions: [...byId.values()], agents, departments, dayStart, now };
}

/** Lista de equipes para o filtro: as cadastradas + as que aparecem nas conversas. */
function departmentList(raw) {
  const map = new Map();
  for (const d of raw.departments ?? []) if (d?.id) map.set(d.id, d.name ?? 'Sem nome');
  for (const s of raw.sessions) if (s.departmentId && !map.has(s.departmentId)) map.set(s.departmentId, s.departmentDetails?.name ?? 'Equipe');
  return [...map].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

/**
 * Snapshot filtrado a partir dos dados crus.
 *   dept: equipe ('' = todas)
 *   user: usuário/atendente ('' = todos). Mostra só as conversas dele, mas a fila de espera
 *         (que ainda não tem atendente) continua vindo do escopo da equipe.
 */
export function snapshotFor(raw, dept = '', user = '') {
  let { sessions, agents } = raw;
  if (dept) {
    sessions = sessions.filter((s) => s.departmentId === dept);
    // atendentes da equipe (pelo cadastro) + quem tem conversa da equipe hoje
    const members = new Set(sessions.map((s) => s.userId).filter(Boolean));
    for (const a of agents) if (a.departments?.some((d) => d.departmentId === dept)) members.add(a.userId);
    for (const d of raw.departments ?? []) if (d.id === dept) for (const a of d.agents ?? []) members.add(a.userId);
    agents = agents.filter((a) => members.has(a.userId));
  }

  const team = buildSnapshot({ sessions, agents, dayStart: raw.dayStart, tz: TZ, now: raw.now });
  // opções do filtro de usuário: quem aparece no painel da equipe (conversa aberta ou movimento hoje)
  const users = team.agents.map((a) => ({ id: a.userId, name: a.name })).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  const base = { department: dept || null, departments: departmentList(raw), user: user || null, users };

  if (!user) return { ...team, ...base };

  const mine = buildSnapshot({
    sessions: sessions.filter((s) => s.userId === user),
    agents: agents.filter((a) => a.userId === user),
    dayStart: raw.dayStart,
    tz: TZ,
    now: raw.now,
  });
  const queue = team.live.filter((s) => s.status === 'PENDING');
  return {
    ...mine,
    ...base,
    totals: {
      ...mine.totals,
      // fila e chatbot não têm atendente: continuam vindo da equipe
      inQueue: team.totals.inQueue,
      oldestQueuedAt: team.totals.oldestQueuedAt,
      inBot: team.totals.inBot,
    },
    live: [...queue, ...mine.live],
  };
}

const safeEqual = (x, y) => {
  const a = Buffer.from(String(x ?? ''));
  const b = Buffer.from(String(y ?? ''));
  return a.length === b.length && timingSafeEqual(a, b);
};

/**
 * Perfis da plataforma, do mais alto para o mais baixo. Quem tem um perfil acessa tudo
 * que os perfis abaixo dele acessam.
 */
const PERFIS = ['ADMIN', 'AGENT', 'RESTRICTED_AGENT'];
const nivel = (perfil) => PERFIS.indexOf(String(perfil ?? '').trim().toUpperCase()); // -1 = desconhecido

/**
 * PERFIL_MINIMO: o perfil mais baixo que ainda pode ver o painel.
 *   ADMIN            → só administradores (padrão)
 *   AGENT            → administradores e atendentes
 *   RESTRICTED_AGENT → todos
 * Valor vazio ou inválido = ADMIN (o mais restrito).
 */
export function perfilMinimo() {
  const valor = String(process.env.PERFIL_MINIMO ?? '').trim().toUpperCase();
  if (!valor) return 'ADMIN';
  if (!PERFIS.includes(valor)) {
    console.error(`[acesso] PERFIL_MINIMO="${process.env.PERFIL_MINIMO}" não é válido (use ADMIN, AGENT ou RESTRICTED_AGENT). Usando ADMIN.`);
    return 'ADMIN';
  }
  return valor;
}

/** O perfil do usuário alcança o PERFIL_MINIMO? (perfil desconhecido nunca passa) */
export function perfilPermitido(perfil, minimo = perfilMinimo()) {
  const n = nivel(perfil);
  return n !== -1 && n <= PERFIS.indexOf(minimo);
}

/**
 * Super admins (SUPER_ADMIN_IDS=id1,id2 nas variáveis de ambiente): entram em qualquer painel,
 * mesmo sem estar na lista de usuários da API e sem depender do PERFIL_MINIMO.
 * A conta do link continua tendo que ser a do token. Sem a variável, não há super admin.
 */
function isSuperAdmin(userId) {
  return String(process.env.SUPER_ADMIN_IDS ?? '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
    .some((id) => safeEqual(userId, id));
}

const MENSAGEM_PERFIL = {
  ADMIN: 'Painel disponível apenas para administradores.',
  AGENT: 'Painel disponível apenas para administradores e atendentes.',
  RESTRICTED_AGENT: 'Seu perfil não tem acesso a este painel.',
};

/**
 * Quem pode ver o painel: só quem abre pelo botão da plataforma, com a URL
 * /<Id da conta>/<Id do usuário> (o navegador envia os dois IDs nos cabeçalhos). Libera se a conta é a mesma do token
 * e o perfil do usuário alcança o PERFIL_MINIMO. Qualquer outro acesso é bloqueado.
 *
 * `getAgents` devolve a lista de usuários da API. Retorna { ok: true } ou { ok: false, status, reason, error }.
 */
export async function authorize({ conta, usuario }, getAgents) {
  if (!conta || !usuario) {
    return { ok: false, status: 403, reason: 'direto', error: 'Abra o painel pelo botão na plataforma.' };
  }
  const agents = await getAgents();
  const companyId = agents.find((a) => a.companyId)?.companyId;
  if (!companyId || !safeEqual(conta, companyId)) {
    return { ok: false, status: 403, reason: 'conta', error: 'Este painel não pertence à conta informada no link.' };
  }
  if (isSuperAdmin(usuario)) return { ok: true };
  const user = agents.find((a) => a.userId === usuario);
  if (!user) return { ok: false, status: 403, reason: 'usuario', error: 'Usuário não encontrado nesta conta.' };
  const minimo = perfilMinimo();
  if (!perfilPermitido(user.profile, minimo)) return { ok: false, status: 403, reason: 'perfil', error: MENSAGEM_PERFIL[minimo] };
  return { ok: true };
}

/** Lê os IDs enviados pelo navegador (cabeçalhos). */
export const credentialsFrom = (headers) => ({
  conta: headers['x-dash-conta'],
  usuario: headers['x-dash-usuario'],
});