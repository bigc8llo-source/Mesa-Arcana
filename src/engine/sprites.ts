import type { SpriteConfig } from '../types'

/**
 * Gerador procedural de sprites em pixel art (32×32 por quadro).
 * Assim todo personagem já nasce com um sprite animado, sem depender de arte externa.
 * Linhas: 0 idle, 1 walk, 2 attack, 3 hurt, 4 death, 5 cast.
 */
export interface SpriteRecipe {
  body: 'human' | 'dwarf' | 'elf' | 'orc' | 'skeleton' | 'slime' | 'goblin'
  skin: string
  hair: string
  outfit: string
  accent: string
  weapon: 'sword' | 'axe' | 'staff' | 'bow' | 'dagger' | 'mace' | 'none'
  hat: 'none' | 'hood' | 'wizard' | 'helmet' | 'crown' | 'horns'
  shield: boolean
}

export const DEFAULT_RECIPE: SpriteRecipe = {
  body: 'human',
  skin: '#f1c27d',
  hair: '#5b3a1e',
  outfit: '#2563eb',
  accent: '#facc15',
  weapon: 'sword',
  hat: 'none',
  shield: false,
}

export const RECIPE_PRESETS: Record<string, { label: string; recipe: SpriteRecipe }> = {
  guerreiro: { label: 'Guerreiro', recipe: { ...DEFAULT_RECIPE, outfit: '#64748b', accent: '#dc2626', weapon: 'sword', hat: 'helmet', shield: true } },
  mago: { label: 'Mago', recipe: { ...DEFAULT_RECIPE, outfit: '#6d28d9', accent: '#fde047', hair: '#e5e7eb', weapon: 'staff', hat: 'wizard' } },
  ladino: { label: 'Ladino', recipe: { ...DEFAULT_RECIPE, outfit: '#1f2937', accent: '#10b981', hair: '#111827', weapon: 'dagger', hat: 'hood' } },
  clerigo: { label: 'Clérigo', recipe: { ...DEFAULT_RECIPE, outfit: '#f8fafc', accent: '#eab308', hair: '#a16207', weapon: 'mace', shield: true } },
  patrulheiro: { label: 'Patrulheiro', recipe: { ...DEFAULT_RECIPE, body: 'elf', skin: '#fde3c4', outfit: '#166534', accent: '#a3e635', hair: '#fef08a', weapon: 'bow', hat: 'hood' } },
  barbaro: { label: 'Bárbaro', recipe: { ...DEFAULT_RECIPE, body: 'orc', skin: '#65a30d', outfit: '#7c2d12', accent: '#e5e7eb', hair: '#111827', weapon: 'axe', hat: 'horns' } },
  anao: { label: 'Anão', recipe: { ...DEFAULT_RECIPE, body: 'dwarf', skin: '#e0ac69', hair: '#b45309', outfit: '#78350f', accent: '#fbbf24', weapon: 'axe', hat: 'helmet' } },
  rei: { label: 'Nobre', recipe: { ...DEFAULT_RECIPE, outfit: '#991b1b', accent: '#fbbf24', hair: '#78350f', weapon: 'none', hat: 'crown' } },
  goblin: { label: 'Goblin', recipe: { ...DEFAULT_RECIPE, body: 'goblin', skin: '#4d7c0f', outfit: '#57534e', accent: '#a8a29e', hair: '#1c1917', weapon: 'dagger' } },
  esqueleto: { label: 'Esqueleto', recipe: { ...DEFAULT_RECIPE, body: 'skeleton', skin: '#e7e5e4', outfit: '#44403c', accent: '#78716c', weapon: 'sword', shield: true } },
  slime: { label: 'Gosma', recipe: { ...DEFAULT_RECIPE, body: 'slime', skin: '#22c55e', weapon: 'none' } },
  orc: { label: 'Orc', recipe: { ...DEFAULT_RECIPE, body: 'orc', skin: '#4d7c0f', outfit: '#292524', accent: '#b91c1c', weapon: 'axe', hat: 'helmet' } },
}

const F = 32
const ROWS = [
  { name: 'idle', frames: 4, fps: 4 },
  { name: 'walk', frames: 4, fps: 8 },
  { name: 'attack', frames: 4, fps: 10 },
  { name: 'hurt', frames: 2, fps: 6 },
  { name: 'death', frames: 3, fps: 4 },
  { name: 'cast', frames: 4, fps: 8 },
] as const

interface Pose {
  bob: number
  leg: number // -1..1
  arm: number // ângulo da arma em "passos" 0..3
  flash: boolean
  fall: number // 0..2
  glow: boolean
}

function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16)
  const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amt))
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt))
  const b = Math.max(0, Math.min(255, (n & 255) + amt))
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

function drawFrame(ctx: CanvasRenderingContext2D, ox: number, oy: number, r: SpriteRecipe, p: Pose) {
  const px = (x: number, y: number, w: number, h: number, c: string) => {
    ctx.fillStyle = p.flash ? '#ffffff' : c
    ctx.fillRect(ox + x, oy + y, w, h)
  }
  ctx.save()
  if (p.fall > 0) {
    // Caindo: gira em torno dos pés
    ctx.translate(ox + 16, oy + 30)
    ctx.rotate((Math.PI / 2) * (p.fall / 2))
    ctx.translate(-(ox + 16), -(oy + 30))
  }
  // sombra
  ctx.fillStyle = 'rgba(0,0,0,0.25)'
  ctx.fillRect(ox + 9, oy + 29, 14, 2)

  if (r.body === 'slime') {
    const squash = p.bob
    px(7, 18 + squash, 18, 11 - squash, r.skin)
    px(9, 15 + squash, 14, 3, r.skin)
    px(11, 13 + squash, 10, 2, shade(r.skin, 30))
    px(10, 19 + squash, 3, 2, shade(r.skin, 60))
    px(12, 21 + squash, 2, 3, '#111')
    px(18, 21 + squash, 2, 3, '#111')
    px(8, 27, 16, 2, shade(r.skin, -40))
    ctx.restore()
    return
  }

  const short = r.body === 'dwarf' || r.body === 'goblin'
  const top = (short ? 6 : 3) + p.bob
  const skin = r.skin
  const outfit = r.outfit
  const bone = r.body === 'skeleton'

  // pernas
  const legL = p.leg > 0 ? -1 : 0
  const legR = p.leg < 0 ? -1 : 0
  px(12, 24 + legL, 3, 5 - legL, bone ? skin : shade(outfit, -50))
  px(17, 24 + legR, 3, 5 - legR, bone ? skin : shade(outfit, -50))
  px(11, 28, 4, 2, '#3f2a14')
  px(17, 28, 4, 2, '#3f2a14')

  // corpo
  const bw = short ? 12 : 10
  const bx = 16 - bw / 2
  px(bx, top + 12, bw, 10, bone ? shade(outfit, 10) : outfit)
  px(bx, top + 18, bw, 2, r.accent) // cinto
  if (bone) {
    px(14, top + 13, 4, 1, skin)
    px(14, top + 15, 4, 1, skin)
  } else px(15, top + 12, 2, 6, shade(outfit, 25))

  // braços
  px(bx - 2, top + 13, 2, 6, bone ? skin : shade(outfit, -20))
  px(bx - 2, top + 19, 2, 2, skin)
  px(bx + bw, top + 13, 2, 6, bone ? skin : shade(outfit, -20))

  // cabeça
  const hw = r.body === 'orc' ? 10 : 9
  const hx = 16 - Math.floor(hw / 2)
  px(hx, top + 3, hw, 9, skin)
  px(hx, top + 10, hw, 2, shade(skin, -25))
  // olhos
  const eye = bone ? '#111' : r.body === 'orc' || r.body === 'goblin' ? '#fde047' : '#1e1b4b'
  px(hx + 2, top + 6, 2, 2, eye)
  px(hx + hw - 4, top + 6, 2, 2, eye)
  if (r.body === 'elf' || r.body === 'goblin') {
    px(hx - 2, top + 5, 2, 2, skin)
    px(hx + hw, top + 5, 2, 2, skin)
  }
  if (r.body === 'orc') {
    px(hx + 2, top + 10, 1, 2, '#fff')
    px(hx + hw - 3, top + 10, 1, 2, '#fff')
  }
  if (r.body === 'dwarf') px(hx, top + 9, hw, 5, r.hair) // barba
  if (bone) px(hx + 3, top + 9, hw - 6, 1, '#111')

  // cabelo / chapéu
  if (!bone) {
    if (r.hat === 'none' || r.hat === 'crown' || r.hat === 'horns') {
      px(hx, top + 2, hw, 3, r.hair)
      px(hx - 1, top + 3, 1, 5, r.hair)
      px(hx + hw, top + 3, 1, 5, r.hair)
    }
  }
  if (r.hat === 'hood') {
    px(hx - 1, top + 1, hw + 2, 4, r.outfit)
    px(hx - 1, top + 4, 2, 7, r.outfit)
    px(hx + hw - 1, top + 4, 2, 7, r.outfit)
  }
  if (r.hat === 'wizard') {
    px(hx - 2, top + 2, hw + 4, 2, r.outfit)
    px(hx + 1, top - 1, hw - 2, 3, r.outfit)
    px(hx + 3, top - 3, hw - 6, 2, r.outfit)
    px(hx + 3, top + 1, hw - 6, 1, r.accent)
  }
  if (r.hat === 'helmet') {
    px(hx - 1, top + 1, hw + 2, 4, '#9ca3af')
    px(hx + 3, top + 4, 3, 4, '#9ca3af')
    px(hx - 1, top + 1, hw + 2, 1, '#d1d5db')
  }
  if (r.hat === 'crown') {
    px(hx, top, hw, 2, r.accent)
    px(hx, top - 2, 1, 2, r.accent)
    px(hx + 4, top - 2, 1, 2, r.accent)
    px(hx + hw - 1, top - 2, 1, 2, r.accent)
  }
  if (r.hat === 'horns') {
    px(hx - 2, top + 1, 2, 2, '#e7e5e4')
    px(hx - 3, top - 1, 2, 2, '#e7e5e4')
    px(hx + hw, top + 1, 2, 2, '#e7e5e4')
    px(hx + hw + 1, top - 1, 2, 2, '#e7e5e4')
  }

  // escudo
  if (r.shield) {
    px(bx - 5, top + 13, 5, 7, r.accent)
    px(bx - 4, top + 14, 3, 5, shade(r.accent, -40))
  }

  // arma (mão direita), 4 posições de golpe
  const hxw = bx + bw + 1
  const hyw = top + 18
  const steel = '#d1d5db'
  const wood = '#92400e'
  const a = p.arm
  const w = r.weapon
  if (w === 'sword' || w === 'dagger' || w === 'axe' || w === 'mace') {
    const len = w === 'dagger' ? 5 : 9
    if (a === 0 || a === 3) {
      px(hxw, hyw - len, 2, len, w === 'axe' || w === 'mace' ? wood : steel)
      if (w === 'axe') px(hxw + 2, hyw - len, 3, 4, steel)
      if (w === 'mace') px(hxw - 1, hyw - len - 1, 4, 4, '#6b7280')
      px(hxw - 1, hyw - 1, 4, 1, r.accent)
    } else if (a === 1) {
      for (let i = 0; i < len; i++) px(hxw + i, hyw - i, 2, 2, w === 'axe' || w === 'mace' ? wood : steel)
      if (w === 'axe') px(hxw + len - 2, hyw - len - 1, 4, 4, steel)
    } else {
      px(hxw, hyw, len, 2, w === 'axe' || w === 'mace' ? wood : steel)
      if (w === 'axe') px(hxw + len - 2, hyw - 2, 3, 6, steel)
      if (w === 'mace') px(hxw + len, hyw - 1, 4, 4, '#6b7280')
    }
  } else if (w === 'staff') {
    const dy = a === 1 || a === 2 ? -3 : 0
    px(hxw, top + 6 + dy, 2, 22, wood)
    px(hxw - 1, top + 3 + dy, 4, 4, r.accent)
    if (p.glow) {
      ctx.fillStyle = 'rgba(253,224,71,0.6)'
      ctx.fillRect(ox + hxw - 3, oy + top + 1 + dy, 8, 8)
    }
  } else if (w === 'bow') {
    const pull = a === 1 || a === 2 ? 2 : 0
    px(hxw + 2, top + 9, 1, 14, wood)
    px(hxw + 1, top + 8, 1, 2, wood)
    px(hxw + 1, top + 22, 1, 2, wood)
    px(hxw - pull, top + 10, 1, 12, '#e5e7eb')
    if (a === 2) px(hxw + 3, top + 15, 6, 1, steel)
  }
  ctx.restore()
}

export function generateSpriteSheet(recipe: SpriteRecipe): HTMLCanvasElement {
  const maxFrames = Math.max(...ROWS.map((r) => r.frames))
  const c = document.createElement('canvas')
  c.width = F * maxFrames
  c.height = F * ROWS.length
  const ctx = c.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  ROWS.forEach((row, ri) => {
    for (let f = 0; f < row.frames; f++) {
      const pose: Pose = { bob: 0, leg: 0, arm: 0, flash: false, fall: 0, glow: false }
      if (row.name === 'idle') pose.bob = f === 1 || f === 2 ? 1 : 0
      if (row.name === 'walk') {
        pose.leg = f % 2 === 0 ? 1 : -1
        pose.bob = f % 2
      }
      if (row.name === 'attack') pose.arm = f
      if (row.name === 'hurt') pose.flash = f === 0
      if (row.name === 'death') pose.fall = f
      if (row.name === 'cast') {
        pose.arm = f === 1 || f === 2 ? 1 : 0
        pose.glow = f > 0
        pose.bob = f === 2 ? -1 : 0
      }
      drawFrame(ctx, f * F, ri * F, recipe, pose)
    }
  })
  return c
}

export function spriteConfigFor(url: string): SpriteConfig {
  const animations: SpriteConfig['animations'] = {}
  ROWS.forEach((r, i) => {
    animations[r.name] = { row: i, frames: r.frames, fps: r.fps }
  })
  return { url, frameW: F, frameH: F, directional: false, animations, credits: 'Gerado proceduralmente pela Mesa Arcana' }
}

/**
 * Predefinição para folhas do gerador Universal LPC (quadros 64×64, 4 direções).
 * Ordem padrão das linhas: spellcast(0-3), thrust(4-7), walk(8-11), slash(12-15), shoot(16-19), hurt(20).
 * Usamos a direção "baixo" (de frente para a câmera) de cada animação.
 */
export function lpcConfig(url: string, credits?: string): SpriteConfig {
  return {
    url,
    frameW: 64,
    frameH: 64,
    directional: true,
    credits: credits ?? 'Arte LPC (CC-BY-SA 3.0 / GPL 3.0) — preencha os créditos dos autores',
    animations: {
      idle: { row: 10, frames: 1, fps: 1 },
      walk: { row: 10, frames: 9, fps: 10 },
      attack: { row: 14, frames: 6, fps: 12 },
      cast: { row: 2, frames: 7, fps: 10 },
      hurt: { row: 20, frames: 6, fps: 8 },
      death: { row: 20, frames: 6, fps: 6 },
    },
  }
}

export function customSheetConfig(url: string, frameW: number, frameH: number, rows: Partial<Record<keyof SpriteConfig['animations'], { row: number; frames: number }>>): SpriteConfig {
  const animations: SpriteConfig['animations'] = {}
  for (const [k, v] of Object.entries(rows)) if (v) animations[k as keyof SpriteConfig['animations']] = { ...v, fps: 8 }
  return { url, frameW, frameH, directional: false, animations }
}

/** Token redondo com moldura colorida a partir de um quadro do sprite ou de uma imagem. */
export function makeTokenCanvas(src: CanvasImageSource, sx: number, sy: number, sw: number, sh: number, ring: string, pixelated: boolean): HTMLCanvasElement {
  const S = 256
  const c = document.createElement('canvas')
  c.width = S
  c.height = S
  const ctx = c.getContext('2d')!
  ctx.imageSmoothingEnabled = !pixelated
  ctx.save()
  ctx.beginPath()
  ctx.arc(S / 2, S / 2, S / 2 - 10, 0, Math.PI * 2)
  ctx.clip()
  const g = ctx.createRadialGradient(S / 2, S / 2, 10, S / 2, S / 2, S / 2)
  g.addColorStop(0, '#3b3450')
  g.addColorStop(1, '#16131f')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, S, S)
  const scale = Math.min((S - 20) / sw, (S - 20) / sh)
  ctx.drawImage(src, sx, sy, sw, sh, (S - sw * scale) / 2, (S - sh * scale) / 2 + 6, sw * scale, sh * scale)
  ctx.restore()
  ctx.lineWidth = 12
  ctx.strokeStyle = ring
  ctx.beginPath()
  ctx.arc(S / 2, S / 2, S / 2 - 8, 0, Math.PI * 2)
  ctx.stroke()
  ctx.lineWidth = 2
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'
  ctx.beginPath()
  ctx.arc(S / 2, S / 2, S / 2 - 14, 0, Math.PI * 2)
  ctx.stroke()
  return c
}
