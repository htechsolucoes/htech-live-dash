import { fmtDuration, secondsSince, waitLevel } from '../format'
import type { Department, Snapshot } from '../types'
import { FilterIcon } from './Icons'

interface Props {
  snapshot: Snapshot
  /** erro da última tentativa de atualização (os dados na tela são da anterior) */
  error: string | null
  now: number
  department: string
  onDepartmentChange: (id: string) => void
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

/**
 * Filtro de equipe com cara de card (primeiro da linha de números).
 * O <select> nativo fica invisível por cima do card: abre a lista do sistema e funciona com teclado e leitor de tela.
 */
function DepartmentCard({ departments, value, onChange }: { departments: Department[]; value: string; onChange: (id: string) => void }) {
  const current = departments.find((d) => d.id === value)?.name ?? 'Todas'
  return (
    <div className="relative flex min-w-0 flex-col gap-0.5 rounded-xl border-[1.5px] border-primary bg-white px-3.5 py-2.5 focus-within:ring-2 focus-within:ring-primary-100 hover:bg-primary-50">
      <span className="flex items-center gap-1.5 text-xs text-primary-700">
        <FilterIcon size={14} />
        Equipe
      </span>
      <span className="flex items-center justify-between gap-2 text-xl leading-snug font-bold text-primary-900">
        <span className="truncate">{current}</span>
        <ChevronIcon />
      </span>
      <select
        aria-label="Filtrar por equipe"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        <option value="">Todas as equipes</option>
        {departments.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </select>
    </div>
  )
}

const ChevronIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-primary" aria-hidden>
    <path d="m6 9 6 6 6-6" />
  </svg>
)

/** Barra superior: filtro de equipe + números gerais do dia. */
export function Header({ snapshot, error, now, department, onDepartmentChange }: Props) {
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
        className={`grid grid-cols-2 gap-2.5 sm:grid-cols-4 ${hasDepartments ? 'xl:grid-cols-7' : 'xl:grid-cols-6'}`}
        aria-label="Números do dia"
      >
        {hasDepartments && (
          <DepartmentCard departments={snapshot.departments} value={department} onChange={onDepartmentChange} />
        )}
        <Stat label="Recebidos" value={t.received} hint={t.inBot ? `${t.inBot} no chatbot` : undefined} />
        <Stat label="Concluídos" value={t.completed} />
        <Stat label="Em atendimento" value={t.inProgress} />
        <Stat label="Na fila" value={t.inQueue} alert={t.inQueue > 0 && waitLevel(oldestWait) !== 'ok'} />
        <Stat label="Tempo médio de atendimento" value={fmtDuration(t.avgServiceSec)} />
        <Stat label="Tempo médio de espera" value={fmtDuration(t.avgWaitSec)} />
      </div>

      {error && (
        <div className="rounded-lg border border-gray-200 bg-gray-100 px-3 py-2 text-sm" role="alert">
          Não foi possível atualizar agora — mostrando os dados de {updated}. Detalhe: {error}
        </div>
      )}
    </header>
  )
}
