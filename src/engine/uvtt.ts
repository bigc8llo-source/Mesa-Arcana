import type { Light, Wall } from '../types'
import { uid } from '../lib/id'

/** Formato Universal VTT (.dd2vtt / .uvtt / .df2vtt), exportado por Dungeondraft e similares. */
interface UvttFile {
  resolution: { map_origin?: { x: number; y: number }; map_size: { x: number; y: number }; pixels_per_grid: number }
  line_of_sight?: { x: number; y: number }[][]
  objects_line_of_sight?: { x: number; y: number }[][]
  portals?: { bounds: { x: number; y: number }[]; closed?: boolean }[]
  lights?: { position: { x: number; y: number }; range: number; intensity?: number; color?: string }[]
  image?: string
}

export interface UvttImport {
  width: number
  height: number
  gridSize: number
  walls: Wall[]
  lights: Light[]
  image: Blob | null
}

export function parseUvtt(text: string): UvttImport {
  const f = JSON.parse(text) as UvttFile
  if (!f.resolution?.pixels_per_grid) throw new Error('Arquivo Universal VTT inválido')
  const ppg = f.resolution.pixels_per_grid
  const ox = f.resolution.map_origin?.x ?? 0
  const oy = f.resolution.map_origin?.y ?? 0
  const px = (p: { x: number; y: number }) => ({ x: (p.x - ox) * ppg, y: (p.y - oy) * ppg })

  const walls: Wall[] = []
  for (const line of [...(f.line_of_sight ?? []), ...(f.objects_line_of_sight ?? [])]) {
    for (let i = 0; i < line.length - 1; i++) {
      const a = px(line[i])
      const b = px(line[i + 1])
      walls.push({ id: uid(), x1: a.x, y1: a.y, x2: b.x, y2: b.y, kind: 'wall' })
    }
  }
  for (const portal of f.portals ?? []) {
    if (portal.bounds?.length < 2) continue
    const a = px(portal.bounds[0])
    const b = px(portal.bounds[1])
    walls.push({ id: uid(), x1: a.x, y1: a.y, x2: b.x, y2: b.y, kind: 'door', open: portal.closed === false })
  }
  const lights: Light[] = (f.lights ?? []).map((l) => {
    const p = px(l.position)
    const hex = (l.color ?? 'ffffffff').replace('#', '')
    const rgb = hex.length === 8 ? hex.slice(2) : hex.slice(0, 6)
    return { id: uid(), x: p.x, y: p.y, bright: l.range / 2, dim: l.range, color: `#${rgb}`, flicker: false }
  })

  let image: Blob | null = null
  if (f.image) {
    const bin = atob(f.image)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    image = new Blob([bytes], { type: f.image.startsWith('/9j/') ? 'image/jpeg' : 'image/png' })
  }
  return {
    width: f.resolution.map_size.x * ppg,
    height: f.resolution.map_size.y * ppg,
    gridSize: ppg,
    walls,
    lights,
    image,
  }
}
