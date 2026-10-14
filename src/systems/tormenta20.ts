import type { SystemDef, Rollable } from './index'
import { formatMod } from '../engine/dice'
import { uid } from '../lib/id'

/**
 * Tormenta20 — apenas mecânicas (números e nomes de regras), sem texto dos livros.
 * Tormenta20 é marca da Jambô Editora; tenha os livros para as descrições completas.
 */

export type T20Attr = 'for' | 'des' | 'con' | 'int' | 'sab' | 'car'
export const T20_ATTRS: { key: T20Attr; label: string; full: string }[] = [
  { key: 'for', label: 'FOR', full: 'Força' },
  { key: 'des', label: 'DES', full: 'Destreza' },
  { key: 'con', label: 'CON', full: 'Constituição' },
  { key: 'int', label: 'INT', full: 'Inteligência' },
  { key: 'sab', label: 'SAB', full: 'Sabedoria' },
  { key: 'car', label: 'CAR', full: 'Carisma' },
]

export const T20_SKILLS: { key: string; label: string; attr: T20Attr; onlyTrained?: boolean; armor?: boolean }[] = [
  { key: 'acrobacia', label: 'Acrobacia', attr: 'des', armor: true },
  { key: 'adestramento', label: 'Adestramento', attr: 'car', onlyTrained: true },
  { key: 'atletismo', label: 'Atletismo', attr: 'for' },
  { key: 'atuacao', label: 'Atuação', attr: 'car', onlyTrained: true },
  { key: 'cavalgar', label: 'Cavalgar', attr: 'des' },
  { key: 'conhecimento', label: 'Conhecimento', attr: 'int', onlyTrained: true },
  { key: 'cura', label: 'Cura', attr: 'sab' },
  { key: 'diplomacia', label: 'Diplomacia', attr: 'car' },
  { key: 'enganacao', label: 'Enganação', attr: 'car' },
  { key: 'fortitude', label: 'Fortitude', attr: 'con' },
  { key: 'furtividade', label: 'Furtividade', attr: 'des', armor: true },
  { key: 'guerra', label: 'Guerra', attr: 'int', onlyTrained: true },
  { key: 'iniciativa', label: 'Iniciativa', attr: 'des' },
  { key: 'intimidacao', label: 'Intimidação', attr: 'car' },
  { key: 'intuicao', label: 'Intuição', attr: 'sab' },
  { key: 'investigacao', label: 'Investigação', attr: 'int' },
  { key: 'jogatina', label: 'Jogatina', attr: 'car', onlyTrained: true },
  { key: 'ladinagem', label: 'Ladinagem', attr: 'des', onlyTrained: true, armor: true },
  { key: 'luta', label: 'Luta', attr: 'for' },
  { key: 'misticismo', label: 'Misticismo', attr: 'int', onlyTrained: true },
  { key: 'nobreza', label: 'Nobreza', attr: 'int', onlyTrained: true },
  { key: 'oficio', label: 'Ofício', attr: 'int', onlyTrained: true },
  { key: 'percepcao', label: 'Percepção', attr: 'sab' },
  { key: 'pilotagem', label: 'Pilotagem', attr: 'des', onlyTrained: true },
  { key: 'pontaria', label: 'Pontaria', attr: 'des' },
  { key: 'reflexos', label: 'Reflexos', attr: 'des' },
  { key: 'religiao', label: 'Religião', attr: 'sab', onlyTrained: true },
  { key: 'sobrevivencia', label: 'Sobrevivência', attr: 'sab' },
  { key: 'vontade', label: 'Vontade', attr: 'sab' },
]

/** PV inicial (+CON), PV por nível (+CON), PM por nível. */
export const T20_CLASSES: Record<string, { pv: number; pvLevel: number; pm: number; sprite: string }> = {
  Arcanista: { pv: 8, pvLevel: 2, pm: 6, sprite: 'mago' },
  Bárbaro: { pv: 24, pvLevel: 6, pm: 3, sprite: 'barbaro' },
  Bardo: { pv: 12, pvLevel: 3, pm: 4, sprite: 'ladino' },
  Bucaneiro: { pv: 16, pvLevel: 4, pm: 3, sprite: 'ladino' },
  Caçador: { pv: 16, pvLevel: 4, pm: 4, sprite: 'patrulheiro' },
  Cavaleiro: { pv: 20, pvLevel: 5, pm: 3, sprite: 'guerreiro' },
  Clérigo: { pv: 16, pvLevel: 4, pm: 5, sprite: 'clerigo' },
  Druida: { pv: 16, pvLevel: 4, pm: 4, sprite: 'patrulheiro' },
  Guerreiro: { pv: 20, pvLevel: 5, pm: 3, sprite: 'guerreiro' },
  Inventor: { pv: 12, pvLevel: 3, pm: 4, sprite: 'anao' },
  Ladino: { pv: 12, pvLevel: 3, pm: 4, sprite: 'ladino' },
  Lutador: { pv: 20, pvLevel: 5, pm: 3, sprite: 'barbaro' },
  Nobre: { pv: 16, pvLevel: 4, pm: 4, sprite: 'rei' },
  Paladino: { pv: 20, pvLevel: 5, pm: 3, sprite: 'clerigo' },
}

export const T20_RACES = [
  'Humano', 'Anão', 'Dahllan', 'Elfo', 'Goblin', 'Lefou', 'Minotauro', 'Qareen',
  'Golem', 'Hynne', 'Kliren', 'Medusa', 'Osteon', 'Sereia/Tritão', 'Sílfide', 'Suraggel', 'Trog',
]

export interface T20Attack {
  id: string
  name: string
  skill: 'luta' | 'pontaria'
  damage: string
  crit: string // ex.: "19/x2"
  extra: number
}
export interface T20Power {
  id: string
  name: string
  cost: number // PM
  notation: string
  description: string
}

export interface T20Sheet {
  race: string
  class: string
  origin: string
  deity: string
  level: number
  attrs: Record<T20Attr, number> // valores de atributo (ex.: 14)
  trained: string[]
  others: Record<string, number> // bônus extras por perícia
  pv: number
  pv_max: number
  pm: number
  pm_max: number
  defense_armor: number // bônus de armadura + escudo
  defense_other: number
  armor_penalty: number
  speed: number
  attacks: T20Attack[]
  powers: T20Power[]
  inventory: string
  notes: string
  nd?: string
}

export const t20mod = (v: number) => Math.floor((v - 10) / 2)
export const halfLevel = (lvl: number) => Math.floor(Math.max(1, lvl) / 2)
export const trainingBonus = (lvl: number) => (lvl >= 15 ? 6 : lvl >= 7 ? 4 : 2)

export function asT20(raw: Record<string, unknown>): T20Sheet {
  return { ...(tormenta20.defaultSheet() as unknown as T20Sheet), ...(raw as Partial<T20Sheet>) }
}

export function t20Skill(s: T20Sheet, key: string): number {
  const sk = T20_SKILLS.find((x) => x.key === key)!
  const trained = s.trained.includes(key)
  return halfLevel(s.level) + t20mod(s.attrs[sk.attr]) + (trained ? trainingBonus(s.level) : 0) + (s.others[key] ?? 0) - (sk.armor ? s.armor_penalty : 0)
}
export function t20Defense(s: T20Sheet) {
  return 10 + t20mod(s.attrs.des) + s.defense_armor + s.defense_other
}

/** PV e PM calculados pela classe e nível (sugestão — o jogador pode ajustar). */
export function t20Resources(cls: string, level: number, con: number) {
  const c = T20_CLASSES[cls] ?? T20_CLASSES.Guerreiro
  const m = t20mod(con)
  const pv = c.pv + m + (Math.max(1, level) - 1) * (c.pvLevel + m)
  const pm = c.pm * Math.max(1, level)
  return { pv: Math.max(1, pv), pm }
}

export const tormenta20: SystemDef = {
  id: 'tormenta20',
  name: 'Tormenta20',
  description: 'Atributos, 29 perícias, PV e PM por classe, Defesa e ataques com Luta/Pontaria.',
  attribution: 'Tormenta20 é marca da Jambô Editora. A Mesa Arcana implementa só as mecânicas; consulte os livros para as regras completas.',
  defaultSheet: () =>
    ({
      race: 'Humano',
      class: 'Guerreiro',
      origin: '',
      deity: '',
      level: 1,
      attrs: { for: 10, des: 10, con: 10, int: 10, sab: 10, car: 10 },
      trained: [],
      others: {},
      pv: 20,
      pv_max: 20,
      pm: 3,
      pm_max: 3,
      defense_armor: 0,
      defense_other: 0,
      armor_penalty: 0,
      speed: 9,
      attacks: [{ id: uid(), name: 'Espada longa', skill: 'luta', damage: '1d8', crit: '19/x2', extra: 0 }],
      powers: [],
      inventory: '',
      notes: '',
    }) satisfies T20Sheet as unknown as Record<string, unknown>,
  hp: (raw) => {
    const s = asT20(raw)
    return { hp: s.pv, max: s.pv_max, temp: 0 }
  },
  // em T20 o personagem pode ficar com PV negativos (morre em -metade dos PV máx.)
  setHp: (raw, hp) => {
    const s = asT20(raw)
    return { ...raw, pv: Math.max(-Math.ceil(s.pv_max / 2), Math.min(s.pv_max, hp)) }
  },
  ac: (raw) => t20Defense(asT20(raw)),
  initiative: (raw) => `1d20${formatMod(t20Skill(asT20(raw), 'iniciativa'))}`,
  rollables: (raw) => {
    const s = asT20(raw)
    const out: Rollable[] = T20_SKILLS.map((sk) => ({ id: `sk-${sk.key}`, group: 'Perícias', label: sk.label, notation: `1d20${formatMod(t20Skill(s, sk.key))}` }))
    for (const a of s.attacks)
      out.push({ id: `at-${a.id}`, group: 'Ataques', label: a.name, notation: `1d20${formatMod(t20Skill(s, a.skill) + a.extra)}`, damage: a.damage })
    for (const p of s.powers) if (p.notation) out.push({ id: `pw-${p.id}`, group: 'Poderes', label: p.name, notation: p.notation })
    return out
  },
  summary: (raw) => {
    const s = asT20(raw)
    return s.nd ? `ND ${s.nd}` : `${s.race} ${s.class} ${s.level}`
  },
}
