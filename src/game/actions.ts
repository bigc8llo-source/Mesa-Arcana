import type { Character, ChatMessage, Scene, Token } from '../types'
import { useGame, isGmNow, activeSceneId, emitLocalLive } from '../store/game'
import { roll, randomSeed } from '../engine/dice'
import { nowIso, uid } from '../lib/id'
import { systemOf, SYSTEMS } from '../systems'
import { generateSpriteSheet, makeTokenCanvas, RECIPE_PRESETS, spriteConfigFor, type SpriteRecipe } from '../engine/sprites'
import { uploadCanvas } from '../lib/images'
import { buildSampleMap, buildTheaterBackground } from '../engine/sampleMap'
import { MONSTERS, monsterSheet } from '../systems/monsters'
import { snapToGrid } from '../engine/geometry'

const g = () => useGame.getState()

export function myName(): string {
  const s = g()
  const m = s.user && s.campaignId ? s.members[`${s.campaignId}:${s.user.id}`] : null
  return m?.display_name ?? s.user?.name ?? 'Alguém'
}

export function defaultScene(campaignId: string, name: string, kind: Scene['kind'] = 'map'): Scene {
  return {
    id: uid(),
    campaign_id: campaignId,
    name,
    kind,
    sort: Date.now(),
    map_url: null,
    map_w: 2100,
    map_h: 1400,
    background_url: null,
    grid: { type: 'square', size: 70, offsetX: 0, offsetY: 0, color: '#000000', opacity: 0.25, unitDistance: 1.5, unitLabel: 'm' },
    walls: [],
    lights: [],
    fog: [],
    fog_enabled: false,
    vision_enabled: false,
    ambient: 1,
    weather: 'none',
    audio: { url: null, name: '', playing: false, volume: 0.6, loop: true, startedAt: 0 },
    combat: { active: false, round: 1, turn: 0, combatants: [] },
  }
}

// ------------------------------------------------------------ Dados e chat

export interface RollOptions {
  label?: string
  character?: Character | null
  visibility?: ChatMessage['visibility']
  whisperTo?: string[]
}

export async function rollDice(notation: string, opts: RollOptions = {}) {
  const s = g()
  if (!s.user || !s.campaignId) return
  const seed = randomSeed()
  const result = roll(notation, seed)
  const msg: ChatMessage = {
    id: uid(),
    campaign_id: s.campaignId,
    author_id: s.user.id,
    author_name: myName(),
    character_name: opts.character?.name ?? null,
    kind: 'roll',
    content: '',
    roll: result,
    label: opts.label ?? null,
    visibility: opts.visibility ?? 'public',
    whisper_to: opts.whisperTo ?? [],
    seed,
    created_at: nowIso(),
  }
  await s.save('chat', msg)
  return result
}

export async function sendChat(content: string, kind: ChatMessage['kind'] = 'text', whisperTo: string[] = [], characterName: string | null = null) {
  const s = g()
  if (!s.user || !s.campaignId) return
  await s.save('chat', {
    id: uid(),
    campaign_id: s.campaignId,
    author_id: s.user.id,
    author_name: myName(),
    character_name: characterName,
    kind,
    content,
    roll: null,
    label: null,
    visibility: whisperTo.length ? 'whisper' : 'public',
    whisper_to: whisperTo,
    seed: 0,
    created_at: nowIso(),
  })
}

export async function systemMessage(content: string) {
  await sendChat(content, 'system')
}

/** Interpreta comandos do chat: /r, /gr (secreta), /w nome, /me. */
export async function handleChatInput(text: string, character: Character | null) {
  const t = text.trim()
  if (!t) return
  const s = g()
  const gmIds = Object.values(s.members).filter((m) => m.role === 'gm').map((m) => m.user_id)
  const cmd = t.match(/^\/(\w+)\s*(.*)$/s)
  if (!cmd) return sendChat(t, 'text', [], character?.name ?? null)
  const [, name, rest] = cmd
  switch (name.toLowerCase()) {
    case 'r':
    case 'rolar':
    case 'roll':
      return rollDice(rest || 'd20', { character })
    case 'gr':
    case 'secreta':
      return rollDice(rest || 'd20', { character, visibility: 'gm', label: 'Rolagem secreta' })
    case 'me':
    case 'eu':
      return sendChat(rest, 'emote', [], character?.name ?? myName())
    case 'w':
    case 'sussurro': {
      const target = Object.values(s.members).find((m) => rest.toLowerCase().startsWith(m.display_name.toLowerCase()))
      if (!target) throw new Error('Use /w NomeDoJogador mensagem')
      const body = rest.slice(target.display_name.length).trim()
      return sendChat(body, 'text', Array.from(new Set([target.user_id, ...gmIds])), character?.name ?? null)
    }
    default:
      throw new Error(`Comando desconhecido: /${name}. Use /r, /gr, /w ou /me.`)
  }
}

// ------------------------------------------------------------ Personagens

export async function buildSpriteAssets(campaignId: string, recipe: SpriteRecipe, ring: string) {
  const sheet = generateSpriteSheet(recipe)
  const spriteUrl = await uploadCanvas(campaignId, 'sprite', sheet, true)
  const token = makeTokenCanvas(sheet, 0, 0, 32, 32, ring, true)
  const tokenUrl = await uploadCanvas(campaignId, 'token', token, true)
  return { sprite: spriteConfigFor(spriteUrl), tokenUrl }
}

export async function createCharacter(opts: {
  name: string
  kind: Character['kind']
  recipe: SpriteRecipe
  color: string
  ownerId: string | null
  sheet?: Record<string, unknown>
  hidden?: boolean
}): Promise<Character> {
  const s = g()
  const campaignId = s.campaignId!
  const systemId = s.campaign?.system_id ?? 'dnd5e'
  const sys = SYSTEMS[systemId] ?? SYSTEMS.generico
  const { sprite, tokenUrl } = await buildSpriteAssets(campaignId, opts.recipe, opts.color)
  const c: Character = {
    id: uid(),
    campaign_id: campaignId,
    owner_id: opts.ownerId,
    kind: opts.kind,
    name: opts.name,
    system_id: systemId,
    sheet: { ...sys.defaultSheet(), ...(opts.sheet ?? {}), recipe: opts.recipe },
    portrait_url: null,
    token_url: tokenUrl,
    sprite,
    color: opts.color,
    hidden: opts.hidden ?? false,
  }
  await s.save('characters', c)
  return c
}

export async function placeToken(c: Character, x: number, y: number, sceneId?: string): Promise<Token | null> {
  const s = g()
  const sid = sceneId ?? activeSceneId(s)
  const scene = sid ? s.scenes[sid] : null
  if (!scene) return null
  const sys = systemOf(c)
  const hp = sys.hp(c.sheet)
  const size = (c.sheet.size as number) ?? 1
  const p = snapToGrid({ x, y }, scene.grid, size)
  const t: Token = {
    id: uid(),
    campaign_id: c.campaign_id,
    scene_id: scene.id,
    character_id: c.id,
    name: c.name,
    image_url: c.token_url,
    color: c.color,
    x: p.x,
    y: p.y,
    size,
    layer: 'token',
    hidden: false,
    locked: false,
    hp: hp.hp,
    hp_max: hp.max,
    show_bar: c.kind === 'pc',
    conditions: [],
    vision: c.kind === 'pc' ? 12 : 0,
    darkvision: c.kind === 'pc' ? ((c.sheet.darkvision as number) ?? 0) : 0,
    light_bright: 0,
    light_dim: 0,
    owner_ids: c.owner_id ? [c.owner_id] : [],
  }
  await s.save('tokens', t)
  return t
}

/** Vida do token: se ligado a personagem jogador, a ficha é a fonte da verdade. */
export function tokenHp(t: Token): { hp: number; max: number; temp: number } {
  const c = t.character_id ? g().characters[t.character_id] : null
  if (c && c.kind === 'pc') return systemOf(c).hp(c.sheet)
  return { hp: t.hp, max: t.hp_max, temp: 0 }
}

export async function changeHp(tokenIds: string[], delta: number) {
  const s = g()
  for (const id of tokenIds) {
    const t = s.tokens[id]
    if (!t) continue
    const c = t.character_id ? s.characters[t.character_id] : null
    const cur = tokenHp(t)
    const next = Math.max(0, Math.min(cur.max, cur.hp + delta))
    if (c && c.kind === 'pc') {
      await s.patch('characters', c.id, { sheet: systemOf(c).setHp(c.sheet, cur.hp + delta) })
    } else {
      const conditions = next === 0 && !t.conditions.includes('inconsciente') ? [...t.conditions, 'inconsciente' as const] : t.conditions
      await s.patch('tokens', id, { hp: next, conditions })
    }
    const ev = { type: 'float' as const, tokenId: id, text: delta > 0 ? `+${delta}` : `${delta}`, color: delta > 0 ? '#4ade80' : '#f87171' }
    s.send(ev)
    emitLocalLive(ev)
  }
}

export function canControl(t: Token): boolean {
  const s = g()
  if (isGmNow()) return true
  if (!s.user || t.locked) return false
  if (t.owner_ids.includes(s.user.id)) return true
  const c = t.character_id ? s.characters[t.character_id] : null
  return c?.owner_id === s.user.id
}

export function myCharacters(): Character[] {
  const s = g()
  return Object.values(s.characters).filter((c) => c.owner_id === s.user?.id)
}

// ------------------------------------------------------------ Combate

export async function updateCombat(fn: (c: Scene['combat'], scene: Scene) => Scene['combat']) {
  const s = g()
  const sid = activeSceneId(s)
  const scene = sid ? s.scenes[sid] : null
  if (!scene) return
  await s.patch('scenes', scene.id, { combat: fn(scene.combat, scene) })
}

export function initiativeNotation(t: Token): string {
  const c = t.character_id ? g().characters[t.character_id] : null
  return c ? systemOf(c).initiative(c.sheet) : '1d20'
}

// ------------------------------------------------------------ Campanha de exemplo

export async function seedSampleCampaign(onProgress?: (msg: string) => void) {
  const s = g()
  const campaignId = s.campaignId!
  onProgress?.('Desenhando a masmorra…')
  const map = buildSampleMap()
  const mapUrl = await uploadCanvas(campaignId, 'map', map.canvas)
  const scene = defaultScene(campaignId, 'Cripta do Rei Goblin')
  Object.assign(scene, {
    map_url: mapUrl,
    map_w: map.width,
    map_h: map.height,
    walls: map.walls,
    lights: map.lights,
    fog_enabled: true,
    vision_enabled: true,
    ambient: 0.15,
    sort: 1,
  } satisfies Partial<Scene>)
  scene.grid.size = map.gridSize

  onProgress?.('Pintando o cenário da taverna…')
  const bgUrl = await uploadCanvas(campaignId, 'scene', buildTheaterBackground())
  const theater = defaultScene(campaignId, 'Taverna do Javali Dourado', 'theater')
  theater.background_url = bgUrl
  theater.sort = 0
  theater.weather = 'embers'
  await s.save('scenes', theater)
  await s.save('scenes', scene)
  await s.patch('campaigns', campaignId, { active_scene_id: theater.id })

  onProgress?.('Criando heróis…')
  const dnd = s.campaign?.system_id === 'dnd5e'
  const t20 = s.campaign?.system_id === 'tormenta20'
  const heroes: { name: string; preset: string; color: string; sheet: Record<string, unknown> }[] = [
    { name: 'Brunhilda', preset: 'guerreiro', color: '#e11d48', sheet: dnd ? { race: 'Anã', class: 'Guerreira', abilities: { for: 16, des: 12, con: 15, int: 8, sab: 12, car: 10 }, saves: ['for', 'con'], skills: { atletismo: 1, intimidacao: 1 }, hp: 13, hp_max: 13, ac: 18, attacks: [{ id: uid(), name: 'Espada longa', bonus: 5, damage: '1d8+3', type: 'cortante' }], darkvision: 12 } : {} },
    { name: 'Eldrin', preset: 'mago', color: '#2563eb', sheet: dnd ? { race: 'Elfo', class: 'Mago', abilities: { for: 8, des: 14, con: 12, int: 16, sab: 12, car: 10 }, saves: ['int', 'sab'], skills: { arcanismo: 1, historia: 1 }, hp: 7, hp_max: 7, ac: 12, spell_ability: 'int', attacks: [{ id: uid(), name: 'Bordão', bonus: 1, damage: '1d6-1', type: 'concussão' }], spells: [{ id: uid(), name: 'Raio de Fogo', level: 0, notation: '1d20+5', description: 'Dano 1d10 de fogo, 36 m.' }, { id: uid(), name: 'Mísseis Mágicos', level: 1, notation: '3d4+3', description: 'Três dardos que acertam automaticamente.' }], darkvision: 12 } : {} },
    { name: 'Sombra', preset: 'ladino', color: '#16a34a', sheet: dnd ? { race: 'Halfling', class: 'Ladina', abilities: { for: 8, des: 16, con: 12, int: 12, sab: 10, car: 14 }, saves: ['des', 'int'], skills: { furtividade: 2, prestidigitacao: 1, enganacao: 1, percepcao: 1 }, hp: 9, hp_max: 9, ac: 14, attacks: [{ id: uid(), name: 'Adaga', bonus: 5, damage: '1d4+3', type: 'perfurante' }, { id: uid(), name: 'Ataque Furtivo', bonus: 5, damage: '1d6', type: 'extra' }] } : {} },
    { name: 'Irmã Lúcia', preset: 'clerigo', color: '#d97706', sheet: dnd ? { race: 'Humana', class: 'Clériga', abilities: { for: 12, des: 10, con: 14, int: 10, sab: 16, car: 12 }, saves: ['sab', 'car'], skills: { religiao: 1, medicina: 1 }, hp: 10, hp_max: 10, ac: 16, spell_ability: 'sab', attacks: [{ id: uid(), name: 'Maça', bonus: 3, damage: '1d6+1', type: 'concussão' }], spells: [{ id: uid(), name: 'Curar Ferimentos', level: 1, notation: '1d8+3', description: 'Toque: recupera PV.' }, { id: uid(), name: 'Chama Sagrada', level: 0, notation: '1d8', description: 'Salv. DES CD 13.' }] } : {} },
  ]
  if (t20) heroes.forEach((h, i) => (h.sheet = T20_HEROES[i]))
  for (let i = 0; i < heroes.length; i++) {
    const h = heroes[i]
    const c = await createCharacter({ name: h.name, kind: 'pc', recipe: RECIPE_PRESETS[h.preset].recipe, color: h.color, ownerId: null, sheet: h.sheet })
    await placeToken(c, map.spawns[i].x, map.spawns[i].y, scene.id)
  }

  onProgress?.('Escondendo monstros nas sombras…')
  const made = new Map<string, Character>()
  for (const m of map.monsters) {
    const entry = MONSTERS.find((x) => x.key === m.kind)!
    let c = made.get(m.kind)
    if (!c) {
      c = await createCharacter({
        name: entry.name,
        kind: 'monster',
        recipe: RECIPE_PRESETS[entry.sprite].recipe,
        color: '#7f1d1d',
        ownerId: null,
        sheet: monsterSheet(s.campaign?.system_id ?? 'generico', entry),
        hidden: true,
      })
      made.set(m.kind, c)
    }
    await placeToken(c, m.x, m.y, scene.id)
  }
  await systemMessage('Bem-vindos à Taverna do Javali Dourado! O mestre pode trocar para a "Cripta do Rei Goblin" no painel Cenas.')
}

export { MONSTERS }

const t20atk = (name: string, skill: 'luta' | 'pontaria', damage: string, crit: string) => ({ id: uid(), name, skill, damage, crit, extra: 0 })
const T20_HEROES: Record<string, unknown>[] = [
  { race: 'Anão', class: 'Guerreiro', origin: 'Soldado', deity: 'Khalmyr', attrs: { for: 16, des: 12, con: 16, int: 10, sab: 12, car: 8 }, trained: ['luta', 'fortitude', 'atletismo', 'intimidacao', 'guerra'], pv: 23, pv_max: 23, pm: 3, pm_max: 3, defense_armor: 7, armor_penalty: 2, attacks: [t20atk('Machado de batalha', 'luta', '1d8+3', '20/x3')], darkvision: 12 },
  { race: 'Elfo', class: 'Arcanista', origin: 'Acólito', deity: 'Wynna', attrs: { for: 8, des: 14, con: 12, int: 17, sab: 12, car: 10 }, trained: ['misticismo', 'vontade', 'conhecimento', 'percepcao'], pv: 9, pv_max: 9, pm: 6, pm_max: 6, attacks: [t20atk('Bordão', 'luta', '1d6-1', '20/x2')], powers: [{ id: uid(), name: 'Seta Infalível de Talude', cost: 1, notation: '2d4+2', description: 'Magia arcana de dano.' }, { id: uid(), name: 'Explosão de Chamas', cost: 1, notation: '2d6', description: 'Cone de fogo (Reflexos reduz).' }], darkvision: 12 },
  { race: 'Hynne', class: 'Ladino', origin: 'Batedor', deity: 'Hyninn', attrs: { for: 8, des: 17, con: 12, int: 12, sab: 10, car: 14 }, trained: ['ladinagem', 'furtividade', 'reflexos', 'enganacao', 'percepcao', 'acrobacia', 'iniciativa'], pv: 13, pv_max: 13, pm: 4, pm_max: 4, defense_armor: 2, attacks: [t20atk('Adaga', 'luta', '1d4+3', '19/x2'), t20atk('Funda', 'pontaria', '1d4', '20/x2')], powers: [{ id: uid(), name: 'Ataque Furtivo', cost: 0, notation: '1d6', description: 'Dano extra contra alvo desprevenido.' }] },
  { race: 'Humano', class: 'Clérigo', origin: 'Acólito', deity: 'Lena', attrs: { for: 12, des: 10, con: 14, int: 10, sab: 17, car: 12 }, trained: ['religiao', 'vontade', 'cura', 'diplomacia', 'intuicao'], pv: 18, pv_max: 18, pm: 5, pm_max: 5, defense_armor: 6, armor_penalty: 2, attacks: [t20atk('Maça', 'luta', '1d8+1', '20/x2')], powers: [{ id: uid(), name: 'Curar Ferimentos', cost: 1, notation: '2d8+2', description: 'Recupera PV pelo toque.' }] },
]
