import type { Collections, LiveEvent, TableName } from '../types'
import type { Backend, Change, PresenceUser, SubscribeHandlers, User } from './backend'
import { inviteCode, nowIso, uid } from '../lib/id'

/**
 * Modo demonstração: tudo fica no navegador. Cada aba é um usuário diferente
 * (sessionStorage) e as abas conversam via BroadcastChannel, simulando o Realtime.
 */

const PREFIX = 'mesa-arcana:'
const USER_KEY = PREFIX + 'user'

type Msg =
  | { kind: 'change'; campaignId: string; change: Change }
  | { kind: 'live'; campaignId: string; event: LiveEvent }
  | { kind: 'presence'; campaignId: string; user: PresenceUser; leaving?: boolean }

function load<T extends TableName>(table: T): Record<string, Collections[T]> {
  try {
    return JSON.parse(localStorage.getItem(PREFIX + table) || '{}')
  } catch {
    return {}
  }
}
function save<T extends TableName>(table: T, data: Record<string, Collections[T]>) {
  localStorage.setItem(PREFIX + table, JSON.stringify(data))
}

// ---- IndexedDB para imagens/áudio (localStorage tem só ~5 MB)
function idb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('mesa-arcana-assets', 1)
    req.onupgradeneeded = () => req.result.createObjectStore('assets')
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}
async function idbPut(key: string, blob: Blob) {
  const db = await idb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('assets', 'readwrite')
    tx.objectStore('assets').put(blob, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}
async function idbGet(key: string): Promise<Blob | null> {
  const db = await idb()
  return new Promise((resolve, reject) => {
    const req = db.transaction('assets').objectStore('assets').get(key)
    req.onsuccess = () => resolve((req.result as Blob) ?? null)
    req.onerror = () => reject(req.error)
  })
}

export class LocalBackend implements Backend {
  readonly kind = 'local' as const
  private channel = new BroadcastChannel('mesa-arcana')
  private authListeners = new Set<(u: User | null) => void>()
  private urlCache = new Map<string, Promise<string>>()

  private me(): User | null {
    try {
      return JSON.parse(sessionStorage.getItem(USER_KEY) || 'null')
    } catch {
      return null
    }
  }

  async getUser() {
    return this.me()
  }
  onAuthChange(cb: (u: User | null) => void) {
    this.authListeners.add(cb)
    return () => this.authListeners.delete(cb)
  }
  private emitAuth() {
    const u = this.me()
    this.authListeners.forEach((cb) => cb(u))
  }
  async signInMagicLink() {
    throw new Error('Login por e-mail requer o Supabase configurado (.env.local).')
  }
  async signInDiscord() {
    throw new Error('Login com Discord requer o Supabase configurado (.env.local).')
  }
  async signInGuest(name: string) {
    const u: User = { id: uid(), name: name.trim() || 'Aventureiro' }
    sessionStorage.setItem(USER_KEY, JSON.stringify(u))
    this.emitAuth()
    return u
  }
  async updateName(name: string) {
    const u = this.me()
    if (!u) return
    sessionStorage.setItem(USER_KEY, JSON.stringify({ ...u, name }))
    this.emitAuth()
  }
  async signOut() {
    sessionStorage.removeItem(USER_KEY)
    this.emitAuth()
  }

  async listMyCampaigns() {
    const me = this.me()
    if (!me) return []
    const members = Object.values(load('members')).filter((m) => m.user_id === me.id)
    const campaigns = load('campaigns')
    return members.map((m) => campaigns[m.campaign_id]).filter(Boolean)
  }

  async createCampaign(name: string, systemId: string, displayName: string) {
    const me = this.me()!
    const id = uid()
    const c: Collections['campaigns'] = {
      id,
      campaign_id: id,
      name,
      description: '',
      system_id: systemId,
      owner_id: me.id,
      invite_code: inviteCode(),
      active_scene_id: null,
      updated_at: nowIso(),
    }
    await this.upsert('campaigns', c)
    await this.upsert('members', {
      id: `${id}:${me.id}`,
      campaign_id: id,
      user_id: me.id,
      role: 'gm',
      display_name: displayName,
      color: '#a855f7',
    })
    return c
  }

  async joinCampaign(code: string, displayName: string) {
    const me = this.me()!
    const c = Object.values(load('campaigns')).find((x) => x.invite_code === code.trim().toUpperCase())
    if (!c) throw new Error('Código de convite não encontrado (no modo demonstração ele precisa ter sido criado neste navegador).')
    const existing = load('members')[`${c.id}:${me.id}`]
    if (!existing) {
      const colors = ['#e11d48', '#2563eb', '#16a34a', '#d97706', '#0891b2', '#db2777', '#65a30d']
      const count = Object.values(load('members')).filter((m) => m.campaign_id === c.id).length
      await this.upsert('members', {
        id: `${c.id}:${me.id}`,
        campaign_id: c.id,
        user_id: me.id,
        role: 'player',
        display_name: displayName,
        color: colors[count % colors.length],
      })
    }
    return c.id
  }

  async select<T extends TableName>(table: T, campaignId: string) {
    return Object.values(load(table)).filter((r) => r.campaign_id === campaignId)
  }

  async upsert<T extends TableName>(table: T, row: Collections[T]) {
    const data = load(table)
    const stamped = { ...row, updated_at: nowIso() }
    data[row.id] = stamped
    save(table, data)
    const change: Change = { table, op: 'upsert', row: stamped }
    this.local(change)
  }

  async remove<T extends TableName>(table: T, row: Collections[T]) {
    const data = load(table)
    delete data[row.id]
    save(table, data)
    this.local({ table, op: 'delete', row })
  }

  private localHandlers = new Map<string, Set<SubscribeHandlers>>()
  private local(change: Change) {
    const msg: Msg = { kind: 'change', campaignId: change.row.campaign_id, change }
    this.channel.postMessage(msg)
    this.localHandlers.get(change.row.campaign_id)?.forEach((h) => h.onChange(change))
  }

  async endTurn(sceneId: string) {
    const scene = load('scenes')[sceneId]
    if (!scene?.combat.active || !scene.combat.combatants.length) return
    const n = scene.combat.combatants.length
    let turn = scene.combat.turn + 1
    let round = scene.combat.round
    if (turn >= n) {
      turn = 0
      round++
    }
    await this.upsert('scenes', { ...scene, combat: { ...scene.combat, turn, round } })
  }

  async uploadAsset(_campaignId: string, _kind: string, file: Blob) {
    const key = uid()
    await idbPut(key, file)
    return `idb:${key}`
  }

  resolveUrl(url: string): Promise<string> {
    if (!url.startsWith('idb:')) return Promise.resolve(url)
    let p = this.urlCache.get(url)
    if (!p) {
      p = idbGet(url.slice(4)).then((b) => (b ? URL.createObjectURL(b) : ''))
      this.urlCache.set(url, p)
    }
    return p
  }

  subscribe(campaignId: string, userId: string, _isGm: boolean, h: SubscribeHandlers) {
    const peers = new Map<string, { user: PresenceUser; seen: number }>()
    let mine: PresenceUser | null = null
    const set = this.localHandlers.get(campaignId) ?? new Set()
    set.add(h)
    this.localHandlers.set(campaignId, set)

    const emitPresence = () => {
      const now = Date.now()
      for (const [k, v] of peers) if (now - v.seen > 6000) peers.delete(k)
      const list = [...peers.values()].map((p) => p.user)
      if (mine) list.push(mine)
      h.onPresence(list)
    }
    const onMsg = (e: MessageEvent<Msg>) => {
      const m = e.data
      if (m.campaignId !== campaignId) return
      if (m.kind === 'change') h.onChange(m.change)
      if (m.kind === 'live') h.onLive(m.event)
      if (m.kind === 'presence' && m.user.user_id !== userId) {
        if (m.leaving) peers.delete(m.user.user_id)
        else {
          const isNew = !peers.has(m.user.user_id)
          peers.set(m.user.user_id, { user: m.user, seen: Date.now() })
          if (isNew) beat()
        }
        emitPresence()
      }
    }
    const beat = () => {
      if (mine) this.channel.postMessage({ kind: 'presence', campaignId, user: mine } satisfies Msg)
    }
    this.channel.addEventListener('message', onMsg)
    const timer = setInterval(() => {
      beat()
      emitPresence()
    }, 2000)
    h.onStatus('online')

    return {
      send: (event: LiveEvent) => {
        this.channel.postMessage({ kind: 'live', campaignId, event } satisfies Msg)
      },
      track: (s: { name: string; sceneId: string | null; color: string }) => {
        mine = { user_id: userId, ...s }
        beat()
        emitPresence()
      },
      close: () => {
        if (mine) this.channel.postMessage({ kind: 'presence', campaignId, user: mine, leaving: true } satisfies Msg)
        clearInterval(timer)
        this.channel.removeEventListener('message', onMsg)
        set.delete(h)
      },
    }
  }
}
