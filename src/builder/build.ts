import type { BuildData, GridConfig, Light, Wall } from '../types'
import { PROP_BY_ID, TILE_BY_ID, TILE_PX, propImage, tileImage } from './tiles'
import { uid } from '../lib/id'

export const key = (x: number, y: number) => `${x},${y}`

export function emptyBuild(cols = 30, rows = 20): BuildData {
  return { cols, rows, tiles: {}, props: [] }
}

const kindAt = (b: BuildData, x: number, y: number) => {
  if (x < 0 || y < 0 || x >= b.cols || y >= b.rows) return null
  const id = b.tiles[key(x, y)]
  return id ? (TILE_BY_ID[id]?.kind ?? null) : null
}
const isWall = (b: BuildData, x: number, y: number) => kindAt(b, x, y) === 'wall'

/** Desenha o mapa inteiro (32 px por célula, pixel art). */
export function bakeBuild(b: BuildData, canvas: HTMLCanvasElement, transparentEmpty = false) {
  const W = b.cols * TILE_PX
  const H = b.rows * TILE_PX
  if (canvas.width !== W || canvas.height !== H) {
    canvas.width = W
    canvas.height = H
  }
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  ctx.clearRect(0, 0, W, H)
  if (!transparentEmpty) {
    ctx.fillStyle = '#0b0a0f'
    ctx.fillRect(0, 0, W, H)
  }
  for (let y = 0; y < b.rows; y++)
    for (let x = 0; x < b.cols; x++) {
      const id = b.tiles[key(x, y)]
      if (!id) continue
      const img = tileImage(id, (x * 7 + y * 13) % 4)
      if (img) ctx.drawImage(img, x * TILE_PX, y * TILE_PX)
    }
  // sombreamento: face das paredes, sombra no chão junto às paredes, borda dos líquidos
  for (let y = 0; y < b.rows; y++)
    for (let x = 0; x < b.cols; x++) {
      const k = kindAt(b, x, y)
      const X = x * TILE_PX
      const Y = y * TILE_PX
      if (k === 'wall') {
        ctx.fillStyle = 'rgba(0,0,0,0.35)'
        ctx.fillRect(X, Y, TILE_PX, 3)
        if (kindAt(b, x, y + 1) !== 'wall' && kindAt(b, x, y + 1) !== null) {
          ctx.fillStyle = 'rgba(0,0,0,0.28)'
          ctx.fillRect(X, Y + TILE_PX - 8, TILE_PX, 8)
        }
      } else if (k) {
        ctx.fillStyle = 'rgba(0,0,0,0.3)'
        if (isWall(b, x, y - 1)) ctx.fillRect(X, Y, TILE_PX, 6)
        if (isWall(b, x - 1, y)) ctx.fillRect(X, Y, 4, TILE_PX)
        if (k === 'liquid') {
          ctx.fillStyle = 'rgba(255,255,255,0.18)'
          if (kindAt(b, x, y - 1) === 'floor') ctx.fillRect(X, Y, TILE_PX, 2)
          if (kindAt(b, x - 1, y) === 'floor') ctx.fillRect(X, Y, 2, TILE_PX)
        }
      }
    }
  for (const p of b.props) {
    const img = propImage(p.kind)
    if (!img) continue
    ctx.fillStyle = 'rgba(0,0,0,0.25)'
    ctx.fillRect(p.x * TILE_PX + 5, p.y * TILE_PX + TILE_PX - 5, TILE_PX - 10, 3)
    ctx.drawImage(img, p.x * TILE_PX, p.y * TILE_PX)
  }
}

/** Paredes, portas e luzes geradas a partir do mapa construído (em px do mapa). */
export function deriveFromBuild(b: BuildData, grid: GridConfig): { walls: Wall[]; lights: Light[] } {
  const G = grid.size
  const walls: Wall[] = []
  const add = (x1: number, y1: number, x2: number, y2: number, kind: Wall['kind']) => walls.push({ id: uid(), x1: x1 * G, y1: y1 * G, x2: x2 * G, y2: y2 * G, kind, open: false, auto: true })
  const solid = new Set<string>()
  for (const p of b.props) if (PROP_BY_ID[p.kind]?.block === 'solid') solid.add(key(p.x, p.y))
  const blocks = (x: number, y: number) => isWall(b, x, y) || solid.has(key(x, y))
  // arestas horizontais e verticais entre bloco e não-bloco, unidas
  for (let y = 0; y <= b.rows; y++) {
    let start = -1
    for (let x = 0; x <= b.cols; x++) {
      const edge = x < b.cols && blocks(x, y - 1) !== blocks(x, y)
      if (edge && start < 0) start = x
      if (!edge && start >= 0) {
        add(start, y, x, y, 'wall')
        start = -1
      }
    }
  }
  for (let x = 0; x <= b.cols; x++) {
    let start = -1
    for (let y = 0; y <= b.rows; y++) {
      const edge = y < b.rows && blocks(x - 1, y) !== blocks(x, y)
      if (edge && start < 0) start = y
      if (!edge && start >= 0) {
        add(x, start, x, y, 'wall')
        start = -1
      }
    }
  }
  const lights: Light[] = []
  for (const p of b.props) {
    const def = PROP_BY_ID[p.kind]
    if (!def) continue
    if (def.block === 'door') {
      // porta atravessa a célula na direção entre as paredes vizinhas
      const vertical = blocks(p.x, p.y - 1) && blocks(p.x, p.y + 1) && !(blocks(p.x - 1, p.y) && blocks(p.x + 1, p.y))
      if (vertical) add(p.x + 0.5, p.y, p.x + 0.5, p.y + 1, 'door')
      else add(p.x, p.y + 0.5, p.x + 1, p.y + 0.5, 'door')
    }
    if (def.block === 'window') {
      add(p.x + 0.15, p.y + 0.15, p.x + 0.85, p.y + 0.15, 'window')
      add(p.x + 0.85, p.y + 0.15, p.x + 0.85, p.y + 0.85, 'window')
      add(p.x + 0.85, p.y + 0.85, p.x + 0.15, p.y + 0.85, 'window')
      add(p.x + 0.15, p.y + 0.85, p.x + 0.15, p.y + 0.15, 'window')
    }
    if (def.light) lights.push({ id: uid(), x: (p.x + 0.5) * G, y: (p.y + 0.5) * G, bright: def.light.radius / 2, dim: def.light.radius, color: def.light.color, flicker: true, auto: true })
  }
  return { walls, lights }
}

/** Junta paredes/luzes manuais com as geradas, preservando portas já abertas. */
export function mergeDerived(prevWalls: Wall[], prevLights: Light[], derived: { walls: Wall[]; lights: Light[] }) {
  const openDoors = new Set(prevWalls.filter((w) => w.auto && w.kind === 'door' && w.open).map((w) => `${w.x1},${w.y1},${w.x2},${w.y2}`))
  const walls = [...prevWalls.filter((w) => !w.auto), ...derived.walls.map((w) => (openDoors.has(`${w.x1},${w.y1},${w.x2},${w.y2}`) ? { ...w, open: true } : w))]
  const lights = [...prevLights.filter((l) => !l.auto), ...derived.lights]
  return { walls, lights }
}

/** Pinta um quadrado de células (pincel). */
export function paint(b: BuildData, cx: number, cy: number, size: number, tile: string | null): BuildData {
  const tiles = { ...b.tiles }
  const r = Math.floor((size - 1) / 2)
  for (let y = cy - r; y < cy - r + size; y++)
    for (let x = cx - r; x < cx - r + size; x++) {
      if (x < 0 || y < 0 || x >= b.cols || y >= b.rows) continue
      if (tile) tiles[key(x, y)] = tile
      else delete tiles[key(x, y)]
    }
  return { ...b, tiles }
}

export function paintRect(b: BuildData, x0: number, y0: number, x1: number, y1: number, tile: string | null, outlineWall?: string): BuildData {
  const tiles = { ...b.tiles }
  const [ax, bx] = [Math.max(0, Math.min(x0, x1)), Math.min(b.cols - 1, Math.max(x0, x1))]
  const [ay, by] = [Math.max(0, Math.min(y0, y1)), Math.min(b.rows - 1, Math.max(y0, y1))]
  for (let y = ay; y <= by; y++)
    for (let x = ax; x <= bx; x++) {
      const edge = x === ax || x === bx || y === ay || y === by
      const t = outlineWall && edge ? outlineWall : tile
      if (t) tiles[key(x, y)] = t
      else delete tiles[key(x, y)]
    }
  return { ...b, tiles }
}

/** Balde de tinta: preenche a região contígua de mesma textura. */
export function fill(b: BuildData, sx: number, sy: number, tile: string | null): BuildData {
  const target = b.tiles[key(sx, sy)] ?? null
  if (target === tile) return b
  const tiles = { ...b.tiles }
  const stack = [[sx, sy]]
  let guard = 0
  while (stack.length && guard++ < 20000) {
    const [x, y] = stack.pop()!
    if (x < 0 || y < 0 || x >= b.cols || y >= b.rows) continue
    if ((tiles[key(x, y)] ?? null) !== target) continue
    if (tile) tiles[key(x, y)] = tile
    else delete tiles[key(x, y)]
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1])
  }
  return { ...b, tiles }
}

export function placeProp(b: BuildData, x: number, y: number, kind: string): BuildData {
  if (x < 0 || y < 0 || x >= b.cols || y >= b.rows) return b
  let tiles = b.tiles
  // porta/grade sobre parede: troca o bloco por piso (pega o piso vizinho)
  const block = PROP_BY_ID[kind]?.block
  if ((block === 'door' || block === 'window') && isWall(b, x, y)) {
    const near = [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
    ]
      .map(([nx, ny]) => b.tiles[key(nx, ny)])
      .find((id) => id && TILE_BY_ID[id]?.kind === 'floor')
    tiles = { ...b.tiles, [key(x, y)]: near ?? 'pedra' }
  }
  return { ...b, tiles, props: [...b.props.filter((p) => !(p.x === x && p.y === y)), { id: uid(), kind, x, y }] }
}
export function removeProp(b: BuildData, x: number, y: number): BuildData {
  return { ...b, props: b.props.filter((p) => !(p.x === x && p.y === y)) }
}

/** Sala pronta: piso com paredes em volta (atalho para começar rápido). */
export function room(b: BuildData, x0: number, y0: number, x1: number, y1: number, floor: string, wall: string) {
  return paintRect(b, x0, y0, x1, y1, floor, wall)
}

/** Grava o mapa construído na cena, recriando paredes/portas/luzes automáticas. */
export function sceneBuildPatch(scene: { grid: GridConfig; walls: Wall[]; lights: Light[]; map_url: string | null; map_w: number; map_h: number }, b: BuildData) {
  const derived = deriveFromBuild(b, scene.grid)
  const merged = mergeDerived(scene.walls, scene.lights, derived)
  const w = b.cols * scene.grid.size
  const h = b.rows * scene.grid.size
  return {
    build: b,
    walls: merged.walls,
    lights: merged.lights,
    map_w: scene.map_url ? Math.max(scene.map_w, w) : w,
    map_h: scene.map_url ? Math.max(scene.map_h, h) : h,
  }
}
