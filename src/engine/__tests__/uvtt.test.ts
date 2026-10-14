import { describe, expect, it } from 'vitest'
import { parseUvtt } from '../uvtt'

describe('Universal VTT (.dd2vtt)', () => {
  it('converte paredes, portas e luzes para pixels', () => {
    const file = {
      format: 0.3,
      resolution: { map_origin: { x: 0, y: 0 }, map_size: { x: 10, y: 8 }, pixels_per_grid: 100 },
      line_of_sight: [
        [
          { x: 0, y: 0 },
          { x: 5, y: 0 },
          { x: 5, y: 3 },
        ],
      ],
      portals: [{ position: { x: 5, y: 4 }, bounds: [{ x: 5, y: 3.5 }, { x: 5, y: 4.5 }], closed: true }],
      lights: [{ position: { x: 2, y: 2 }, range: 6, intensity: 1, color: 'ffff8800' }],
    }
    const r = parseUvtt(JSON.stringify(file))
    expect(r.width).toBe(1000)
    expect(r.height).toBe(800)
    expect(r.gridSize).toBe(100)
    expect(r.walls.filter((w) => w.kind === 'wall')).toHaveLength(2)
    expect(r.walls[0]).toMatchObject({ x1: 0, y1: 0, x2: 500, y2: 0 })
    expect(r.walls.find((w) => w.kind === 'door')).toMatchObject({ x1: 500, y1: 350, x2: 500, y2: 450, open: false })
    expect(r.lights[0]).toMatchObject({ x: 200, y: 200, dim: 6, color: '#ff8800' })
    expect(r.image).toBeNull()
  })
  it('recusa arquivo inválido', () => {
    expect(() => parseUvtt('{"foo":1}')).toThrow()
  })
})
