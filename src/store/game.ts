import { create } from 'zustand'
import type { Campaign, Character, ChatMessage, Collections, LiveEvent, Member, Scene, TableName, Token } from '../types'
import type { CampaignSubscription, Change, PresenceUser, User } from '../data/backend'
import { backend } from '../data'

/** Callbacks de eventos efêmeros (dados 3D, VFX, pings) — consumidos pelo canvas. */
type LiveListener = (e: LiveEvent) => void
const liveListeners = new Set<LiveListener>()
export function onLive(cb: LiveListener) {
  liveListeners.add(cb)
  return () => {
    liveListeners.delete(cb)
  }
}
export function emitLocalLive(e: LiveEvent) {
  liveListeners.forEach((l) => l(e))
}

export type Tool = 'select' | 'ruler' | 'aoe' | 'spell' | 'walls' | 'fog' | 'light' | 'ping' | 'build'

interface GameState {
  user: User | null
  campaignId: string | null
  campaign: Campaign | null
  members: Record<string, Member>
  characters: Record<string, Character>
  scenes: Record<string, Scene>
  tokens: Record<string, Token>
  chat: Record<string, ChatMessage>
  presence: PresenceUser[]
  status: 'connecting' | 'online' | 'offline'
  loading: boolean
  error: string | null

  /** Cena que este cliente está vendo (o mestre pode olhar outras cenas sem mover os jogadores). */
  viewSceneId: string | null
  /** Posições temporárias enquanto alguém arrasta (sem gravar). */
  dragging: Record<string, { x: number; y: number; at: number }>
  selected: string[]
  tool: Tool
  /** O mestre pode ver a mesa "como jogador". */
  previewAsPlayer: boolean
  mode25d: boolean
  lowFx: boolean
  openSheetId: string | null

  setUser(u: User | null): void
  enter(campaignId: string): Promise<void>
  leave(): void
  reload(): Promise<void>
  apply(change: Change): void
  save<T extends TableName>(table: T, row: Collections[T]): Promise<void>
  patch<T extends 'tokens' | 'characters' | 'scenes' | 'campaigns' | 'members'>(
    table: T,
    id: string,
    p: Partial<Collections[T]>,
  ): Promise<void>
  removeRow<T extends TableName>(table: T, row: Collections[T]): Promise<void>
  send(e: LiveEvent): void
  set(p: Partial<GameState>): void
}

let sub: CampaignSubscription | null = null
/** Cada entrada/saída incrementa; respostas de carregamentos antigos são descartadas. */
let epoch = 0

const TABLE_KEYS: Record<TableName, keyof GameState> = {
  campaigns: 'campaign',
  members: 'members',
  characters: 'characters',
  scenes: 'scenes',
  tokens: 'tokens',
  chat: 'chat',
}

function byId<T extends { id: string }>(rows: T[]): Record<string, T> {
  return Object.fromEntries(rows.map((r) => [r.id, r]))
}

export const useGame = create<GameState>((set, get) => ({
  user: null,
  campaignId: null,
  campaign: null,
  members: {},
  characters: {},
  scenes: {},
  tokens: {},
  chat: {},
  presence: [],
  status: 'connecting',
  loading: false,
  error: null,
  viewSceneId: null,
  dragging: {},
  selected: [],
  tool: 'select',
  previewAsPlayer: false,
  mode25d: false,
  lowFx: typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches,
  openSheetId: null,

  set: (p) => set(p),
  setUser: (u) => set({ user: u }),

  enter: async (campaignId) => {
    const user = get().user
    if (!user) return
    sub?.close()
    sub = null
    const my = ++epoch
    set({ campaignId, loading: true, error: null, status: 'connecting', viewSceneId: null, selected: [] })
    try {
      await get().reload()
    } catch (e) {
      if (my === epoch) set({ loading: false, error: (e as Error).message })
      return
    }
    if (my !== epoch) return
    const me = get().members[`${campaignId}:${user.id}`]
    if (!me) {
      set({ loading: false, error: 'Você não faz parte desta campanha.' })
      return
    }
    sub = backend.subscribe(campaignId, user.id, me.role === 'gm', {
      onChange: (c) => get().apply(c),
      onLive: (e) => {
        if (e.type === 'drag') {
          set((s) => ({ dragging: { ...s.dragging, [e.tokenId]: { x: e.x, y: e.y, at: performance.now() } } }))
        }
        if (e.type === 'pull') {
          const myMember = get().members[`${campaignId}:${user.id}`]
          if (myMember?.role !== 'gm') set({ viewSceneId: e.sceneId })
        }
        liveListeners.forEach((l) => l(e))
      },
      onPresence: (users) => set({ presence: users }),
      onReconnect: () => void get().reload(),
      onStatus: (status) => set({ status }),
    })
    set({ loading: false })
  },

  leave: () => {
    epoch++
    sub?.close()
    sub = null
    set({ campaignId: null, campaign: null, members: {}, characters: {}, scenes: {}, tokens: {}, chat: {}, presence: [] })
  },

  reload: async () => {
    const id = get().campaignId
    if (!id) return
    const my = epoch
    const [campaigns, members, characters, scenes, tokens, chat] = await Promise.all([
      backend.select('campaigns', id),
      backend.select('members', id),
      backend.select('characters', id),
      backend.select('scenes', id),
      backend.select('tokens', id),
      backend.select('chat', id),
    ])
    if (my !== epoch || get().campaignId !== id) return
    if (!campaigns[0]) throw new Error('Campanha não encontrada ou sem acesso.')
    set({
      campaign: campaigns[0],
      members: byId(members),
      characters: byId(characters),
      scenes: byId(scenes),
      tokens: byId(tokens),
      chat: byId(chat),
    })
  },

  apply: ({ table, op, row }) => {
    if (row.campaign_id !== get().campaignId) return
    if (table === 'campaigns') {
      if (op === 'upsert') set({ campaign: row as Campaign })
      return
    }
    const key = TABLE_KEYS[table]
    set((s) => {
      const coll = { ...(s[key] as Record<string, unknown>) }
      if (op === 'delete') delete coll[row.id]
      else coll[row.id] = row
      const extra: Partial<GameState> = {}
      if (table === 'tokens' && s.dragging[row.id]) {
        const d = { ...s.dragging }
        delete d[row.id]
        extra.dragging = d
      }
      return { [key]: coll, ...extra } as Partial<GameState>
    })
  },

  save: async (table, row) => {
    // otimista: aplica localmente e grava
    get().apply({ table, op: 'upsert', row: { ...row, updated_at: new Date().toISOString() } } as Change)
    try {
      await backend.upsert(table, row)
    } catch (e) {
      set({ error: `Não foi possível salvar: ${(e as Error).message}` })
      void get().reload()
    }
  },

  patch: async (table, id, p) => {
    const s = get()
    const current =
      table === 'campaigns'
        ? s.campaign
        : (s[TABLE_KEYS[table]] as Record<string, Collections[typeof table]>)[id]
    if (!current) return
    await get().save(table, { ...current, ...p } as Collections[typeof table])
  },

  removeRow: async (table, row) => {
    get().apply({ table, op: 'delete', row } as Change)
    try {
      await backend.remove(table, row)
    } catch (e) {
      set({ error: `Não foi possível remover: ${(e as Error).message}` })
      void get().reload()
    }
  },

  send: (e) => {
    sub?.send(e)
  },
}))

export function trackPresence(state: { name: string; sceneId: string | null; color: string }) {
  sub?.track(state)
}

// ------------------------------------------------------------ Seletores

export function useMe(): Member | null {
  return useGame((s) => (s.user && s.campaignId ? (s.members[`${s.campaignId}:${s.user.id}`] ?? null) : null))
}

export function useIsGm(): boolean {
  return useGame((s) => {
    if (!s.user || !s.campaignId) return false
    return s.members[`${s.campaignId}:${s.user.id}`]?.role === 'gm' && !s.previewAsPlayer
  })
}

export function isGmNow(): boolean {
  const s = useGame.getState()
  if (!s.user || !s.campaignId) return false
  return s.members[`${s.campaignId}:${s.user.id}`]?.role === 'gm' && !s.previewAsPlayer
}

export function activeSceneId(s: GameState): string | null {
  return s.viewSceneId ?? s.campaign?.active_scene_id ?? Object.values(s.scenes).sort((a, b) => a.sort - b.sort)[0]?.id ?? null
}

export function useScene(): Scene | null {
  return useGame((s) => {
    const id = activeSceneId(s)
    return id ? (s.scenes[id] ?? null) : null
  })
}
