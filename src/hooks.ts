import { useCallback, useEffect, useRef, useState } from 'react'
import type { Snapshot } from './types'

/** De quantos em quantos segundos a tela busca dados novos. */
const POLL_MS = 15_000

export type Status = 'loading' | 'ok' | 'denied' | 'error'

/**
 * IDs que a plataforma coloca no link do botão, no caminho da URL:
 *   https://<painel>.vercel.app/<Id da conta>/<Id do usuário>
 * Qualquer outro formato (sem os dois IDs, ou com partes a mais) chega vazio e o servidor bloqueia.
 */
function readPlatformParams() {
  const parts = window.location.pathname.split('/').filter(Boolean)
  if (parts.length !== 2) return { conta: '', usuario: '' }
  const decode = (v: string) => {
    try {
      return decodeURIComponent(v)
    } catch {
      return ''
    }
  }
  return { conta: decode(parts[0]!), usuario: decode(parts[1]!) }
}

/**
 * Busca /api/snapshot a cada 15 s, enviando os IDs da conta e do usuário que vieram no link. Se a API falhar, mantém os últimos dados na tela e mostra o erro.
 * `department` / `user` vazios = sem filtro.
 */
export function useSnapshot(department: string, user: string) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [status, setStatus] = useState<Status>('loading')
  const [error, setError] = useState<string | null>(null)
  const [platform] = useState(readPlatformParams)
  const [refreshing, setRefreshing] = useState(false)
  const [nonce, setNonce] = useState(0) // muda a cada clique em "Atualizar"
  const forceNext = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()

    async function load() {
      try {
        const q = new URLSearchParams()
        if (department) q.set('department', department)
        if (user) q.set('user', user)
        if (forceNext.current) q.set('fresh', '1')
        forceNext.current = false
        const query = q.toString()
        const url = query ? `/api/snapshot?${query}` : '/api/snapshot'
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
      if (!cancelled) {
        setRefreshing(false)
        timer.current = setTimeout(load, POLL_MS)
      }
    }

    load()
    return () => {
      cancelled = true
      controller.abort()
      clearTimeout(timer.current)
    }
  }, [department, user, platform, nonce])

  /** Botão "Atualizar": busca agora (sem esperar os 15 s) e reinicia a contagem. */
  const refresh = useCallback(() => {
    forceNext.current = true
    setRefreshing(true)
    setNonce((n) => n + 1)
  }, [])

  return { snapshot, status, error, refresh, refreshing }
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

/**
 * Filtro guardado no endereço da página (?equipe=<id>, ?atendente=<id>), para poder deixar
 * uma tela fixa num filtro e para o filtro sobreviver a um recarregar.
 */
export function useUrlParam(key: string) {
  const [value, setValue] = useState(() => new URLSearchParams(window.location.search).get(key) ?? '')

  const change = useCallback(
    (id: string) => {
      const url = new URL(window.location.href)
      if (id) url.searchParams.set(key, id)
      else url.searchParams.delete(key)
      window.history.replaceState(null, '', url)
      setValue(id)
    },
    [key],
  )

  return [value, change] as const
}