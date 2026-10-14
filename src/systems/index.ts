import type { Character } from '../types'
import { formatMod } from '../engine/dice'
import { uid } from '../lib/id'

/** Uma ação rolável exibida na ficha e no menu do token. */
export interface Rollable {
  id: string
  group: string
  label: string
  notation: string
  /** Dano associado (ataques/magias). */
  damage?: string
}

export interface SystemDef {
  id: string
  name: string
  description: string
  attribution?: string
  defaultSheet(): Record<string, unknown>
  hp(sheet: Record<string, unknown>): { hp: number; max: number; temp: number }
  setHp(sheet: Record<string, unknown>, hp: number): Record<string, unknown>
  ac(sheet: Record<string, unknown>): number
  initiative(sheet: Record<string, unknown>): string
  rollables(sheet: Record<string, unknown>): Rollable[]
  summary(sheet: Record<string, unknown>): string
}

// ============================================================ D&D 5e (SRD 5.2)

export type Ability = 'for' | 'des' | 'con' | 'int' | 'sab' | 'car'
export const ABILITIES: { key: Ability; label: string; full: string }[] = [
  { key: 'for', label: 'FOR', full: 'Força' },
  { key: 'des', label: 'DES', full: 'Destreza' },
  { key: 'con', label: 'CON', full: 'Constituição' },
  { key: 'int', label: 'INT', full: 'Inteligência' },
  { key: 'sab', label: 'SAB', full: 'Sabedoria' },
  { key: 'car', label: 'CAR', full: 'Carisma' },
]

export const SKILLS: { key: string; label: string; ability: Ability }[] = [
  { key: 'acrobacia', label: 'Acrobacia', ability: 'des' },
  { key: 'adestrar', label: 'Adestrar Animais', ability: 'sab' },
  { key: 'arcanismo', label: 'Arcanismo', ability: 'int' },
  { key: 'atletismo', label: 'Atletismo', ability: 'for' },
  { key: 'atuacao', label: 'Atuação', ability: 'car' },
  { key: 'enganacao', label: 'Enganação', ability: 'car' },
  { key: 'furtividade', label: 'Furtividade', ability: 'des' },
  { key: 'historia', label: 'História', ability: 'int' },
  { key: 'intimidacao', label: 'Intimidação', ability: 'car' },
  { key: 'intuicao', label: 'Intuição', ability: 'sab' },
  { key: 'investigacao', label: 'Investigação', ability: 'int' },
  { key: 'medicina', label: 'Medicina', ability: 'sab' },
  { key: 'natureza', label: 'Natureza', ability: 'int' },
  { key: 'percepcao', label: 'Percepção', ability: 'sab' },
  { key: 'persuasao', label: 'Persuasão', ability: 'car' },
  { key: 'prestidigitacao', label: 'Prestidigitação', ability: 'des' },
  { key: 'religiao', label: 'Religião', ability: 'int' },
  { key: 'sobrevivencia', label: 'Sobrevivência', ability: 'sab' },
]

export interface Attack {
  id: string
  name: string
  bonus: number
  damage: string
  type: string
}
export interface Spell {
  id: string
  name: string
  level: number
  notation: string
  description: string
}
export interface Item {
  id: string
  name: string
  qty: number
  notes: string
}

export interface Dnd5eSheet {
  race: string
  class: string
  level: number
  background: string
  alignment: string
  abilities: Record<Ability, number>
  saves: Ability[]
  skills: Record<string, 0 | 1 | 2> // 0 nada, 1 proficiente, 2 especialista
  hp: number
  hp_max: number
  hp_temp: number
  ac: number
  speed: number
  initiative_bonus: number
  attacks: Attack[]
  spells: Spell[]
  spell_ability: Ability
  inventory: Item[]
  gold: number
  features: string
  notes: string
  cr?: string
}

export const mod = (score: number) => Math.floor((score - 10) / 2)
export const profBonus = (level: number) => 2 + Math.floor((Math.max(1, level) - 1) / 4)

export function asDnd(sheet: Record<string, unknown>): Dnd5eSheet {
  return { ...(dnd5e.defaultSheet() as unknown as Dnd5eSheet), ...(sheet as Partial<Dnd5eSheet>) }
}

export function skillBonus(s: Dnd5eSheet, key: string): number {
  const sk = SKILLS.find((x) => x.key === key)!
  return mod(s.abilities[sk.ability]) + (s.skills[key] ?? 0) * profBonus(s.level)
}
export function saveBonus(s: Dnd5eSheet, a: Ability): number {
  return mod(s.abilities[a]) + (s.saves.includes(a) ? profBonus(s.level) : 0)
}
export function spellAttack(s: Dnd5eSheet) {
  return mod(s.abilities[s.spell_ability]) + profBonus(s.level)
}
export function spellDc(s: Dnd5eSheet) {
  return 8 + spellAttack(s)
}

export const dnd5e: SystemDef = {
  id: 'dnd5e',
  name: 'D&D 5e (SRD 5.2)',
  description: 'Atributos, perícias, salvaguardas, ataques e magias calculados automaticamente.',
  attribution:
    'Este conteúdo usa material do System Reference Document 5.2 ("SRD 5.2") da Wizards of the Coast LLC, disponível em https://www.dndbeyond.com/srd, licenciado sob CC-BY-4.0.',
  defaultSheet: () =>
    ({
      race: 'Humano',
      class: 'Guerreiro',
      level: 1,
      background: '',
      alignment: '',
      abilities: { for: 10, des: 10, con: 10, int: 10, sab: 10, car: 10 },
      saves: [],
      skills: {},
      hp: 10,
      hp_max: 10,
      hp_temp: 0,
      ac: 10,
      speed: 9,
      initiative_bonus: 0,
      attacks: [],
      spells: [],
      spell_ability: 'int',
      inventory: [],
      gold: 0,
      features: '',
      notes: '',
    }) satisfies Dnd5eSheet as unknown as Record<string, unknown>,
  hp: (raw) => {
    const s = asDnd(raw)
    return { hp: s.hp, max: s.hp_max, temp: s.hp_temp }
  },
  setHp: (raw, hp) => {
    const s = asDnd(raw)
    let next = hp
    let temp = s.hp_temp
    if (hp < s.hp && temp > 0) {
      const dmg = s.hp - hp
      const absorbed = Math.min(temp, dmg)
      temp -= absorbed
      next = s.hp - (dmg - absorbed)
    }
    return { ...raw, hp: Math.max(0, Math.min(s.hp_max, next)), hp_temp: temp }
  },
  ac: (raw) => asDnd(raw).ac,
  initiative: (raw) => {
    const s = asDnd(raw)
    return `1d20${formatMod(mod(s.abilities.des) + s.initiative_bonus)}`
  },
  rollables: (raw) => {
    const s = asDnd(raw)
    const out: Rollable[] = []
    for (const a of ABILITIES) out.push({ id: `ab-${a.key}`, group: 'Testes', label: a.full, notation: `1d20${formatMod(mod(s.abilities[a.key]))}` })
    for (const a of ABILITIES) out.push({ id: `sv-${a.key}`, group: 'Salvaguardas', label: `Salv. ${a.full}`, notation: `1d20${formatMod(saveBonus(s, a.key))}` })
    for (const sk of SKILLS) out.push({ id: `sk-${sk.key}`, group: 'Perícias', label: sk.label, notation: `1d20${formatMod(skillBonus(s, sk.key))}` })
    for (const at of s.attacks) out.push({ id: `at-${at.id}`, group: 'Ataques', label: at.name, notation: `1d20${formatMod(at.bonus)}`, damage: at.damage })
    for (const sp of s.spells)
      if (sp.notation) out.push({ id: `sp-${sp.id}`, group: 'Magias', label: sp.name, notation: sp.notation })
    return out
  },
  summary: (raw) => {
    const s = asDnd(raw)
    return s.cr ? `ND ${s.cr}` : `${s.race} ${s.class} ${s.level}`
  },
}

// ============================================================ Genérico

export interface GenericSheet {
  concept: string
  attributes: { id: string; name: string; value: number }[]
  hp: number
  hp_max: number
  defense: number
  base_die: string
  actions: { id: string; name: string; notation: string }[]
  inventory: Item[]
  notes: string
}

export function asGeneric(sheet: Record<string, unknown>): GenericSheet {
  return { ...(generic.defaultSheet() as unknown as GenericSheet), ...(sheet as Partial<GenericSheet>) }
}

export const generic: SystemDef = {
  id: 'generico',
  name: 'Genérico',
  description: 'Atributos livres, vida, defesa e ações com qualquer notação de dados. Serve para qualquer sistema.',
  defaultSheet: () =>
    ({
      concept: '',
      attributes: [
        { id: uid(), name: 'Físico', value: 1 },
        { id: uid(), name: 'Agilidade', value: 1 },
        { id: uid(), name: 'Mente', value: 1 },
        { id: uid(), name: 'Presença', value: 1 },
      ],
      hp: 20,
      hp_max: 20,
      defense: 10,
      base_die: '1d20',
      actions: [],
      inventory: [],
      notes: '',
    }) satisfies GenericSheet as unknown as Record<string, unknown>,
  hp: (raw) => {
    const s = asGeneric(raw)
    return { hp: s.hp, max: s.hp_max, temp: 0 }
  },
  setHp: (raw, hp) => ({ ...raw, hp: Math.max(0, Math.min(asGeneric(raw).hp_max, hp)) }),
  ac: (raw) => asGeneric(raw).defense,
  initiative: (raw) => {
    const s = asGeneric(raw)
    const ag = s.attributes.find((a) => /agil|des|reflex/i.test(a.name))
    return `${s.base_die}${formatMod(ag?.value ?? 0)}`
  },
  rollables: (raw) => {
    const s = asGeneric(raw)
    return [
      ...s.attributes.map((a) => ({ id: `attr-${a.id}`, group: 'Atributos', label: a.name, notation: `${s.base_die}${formatMod(a.value)}` })),
      ...s.actions.map((a) => ({ id: `act-${a.id}`, group: 'Ações', label: a.name, notation: a.notation })),
    ]
  },
  summary: (raw) => asGeneric(raw).concept || 'Personagem',
}

export const SYSTEMS: Record<string, SystemDef> = { dnd5e, generico: generic }
export function systemOf(c: Pick<Character, 'system_id'> | { system_id: string }): SystemDef {
  return SYSTEMS[c.system_id] ?? generic
}
