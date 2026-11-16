import type { ReactNode } from 'react'
import { fmtAgo, fmtClock, initials, secondsSince, waitLevel } from '../format'
import type { AgentRow, LiveSession } from '../types'
import { ChatIcon, CheckIcon, ClockAlertIcon } from './Icons'

interface Props {
  agents: AgentRow[]
  live: LiveSession[]
  now: number
}

function ContactName({ s }: { s: LiveSession }) {
  return s.previewUrl ? (
    <a href={s.previewUrl} target="_blank" rel="noreferrer" className="truncate hover:underline hover:underline-offset-2">
      {s.contactName}
    </a>
  ) : (
    <span className="truncate">{s.contactName}</span>
  )
}

/** Ícone + número na faixa do card (✓ concluídos, 💬 em andamento / aguardando). */
function Counter({ icon, value, label }: { icon: ReactNode; value: number; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[17px] font-semibold text-white" title={label}>
      {icon}
      <span className="tabular-nums">{value}</span>
      <span className="sr-only">{label}</span>
    </span>
  )
}

/**
 * Card padrão (estilo "faixa colorida no topo"): faixa azul — vermelha na fila — com título e números,
 * corpo branco com rolagem interna. Todos os cards têm a mesma altura (h-block).
 */
function Block({
  label,
  avatar,
  title,
  counters,
  children,
  danger,
}: {
  label: string
  avatar: ReactNode
  title: string
  counters: ReactNode
  children: ReactNode
  danger?: boolean
}) {
  return (
    <section
      aria-label={label}
      className="flex h-block min-w-0 flex-col overflow-hidden rounded-2xl bg-white shadow-[0_1px_2px_rgba(11,37,64,0.06),0_4px_16px_rgba(11,37,64,0.08)]"
    >
      <div className={`flex shrink-0 items-center justify-between gap-2.5 px-4 py-3.5 text-white ${danger ? 'bg-danger' : 'bg-primary'}`}>
        <div className="flex min-w-0 items-center gap-2.5">
          {avatar}
          <h2 className="truncate text-[15px] font-semibold">{title}</h2>
        </div>
        <div className="flex shrink-0 items-center gap-3.5">{counters}</div>
      </div>
      <div className={`flex min-h-0 flex-1 flex-col p-3 ${danger ? 'scroll-thin-danger' : 'scroll-thin'}`}>{children}</div>
    </section>
  )
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="grid flex-1 place-items-center rounded-lg bg-slate-50 text-sm text-gray">{children}</p>
}

const listClass = 'm-0 -mr-1 flex min-h-0 flex-1 list-none flex-col gap-2 overflow-y-auto p-0 pr-1'
const rowClass = 'flex shrink-0 items-center justify-between gap-2.5 rounded-lg px-3 py-2.5'

/** Lead na fila: o fundo e o cronômetro ficam mais vermelhos conforme a espera aumenta. */
function QueueCard({ s, now }: { s: LiveSession; now: number }) {
  const lvl = waitLevel(secondsSince(s.startAt, now))
  const bg = lvl === 'ok' ? 'bg-slate-50' : 'bg-danger-50'
  const timer = lvl === 'critical' ? 'text-danger' : lvl === 'warning' ? 'text-danger-700' : 'text-ink'

  return (
    <li className={`${rowClass} ${bg}`}>
      <div className="flex min-w-0 flex-col gap-0.5">
        <strong className="flex items-center gap-1.5 truncate text-sm font-semibold text-ink">
          <ContactName s={s} />
        </strong>
        <span className="truncate text-xs text-gray">{[s.department, s.channel].filter(Boolean).join(' · ') || 'Sem equipe'}</span>
      </div>
      <span className={`shrink-0 text-base font-bold tabular-nums ${timer}`}>{fmtClock(s.startAt, now)}</span>
    </li>
  )
}

/** Conversa em atendimento: destaque azul quando o cliente está aguardando resposta. */
function ConvCard({ s, now }: { s: LiveSession; now: number }) {
  const waitingReply = !!s.lastMessageIn && (!s.lastMessageOut || s.lastMessageIn > s.lastMessageOut)
  return (
    <li className={`${rowClass} ${waitingReply ? 'bg-primary-50' : 'bg-slate-50'}`}>
      <div className="flex min-w-0 flex-col gap-0.5">
        <strong className="flex items-center gap-1.5 truncate text-sm font-semibold text-ink">
          <ContactName s={s} />
          {s.unreadCount > 0 && (
            <span className="inline-grid h-[18px] min-w-[18px] shrink-0 place-items-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-white">
              {s.unreadCount}
            </span>
          )}
        </strong>
        <span className={`truncate text-xs ${waitingReply ? 'font-medium text-primary' : 'text-gray'}`}>
          {waitingReply ? `cliente aguardando resposta ${fmtAgo(s.lastMessageIn, now)}` : (s.department ?? s.channel ?? '')}
        </span>
      </div>
      <span className="shrink-0 text-base font-bold text-primary-900 tabular-nums">{fmtClock(s.firstResponseAt ?? s.startAt, now)}</span>
    </li>
  )
}

const avatarClass = 'grid size-[34px] shrink-0 place-items-center rounded-full bg-white/20 text-[13px] font-bold text-white'

export function Board({ agents, live, now }: Props) {
  const queue = live.filter((s) => s.status === 'PENDING').sort((a, b) => (a.startAt < b.startAt ? -1 : 1))
  const inProgress = live.filter((s) => s.status === 'IN_PROGRESS')

  // Um card por atendente (quem tem conversa aberta ou atendeu hoje)
  const byUser = new Map<string, LiveSession[]>()
  for (const s of inProgress) {
    const key = s.agentUserId ?? 'sem-atendente'
    byUser.set(key, [...(byUser.get(key) ?? []), s])
  }
  const blocks = agents.map((a) => ({
    agent: a,
    sessions: (byUser.get(a.userId) ?? []).sort((x, y) => (x.startAt < y.startAt ? -1 : 1)),
  }))
  // conversas de alguém que não veio na lista de usuários
  for (const [userId, sessions] of byUser) {
    if (!agents.some((a) => a.userId === userId)) {
      blocks.push({ agent: { userId, name: sessions[0]?.agentName ?? 'Sem atendente', completed: 0 } as AgentRow, sessions })
    }
  }
  blocks.sort((a, b) => b.sessions.length - a.sessions.length || a.agent.name.localeCompare(b.agent.name))

  return (
    <main className="grid grid-cols-[repeat(auto-fill,minmax(290px,1fr))] items-start gap-5 px-4 pt-5 pb-10 sm:px-7">
      <Block
        label="Fila de espera"
        danger
        title="Fila de espera"
        avatar={
          <span className={avatarClass} aria-hidden>
            <ClockAlertIcon size={20} />
          </span>
        }
        counters={<Counter icon={<ChatIcon size={22} />} value={queue.length} label="aguardando atendente" />}
      >
        {queue.length > 0 ? (
          <ul className={listClass}>
            {queue.map((s) => (
              <QueueCard key={s.id} s={s} now={now} />
            ))}
          </ul>
        ) : (
          <Empty>Ninguém esperando</Empty>
        )}
      </Block>

      {blocks.map(({ agent, sessions }) => (
        <Block
          key={agent.userId}
          label={`Atendente ${agent.name}`}
          title={agent.name}
          avatar={
            agent.pictureUrl ? (
              <img className="size-[34px] shrink-0 rounded-full object-cover ring-2 ring-white/30" src={agent.pictureUrl} alt="" />
            ) : (
              <span className={avatarClass} aria-hidden>
                {initials(agent.name)}
              </span>
            )
          }
          counters={
            <>
              <Counter icon={<CheckIcon size={22} />} value={agent.completed} label="concluídos hoje" />
              <Counter icon={<ChatIcon size={22} />} value={sessions.length} label="em andamento" />
            </>
          }
        >
          {sessions.length ? (
            <ul className={listClass}>
              {sessions.map((s) => (
                <ConvCard key={s.id} s={s} now={now} />
              ))}
            </ul>
          ) : (
            <Empty>Sem conversas no momento</Empty>
          )}
        </Block>
      ))}
    </main>
  )
}
