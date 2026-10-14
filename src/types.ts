// Entidades do jogo. Cada uma vira uma linha no Supabase (colunas-chave + `data` jsonb)
// ou um item no armazenamento local do modo demonstração.

export type Role = 'gm' | 'player'

export interface Campaign {
  id: string
  campaign_id: string // = id (mantém o formato genérico das coleções)
  name: string
  description: string
  system_id: string
  owner_id: string
  invite_code: string
  active_scene_id: string | null
  /** Sessão de jogo: o mestre prepara tudo e depois "abre a mesa". */
  session?: { live: boolean; number: number; started_at?: string }
  updated_at?: string
}

export interface Member {
  id: string // `${campaign_id}:${user_id}`
  campaign_id: string
  user_id: string
  role: Role
  display_name: string
  color: string
}

export interface SpriteAnim {
  row: number
  frames: number
  fps: number
}

export interface SpriteConfig {
  url: string
  frameW: number
  frameH: number
  /** Linhas por direção (LPC usa 4 direções: cima, esquerda, baixo, direita). */
  directional: boolean
  animations: Partial<Record<'idle' | 'walk' | 'attack' | 'hurt' | 'death' | 'cast', SpriteAnim>>
  credits?: string
}

export interface Character {
  id: string
  campaign_id: string
  owner_id: string | null // null = NPC/monstro do mestre
  kind: 'pc' | 'npc' | 'monster'
  name: string
  system_id: string
  sheet: Record<string, unknown>
  portrait_url: string | null
  token_url: string | null
  sprite: SpriteConfig | null
  color: string
  hidden: boolean
  updated_at?: string
}

export type GridType = 'square' | 'hex' | 'none'

export interface GridConfig {
  type: GridType
  size: number // px por célula
  offsetX: number
  offsetY: number
  color: string
  opacity: number
  unitDistance: number
  unitLabel: string
}

export interface Wall {
  id: string
  x1: number
  y1: number
  x2: number
  y2: number
  kind: 'wall' | 'door' | 'window'
  open?: boolean
}

export interface Light {
  id: string
  x: number
  y: number
  bright: number // em células
  dim: number
  color: string
  flicker: boolean
}

export interface FogShape {
  id: string
  mode: 'reveal' | 'hide'
  points: number[] // x,y,x,y...
}

export type Weather = 'none' | 'rain' | 'snow' | 'fog' | 'embers' | 'leaves'

export interface Combatant {
  id: string
  token_id: string
  name: string
  initiative: number
}

export interface CombatState {
  active: boolean
  round: number
  turn: number
  combatants: Combatant[]
}

export interface AudioState {
  url: string | null
  name: string
  playing: boolean
  volume: number
  loop: boolean
  startedAt: number
}

export interface Scene {
  id: string
  campaign_id: string
  name: string
  kind: 'map' | 'theater'
  sort: number
  map_url: string | null
  map_w: number
  map_h: number
  background_url: string | null
  grid: GridConfig
  walls: Wall[]
  lights: Light[]
  fog: FogShape[]
  fog_enabled: boolean
  vision_enabled: boolean
  ambient: number // 0 = breu, 1 = dia
  weather: Weather
  audio: AudioState
  combat: CombatState
  /** NPCs no palco do modo teatro. */
  stage?: string[]
  updated_at?: string
}

export type Condition =
  | 'caido'
  | 'envenenado'
  | 'atordoado'
  | 'cego'
  | 'amedrontado'
  | 'invisivel'
  | 'paralisado'
  | 'concentrando'
  | 'abencoado'
  | 'inconsciente'

export interface Token {
  id: string
  campaign_id: string
  scene_id: string
  character_id: string | null
  name: string
  image_url: string | null
  color: string
  x: number // centro, em px do mapa
  y: number
  size: number // em células
  layer: 'token' | 'object' | 'gm'
  hidden: boolean
  locked: boolean
  hp: number
  hp_max: number
  show_bar: boolean
  conditions: Condition[]
  vision: number // alcance em células (0 = sem visão)
  darkvision: number
  light_bright: number
  light_dim: number
  owner_ids: string[]
  updated_at?: string
}

export interface RollDie {
  sides: number
  value: number
  dropped?: boolean
  exploded?: boolean
}

export interface RollResult {
  notation: string
  total: number
  groups: { sides: number; dice: RollDie[] }[]
  modifier: number
  text: string
  crit: 'success' | 'fail' | null
}

export interface ChatMessage {
  id: string
  campaign_id: string
  author_id: string
  author_name: string
  character_name: string | null
  kind: 'text' | 'roll' | 'system' | 'emote'
  content: string
  roll: RollResult | null
  label: string | null
  visibility: 'public' | 'gm' | 'whisper'
  whisper_to: string[]
  seed: number
  created_at: string
}

export interface Collections {
  campaigns: Campaign
  members: Member
  characters: Character
  scenes: Scene
  tokens: Token
  chat: ChatMessage
}

export type TableName = keyof Collections

/** Eventos efêmeros (não persistidos), enviados por Broadcast. */
export type LiveEvent =
  | { type: 'drag'; tokenId: string; x: number; y: number; by: string }
  | { type: 'ping'; x: number; y: number; color: string; by: string }
  | { type: 'vfx'; effect: string; x: number; y: number; tx?: number; ty?: number; color?: string }
  | { type: 'pull'; sceneId: string; x: number; y: number }
  | { type: 'shake' }
  | { type: 'float'; tokenId: string; text: string; color: string }
  | { type: 'handout'; url: string; title: string; to: string[] }
