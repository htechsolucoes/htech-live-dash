// Transforma as listas cruas da API no "snapshot" que o painel consome.
import { localHour, parseDuration, secondsBetween } from './time.js';

const avg = (arr) => {
  const v = arr.filter((x) => x != null && Number.isFinite(x));
  return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null;
};

/** Tempo de espera (s): campo timeWait da API, senão 1ª resposta − início. */
export function waitSeconds(s) {
  return parseDuration(s.timeWait) ?? secondsBetween(s.startAt ?? s.createdAt, s.firstResponseAt);
}

/** Tempo de atendimento (s): campo timeService da API, senão fim − 1ª resposta (ou início). */
export function serviceSeconds(s) {
  if (!s.endAt) return null;
  return parseDuration(s.timeService) ?? secondsBetween(s.firstResponseAt ?? s.startAt ?? s.createdAt, s.endAt);
}

const ACTIVE = new Set(['STARTED', 'PENDING', 'IN_PROGRESS']);

/**
 * @param {object} p
 * @param {object[]} p.sessions  conversas (ativas ∪ criadas hoje ∪ concluídas hoje), sem duplicatas
 * @param {object[]} p.agents    usuários da conta
 * @param {Date}     p.dayStart  meia-noite local em UTC
 * @param {string}   p.tz
 */
export function buildSnapshot({ sessions, agents, dayStart, tz, now = new Date() }) {
  const t0 = dayStart.getTime();
  const isToday = (iso) => iso && new Date(iso).getTime() >= t0;

  const startedToday = sessions.filter((s) => isToday(s.startAt ?? s.createdAt));
  const completedToday = sessions.filter((s) => s.status === 'COMPLETED' && isToday(s.endAt));
  const active = sessions.filter((s) => ACTIVE.has(s.status));
  const inQueue = active.filter((s) => s.status === 'PENDING');
  const inProgress = active.filter((s) => s.status === 'IN_PROGRESS');
  const inBot = active.filter((s) => s.status === 'STARTED');

  // Espera só conta conversas de hoje que já foram respondidas por alguém
  const answeredToday = startedToday.filter((s) => s.userId && (s.firstResponseAt || s.timeWait));

  // ---------- por atendente ----------
  const byUser = new Map();
  const ensure = (userId, fallback) => {
    if (!byUser.has(userId)) {
      byUser.set(userId, {
        userId,
        name: fallback?.name ?? fallback?.shortName ?? 'Sem nome',
        pictureUrl: fallback?.pictureUrl ?? null,
        profile: null,
        active: 0,
        completed: 0,
        received: 0,
        _service: [],
        _wait: [],
        lastActivityAt: null,
      });
    }
    return byUser.get(userId);
  };

  for (const a of agents) {
    const row = ensure(a.userId, a);
    row.name = a.shortName || a.name || row.name;
    row.profile = a.profile ?? null;
  }

  const touch = (row, iso) => {
    if (iso && (!row.lastActivityAt || iso > row.lastActivityAt)) row.lastActivityAt = iso;
  };

  for (const s of active) {
    if (!s.userId) continue;
    const row = ensure(s.userId, s.agentDetails);
    if (s.status === 'IN_PROGRESS') row.active++;
    touch(row, s.lastMessageOut);
  }
  for (const s of startedToday) {
    if (!s.userId) continue;
    const row = ensure(s.userId, s.agentDetails);
    row.received++;
    row._wait.push(waitSeconds(s));
    touch(row, s.lastMessageOut);
  }
  for (const s of completedToday) {
    if (!s.userId) continue;
    const row = ensure(s.userId, s.agentDetails);
    row.completed++;
    row._service.push(serviceSeconds(s));
    touch(row, s.endAt);
  }

  const agentRows = [...byUser.values()]
    .map(({ _service, _wait, ...r }) => ({
      ...r,
      avgServiceSec: avg(_service),
      avgWaitSec: avg(_wait),
    }))
    // todos os usuários aparecem, mesmo sem nenhuma conversa hoje (card zerado)
    .sort((a, b) => b.completed - a.completed || b.active - a.active || a.name.localeCompare(b.name));

  // ---------- por hora ----------
  const currentHour = localHour(tz, now);
  const hourly = Array.from({ length: currentHour + 1 }, (_, h) => ({ hour: h, received: 0, completed: 0 }));
  for (const s of startedToday) {
    const h = localHour(tz, new Date(s.startAt ?? s.createdAt));
    if (hourly[h]) hourly[h].received++;
  }
  for (const s of completedToday) {
    const h = localHour(tz, new Date(s.endAt));
    if (hourly[h]) hourly[h].completed++;
  }

  // ---------- ao vivo ----------
  const order = { PENDING: 0, STARTED: 1, IN_PROGRESS: 2 };
  const live = active
    .map((s) => ({
      id: s.id,
      number: s.number,
      status: s.status,
      contactName: s.contactDetails?.name ?? s.title ?? 'Contato',
      agentUserId: s.userId,
      agentName: s.userId ? (byUser.get(s.userId)?.name ?? s.agentDetails?.name ?? '—') : null,
      department: s.departmentDetails?.name ?? null,
      channel: s.channelDetails?.platform ?? s.channelType ?? null,
      startAt: s.startAt ?? s.createdAt,
      firstResponseAt: s.firstResponseAt,
      lastMessageIn: s.lastMessageIn,
      lastMessageOut: s.lastMessageOut,
      lastMessageText: s.lastMessageText,
      unreadCount: s.unreadCount ?? 0,
      previewUrl: s.previewUrl,
    }))
    .sort((a, b) => order[a.status] - order[b.status] || (a.startAt < b.startAt ? -1 : 1));

  const oldestQueued = inQueue.map((s) => s.startAt ?? s.createdAt).sort()[0] ?? null;

  return {
    generatedAt: now.toISOString(),
    dayStart: dayStart.toISOString(),
    tz,
    totals: {
      received: startedToday.length,
      completed: completedToday.length,
      active: active.length,
      inQueue: inQueue.length,
      inProgress: inProgress.length,
      inBot: inBot.length,
      avgServiceSec: avg(completedToday.filter((s) => s.userId).map(serviceSeconds)),
      avgWaitSec: avg(answeredToday.map(waitSeconds)),
      oldestQueuedAt: oldestQueued,
    },
    agents: agentRows,
    hourly,
    live,
  };
}