import type { Light, Wall } from '../types'
import { mulberry32 } from './dice'
import { uid } from '../lib/id'

/**
 * Masmorra de exemplo gerada em canvas, com paredes/portas/luzes já alinhadas ao desenho.
 * Permite jogar a campanha de exemplo sem nenhum arquivo externo.
 */
export interface SampleMap {
  canvas: HTMLCanvasElement
  walls: Wall[]
  lights: Light[]
  gridSize: number
  width: number
  height: number
  spawns: { x: number; y: number }[]
  monsters: { x: number; y: number; kind: string }[]
}

const G = 70
const W = 30
const H = 20

type Rect = [number, number, number, number]
const ROOMS: Rect[] = [
  [2, 2, 8, 6], // entrada
  [14, 2, 11, 7], // salão
  [2, 12, 10, 6], // cripta
  [17, 12, 11, 6], // trono
]
const CORRIDORS: Rect[] = [
  [10, 4, 4, 2],
  [5, 8, 2, 4],
  [12, 14, 5, 2],
  [20, 9, 2, 3],
]
// células de corredor que encostam em salas viram portas
const DOORS: { cell: [number, number]; dir: 'w' | 'e' | 'n' | 's' }[] = [
  { cell: [13, 4], dir: 'e' },
  { cell: [5, 11], dir: 's' },
  { cell: [16, 14], dir: 'e' },
  { cell: [20, 11], dir: 's' },
]

export function buildSampleMap(): SampleMap {
  const floor: boolean[][] = Array.from({ length: H }, () => Array(W).fill(false))
  for (const [x, y, w, h] of [...ROOMS, ...CORRIDORS]) for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) floor[j][i] = true
  const isFloor = (i: number, j: number) => i >= 0 && j >= 0 && i < W && j < H && floor[j][i]

  const canvas = document.createElement('canvas')
  canvas.width = W * G
  canvas.height = H * G
  const ctx = canvas.getContext('2d')!
  const rng = mulberry32(42)

  // Fundo: rocha
  ctx.fillStyle = '#1b1820'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  for (let k = 0; k < 2500; k++) {
    ctx.fillStyle = `rgba(${60 + rng() * 30},${55 + rng() * 25},${70 + rng() * 30},${0.25 + rng() * 0.3})`
    const s = 4 + rng() * 18
    ctx.fillRect(rng() * canvas.width, rng() * canvas.height, s, s * (0.5 + rng()))
  }

  // Piso de lajotas
  for (let j = 0; j < H; j++)
    for (let i = 0; i < W; i++) {
      if (!floor[j][i]) continue
      const base = 120 + Math.floor(rng() * 25)
      ctx.fillStyle = `rgb(${base},${base - 8},${base - 18})`
      ctx.fillRect(i * G, j * G, G, G)
      // pedras
      for (let s = 0; s < 4; s++) {
        const sx = i * G + (s % 2) * (G / 2) + 2
        const sy = j * G + Math.floor(s / 2) * (G / 2) + 2
        const v = base - 10 + Math.floor(rng() * 30)
        ctx.fillStyle = `rgb(${v},${v - 6},${v - 16})`
        ctx.fillRect(sx, sy, G / 2 - 4, G / 2 - 4)
      }
      // rachaduras e sujeira
      if (rng() < 0.25) {
        ctx.strokeStyle = 'rgba(40,30,25,0.5)'
        ctx.lineWidth = 1.5
        ctx.beginPath()
        let cx = i * G + rng() * G
        let cy = j * G + rng() * G
        ctx.moveTo(cx, cy)
        for (let s = 0; s < 4; s++) {
          cx += (rng() - 0.5) * 24
          cy += (rng() - 0.5) * 24
          ctx.lineTo(cx, cy)
        }
        ctx.stroke()
      }
    }

  // Sombra interna perto das paredes
  for (let j = 0; j < H; j++)
    for (let i = 0; i < W; i++) {
      if (!floor[j][i]) continue
      ctx.fillStyle = 'rgba(0,0,0,0.35)'
      if (!isFloor(i, j - 1)) ctx.fillRect(i * G, j * G, G, 12)
      if (!isFloor(i - 1, j)) ctx.fillRect(i * G, j * G, 8, G)
    }

  // Decoração: tapete no trono, sarcófagos na cripta, mesa no salão
  ctx.fillStyle = '#7f1d1d'
  ctx.fillRect(21 * G, 13 * G, 3 * G, 4 * G)
  ctx.strokeStyle = '#facc15'
  ctx.lineWidth = 4
  ctx.strokeRect(21 * G + 8, 13 * G + 8, 3 * G - 16, 4 * G - 16)
  ctx.fillStyle = '#57534e'
  ctx.fillRect(22 * G, 12 * G + 6, G, G - 12) // trono
  ctx.fillStyle = '#a16207'
  ctx.fillRect(22 * G + 18, 12 * G + 14, G - 36, G - 30)
  for (const [x, y] of [
    [3, 13],
    [6, 13],
    [9, 13],
  ]) {
    ctx.fillStyle = '#44403c'
    ctx.fillRect(x * G + 10, y * G + 8, G - 20, 2 * G - 16)
    ctx.fillStyle = '#78716c'
    ctx.fillRect(x * G + 16, y * G + 14, G - 32, 2 * G - 28)
  }
  ctx.fillStyle = '#78350f'
  ctx.fillRect(17 * G, 4 * G + 10, 5 * G, G - 20)
  ctx.fillStyle = '#92400e'
  ctx.fillRect(17 * G + 6, 4 * G + 16, 5 * G - 12, G - 32)

  // Paredes: arestas entre piso e rocha, unidas em segmentos longos
  const walls: Wall[] = []
  const doorEdges = new Set<string>()
  for (const d of DOORS) {
    const [i, j] = d.cell
    if (d.dir === 'e') doorEdges.add(`v:${i + 1}:${j}`), doorEdges.add(`v:${i + 1}:${j + 1}`)
    if (d.dir === 's') doorEdges.add(`h:${j + 1}:${i}`), doorEdges.add(`h:${j + 1}:${i + 1}`)
  }
  // horizontais
  for (let j = 0; j <= H; j++) {
    let start = -1
    for (let i = 0; i <= W; i++) {
      const edge = i < W && isFloor(i, j - 1) !== isFloor(i, j)
      if (edge && start < 0) start = i
      if (!edge && start >= 0) {
        walls.push({ id: uid(), x1: start * G, y1: j * G, x2: i * G, y2: j * G, kind: 'wall' })
        start = -1
      }
    }
  }
  for (let i = 0; i <= W; i++) {
    let start = -1
    for (let j = 0; j <= H; j++) {
      const edge = j < H && isFloor(i - 1, j) !== isFloor(i, j)
      if (edge && start < 0) start = j
      if (!edge && start >= 0) {
        walls.push({ id: uid(), x1: i * G, y1: start * G, x2: i * G, y2: j * G, kind: 'wall' })
        start = -1
      }
    }
  }
  // portas (entre piso e piso)
  for (const d of DOORS) {
    const [i, j] = d.cell
    if (d.dir === 'e') walls.push({ id: uid(), x1: (i + 1) * G, y1: j * G, x2: (i + 1) * G, y2: (j + 2) * G, kind: 'door', open: false })
    if (d.dir === 's') walls.push({ id: uid(), x1: i * G, y1: (j + 1) * G, x2: (i + 2) * G, y2: (j + 1) * G, kind: 'door', open: false })
  }
  // desenha paredes e portas
  ctx.lineCap = 'square'
  for (const w of walls) {
    if (w.kind === 'door') {
      ctx.strokeStyle = '#78350f'
      ctx.lineWidth = 14
    } else {
      ctx.strokeStyle = '#0c0a10'
      ctx.lineWidth = 12
    }
    ctx.beginPath()
    ctx.moveTo(w.x1, w.y1)
    ctx.lineTo(w.x2, w.y2)
    ctx.stroke()
    if (w.kind === 'door') {
      ctx.strokeStyle = '#fbbf24'
      ctx.lineWidth = 3
      ctx.stroke()
    }
  }

  const torch = (x: number, y: number): Light => ({ id: uid(), x: x * G, y: y * G, bright: 3, dim: 6, color: '#ffb35c', flicker: true })
  const lights = [torch(2.5, 2.5), torch(14.5, 2.5), torch(24.5, 8.5), torch(22.5, 12.5), torch(27.5, 17.5)]
  for (const l of lights) {
    const g = ctx.createRadialGradient(l.x, l.y, 2, l.x, l.y, 22)
    g.addColorStop(0, '#fff7cc')
    g.addColorStop(0.4, '#f59e0b')
    g.addColorStop(1, 'rgba(245,158,11,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(l.x, l.y, 22, 0, Math.PI * 2)
    ctx.fill()
  }

  const c = (i: number, j: number) => ({ x: i * G + G / 2, y: j * G + G / 2 })
  return {
    canvas,
    walls,
    lights,
    gridSize: G,
    width: W * G,
    height: H * G,
    spawns: [c(3, 4), c(4, 5), c(3, 6), c(5, 4), c(4, 3), c(6, 6)],
    monsters: [
      { ...c(18, 6), kind: 'goblin' },
      { ...c(21, 3), kind: 'goblin' },
      { ...c(6, 15), kind: 'esqueleto' },
      { ...c(9, 16), kind: 'esqueleto' },
      { ...c(22, 14), kind: 'bugbear' },
    ],
  }
}

/** Ilustração de fundo para o modo teatro (paisagem noturna). */
export function buildTheaterBackground(): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = 1920
  c.height = 1080
  const ctx = c.getContext('2d')!
  const rng = mulberry32(7)
  const sky = ctx.createLinearGradient(0, 0, 0, 1080)
  sky.addColorStop(0, '#0b1026')
  sky.addColorStop(0.6, '#3b1f4a')
  sky.addColorStop(1, '#8a3b3b')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, 1920, 1080)
  for (let i = 0; i < 400; i++) {
    ctx.fillStyle = `rgba(255,255,255,${rng() * 0.8})`
    ctx.fillRect(rng() * 1920, rng() * 600, 2, 2)
  }
  const moon = ctx.createRadialGradient(1450, 250, 10, 1450, 250, 160)
  moon.addColorStop(0, '#fffbe8')
  moon.addColorStop(0.5, 'rgba(255,240,200,0.6)')
  moon.addColorStop(1, 'rgba(255,240,200,0)')
  ctx.fillStyle = moon
  ctx.beginPath()
  ctx.arc(1450, 250, 160, 0, Math.PI * 2)
  ctx.fill()
  const ridge = (base: number, amp: number, color: string, seed: number) => {
    const r = mulberry32(seed)
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.moveTo(0, 1080)
    let y = base
    for (let x = 0; x <= 1920; x += 40) {
      y += (r() - 0.5) * amp
      y = Math.max(base - amp * 2, Math.min(base + amp, y))
      ctx.lineTo(x, y)
    }
    ctx.lineTo(1920, 1080)
    ctx.fill()
  }
  ridge(700, 60, '#2a1838', 1)
  ridge(800, 50, '#1c1027', 2)
  ridge(900, 40, '#120a18', 3)
  // taverna
  ctx.fillStyle = '#0d0710'
  ctx.fillRect(300, 760, 360, 200)
  ctx.beginPath()
  ctx.moveTo(270, 770)
  ctx.lineTo(480, 640)
  ctx.lineTo(690, 770)
  ctx.fill()
  ctx.fillStyle = '#fbbf24'
  for (const [x, y] of [
    [340, 820],
    [430, 820],
    [560, 820],
  ]) ctx.fillRect(x, y, 40, 50)
  ctx.fillStyle = 'rgba(251,191,36,0.15)'
  ctx.beginPath()
  ctx.arc(480, 850, 260, 0, Math.PI * 2)
  ctx.fill()
  return c
}
