import { describe, expect, it } from 'vitest'
import type { GridConfig, Wall } from '../../types'
import { cellDistance, crossesWall, inAoe, pointInPolygon, snapToGrid, visibilityPolygon, sightBlockers, hexRound, pixelToHex, hexToPixel } from '../geometry'

const grid: GridConfig = { type: 'square', size: 70, offsetX: 0, offsetY: 0, color: '#000', opacity: 1, unitDistance: 1.5, unitLabel: 'm' }

describe('grid', () => {
  it('encaixa no centro da célula (tamanho ímpar) ou na interseção (par)', () => {
    expect(snapToGrid({ x: 80, y: 130 }, grid)).toEqual({ x: 105, y: 105 })
    expect(snapToGrid({ x: 80, y: 130 }, grid, 2)).toEqual({ x: 70, y: 140 })
  })
  it('distância em células: diagonal conta 1', () => {
    expect(cellDistance({ x: 35, y: 35 }, { x: 35 + 70 * 3, y: 35 + 70 * 2 }, grid)).toBe(3)
  })
  it('hexágonos ida e volta', () => {
    const hex = { ...grid, type: 'hex' as const }
    for (const h of [{ q: 0, r: 0 }, { q: 3, r: -2 }, { q: -1, r: 4 }]) {
      const p = hexToPixel(h, hex)
      expect(hexRound(pixelToHex(p, hex))).toEqual(h)
    }
  })
})

describe('visão', () => {
  // sala 0..700 com uma parede vertical em x=350 de y=0 a y=500 (abertura embaixo)
  const walls: Wall[] = [{ id: 'w', x1: 350, y1: 0, x2: 350, y2: 500, kind: 'wall' }]
  const bounds = { w: 700, h: 700 }
  it('parede bloqueia a linha de visão', () => {
    const poly = visibilityPolygon({ x: 100, y: 100 }, sightBlockers(walls), bounds)
    expect(pointInPolygon({ x: 200, y: 200 }, poly)).toBe(true)
    expect(pointInPolygon({ x: 600, y: 100 }, poly)).toBe(false) // atrás da parede
    const below = visibilityPolygon({ x: 100, y: 600 }, sightBlockers(walls), bounds)
    expect(pointInPolygon({ x: 600, y: 650 }, below)).toBe(true) // pela abertura
  })
  it('porta aberta não bloqueia, janela não bloqueia visão', () => {
    const door: Wall[] = [{ ...walls[0], kind: 'door', open: true }]
    expect(pointInPolygon({ x: 600, y: 100 }, visibilityPolygon({ x: 100, y: 100 }, sightBlockers(door), bounds))).toBe(true)
    const win: Wall[] = [{ ...walls[0], kind: 'window' }]
    expect(pointInPolygon({ x: 600, y: 100 }, visibilityPolygon({ x: 100, y: 100 }, sightBlockers(win), bounds))).toBe(true)
  })
  it('jogador não atravessa parede nem janela, mas passa por porta aberta', () => {
    expect(crossesWall({ x: 100, y: 100 }, { x: 600, y: 100 }, walls)).toBe(true)
    expect(crossesWall({ x: 100, y: 100 }, { x: 600, y: 100 }, [{ ...walls[0], kind: 'window' }])).toBe(true)
    expect(crossesWall({ x: 100, y: 100 }, { x: 600, y: 100 }, [{ ...walls[0], kind: 'door', open: true }])).toBe(false)
    expect(crossesWall({ x: 100, y: 600 }, { x: 600, y: 600 }, walls)).toBe(false)
  })
})

describe('áreas de efeito', () => {
  const o = { x: 0, y: 0 }
  it('círculo', () => {
    expect(inAoe('circle', o, { x: 100, y: 0 }, { x: 60, y: 60 }, 70)).toBe(true)
    expect(inAoe('circle', o, { x: 100, y: 0 }, { x: 90, y: 90 }, 70)).toBe(false)
  })
  it('cone de 53°', () => {
    expect(inAoe('cone', o, { x: 300, y: 0 }, { x: 200, y: 50 }, 70)).toBe(true)
    expect(inAoe('cone', o, { x: 300, y: 0 }, { x: 100, y: 100 }, 70)).toBe(false)
    expect(inAoe('cone', o, { x: 300, y: 0 }, { x: -50, y: 0 }, 70)).toBe(false)
  })
  it('linha', () => {
    expect(inAoe('line', o, { x: 300, y: 0 }, { x: 150, y: 20 }, 70)).toBe(true)
    expect(inAoe('line', o, { x: 300, y: 0 }, { x: 150, y: 50 }, 70)).toBe(false)
  })
})
