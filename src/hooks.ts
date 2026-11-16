import { useEffect, useRef, useState } from 'react'
import type { Snapshot } from './types'

/** De quantos em quantos segundos a tela busca dados novos. */
const POLL_MS = 15_000

export type Status = 'loading' | 'ok' | 'denied' | 'error'

/** IDs que a plataforma coloca no link do botão: ?conta=<Id da conta>&usuario=<Id do usuário> */
function readPlatformParams() {
  const q = new URLSearchParams(window.location.search)
  return { conta: q.get('conta') ?? '', usuario: q.get('usuario') ?? '' }
}

/**
 * Busca /api/snapshot a cada 15 s, enviando os IDs da conta e do usuário que vieram no link. Se a API falhar, mantém os últimos dados na tela e mostra o erro.
 * `department` vazio = todas as equipes.
 */
export function useSnapshot(department: string) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [status, setStatus] = useState<Status>('loading')
  const [error, setError] = useState<string | null>(null)
  const [platform] = useState(readPlatformParams)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()

    async function load() {
      try {
        const url = department ? `/api/snapshot?department=${encodeURIComponent(department)}` : '/api/snapshot'
        const headers = { 'x-dash-conta': platform.conta, 'x-dash-usuario': platform.usuario }
        const res = await fetch(url, { headers, signal: controller.signal })
        if (cancelled) return
        const body = await res.json()
        if (res.status === 403) {
          setError(body?.error ?? 'Acesso negado')
          setStatus('denied')
          return
        }
        if (!res.ok) throw new Error(body?.error ?? `Erro ${res.status}`)
        setSnapshot(body)
        setError(null)
        setStatus('ok')
      } catch (err) {
        if (cancelled || controller.signal.aborted) return
        setError(err instanceof Error ? err.message : String(err))
        setStatus((s) => (s === 'loading' ? 'error' : s))
      }
      if (!cancelled) timer.current = setTimeout(load, POLL_MS)
    }

    load()
    return () => {
      cancelled = true
      controller.abort()
      clearTimeout(timer.current)
    }
  }, [department, platform])

  return { snapshot, status, error }
}

/** Relógio que atualiza a cada `ms` — usado nos cronômetros ao vivo. */
export function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(id)
  }, [ms])
  return now
}

/** Equipe escolhida, guardada no endereço da página (?equipe=<id>) para poder deixar uma TV fixa numa equipe. */
export function useDepartmentParam() {
  const [department, setDepartment] = useState(() => new URLSearchParams(window.location.search).get('equipe') ?? '')

  const change = (id: string) => {
    const url = new URL(window.location.href)
    if (id) url.searchParams.set('equipe', id)
    else url.searchParams.delete('equipe')
    window.history.replaceState(null, '', url)
    setDepartment(id)
  }

  return [department, change] as const
}
