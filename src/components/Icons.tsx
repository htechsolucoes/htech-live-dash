// Ícones em SVG (traço, herdam a cor do texto via currentColor)

type P = { size?: number; title?: string }

const base = (size: number, title?: string) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  role: title ? 'img' : undefined,
  'aria-hidden': title ? undefined : true,
  'aria-label': title,
})

/** Check — atendimentos concluídos */
export const CheckIcon = ({ size = 16, title }: P) => (
  <svg {...base(size, title)}>
    <circle cx="12" cy="12" r="9" />
    <path d="m8.5 12.5 2.5 2.5 4.5-5" />
  </svg>
)

/** Balão de conversa — atendimentos em andamento */
export const ChatIcon = ({ size = 16, title }: P) => (
  <svg {...base(size, title)}>
    <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.6 8.6 0 0 1-3.9-.9L3 20.5l1.6-4.6A8.3 8.3 0 0 1 3 11.5 8.5 8.5 0 0 1 12 3a8.5 8.5 0 0 1 9 8.5Z" />
    <path d="M8 11.5h.01M12 11.5h.01M16 11.5h.01" strokeWidth={2.6} />
  </svg>
)

/** Relógio com alerta — fila de espera */
export const ClockAlertIcon = ({ size = 20, title }: P) => (
  <svg {...base(size, title)}>
    <path d="M20.4 13.4A8.5 8.5 0 1 1 13 3.6" />
    <path d="M11.5 7.5V12l3 1.8" />
    <path d="M19 3.5v4" />
    <path d="M19 10.5h.01" strokeWidth={2.6} />
  </svg>
)

/** Funil — filtro */
export const FilterIcon = ({ size = 16, title }: P) => (
  <svg {...base(size, title)}>
    <path d="M3 5h18l-7 8.5V19l-4 2v-7.5Z" />
  </svg>
)

/** Pessoa — filtro de usuário */
export const UserIcon = ({ size = 16, title }: P) => (
  <svg {...base(size, title)}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20.5c1.4-3.6 4.4-5.5 8-5.5s6.6 1.9 8 5.5" />
  </svg>
)

/** Calendário — barra de "Hoje" */
export const CalendarIcon = ({ size = 16, title }: P) => (
  <svg {...base(size, title)}>
    <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
  </svg>
)

/** Setas circulares — atualizar */
export const RefreshIcon = ({ size = 16, title, className }: P & { className?: string }) => (
  <svg {...base(size, title)} className={className}>
    <path d="M20 11.5A8 8 0 0 0 6.3 6.3L4 8.5" />
    <path d="M4 4v4.5h4.5" />
    <path d="M4 12.5a8 8 0 0 0 13.7 5.2l2.3-2.2" />
    <path d="M20 20v-4.5h-4.5" />
  </svg>
)