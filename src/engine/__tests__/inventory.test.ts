import { describe, expect, it } from 'vitest'
import { addItem, carryInfo, readBag, splitStack, mergeStacks, starterBag, totalWeight, type InvItem } from '../../systems/inventory'

const base = { notes: '', stackable: false, qty: 1 }

describe('inventário', () => {
  it('itens empilháveis somam na mesma pilha; moedas não pesam', () => {
    let b: InvItem[] = []
    b = addItem(b, { ...base, name: 'Tibar (T$)', kind: 'moeda', weight: 5, stackable: true, qty: 10 })
    b = addItem(b, { ...base, name: 'tibar (T$)', kind: 'moeda', weight: 0, stackable: true, qty: 7 })
    b = addItem(b, { ...base, name: 'Flechas', kind: 'municao', weight: 0.05, stackable: true, qty: 20 })
    b = addItem(b, { ...base, name: 'Espada', kind: 'arma', weight: 1 })
    expect(b.length).toBe(3)
    expect(b[0].qty).toBe(17)
    expect(b[0].weight).toBe(0)
    expect(totalWeight(b)).toBe(2)
  })
  it('não empilháveis viram itens separados', () => {
    const b = addItem([], { ...base, name: 'Adaga', kind: 'arma', weight: 1, qty: 3 })
    expect(b.length).toBe(3)
    expect(new Set(b.map((x) => x.id)).size).toBe(3)
  })
  it('dividir e juntar pilhas', () => {
    const b = addItem([], { ...base, name: 'Poção', kind: 'consumivel', weight: 0.5, stackable: true, qty: 4 })
    const s = splitStack(b, b[0].id, 1)
    expect(s.map((x) => x.qty)).toEqual([3, 1])
    expect(mergeStacks(s).map((x) => x.qty)).toEqual([4])
  })
  it('fichas antigas são lidas sem perder nada', () => {
    expect(readBag({ inventory: [{ id: 'a', name: 'Corda', qty: 2, notes: 'x' }] })[0]).toMatchObject({ name: 'Corda', qty: 2, notes: 'x' })
    expect(readBag({ inventory: 'texto livre' })).toEqual([])
  })
  it('capacidade de carga por sistema', () => {
    expect(carryInfo({ system_id: 'tormenta20', sheet: { attrs: { for: 14 } } })).toEqual({ unit: 'espaços', capacity: 14, max: 28 })
    expect(carryInfo({ system_id: 'dnd5e', sheet: { abilities: { for: 10 } } }).capacity).toBe(75)
    expect(carryInfo({ system_id: 'generico', sheet: {} }).capacity).toBeNull()
  })
  it('equipamento inicial com moedas', () => {
    const b = starterBag('tormenta20', { weapon: { id: 'arco_curto', label: 'Arco curto', weapon: 'bow' }, armor: { id: 'couro', label: 'Couro', defense: 2 }, shield: false })
    const t = b.find((x) => x.kind === 'moeda')!
    expect(t.qty).toBeGreaterThanOrEqual(11)
    expect(t.qty).toBeLessThanOrEqual(16)
    expect(b.find((x) => x.name === 'Flechas')?.qty).toBe(20)
  })
})
