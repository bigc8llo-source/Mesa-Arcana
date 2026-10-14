import type { Collections, LiveEvent, TableName } from '../types'

export interface User {
  id: string
  name: string
  email?: string
}

export type ChangeOp = 'upsert' | 'delete'
export interface Change<T extends TableName = TableName> {
  table: T
  op: ChangeOp
  row: Collections[T]
}

export interface CampaignSubscription {
  /** Envia um evento efêmero para todos na campanha (não grava no banco). */
  send(event: LiveEvent): void
  /** Atualiza quem está online e em qual cena. */
  track(state: { name: string; sceneId: string | null; color: string }): void
  close(): void
}

export interface PresenceUser {
  user_id: string
  name: string
  sceneId: string | null
  color: string
}

export interface SubscribeHandlers {
  onChange(change: Change): void
  onLive(event: LiveEvent): void
  onPresence(users: PresenceUser[]): void
  onReconnect(): void
  onStatus(status: 'connecting' | 'online' | 'offline'): void
}

/**
 * Interface única de persistência + tempo real. Há duas implementações:
 * - SupabaseBackend: Postgres + RLS + Realtime (uso real com os amigos)
 * - LocalBackend: localStorage + IndexedDB + BroadcastChannel (demonstração entre abas)
 */
export interface Backend {
  readonly kind: 'supabase' | 'local'
  getUser(): Promise<User | null>
  onAuthChange(cb: (u: User | null) => void): () => void
  signInMagicLink(email: string): Promise<void>
  signInDiscord(): Promise<void>
  signInGuest(name: string): Promise<User>
  updateName(name: string): Promise<void>
  signOut(): Promise<void>

  listMyCampaigns(): Promise<Collections['campaigns'][]>
  createCampaign(name: string, systemId: string, displayName: string): Promise<Collections['campaigns']>
  joinCampaign(code: string, displayName: string): Promise<string>

  select<T extends TableName>(table: T, campaignId: string): Promise<Collections[T][]>
  upsert<T extends TableName>(table: T, row: Collections[T]): Promise<void>
  remove<T extends TableName>(table: T, row: Collections[T]): Promise<void>

  /** Passa o turno do combate da cena (mestre ou dono do token da vez). */
  endTurn(sceneId: string): Promise<void>

  uploadAsset(campaignId: string, kind: string, file: Blob, ext: string): Promise<string>
  /** Converte a URL armazenada em algo que o navegador consegue carregar. */
  resolveUrl(url: string): Promise<string>

  subscribe(campaignId: string, userId: string, isGm: boolean, handlers: SubscribeHandlers): CampaignSubscription
}
