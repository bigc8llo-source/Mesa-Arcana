import { describe, expect, it } from 'vitest'
import { isValidNotation, parseNotation, roll } from '../dice'

describe('dados', () => {
  it('mesma semente = mesmo resultado (todos os clientes veem igual)', () => {
    expect(roll('4d6+2', 123)).toEqual(roll('4d6+2', 123))
  })

  it('soma dados e modificadores', () => {
    for (let s = 1; s < 200; s++) {
      const r = roll('2d6+3', s)
      const dice = r.groups[0].dice.map((d) => d.value)
      expect(dice).toHaveLength(2)
      dice.forEach((v) => expect(v).toBeGreaterThanOrEqual(1))
      dice.forEach((v) => expect(v).toBeLessThanOrEqual(6))
      expect(r.total).toBe(dice[0] + dice[1] + 3)
    }
  })

  it('4d6kh3 descarta o menor', () => {
    for (let s = 1; s < 100; s++) {
      const r = roll('4d6kh3', s)
      const vals = r.groups[0].dice.map((d) => d.value)
      const kept = [...vals].sort((a, b) => b - a).slice(0, 3)
      expect(r.total).toBe(kept.reduce((a, b) => a + b, 0))
      expect(r.groups[0].dice.filter((d) => d.dropped)).toHaveLength(1)
    }
  })

  it('vantagem e desvantagem', () => {
    for (let s = 1; s < 100; s++) {
      const a = roll('1d20+2 vantagem', s)
      const vals = a.groups[0].dice.map((d) => d.value)
      expect(vals).toHaveLength(2)
      expect(a.total).toBe(Math.max(...vals) + 2)
      const d = roll('d20 desvantagem', s)
      expect(d.total).toBe(Math.min(...d.groups[0].dice.map((x) => x.value)))
    }
  })

  it('dados explosivos rolam de novo no máximo', () => {
    let exploded = false
    for (let s = 1; s < 300; s++) {
      const r = roll('3d6!', s)
      const ds = r.groups[0].dice
      ds.forEach((d) => d.exploded && expect(d.value).toBe(6))
      if (ds.length > 3) exploded = true
    }
    expect(exploded).toBe(true)
  })

  it('d% e subtração', () => {
    const r = roll('d%-5', 42)
    expect(r.groups[0].sides).toBe(100)
    expect(r.total).toBe(r.groups[0].dice[0].value - 5)
  })

  it('marca críticos do d20', () => {
    const crits = new Set<string | null>()
    for (let s = 1; s < 500; s++) crits.add(roll('1d20', s).crit)
    expect(crits).toEqual(new Set(['success', 'fail', null]))
  })

  it('rejeita notação inválida', () => {
    expect(isValidNotation('ola')).toBe(false)
    expect(isValidNotation('2d')).toBe(false)
    expect(isValidNotation('1000d6')).toBe(false)
    expect(isValidNotation('2d6 3')).toBe(false)
    expect(() => parseNotation('2d6 vantagem')).toThrow()
    expect(isValidNotation('2d20kl1 + 1d4 - 1')).toBe(true)
  })
})

describe('todos os tipos de dado', () => {
  it.each([4, 6, 8, 10, 12, 20, 100])('d%i sai todos os valores', (sides) => {
    const seen = new Set<number>()
    for (let s = 1; s < 4000; s++) seen.add(roll(`1d${sides}`, s * 7919).total)
    expect(seen.size).toBe(sides)
  })
})
