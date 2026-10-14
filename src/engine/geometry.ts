import type { GridConfig, Wall } from '../types'

export interface Pt {
  x: number
  y: number
}
export interface Seg {
  a: Pt
  b: Pt
}

// ---------------------------------------------------------------- Grid

const SQRT3 = Math.sqrt(3)

/** Centro da célula mais próxima. Tokens de tamanho par encaixam na interseção das linhas. */
export function snapToGrid(p: Pt, grid: GridConfig, size = 1): Pt {
  if (grid.type === 'none') return p
  if (grid.type === 'hex') {
    const c = hexRound(pixelToHex(p, grid))
    return hexToPixel(c, grid)
  }
  const s = grid.size
  const off = size % 2 === 0 ? 0 : s / 2
  return {
    x: Math.round((p.x - grid.offsetX - off) / s) * s + grid.offsetX + off,
    y: Math.round((p.y - grid.offsetY - off) / s) * s + grid.offsetY + off,
  }
}

// Hexágonos "pointy-top", raio = size / sqrt(3) para que a largura seja `size`.
function hexRadius(grid: GridConfig) {
  return grid.size / SQRT3
}
export function pixelToHex(p: Pt, grid: GridConfig) {
  const r = hexRadius(grid)
  const x = p.x - grid.offsetX
  const y = p.y - grid.offsetY
  return { q: ((SQRT3 / 3) * x - (1 / 3) * y) / r, r: ((2 / 3) * y) / r }
}
export function hexToPixel(h: { q: number; r: number }, grid: GridConfig): Pt {
  const r = hexRadius(grid)
  return { x: r * (SQRT3 * h.q + (SQRT3 / 2) * h.r) + grid.offsetX, y: r * (1.5 * h.r) + grid.offsetY }
}
export function hexRound(h: { q: number; r: number }) {
  const s = -h.q - h.r
  let q = Math.round(h.q)
  let r = Math.round(h.r)
  const rs = Math.round(s)
  const dq = Math.abs(q - h.q)
  const dr = Math.abs(r - h.r)
  const ds = Math.abs(rs - s)
  if (dq > dr && dq > ds) q = -r - rs
  else if (dr > ds) r = -q - rs
  return { q, r }
}
export function hexCorners(center: Pt, grid: GridConfig): Pt[] {
  const r = hexRadius(grid)
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 180) * (60 * i - 30)
    return { x: center.x + r * Math.cos(a), y: center.y + r * Math.sin(a) }
  })
}

/** Distância em células: diagonal conta 1 (regra padrão do D&D 5e). */
export function cellDistance(a: Pt, b: Pt, grid: GridConfig): number {
  if (grid.type === 'hex') {
    const ha = hexRound(pixelToHex(a, grid))
    const hb = hexRound(pixelToHex(b, grid))
    const dq = ha.q - hb.q
    const dr = ha.r - hb.r
    return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2
  }
  const dx = Math.abs(b.x - a.x) / grid.size
  const dy = Math.abs(b.y - a.y) / grid.size
  if (grid.type === 'none') return Math.hypot(dx, dy)
  return Math.round(Math.max(dx, dy))
}

export function formatDistance(cells: number, grid: GridConfig): string {
  const v = Math.round(cells * grid.unitDistance * 10) / 10
  return `${v.toLocaleString('pt-BR')} ${grid.unitLabel}`
}

// ---------------------------------------------------------------- Visibilidade

function raySegment(origin: Pt, dir: Pt, s: Seg): number | null {
  const sx = s.b.x - s.a.x
  const sy = s.b.y - s.a.y
  const den = dir.x * sy - dir.y * sx
  if (Math.abs(den) < 1e-12) return null
  const t = ((s.a.x - origin.x) * sy - (s.a.y - origin.y) * sx) / den
  const u = ((s.a.x - origin.x) * dir.y - (s.a.y - origin.y) * dir.x) / den
  if (t < 0 || u < -1e-9 || u > 1 + 1e-9) return null
  return t
}

/** Segmentos que bloqueiam visão (paredes, portas fechadas). Janelas não bloqueiam. */
export function sightBlockers(walls: Wall[]): Seg[] {
  return walls
    .filter((w) => w.kind === 'wall' || (w.kind === 'door' && !w.open))
    .map((w) => ({ a: { x: w.x1, y: w.y1 }, b: { x: w.x2, y: w.y2 } }))
}

/** Segmentos que bloqueiam movimento (paredes, janelas e portas fechadas). */
export function moveBlockers(walls: Wall[]): Seg[] {
  return walls
    .filter((w) => w.kind !== 'door' || !w.open)
    .map((w) => ({ a: { x: w.x1, y: w.y1 }, b: { x: w.x2, y: w.y2 } }))
}

/**
 * Polígono de visibilidade a partir de `origin`: raios para cada ponta de parede (±ε),
 * interseção mais próxima e ordenação angular. Limitado por uma caixa `bounds`.
 */
export function visibilityPolygon(origin: Pt, segments: Seg[], bounds: { w: number; h: number }, radius = Infinity): Pt[] {
  const pad = 2
  const minX = Math.max(-pad, origin.x - radius)
  const minY = Math.max(-pad, origin.y - radius)
  const maxX = Math.min(bounds.w + pad, origin.x + radius)
  const maxY = Math.min(bounds.h + pad, origin.y + radius)
  const box: Seg[] = [
    { a: { x: minX, y: minY }, b: { x: maxX, y: minY } },
    { a: { x: maxX, y: minY }, b: { x: maxX, y: maxY } },
    { a: { x: maxX, y: maxY }, b: { x: minX, y: maxY } },
    { a: { x: minX, y: maxY }, b: { x: minX, y: minY } },
  ]
  const segs = segments.filter((s) => segmentNearBox(s, minX, minY, maxX, maxY)).concat(box)

  const angles: number[] = []
  for (const s of segs) {
    for (const p of [s.a, s.b]) {
      const a = Math.atan2(p.y - origin.y, p.x - origin.x)
      angles.push(a - 1e-4, a, a + 1e-4)
    }
  }
  const hits: { a: number; p: Pt }[] = []
  for (const a of angles) {
    const dir = { x: Math.cos(a), y: Math.sin(a) }
    let best = Infinity
    for (const s of segs) {
      const t = raySegment(origin, dir, s)
      if (t !== null && t < best) best = t
    }
    if (best < Infinity) hits.push({ a, p: { x: origin.x + dir.x * best, y: origin.y + dir.y * best } })
  }
  hits.sort((m, n) => m.a - n.a)
  return hits.map((h) => h.p)
}

function segmentNearBox(s: Seg, minX: number, minY: number, maxX: number, maxY: number) {
  return !(
    Math.max(s.a.x, s.b.x) < minX ||
    Math.min(s.a.x, s.b.x) > maxX ||
    Math.max(s.a.y, s.b.y) < minY ||
    Math.min(s.a.y, s.b.y) > maxY
  )
}

export function pointInPolygon(p: Pt, poly: Pt[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]
    const b = poly[j]
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside
  }
  return inside
}

export function segmentsIntersect(p1: Pt, p2: Pt, s: Seg): boolean {
  const d = (a: Pt, b: Pt, c: Pt) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
  const d1 = d(s.a, s.b, p1)
  const d2 = d(s.a, s.b, p2)
  const d3 = d(p1, p2, s.a)
  const d4 = d(p1, p2, s.b)
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
}

/** Movimento atravessa uma parede? (jogadores não podem atravessar). */
export function crossesWall(from: Pt, to: Pt, walls: Wall[]): boolean {
  return moveBlockers(walls).some((s) => segmentsIntersect(from, to, s))
}

export function distToSegment(p: Pt, s: Seg): number {
  const dx = s.b.x - s.a.x
  const dy = s.b.y - s.a.y
  const l2 = dx * dx + dy * dy
  let t = l2 ? ((p.x - s.a.x) * dx + (p.y - s.a.y) * dy) / l2 : 0
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(p.x - (s.a.x + t * dx), p.y - (s.a.y + t * dy))
}

// ---------------------------------------------------------------- Áreas de efeito

export type AoeShape = 'circle' | 'cone' | 'line' | 'square'

/** O ponto `p` está dentro da área (origem `o`, alvo `t`)? */
export function inAoe(shape: AoeShape, o: Pt, t: Pt, p: Pt, lineWidth: number): boolean {
  const len = Math.hypot(t.x - o.x, t.y - o.y)
  if (shape === 'circle') return Math.hypot(p.x - o.x, p.y - o.y) <= len
  if (shape === 'square') return Math.abs(p.x - o.x) <= len && Math.abs(p.y - o.y) <= len
  if (shape === 'line') return distToSegment(p, { a: o, b: t }) <= lineWidth / 2 && Math.hypot(p.x - o.x, p.y - o.y) <= len + 1
  // cone de 53° (largura = comprimento, como no D&D)
  const d = Math.hypot(p.x - o.x, p.y - o.y)
  if (d > len || d === 0) return d === 0
  const a1 = Math.atan2(t.y - o.y, t.x - o.x)
  const a2 = Math.atan2(p.y - o.y, p.x - o.x)
  let diff = Math.abs(a1 - a2)
  if (diff > Math.PI) diff = 2 * Math.PI - diff
  return diff <= Math.atan(0.5)
}

export function conePoints(o: Pt, t: Pt): Pt[] {
  const len = Math.hypot(t.x - o.x, t.y - o.y)
  const a = Math.atan2(t.y - o.y, t.x - o.x)
  const half = Math.atan(0.5)
  const pts: Pt[] = [o]
  for (let i = 0; i <= 16; i++) {
    const ang = a - half + (2 * half * i) / 16
    pts.push({ x: o.x + Math.cos(ang) * len, y: o.y + Math.sin(ang) * len })
  }
  return pts
}
