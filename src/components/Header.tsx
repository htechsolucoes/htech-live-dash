import { fmtDuration, secondsSince, waitLevel } from '../format'
import type { Snapshot } from '../types'
import { FilterDropdown } from './FilterDropdown'
import { FilterIcon, UserIcon } from './Icons'

interface Props {
  snapshot: Snapshot
  /** erro da última tentativa de atualização (os dados na tela são da anterior) */
  error: string | null
  now: number
  department: string
  onDepartmentChange: (id: string) => void
  user: string
  onUserChange: (id: string) => void
}

function Stat({ label, value, hint, alert }: { label: string; value: string | number; hint?: string; alert?: boolean }) {
  return (
    <div
      className={`flex min-w-0 flex-col gap-0.5 rounded-xl border px-3.5 py-2.5 ${
        alert ? 'border-danger-200 bg-danger-50' : 'border-primary-100 bg-primary-50'
      }`}
    >
      <span className={`truncate text-xs ${alert ? 'text-danger-700' : 'text-gray'}`}>{label}</span>
      <span className={`text-2xl leading-tight font-bold tabular-nums ${alert ? 'text-danger-700' : 'text-primary-900'}`}>{value}</span>
      {hint && <span className="text-[11px] text-gray">{hint}</span>}
    </div>
  )
}

/** Barra superior: filtro de equipe + números gerais do dia. */
export function Header({ snapshot, error, now, department, onDepartmentChange, user, onUserChange }: Props) {
  const t = snapshot.totals
  const hasDepartments = snapshot.departments.length > 0
  const oldestWait = secondsSince(t.oldestQueuedAt, now)
  const updated = new Intl.DateTimeFormat('pt-BR', {
    timeZone: snapshot.tz,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(snapshot.generatedAt))

  return (
    <header className="sticky top-0 z-10 flex flex-col gap-3 border-b border-gray-200 bg-white px-4 py-4 sm:px-7">
      <div
        className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 2xl:grid-cols-8"
        aria-label="Números do dia"
      >
        {hasDepartments && (
          <FilterDropdown
            label="Equipe"
            icon={<FilterIcon size={14} />}
            allLabel="Todas as equipes"
            allShort="Todas"
            options={snapshot.departments}
            value={department}
            onChange={onDepartmentChange}
          />
        )}
        <FilterDropdown
          label="Usuário"
          icon={<UserIcon size={14} />}
          allLabel="Todos os usuários"
          allShort="Todos"
          options={snapshot.users}
          value={user}
          onChange={onUserChange}
        />
        <Stat label="Recebidos" value={t.received} hint={t.inBot ? `${t.inBot} no chatbot` : undefined} />
        <Stat label="Concluídos" value={t.completed} />
        <Stat label="Em atendimento" value={t.inProgress} />
        <Stat label="Na fila" value={t.inQueue} alert={t.inQueue > 0 && waitLevel(oldestWait) !== 'ok'} />
        <Stat label="Tempo médio de atendimento" value={fmtDuration(t.avgServiceSec)} />
        <Stat label="Tempo médio de espera" value={fmtDuration(t.avgWaitSec)} />
      </div>

      {error && (
        <div className="rounded-lg border border-gray-200 bg-gray-100 px-3 py-2 text-sm" role="alert">
          Erro ao atualizar — mostrando os dados de {updated}.
        </div>
      )}
    </header>
  )
}