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

/** Snapshot de uma equipe (ou de todas, com `dept` vazio) a partir dos dados crus. */
export function snapshotFor(raw, dept = '') {
  let { sessions, agents } = raw;
  if (dept) {
    sessions = sessions.filter((s) => s.departmentId === dept);
    // atendentes da equipe (pelo cadastro) + quem tem conversa da equipe hoje
    const members = new Set(sessions.map((s) => s.userId).filter(Boolean));
    for (const a of agents) if (a.departments?.some((d) => d.departmentId === dept)) members.add(a.userId);
    for (const d of raw.departments ?? []) if (d.id === dept) for (const a of d.agents ?? []) members.add(a.userId);
    agents = agents.filter((a) => members.has(a.userId));
  }
  const snapshot = buildSnapshot({ sessions, agents, dayStart: raw.dayStart, tz: TZ, now: raw.now });
  return { ...snapshot, department: dept || null, departments: departmentList(raw) };
}

const safeEqual = (x, y) => {
  const a = Buffer.from(String(x ?? ''));
  const b = Buffer.from(String(y ?? ''));
  return a.length === b.length && timingSafeEqual(a, b);
};

/** Usuário que pode ver o painel: administrador ou dono da conta. */
const isAdmin = (agent) => agent.profile === 'Admin' || agent.isOwner === true;

/**
 * Quem pode ver o painel: só quem abre pelo botão da plataforma, com a URL
 * ?conta=<Id da conta>&usuario=<Id do usuário>. Libera se a conta é a mesma do token
 * e o usuário é um administrador ativo dela. Qualquer outro acesso é bloqueado.
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
  const user = agents.find((a) => a.userId === usuario);
  if (!user) return { ok: false, status: 403, reason: 'usuario', error: 'Usuário não encontrado nesta conta.' };
  if (!isAdmin(user)) return { ok: false, status: 403, reason: 'perfil', error: 'Painel disponível apenas para administradores.' };
  return { ok: true };
}

/** Lê os IDs enviados pelo navegador (cabeçalhos). */
export const credentialsFrom = (headers) => ({
  conta: headers['x-dash-conta'],
  usuario: headers['x-dash-usuario'],
});