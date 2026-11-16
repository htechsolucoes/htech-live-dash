/** 75 → "1m 15s", 3700 → "1h 01m" */
export function fmtDuration(sec: number | null | undefined): string {
  if (sec == null || !Number.isFinite(sec)) return '—'
  const s = Math.max(0, Math.round(sec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  if (h) return `${h}h ${String(m).padStart(2, '0')}m`
  if (m) return `${m}m ${String(r).padStart(2, '0')}s`
  return `${r}s`
}

/** Cronômetro "mm:ss" ou "h:mm:ss" desde `iso` até `now`. */
export function fmtClock(iso: string | null, now: number): string {
  if (!iso) return '—'
  const s = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(r).padStart(2, '0')
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

export const secondsSince = (iso: string | null, now: number) =>
  iso ? Math.max(0, (now - new Date(iso).getTime()) / 1000) : null

export function fmtAgo(iso: string | null, now: number): string {
  const s = secondsSince(iso, now)
  if (s == null) return '—'
  if (s < 60) return 'agora'
  if (s < 3600) return `há ${Math.floor(s / 60)} min`
  return `há ${Math.floor(s / 3600)}h${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}`
}

export function fmtTime(iso: string | null, tz: string): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('pt-BR', { timeZone: tz, hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('')
}

/** Limites (em segundos) para destacar esperas longas. Ajuste conforme a operação. */
export const WAIT_WARNING_SEC = 5 * 60
export const WAIT_CRITICAL_SEC = 10 * 60

export type Level = 'ok' | 'warning' | 'critical'
export const waitLevel = (sec: number | null): Level =>
  sec == null ? 'ok' : sec >= WAIT_CRITICAL_SEC ? 'critical' : sec >= WAIT_WARNING_SEC ? 'warning' : 'ok'
