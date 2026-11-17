import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import type { Option } from '../types'

interface Props {
  /** rótulo do card, ex.: "Equipe" */
  label: string
  icon: ReactNode
  /** opção que limpa o filtro, ex.: "Todas as equipes" */
  allLabel: string
  /** texto mostrado no card quando não há filtro, ex.: "Todas" */
  allShort: string
  options: Option[]
  value: string
  onChange: (id: string) => void
}

/**
 * Filtro com cara de card (na linha de números) e lista própria, estilizada.
 * Teclado: ↓/↑/Enter/Espaço abrem; ↓/↑/Home/End navegam; Enter/Espaço escolhem; Esc fecha.
 * Fecha também ao clicar fora.
 */
export function FilterDropdown({ label, icon, allLabel, allShort, options: items, value, onChange }: Props) {
  const options = [{ id: '', name: allLabel }, ...items]
  const selectedIndex = Math.max(0, options.findIndex((o) => o.id === value))
  const current = value ? (items.find((d) => d.id === value)?.name ?? allShort) : allShort

  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(selectedIndex)
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const baseId = useId()
  const listId = `${baseId}-lista`
  const optionId = (i: number) => `${baseId}-opcao-${i}`

  const openList = () => {
    setActive(selectedIndex)
    setOpen(true)
  }
  const close = (focusButton = true) => {
    setOpen(false)
    if (focusButton) buttonRef.current?.focus()
  }
  const choose = (i: number) => {
    const option = options[i]
    if (option) onChange(option.id)
    close()
  }

  // ao abrir: foco na lista + fechar ao clicar fora
  useEffect(() => {
    if (!open) return
    listRef.current?.focus()
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  // mantém a opção destacada visível quando a lista rola
  useEffect(() => {
    if (open) document.getElementById(optionId(active))?.scrollIntoView({ block: 'nearest' })
  })

  const onButtonKeyDown = (e: KeyboardEvent) => {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
      e.preventDefault()
      openList()
    }
  }

  const onListKeyDown = (e: KeyboardEvent) => {
    const last = options.length - 1
    const moves: Record<string, () => void> = {
      ArrowDown: () => setActive((i) => Math.min(last, i + 1)),
      ArrowUp: () => setActive((i) => Math.max(0, i - 1)),
      Home: () => setActive(0),
      End: () => setActive(last),
      Enter: () => choose(active),
      ' ': () => choose(active),
      Escape: () => close(),
    }
    if (e.key === 'Tab') return close(false)
    const move = moves[e.key]
    if (move) {
      e.preventDefault()
      move()
    }
  }

  return (
    <div ref={rootRef} className="relative min-w-0">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={`Filtrar por ${label.toLowerCase()}: ${current}`}
        onClick={() => (open ? close() : openList())}
        onKeyDown={onButtonKeyDown}
        className={`flex w-full min-w-0 cursor-pointer flex-col gap-0.5 rounded-xl border-[1.5px] border-primary px-3.5 py-2.5 text-left outline-none hover:bg-primary-50 focus-visible:ring-2 focus-visible:ring-primary-100 ${
          open ? 'bg-primary-50 ring-2 ring-primary-100' : 'bg-white'
        }`}
      >
        <span className="flex items-center gap-1.5 text-xs text-primary-700">
          {icon}
          {label}
        </span>
        <span className="flex items-center justify-between gap-2 text-xl leading-snug font-bold text-primary-900">
          <span className="truncate">{current}</span>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`shrink-0 text-primary transition-transform ${open ? 'rotate-180' : ''}`}
            aria-hidden
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </span>
      </button>

      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          tabIndex={-1}
          aria-label={label}
          aria-activedescendant={optionId(active)}
          onKeyDown={onListKeyDown}
          className="scroll-thin absolute top-full left-0 z-30 mt-2 max-h-72 w-full min-w-56 overflow-y-auto rounded-xl border border-primary-100 bg-white p-1.5 shadow-[0_10px_30px_rgba(11,37,64,0.16)] outline-none"
        >
          {options.map((o, i) => {
            const selected = o.id === value
            return (
              <li
                key={o.id || 'todos'}
                id={optionId(i)}
                role="option"
                aria-selected={selected}
                onPointerEnter={() => setActive(i)}
                onClick={() => choose(i)}
                className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm ${
                  i === active ? 'bg-primary-50' : ''
                } ${selected ? 'font-semibold text-primary-900' : 'text-ink'}`}
              >
                <span className="truncate">{o.name}</span>
                {selected && (
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.4}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="shrink-0 text-primary"
                    aria-hidden
                  >
                    <path d="m5 12.5 4.5 4.5L19 7.5" />
                  </svg>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}