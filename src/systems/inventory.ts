// Inventário comum a todos os sistemas: itens com peso, itens empilháveis e moedas (sem peso).
// Fica em `sheet.bag`. Fichas antigas (texto ou lista simples) continuam legíveis e não são apagadas.
import { uid } from '../lib/id'
import type { Character } from '../types'

export type ItemKind = 'moeda' | 'arma' | 'armadura' | 'consumivel' | 'municao' | 'equipamento' | 'tesouro' | 'outro'

export interface InvItem {
  id: string
  name: string
  kind: ItemKind
  qty: number
  /** Peso de UMA unidade (espaços no T20, kg nos outros). Moedas sempre 0. */
  weight: number
  /** Itens iguais se juntam numa pilha (moedas, flechas, poções…). */
  stackable: boolean
  equipped?: boolean
  notes: string
}

export const KIND_LABEL: Record<ItemKind, string> = {
  moeda: 'Moeda',
  arma: 'Arma',
  armadura: 'Armadura',
  consumivel: 'Consumível',
  municao: 'Munição',
  equipamento: 'Equipamento',
  tesouro: 'Tesouro',
  outro: 'Outro',
}

export interface CatalogItem {
  name: string
  kind: ItemKind
  /** [T20 em espaços, kg] */
  weight: [number, number]
  stackable: boolean
  qty?: number
}

const coin = (name: string): CatalogItem => ({ name, kind: 'moeda', weight: [0, 0], stackable: true })

export const COINS: Record<string, CatalogItem[]> = {
  tormenta20: [coin('Tibar (T$)'), coin('Tibar de ouro (TO)'), coin('Tibar de prata (TP)')],
  dnd5e: [coin('Peça de ouro (PO)'), coin('Peça de prata (PP)'), coin('Peça de cobre (PC)'), coin('Peça de platina (PL)')],
  generico: [coin('Moedas de ouro'), coin('Moedas de prata')],
}

export const CATALOG: CatalogItem[] = [
  { name: 'Poção de cura', kind: 'consumivel', weight: [0.5, 0.25], stackable: true },
  { name: 'Ração de viagem (1 dia)', kind: 'consumivel', weight: [0.5, 1], stackable: true },
  { name: 'Odre de água', kind: 'equipamento', weight: [1, 2], stackable: false },
  { name: 'Tocha', kind: 'consumivel', weight: [1, 0.5], stackable: true },
  { name: 'Flechas', kind: 'municao', weight: [0.05, 0.05], stackable: true, qty: 20 },
  { name: 'Virotes', kind: 'municao', weight: [0.05, 0.075], stackable: true, qty: 20 },
  { name: 'Mochila', kind: 'equipamento', weight: [1, 2.5], stackable: false },
  { name: 'Saco de dormir', kind: 'equipamento', weight: [1, 3.5], stackable: false },
  { name: 'Corda (15 m)', kind: 'equipamento', weight: [1, 5], stackable: false },
  { name: 'Lampião', kind: 'equipamento', weight: [1, 1], stackable: false },
  { name: 'Óleo (frasco)', kind: 'consumivel', weight: [0.5, 0.5], stackable: true },
  { name: 'Kit de primeiros socorros', kind: 'equipamento', weight: [1, 1.5], stackable: false },
  { name: 'Ferramentas de ladrão', kind: 'equipamento', weight: [1, 0.5], stackable: false },
  { name: 'Pé de cabra', kind: 'equipamento', weight: [1, 2.5], stackable: false },
  { name: 'Gema', kind: 'tesouro', weight: [0, 0], stackable: true },
]

export const isCoin = (i: Pick<InvItem, 'kind'>) => i.kind === 'moeda'
export const unitWeight = (i: InvItem) => (isCoin(i) ? 0 : Math.max(0, Number(i.weight) || 0))
export const totalWeight = (items: InvItem[]) => Math.round(items.reduce((t, i) => t + unitWeight(i) * Math.max(0, i.qty), 0) * 100) / 100

/** Unidade de peso e capacidade de carga do personagem (null = sem limite definido). */
export function carryInfo(c: Pick<Character, 'system_id' | 'sheet'>): { unit: string; capacity: number | null; max: number | null } {
  const s = c.sheet as Record<string, unknown>
  if (c.system_id === 'tormenta20') {
    // Tormenta20: 10 espaços + 2 por ponto de Força; acima disso fica sobrecarregado, até o dobro.
    const attrs = (s.attrs ?? {}) as Record<string, number>
    const forMod = Math.floor(((attrs.for ?? 10) - 10) / 2)
    const cap = Math.max(1, 10 + 2 * forMod)
    return { unit: 'espaços', capacity: cap, max: cap * 2 }
  }
  if (c.system_id === 'dnd5e') {
    // D&D 5e: Força × 15 lb ≈ Força × 7,5 kg.
    const ab = (s.abilities ?? {}) as Record<string, number>
    const cap = Math.round((ab.for ?? 10) * 7.5 * 10) / 10
    return { unit: 'kg', capacity: cap, max: cap * 2 }
  }
  const cap = Number(s.carry_max) || 0
  return { unit: 'kg', capacity: cap > 0 ? cap : null, max: null }
}

/** Lê o inventário. Fichas antigas sem `bag` são convertidas só na leitura. */
export function readBag(sheet: Record<string, unknown>): InvItem[] {
  if (Array.isArray(sheet.bag)) return (sheet.bag as InvItem[]).map(normalize)
  // Ficha genérica antiga: lista { name, qty, notes }
  if (Array.isArray(sheet.inventory)) {
    return (sheet.inventory as { id?: string; name: string; qty?: number; notes?: string }[]).map((x) =>
      normalize({ id: x.id ?? uid(), name: x.name, qty: x.qty ?? 1, notes: x.notes ?? '', kind: 'outro', weight: 0, stackable: false }),
    )
  }
  return []
}

/** Texto livre de inventário de fichas antigas (mantido e exibido, nunca apagado). */
export function legacyInventoryText(c: Pick<Character, 'system_id' | 'sheet'>): string {
  const s = c.sheet as Record<string, unknown>
  if (c.system_id === 'tormenta20' && typeof s.inventory === 'string') return s.inventory
  if (c.system_id === 'dnd5e' && typeof s.features === 'string') return s.features
  return ''
}

function normalize(i: Partial<InvItem>): InvItem {
  const kind = (i.kind ?? 'outro') as ItemKind
  return {
    id: i.id || uid(),
    name: i.name ?? 'Item',
    kind,
    qty: Math.max(0, Math.floor(Number(i.qty) || 0)),
    weight: kind === 'moeda' ? 0 : Math.max(0, Number(i.weight) || 0),
    stackable: kind === 'moeda' ? true : !!i.stackable,
    equipped: !!i.equipped,
    notes: i.notes ?? '',
  }
}

/** Adiciona um item; empilháveis com o mesmo nome somam na pilha existente. */
export function addItem(items: InvItem[], it: Omit<InvItem, 'id'> & { id?: string }): InvItem[] {
  const n = normalize(it)
  if (n.stackable) {
    const key = n.name.trim().toLowerCase()
    const same = items.find((x) => x.stackable && x.kind === n.kind && x.name.trim().toLowerCase() === key)
    if (same) return items.map((x) => (x === same ? { ...x, qty: x.qty + n.qty } : x))
  }
  if (!n.stackable && n.qty > 1) {
    // não empilháveis viram itens separados (cada um pode ser equipado/anotado)
    return [...items, ...Array.from({ length: Math.min(n.qty, 50) }, () => ({ ...n, id: uid(), qty: 1 }))]
  }
  return [...items, n]
}

/** Separa `qty` unidades de uma pilha num item novo. */
export function splitStack(items: InvItem[], id: string, qty: number): InvItem[] {
  const it = items.find((x) => x.id === id)
  if (!it || qty <= 0 || qty >= it.qty) return items
  const idx = items.indexOf(it)
  const next = [...items]
  next.splice(idx, 1, { ...it, qty: it.qty - qty }, { ...it, id: uid(), qty })
  return next
}

/** Junta pilhas iguais. */
export function mergeStacks(items: InvItem[]): InvItem[] {
  return items.reduce<InvItem[]>((acc, x) => (x.stackable ? addItem(acc, x) : [...acc, x]), [])
}

export function fromCatalog(ci: CatalogItem, systemId: string, qty = ci.qty ?? 1): InvItem {
  return normalize({ id: uid(), name: ci.name, kind: ci.kind, weight: systemId === 'tormenta20' ? ci.weight[0] : ci.weight[1], stackable: ci.stackable, qty, notes: '' })
}

/** Equipamento inicial de um personagem criado pelo assistente. */
export function starterBag(
  systemId: string,
  g: { weapon: { label: string; id: string; weapon?: string }; armor: { label: string; id: string; defense: number }; shield: boolean; originItem?: string },
): InvItem[] {
  const t20 = systemId === 'tormenta20'
  const heavyWeapon = /grande|longo/.test(g.weapon.id)
  const w = (espacos: number, kg: number) => (t20 ? espacos : kg)
  let bag: InvItem[] = []
  const add = (name: string, kind: ItemKind, weight: number, qty = 1, stackable = false, equipped = false) => (bag = addItem(bag, { name, kind, weight, qty, stackable, equipped, notes: '' }))
  if (g.weapon.weapon !== 'none') add(g.weapon.label, 'arma', w(heavyWeapon ? 2 : 1, heavyWeapon ? 3 : 1.5), 1, false, true)
  if (g.weapon.weapon === 'bow') add('Flechas', 'municao', w(0.05, 0.05), 20, true)
  if (g.armor.defense > 0) add(g.armor.label, 'armadura', w(g.armor.defense >= 5 ? 5 : 2, g.armor.defense >= 5 ? 20 : 5), 1, false, true)
  if (g.shield) add('Escudo', 'armadura', w(2, 3), 1, false, true)
  if (g.originItem) add(g.originItem, 'equipamento', w(1, 1))
  add('Mochila', 'equipamento', w(1, 2.5))
  add('Saco de dormir', 'equipamento', w(1, 3.5))
  add('Ração de viagem (1 dia)', 'consumivel', w(0.5, 1), 3, true)
  const coin = (COINS[systemId] ?? COINS.generico)[0]
  // Tormenta20: a mesa usa 1d6+10 T$ iniciais (rolado na criação).
  add(coin.name, 'moeda', 0, t20 ? 10 + 1 + Math.floor(Math.random() * 6) : 10, true)
  return bag
}
