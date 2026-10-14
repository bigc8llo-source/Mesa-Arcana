import { describe, expect, it } from 'vitest'
import { critParts, explainHit, explainPart, formatPart, parseCrit, parseDamage, partsNotation } from '../damage'
import { isValidNotation } from '../dice'

const explain = (t: string) => parseDamage(t).parts.map(explainPart)

describe('dano', () => {
  it('expressões simples', () => {
    expect(explain('1d4')).toEqual(['Role 1 dado de 4 faces.'])
    expect(explain('1d6 + 2')).toEqual(['Role 1 dado de 6 faces e some 2.'])
    expect(explain('1d10')).toEqual(['Role 1 dado de 10 faces.'])
    expect(explain('1d12+1')).toEqual(['Role 1 dado de 12 faces e some 1.'])
  })
  it('múltiplos dados', () => {
    expect(explain('2d6')).toEqual(['Role 2 dados de 6 faces e some os resultados.'])
    expect(explain('2d8 + 3')).toEqual(['Role 2 dados de 8 faces e some 3.'])
  })
  it('modificador negativo e dano fixo', () => {
    expect(explain('1d6-1')).toEqual(['Role 1 dado de 6 faces e subtraia 1.'])
    expect(formatPart(parseDamage('1d6-1').parts[0])).toBe('1d6 − 1')
    expect(explain('5')).toEqual(['Dano fixo de 5: não role dados.'])
    expect(explain('3 de fogo')).toEqual(['Dano fixo de 3: não role dados.'])
  })
  it('vários componentes com tipo, cada um explicado', () => {
    const d = parseDamage('1d6 + 2 de corte e 1d4 de fogo')
    expect(d.ok).toBe(true)
    expect(d.parts).toEqual([
      { count: 1, sides: 6, mod: 2, type: 'corte' },
      { count: 1, sides: 4, mod: 0, type: 'fogo' },
    ])
    expect(partsNotation(d.parts)).toBe('1d6+2+1d4')
    expect(isValidNotation(partsNotation(d.parts))).toBe(true)
    expect(parseDamage('2d6+1d4+3').parts.length).toBe(2)
    expect(parseDamage('1d8 perfuração, 2 veneno').parts[1]).toEqual({ count: 0, sides: 0, mod: 2, type: 'veneno' })
  })
  it('textos ambíguos são preservados, não adivinhados', () => {
    for (const t of ['concussão + 1d6 ácido', '4d6kh3', '1d6 x2', '2d6 3', '(1d6+2)*2', '-1d4', '1d7', '']) {
      const d = parseDamage(t)
      expect(d.ok, t).toBe(false)
      expect(d.raw).toBe(t)
    }
  })
  it('acerto', () => {
    expect(explainHit(4)).toBe('Role um dado de 20 faces e some 4.')
    expect(explainHit(-1)).toBe('Role um dado de 20 faces e subtraia 1.')
    expect(explainHit(0)).toBe('Role um dado de 20 faces.')
  })
  it('crítico: T20 multiplica só os dados da arma; D&D dobra os dados', () => {
    expect(parseCrit('19/x2')).toEqual({ from: 19, mult: 2 })
    expect(parseCrit('x3')).toEqual({ from: 20, mult: 3 })
    expect(parseCrit('19-20/x2')).toEqual({ from: 19, mult: 2 })
    expect(parseCrit('qualquer')).toBeNull()
    const p = parseDamage('1d8+3 corte e 1d6 fogo').parts
    expect(partsNotation(critParts(p, 't20', 3))).toBe('3d8+3+1d6')
    expect(partsNotation(critParts(p, 'dnd'))).toBe('2d8+3+2d6')
  })
})
