import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js'
import type { Collections, LiveEvent, TableName } from '../types'
import type { Backend, Change, PresenceUser, SubscribeHandlers, User } from './backend'
import { inviteCode, uid } from '../lib/id'

/**
 * Cada tabela tem colunas "chave" (usadas por RLS, filtros e gatilhos) e o resto vai em `data` (jsonb).
 * Assim o schema SQL fica estável enquanto a ficha/cena evolui no front.
 */
const TABLES: Record<TableName, { name: string; cols: string[]; jsonData: boolean }> = {
  campaigns: { name: 'campaigns', cols: ['name', 'system_id', 'owner_id', 'invite_code', 'active_scene_id'], jsonData: true },
  members: { name: 'campaign_members', cols: ['campaign_id', 'user_id', 'role', 'display_name', 'color'], jsonData: false },
  characters: { name: 'characters', cols: ['campaign_id', 'owner_id', 'kind', 'hidden'], jsonData: true },
  scenes: { name: 'scenes', cols: ['campaign_id'], jsonData: true },
  tokens: { name: 'tokens', cols: ['campaign_id', 'scene_id', 'character_id', 'hidden', 'layer', 'owner_ids'], jsonData: true },
  chat: { name: 'chat_messages', cols: ['campaign_id', 'author_id', 'visibility', 'whisper_to', 'created_at'], jsonData: true },
}
const BY_DB_NAME = Object.fromEntries(Object.entries(TABLES).map(([k, v]) => [v.name, k as TableName]))

type DbRow = Record<string, unknown> & { id?: string; data?: Record<string, unknown> }

function fromRow<T extends TableName>(table: T, row: DbRow): Collections[T] {
  const out: Record<string, unknown> = { ...(row.data ?? {}) }
  for (const c of TABLES[table].cols) out[c] = row[c]
  if (table === 'campaigns') {
    out.id = row.id
    out.campaign_id = row.id
  } else if (table === 'members') {
    out.id = `${row.campaign_id}:${row.user_id}`
  } else out.id = row.id
  out.updated_at = row.updated_at as string | undefined
  return out as unknown as Collections[T]
}

function toRow<T extends TableName>(table: T, obj: Collections[T]): DbRow {
  const spec = TABLES[table]
  const src = obj as unknown as Record<string, unknown>
  const row: DbRow = {}
  const data: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(src)) {
    if (k === 'updated_at') continue
    if (spec.cols.includes(k)) row[k] = v
    else if (k !== 'id' && k !== 'campaign_id') data[k] = v
  }
  if (table !== 'members') row.id = src.id as string
  if (spec.jsonData) row.data = data
  return row
}

export class SupabaseBackend implements Backend {
  readonly kind = 'supabase' as const
  readonly client: SupabaseClient

  constructor(url: string, key: string) {
    this.client = createClient(url, key, { auth: { persistSession: true, detectSessionInUrl: true, flowType: 'pkce' } })
  }

  private toUser(u: { id: string; email?: string; user_metadata?: Record<string, unknown> } | null | undefined): User | null {
    if (!u) return null
    const md = u.user_metadata ?? {}
    const name = (md.display_name || md.full_name || md.name || md.user_name || u.email?.split('@')[0] || 'Aventureiro') as string
    return { id: u.id, name, email: u.email }
  }

  async getUser() {
    const { data } = await this.client.auth.getSession()
    return this.toUser(data.session?.user)
  }
  onAuthChange(cb: (u: User | null) => void) {
    const { data } = this.client.auth.onAuthStateChange((_e, session) => cb(this.toUser(session?.user)))
    return () => data.subscription.unsubscribe()
  }
  async signInMagicLink(email: string) {
    const { error } = await this.client.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname } })
    if (error) throw error
  }
  async signInDiscord() {
    const { error } = await this.client.auth.signInWithOAuth({ provider: 'discord', options: { redirectTo: location.origin + location.pathname } })
    if (error) throw error
  }
  async signInGuest(name: string) {
    const { data, error } = await this.client.auth.signInAnonymously({ options: { data: { display_name: name } } })
    if (error) throw new Error(`${error.message} — habilite "Anonymous sign-ins" em Authentication > Sign In / Providers.`)
    return this.toUser(data.user)!
  }
  async updateName(name: string) {
    await this.client.auth.updateUser({ data: { display_name: name } })
  }
  async signOut() {
    await this.client.auth.signOut()
  }

  async listMyCampaigns() {
    const { data, error } = await this.client.from('campaigns').select('*').order('updated_at', { ascending: false })
    if (error) throw error
    return (data ?? []).map((r) => fromRow('campaigns', r))
  }

  async createCampaign(name: string, systemId: string, displayName: string) {
    const { data, error } = await this.client.rpc('create_campaign', {
      p_id: uid(),
      p_name: name,
      p_system_id: systemId,
      p_display_name: displayName,
      p_invite_code: inviteCode(),
    })
    if (error) throw error
    return fromRow('campaigns', data as DbRow)
  }

  async joinCampaign(code: string, displayName: string) {
    const { data, error } = await this.client.rpc('join_campaign', { p_code: code.trim().toUpperCase(), p_display_name: displayName })
    if (error) throw new Error(error.message.includes('invalid') ? 'Código de convite inválido' : error.message)
    return data as string
  }

  async select<T extends TableName>(table: T, campaignId: string) {
    const spec = TABLES[table]
    let q = this.client.from(spec.name).select('*').eq(table === 'campaigns' ? 'id' : 'campaign_id', campaignId)
    if (table === 'chat') q = q.order('created_at', { ascending: false }).limit(300)
    const { data, error } = await q
    if (error) throw error
    return (data ?? []).map((r) => fromRow(table, r as DbRow))
  }

  async upsert<T extends TableName>(table: T, row: Collections[T]) {
    const spec = TABLES[table]
    const { error } = await this.client
      .from(spec.name)
      .upsert(toRow(table, row), table === 'members' ? { onConflict: 'campaign_id,user_id' } : undefined)
    if (error) throw error
  }

  async remove<T extends TableName>(table: T, row: Collections[T]) {
    const spec = TABLES[table]
    let q = this.client.from(spec.name).delete()
    if (table === 'members') {
      const m = row as Collections['members']
      q = q.eq('campaign_id', m.campaign_id).eq('user_id', m.user_id)
    } else q = q.eq('id', row.id)
    const { error } = await q
    if (error) throw error
  }

  async uploadAsset(campaignId: string, kind: string, file: Blob, ext: string) {
    const path = `${campaignId}/${kind}/${uid()}.${ext}`
    const { error } = await this.client.storage.from('assets').upload(path, file, {
      contentType: file.type || undefined,
      cacheControl: '31536000',
    })
    if (error) throw error
    return this.client.storage.from('assets').getPublicUrl(path).data.publicUrl
  }

  async resolveUrl(url: string) {
    return url
  }

  subscribe(campaignId: string, userId: string, isGm: boolean, h: SubscribeHandlers) {
    const channels: RealtimeChannel[] = []
    let mainChannel: RealtimeChannel | null = null
    let pendingTrack: { name: string; sceneId: string | null; color: string } | null = null
    let everSubscribed = false
    let closed = false

    const onDb = (msg: { payload: { table: string; op: 'upsert' | 'delete'; row: DbRow; hide?: boolean } }) => {
      const { table, op, row, hide } = msg.payload
      const t = BY_DB_NAME[table]
      if (!t) return
      // "hide" = item ficou oculto; quem ainda pode vê-lo (mestre/dono) ignora a remoção.
      if (hide && (isGm || row.owner_id === userId)) return
      h.onChange({ table: t, op, row: fromRow(t, row) } as Change)
    }

    const topics = [`campaign:${campaignId}`, `campaign:${campaignId}:user:${userId}`]
    if (isGm) topics.push(`campaign:${campaignId}:gm`)

    h.onStatus('connecting')
    void this.client.realtime.setAuth().then(() => {
      if (closed) return
      topics.forEach((topic, i) => {
        const ch = this.client.channel(topic, {
          config: { private: true, broadcast: { self: false }, presence: i === 0 ? { key: userId } : undefined },
        })
        ch.on('broadcast', { event: 'db' }, onDb as never)
        if (i === 0) {
          mainChannel = ch
          ch.on('broadcast', { event: 'live' }, (m) => h.onLive(m.payload as LiveEvent))
          ch.on('presence', { event: 'sync' }, () => {
            const state = ch.presenceState<PresenceUser>()
            h.onPresence(Object.values(state).map((arr) => arr[0]).filter(Boolean))
          })
        }
        ch.subscribe((status) => {
          if (i !== 0) return
          if (status === 'SUBSCRIBED') {
            h.onStatus('online')
            if (everSubscribed) h.onReconnect()
            everSubscribed = true
            if (pendingTrack) void ch.track({ user_id: userId, ...pendingTrack })
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            if (!closed) h.onStatus('offline')
          }
        })
        channels.push(ch)
      })
    })

    return {
      send: (event: LiveEvent) => {
        void mainChannel?.send({ type: 'broadcast', event: 'live', payload: event })
      },
      track: (s: { name: string; sceneId: string | null; color: string }) => {
        pendingTrack = s
        void mainChannel?.track({ user_id: userId, ...s })
      },
      close: () => {
        closed = true
        channels.forEach((c) => void this.client.removeChannel(c))
      },
    }
  }
}
