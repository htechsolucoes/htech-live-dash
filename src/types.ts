export type SessionStatus = 'STARTED' | 'PENDING' | 'IN_PROGRESS' | 'COMPLETED'

export interface Totals {
  received: number
  completed: number
  active: number
  inQueue: number
  inProgress: number
  inBot: number
  avgServiceSec: number | null
  avgWaitSec: number | null
  oldestQueuedAt: string | null
}

export interface AgentRow {
  userId: string
  name: string
  pictureUrl: string | null
  profile: string | null
  active: number
  completed: number
  received: number
  avgServiceSec: number | null
  avgWaitSec: number | null
  lastActivityAt: string | null
}

export interface HourBucket {
  hour: number
  received: number
  completed: number
}

export interface LiveSession {
  id: string
  number: string | null
  status: SessionStatus
  contactName: string
  agentUserId: string | null
  agentName: string | null
  department: string | null
  channel: string | null
  startAt: string
  firstResponseAt: string | null
  lastMessageIn: string | null
  lastMessageOut: string | null
  lastMessageText: string | null
  unreadCount: number
  previewUrl: string | null
}

export interface Department {
  id: string
  name: string
}

export interface Snapshot {
  generatedAt: string
  dayStart: string
  tz: string
  department: string | null
  departments: Department[]
  totals: Totals
  agents: AgentRow[]
  hourly: HourBucket[]
  live: LiveSession[]
}
