import { mulberry32 } from '../engine/dice'

/**
 * Texturas e objetos do construtor de mapas, desenhados em pixel art 16×16 (renderizados a 32×32).
 * Tudo é gerado por código: sem arquivos de arte externos nem problemas de licença.
 */

export const TILE_PX = 32
const P = 2 // tamanho de um "pixel" lógico

export type TileKind = 'floor' | 'wall' | 'liquid'
export interface TileDef {
  id: string
  label: string
  kind: TileKind
  group: 'Pisos' | 'Paredes' | 'Líquidos'
  draw: (ctx: Ctx, rng: () => number) => void
}
export interface PropDef {
  id: string
  label: string
  group: 'Portas e passagens' | 'Luzes' | 'Móveis' | 'Tesouro e itens' | 'Natureza' | 'Masmorra'
  /** porta = segmento de porta; solid = bloqueia visão e passagem; window = bloqueia só passagem */
  block?: 'door' | 'solid' | 'window'
  light?: { color: string; radius: number }
  draw: (ctx: Ctx, rng: () => number) => void
}

type Ctx = CanvasRenderingContext2D

// ------------------------------------------------------------ utilidades de pixel

function px(ctx: Ctx, x: number, y: number, w: number, h: number, c: string) {
  ctx.fillStyle = c
  ctx.fillRect(x * P, y * P, w * P, h * P)
}
function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16)
  const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amt))
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt))
  const b = Math.max(0, Math.min(255, (n & 255) + amt))
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}
function noise(ctx: Ctx, rng: () => number, base: string, spread: number, count = 40) {
  px(ctx, 0, 0, 16, 16, base)
  for (let i = 0; i < count; i++) px(ctx, Math.floor(rng() * 16), Math.floor(rng() * 16), 1, 1, shade(base, Math.round((rng() - 0.5) * spread)))
}
function flags(ctx: Ctx, rng: () => number, base: string, gap: string) {
  // lajotas 8×8 com juntas
  px(ctx, 0, 0, 16, 16, gap)
  for (const [x, y] of [
    [0, 0],
    [8, 0],
    [0, 8],
    [8, 8],
  ]) {
    const c = shade(base, Math.round((rng() - 0.5) * 22))
    px(ctx, x, y, 7, 7, c)
    px(ctx, x, y, 7, 1, shade(c, 14))
    px(ctx, x, y + 6, 7, 1, shade(c, -14))
    if (rng() < 0.4) px(ctx, x + 2 + Math.floor(rng() * 3), y + 2 + Math.floor(rng() * 3), 1, 1, shade(c, -25))
  }
}
function bricks(ctx: Ctx, rng: () => number, base: string, mortar: string, rows = 4) {
  px(ctx, 0, 0, 16, 16, mortar)
  const h = 16 / rows
  for (let r = 0; r < rows; r++) {
    const off = r % 2 ? 4 : 0
    for (let x = -off; x < 16; x += 8) {
      const c = shade(base, Math.round((rng() - 0.5) * 26))
      const x0 = Math.max(0, x)
      const w = Math.min(16, x + 7) - x0
      if (w > 0) {
        px(ctx, x0, r * h, w, h - 1, c)
        px(ctx, x0, r * h, w, 1, shade(c, 16))
      }
    }
  }
}
function planks(ctx: Ctx, rng: () => number, base: string, vertical = false) {
  for (let i = 0; i < 4; i++) {
    const c = shade(base, Math.round((rng() - 0.5) * 24))
    if (vertical) {
      px(ctx, i * 4, 0, 4, 16, c)
      px(ctx, i * 4 + 3, 0, 1, 16, shade(c, -30))
    } else {
      px(ctx, 0, i * 4, 16, 4, c)
      px(ctx, 0, i * 4 + 3, 16, 1, shade(c, -30))
      const knot = Math.floor(rng() * 14)
      px(ctx, knot, i * 4 + 1, 1, 1, shade(c, -40))
    }
  }
}
function water(ctx: Ctx, rng: () => number, base: string, light: string) {
  noise(ctx, rng, base, 20, 30)
  for (let i = 0; i < 4; i++) {
    const y = Math.floor(rng() * 15)
    const x = Math.floor(rng() * 10)
    px(ctx, x, y, 4 + Math.floor(rng() * 3), 1, light)
  }
}
function outline(ctx: Ctx, x: number, y: number, w: number, h: number, c = '#1a1410') {
  px(ctx, x, y, w, 1, c)
  px(ctx, x, y + h - 1, w, 1, c)
  px(ctx, x, y, 1, h, c)
  px(ctx, x + w - 1, y, 1, h, c)
}
function flame(ctx: Ctx, cx: number, cy: number, s = 1) {
  px(ctx, cx - 1 * s, cy - 2 * s, 3 * s, 3 * s, '#f97316')
  px(ctx, cx, cy - 4 * s, 1 * s, 3 * s, '#fb923c')
  px(ctx, cx, cy - 1 * s, 1 * s, 2 * s, '#fde047')
}

// ------------------------------------------------------------ pisos, paredes e líquidos

export const TILES: TileDef[] = [
  { id: 'pedra', label: 'Piso de pedra', kind: 'floor', group: 'Pisos', draw: (c, r) => flags(c, r, '#8f8a80', '#5e5a53') },
  { id: 'pedra_rachada', label: 'Pedra rachada', kind: 'floor', group: 'Pisos', draw: (c, r) => { flags(c, r, '#87827a', '#57534c'); for (let i = 0; i < 6; i++) px(c, 3 + i, 4 + Math.floor(i * 1.3), 1, 1, '#3a3732') } },
  { id: 'musgo', label: 'Pedra com musgo', kind: 'floor', group: 'Pisos', draw: (c, r) => { flags(c, r, '#8a877d', '#55534b'); for (let i = 0; i < 18; i++) px(c, Math.floor(r() * 16), Math.floor(r() * 16), 1 + Math.floor(r() * 2), 1, r() < 0.5 ? '#4d7c0f' : '#65a30d') } },
  { id: 'ardosia', label: 'Ardósia', kind: 'floor', group: 'Pisos', draw: (c, r) => flags(c, r, '#4b4f57', '#2b2d33') },
  { id: 'marmore', label: 'Mármore', kind: 'floor', group: 'Pisos', draw: (c, r) => { flags(c, r, '#e7e5e4', '#a8a29e'); for (let i = 0; i < 5; i++) px(c, Math.floor(r() * 16), Math.floor(r() * 16), 2, 1, '#d6d3d1') } },
  { id: 'tijolo', label: 'Piso de tijolos', kind: 'floor', group: 'Pisos', draw: (c, r) => bricks(c, r, '#a0523d', '#6b3a2a') },
  { id: 'mosaico', label: 'Mosaico', kind: 'floor', group: 'Pisos', draw: (c) => { px(c, 0, 0, 16, 16, '#d6c7a1'); px(c, 0, 0, 8, 8, '#3b5b92'); px(c, 8, 8, 8, 8, '#3b5b92'); px(c, 6, 6, 4, 4, '#c08a3e'); outline(c, 0, 0, 16, 16, '#8b7a55') } },
  { id: 'runas', label: 'Piso com runas', kind: 'floor', group: 'Pisos', draw: (c, r) => { flags(c, r, '#6b6f78', '#3f424a'); px(c, 7, 3, 2, 10, '#5eead4'); px(c, 4, 7, 8, 2, '#5eead4'); px(c, 7, 7, 2, 2, '#ccfbf1') } },
  { id: 'madeira', label: 'Piso de madeira', kind: 'floor', group: 'Pisos', draw: (c, r) => planks(c, r, '#9a6232') },
  { id: 'madeira_escura', label: 'Madeira escura', kind: 'floor', group: 'Pisos', draw: (c, r) => planks(c, r, '#5c3a1e') },
  { id: 'terra', label: 'Terra batida', kind: 'floor', group: 'Pisos', draw: (c, r) => noise(c, r, '#7c5a3a', 36, 60) },
  { id: 'cascalho', label: 'Cascalho', kind: 'floor', group: 'Pisos', draw: (c, r) => { noise(c, r, '#57534e', 20); for (let i = 0; i < 14; i++) { const x = Math.floor(r() * 14); const y = Math.floor(r() * 14); px(c, x, y, 2, 2, shade('#78716c', Math.round((r() - 0.5) * 40))) } } },
  { id: 'areia', label: 'Areia', kind: 'floor', group: 'Pisos', draw: (c, r) => noise(c, r, '#d9b77a', 26, 50) },
  { id: 'grama', label: 'Grama', kind: 'floor', group: 'Pisos', draw: (c, r) => { noise(c, r, '#4d7c2a', 30, 50); for (let i = 0; i < 8; i++) { const x = Math.floor(r() * 15); const y = Math.floor(r() * 14); px(c, x, y, 1, 2, '#86c045') } } },
  { id: 'grama_alta', label: 'Grama alta', kind: 'floor', group: 'Pisos', draw: (c, r) => { noise(c, r, '#3f6b22', 20); for (let i = 0; i < 16; i++) { const x = Math.floor(r() * 16); px(c, x, 4 + Math.floor(r() * 10), 1, 3, r() < 0.5 ? '#65a30d' : '#84cc16') } } },
  { id: 'folhas', label: 'Folhas secas', kind: 'floor', group: 'Pisos', draw: (c, r) => { noise(c, r, '#6b4a2b', 20); for (let i = 0; i < 12; i++) px(c, Math.floor(r() * 15), Math.floor(r() * 15), 2, 1, ['#d97706', '#b45309', '#ca8a04', '#9a3412'][Math.floor(r() * 4)]) } },
  { id: 'lama', label: 'Lama', kind: 'floor', group: 'Pisos', draw: (c, r) => { noise(c, r, '#5b4330', 26); for (let i = 0; i < 4; i++) px(c, Math.floor(r() * 13), Math.floor(r() * 13), 3, 2, '#3f2e20') } },
  { id: 'neve', label: 'Neve', kind: 'floor', group: 'Pisos', draw: (c, r) => noise(c, r, '#eef2f7', 16, 40) },
  { id: 'cinzas', label: 'Cinzas', kind: 'floor', group: 'Pisos', draw: (c, r) => noise(c, r, '#3f3f46', 22, 50) },
  { id: 'tapete', label: 'Tapete vermelho', kind: 'floor', group: 'Pisos', draw: (c, r) => { noise(c, r, '#8f1d1d', 12, 20); px(c, 0, 1, 16, 1, '#e2b65a'); px(c, 0, 14, 16, 1, '#e2b65a') } },
  { id: 'tapete_azul', label: 'Tapete azul', kind: 'floor', group: 'Pisos', draw: (c, r) => { noise(c, r, '#1e3a8a', 12, 20); px(c, 0, 1, 16, 1, '#e2b65a'); px(c, 0, 14, 16, 1, '#e2b65a') } },
  { id: 'metal', label: 'Piso de metal', kind: 'floor', group: 'Pisos', draw: (c) => { px(c, 0, 0, 16, 16, '#6b7280'); outline(c, 0, 0, 16, 16, '#4b5563'); px(c, 8, 0, 1, 16, '#4b5563'); px(c, 0, 8, 16, 1, '#4b5563'); for (const [x, y] of [[2, 2], [13, 2], [2, 13], [13, 13]]) px(c, x, y, 1, 1, '#d1d5db') } },

  { id: 'parede_tijolo', label: 'Parede de tijolos', kind: 'wall', group: 'Paredes', draw: (c, r) => bricks(c, r, '#7d7a75', '#47443f') },
  { id: 'parede_pedra', label: 'Parede de pedra', kind: 'wall', group: 'Paredes', draw: (c, r) => bricks(c, r, '#5f5d58', '#363430', 3) },
  { id: 'parede_musgo', label: 'Parede com musgo', kind: 'wall', group: 'Paredes', draw: (c, r) => { bricks(c, r, '#6f6d66', '#3f3d38'); for (let i = 0; i < 14; i++) px(c, Math.floor(r() * 16), Math.floor(r() * 16), 1, 1, '#4d7c0f') } },
  { id: 'parede_caverna', label: 'Parede de caverna', kind: 'wall', group: 'Paredes', draw: (c, r) => { noise(c, r, '#3b3530', 30, 70); for (let i = 0; i < 6; i++) px(c, Math.floor(r() * 13), Math.floor(r() * 13), 3, 3, shade('#4a423b', Math.round((r() - 0.5) * 30))) } },
  { id: 'parede_arenito', label: 'Muro de arenito', kind: 'wall', group: 'Paredes', draw: (c, r) => bricks(c, r, '#c8a46a', '#8a6d3f', 3) },
  { id: 'parede_madeira', label: 'Parede de madeira', kind: 'wall', group: 'Paredes', draw: (c, r) => planks(c, r, '#6b4423', true) },
  { id: 'parede_gelo', label: 'Parede de gelo', kind: 'wall', group: 'Paredes', draw: (c, r) => { bricks(c, r, '#a5d8f3', '#6aa7c9', 3); px(c, 2, 12, 1, 3, '#e0f2fe'); px(c, 9, 13, 1, 2, '#e0f2fe') } },
  { id: 'rocha', label: 'Rocha maciça', kind: 'wall', group: 'Paredes', draw: (c, r) => noise(c, r, '#26221f', 18, 30) },

  { id: 'agua_rasa', label: 'Água rasa', kind: 'liquid', group: 'Líquidos', draw: (c, r) => water(c, r, '#2f7fb0', '#7cc4e8') },
  { id: 'agua_funda', label: 'Água funda', kind: 'liquid', group: 'Líquidos', draw: (c, r) => water(c, r, '#164a73', '#3b82b8') },
  { id: 'pantano', label: 'Água pantanosa', kind: 'liquid', group: 'Líquidos', draw: (c, r) => { water(c, r, '#3e4d22', '#5d7330'); px(c, 3, 4, 3, 2, '#65a30d') } },
  { id: 'gelo', label: 'Gelo', kind: 'liquid', group: 'Líquidos', draw: (c, r) => { noise(c, r, '#bfe3f5', 14, 20); for (let i = 0; i < 5; i++) px(c, 2 + i * 2, 3 + i, 3, 1, '#f0f9ff') } },
  { id: 'lava', label: 'Lava', kind: 'liquid', group: 'Líquidos', draw: (c, r) => { noise(c, r, '#b91c1c', 30, 40); for (let i = 0; i < 6; i++) px(c, Math.floor(r() * 13), Math.floor(r() * 15), 3, 1, '#fbbf24') } },
  { id: 'abismo', label: 'Abismo', kind: 'liquid', group: 'Líquidos', draw: (c, r) => noise(c, r, '#050407', 8, 10) },
]

// ------------------------------------------------------------ objetos

const WOOD = '#8a5a2b'
const IRON = '#6b7280'
export const PROPS: PropDef[] = [
  { id: 'porta', label: 'Porta', group: 'Portas e passagens', block: 'door', draw: (c) => { px(c, 2, 1, 12, 14, '#3a2a1a'); px(c, 3, 2, 10, 13, WOOD); px(c, 7, 2, 1, 13, shade(WOOD, -30)); px(c, 10, 8, 2, 2, '#d1d5db') } },
  { id: 'porta_ferro', label: 'Porta de ferro', group: 'Portas e passagens', block: 'door', draw: (c) => { px(c, 2, 1, 12, 14, '#27272a'); px(c, 3, 2, 10, 13, IRON); for (let x = 4; x < 13; x += 3) px(c, x, 3, 1, 11, '#374151'); px(c, 10, 8, 2, 2, '#fbbf24') } },
  { id: 'grade', label: 'Grade de ferro', group: 'Portas e passagens', block: 'window', draw: (c) => { outline(c, 1, 1, 14, 14, '#27272a'); for (let x = 3; x < 14; x += 3) px(c, x, 2, 1, 12, '#52525b') } },
  { id: 'escada_sobe', label: 'Escada subindo', group: 'Portas e passagens', draw: (c) => { for (let i = 0; i < 5; i++) px(c, 2, 2 + i * 3, 12, 2, shade('#8f8a80', 30 - i * 12)) } },
  { id: 'escada_desce', label: 'Escada descendo', group: 'Portas e passagens', draw: (c) => { px(c, 1, 1, 14, 14, '#111'); for (let i = 0; i < 5; i++) px(c, 2, 2 + i * 3, 12, 2, shade('#5e5a53', -i * 10)) } },
  { id: 'alcapao', label: 'Alçapão', group: 'Portas e passagens', draw: (c) => { px(c, 2, 2, 12, 12, '#3a2a1a'); px(c, 3, 3, 10, 10, WOOD); px(c, 7, 7, 2, 2, '#9ca3af') } },
  { id: 'ponte', label: 'Ponte de madeira', group: 'Portas e passagens', draw: (c, r) => { planks(c, r, '#8a5a2b', true); px(c, 0, 0, 16, 1, '#3a2a1a'); px(c, 0, 15, 16, 1, '#3a2a1a') } },
  { id: 'portal', label: 'Portal mágico', group: 'Portas e passagens', light: { color: '#a855f7', radius: 4 }, draw: (c) => { px(c, 2, 1, 12, 15, '#57534e'); px(c, 4, 3, 8, 12, '#4c1d95'); px(c, 6, 5, 4, 8, '#a855f7'); px(c, 7, 7, 2, 4, '#e9d5ff') } },

  { id: 'tocha', label: 'Tocha', group: 'Luzes', light: { color: '#ffb35c', radius: 5 }, draw: (c) => { px(c, 7, 8, 2, 7, WOOD); px(c, 6, 7, 4, 2, IRON); flame(c, 8, 6, 2) } },
  { id: 'braseiro', label: 'Braseiro', group: 'Luzes', light: { color: '#ff9a3c', radius: 6 }, draw: (c) => { px(c, 3, 9, 10, 4, '#3f3f46'); px(c, 4, 13, 2, 2, '#27272a'); px(c, 10, 13, 2, 2, '#27272a'); flame(c, 8, 9, 2) } },
  { id: 'fogueira', label: 'Fogueira', group: 'Luzes', light: { color: '#ffa94d', radius: 7 }, draw: (c) => { for (const [x, y] of [[3, 11], [10, 11], [6, 13], [4, 8], [11, 8]]) px(c, x, y, 3, 2, '#78716c'); px(c, 5, 10, 6, 2, '#7c2d12'); flame(c, 8, 9, 2) } },
  { id: 'lanterna', label: 'Lanterna', group: 'Luzes', light: { color: '#ffd27a', radius: 4 }, draw: (c) => { px(c, 6, 3, 4, 1, '#27272a'); px(c, 5, 4, 6, 8, '#27272a'); px(c, 6, 5, 4, 6, '#fbbf24'); px(c, 7, 6, 2, 3, '#fef9c3') } },
  { id: 'candelabro', label: 'Candelabro', group: 'Luzes', light: { color: '#ffe0a3', radius: 4 }, draw: (c) => { px(c, 7, 8, 2, 7, '#a16207'); px(c, 3, 8, 10, 1, '#a16207'); for (const x of [3, 7, 12]) { px(c, x, 5, 1, 3, '#f5f5f4'); px(c, x, 3, 1, 2, '#fbbf24') } } },
  { id: 'cristais', label: 'Cristais brilhantes', group: 'Luzes', light: { color: '#60a5fa', radius: 4 }, draw: (c) => { px(c, 4, 6, 3, 9, '#3b82f6'); px(c, 7, 3, 3, 12, '#60a5fa'); px(c, 10, 7, 3, 8, '#2563eb'); px(c, 8, 4, 1, 6, '#dbeafe') } },

  { id: 'mesa', label: 'Mesa', group: 'Móveis', draw: (c) => { px(c, 1, 4, 14, 8, '#3a2a1a'); px(c, 2, 5, 12, 6, WOOD); px(c, 2, 7, 12, 1, shade(WOOD, -25)) } },
  { id: 'cadeira', label: 'Cadeira', group: 'Móveis', draw: (c) => { px(c, 5, 3, 6, 3, '#3a2a1a'); px(c, 4, 6, 8, 6, WOOD); outline(c, 4, 6, 8, 6, '#3a2a1a') } },
  { id: 'cama', label: 'Cama', group: 'Móveis', draw: (c) => { px(c, 3, 1, 10, 14, '#3a2a1a'); px(c, 4, 2, 8, 12, '#b91c1c'); px(c, 4, 2, 8, 3, '#f5f5f4') } },
  { id: 'estante', label: 'Estante', group: 'Móveis', block: 'solid', draw: (c) => { px(c, 1, 3, 14, 11, '#3a2a1a'); for (let y = 4; y < 13; y += 4) for (let x = 2; x < 14; x += 2) px(c, x, y, 1, 3, ['#b91c1c', '#1d4ed8', '#15803d', '#a16207'][(x + y) % 4]) } },
  { id: 'armario', label: 'Armário', group: 'Móveis', block: 'solid', draw: (c) => { px(c, 2, 2, 12, 12, '#3a2a1a'); px(c, 3, 3, 10, 10, WOOD); px(c, 8, 3, 1, 10, '#3a2a1a'); px(c, 6, 7, 1, 2, '#fbbf24'); px(c, 9, 7, 1, 2, '#fbbf24') } },
  { id: 'bancada', label: 'Bancada de alquimia', group: 'Móveis', draw: (c) => { px(c, 1, 6, 14, 6, WOOD); px(c, 3, 3, 2, 4, '#22c55e'); px(c, 7, 2, 2, 5, '#a855f7'); px(c, 11, 4, 2, 3, '#3b82f6') } },
  { id: 'caldeirao', label: 'Caldeirão', group: 'Móveis', draw: (c) => { px(c, 3, 5, 10, 8, '#18181b'); px(c, 4, 5, 8, 2, '#84cc16'); px(c, 6, 4, 2, 1, '#bef264') } },
  { id: 'forja', label: 'Forja', group: 'Móveis', block: 'solid', light: { color: '#ff7a2f', radius: 4 }, draw: (c) => { px(c, 1, 2, 14, 13, '#44403c'); px(c, 4, 7, 8, 6, '#1c1917'); flame(c, 8, 12, 2) } },
  { id: 'bigorna', label: 'Bigorna', group: 'Móveis', draw: (c) => { px(c, 3, 6, 10, 3, '#3f3f46'); px(c, 6, 9, 4, 4, '#27272a'); px(c, 4, 13, 8, 2, '#3f3f46') } },
  { id: 'suporte_armas', label: 'Suporte de armas', group: 'Móveis', draw: (c) => { px(c, 2, 12, 12, 2, WOOD); for (const x of [4, 8, 12]) { px(c, x, 2, 1, 10, '#d1d5db'); px(c, x - 1, 9, 3, 1, '#a16207') } } },

  { id: 'bau', label: 'Baú', group: 'Tesouro e itens', draw: (c) => { px(c, 2, 5, 12, 9, '#3a2a1a'); px(c, 3, 6, 10, 7, WOOD); px(c, 3, 8, 10, 1, '#e2b65a'); px(c, 7, 8, 2, 3, '#fbbf24') } },
  { id: 'bau_aberto', label: 'Baú aberto', group: 'Tesouro e itens', draw: (c) => { px(c, 2, 2, 12, 5, '#3a2a1a'); px(c, 2, 7, 12, 7, '#3a2a1a'); px(c, 3, 8, 10, 5, WOOD); px(c, 4, 6, 8, 2, '#fbbf24') } },
  { id: 'ouro', label: 'Pilha de ouro', group: 'Tesouro e itens', draw: (c, r) => { for (let i = 0; i < 14; i++) px(c, 3 + Math.floor(r() * 10), 7 + Math.floor(r() * 7), 2, 2, r() < 0.5 ? '#fbbf24' : '#eab308') } },
  { id: 'barril', label: 'Barril', group: 'Tesouro e itens', draw: (c) => { px(c, 4, 2, 8, 12, '#3a2a1a'); px(c, 5, 3, 6, 10, WOOD); px(c, 4, 5, 8, 1, IRON); px(c, 4, 10, 8, 1, IRON) } },
  { id: 'caixa', label: 'Caixa', group: 'Tesouro e itens', draw: (c) => { px(c, 3, 3, 10, 10, '#3a2a1a'); px(c, 4, 4, 8, 8, '#a16207'); for (let i = 0; i < 8; i++) px(c, 4 + i, 4 + i, 1, 1, '#713f12') } },
  { id: 'sacos', label: 'Sacos', group: 'Tesouro e itens', draw: (c) => { px(c, 3, 6, 5, 8, '#a8875a'); px(c, 8, 5, 5, 9, '#c4a574'); px(c, 4, 5, 3, 1, '#78593a'); px(c, 9, 4, 3, 1, '#78593a') } },
  { id: 'vasos', label: 'Vasos de barro', group: 'Tesouro e itens', draw: (c) => { px(c, 3, 6, 5, 8, '#b45309'); px(c, 4, 4, 3, 2, '#92400e'); px(c, 9, 8, 4, 6, '#c2410c'); px(c, 10, 7, 2, 1, '#9a3412') } },
  { id: 'mapa_mesa', label: 'Mapa sobre mesa', group: 'Tesouro e itens', draw: (c) => { px(c, 1, 5, 14, 8, WOOD); px(c, 3, 6, 10, 6, '#f5e6c8'); px(c, 9, 8, 1, 1, '#dc2626'); px(c, 5, 9, 3, 1, '#78716c') } },

  { id: 'rocha_grande', label: 'Rocha grande', group: 'Natureza', block: 'solid', draw: (c) => { px(c, 2, 5, 12, 9, '#57534e'); px(c, 4, 3, 8, 2, '#78716c'); px(c, 4, 5, 4, 3, '#a8a29e') } },
  { id: 'estalagmite', label: 'Estalagmites', group: 'Natureza', block: 'solid', draw: (c) => { for (const [x, h] of [[3, 9], [7, 13], [11, 8]]) px(c, x, 15 - h, 3, h, '#57534e') } },
  { id: 'arvore', label: 'Árvore', group: 'Natureza', block: 'solid', draw: (c, r) => { px(c, 7, 10, 2, 5, '#5c3a1e'); for (let i = 0; i < 30; i++) px(c, 2 + Math.floor(r() * 12), 1 + Math.floor(r() * 10), 2, 2, r() < 0.5 ? '#166534' : '#15803d') } },
  { id: 'arbusto', label: 'Arbusto', group: 'Natureza', draw: (c, r) => { for (let i = 0; i < 20; i++) px(c, 3 + Math.floor(r() * 10), 5 + Math.floor(r() * 8), 2, 2, r() < 0.5 ? '#3f6212' : '#4d7c0f') } },
  { id: 'tronco', label: 'Tronco caído', group: 'Natureza', draw: (c) => { px(c, 1, 6, 14, 5, '#5c3a1e'); px(c, 1, 6, 14, 1, '#78502c'); px(c, 13, 6, 2, 5, '#a16207'); px(c, 4, 7, 3, 1, '#4d7c0f') } },
  { id: 'toco', label: 'Toco de árvore', group: 'Natureza', draw: (c) => { px(c, 4, 6, 8, 8, '#5c3a1e'); px(c, 5, 6, 6, 2, '#a16207'); px(c, 7, 7, 2, 1, '#78502c') } },
  { id: 'cogumelos', label: 'Cogumelos', group: 'Natureza', draw: (c) => { for (const [x, y] of [[3, 8], [9, 6], [7, 11]]) { px(c, x + 1, y + 2, 2, 3, '#f5f5f4'); px(c, x, y, 4, 2, '#dc2626'); px(c, x + 1, y, 1, 1, '#fff') } } },
  { id: 'raizes', label: 'Raízes', group: 'Natureza', draw: (c) => { for (let i = 0; i < 6; i++) px(c, 2 + i * 2, 3 + (i % 3) * 3, 2, 8 - (i % 3), '#5c3a1e') } },

  { id: 'pilar', label: 'Pilar', group: 'Masmorra', block: 'solid', draw: (c) => { px(c, 3, 2, 10, 3, '#a8a29e'); px(c, 4, 5, 8, 7, '#8f8a80'); px(c, 3, 12, 10, 3, '#a8a29e'); px(c, 6, 5, 1, 7, '#d6d3d1') } },
  { id: 'pilar_quebrado', label: 'Pilar quebrado', group: 'Masmorra', draw: (c) => { px(c, 4, 7, 8, 5, '#8f8a80'); px(c, 3, 12, 10, 3, '#a8a29e'); px(c, 1, 13, 2, 2, '#78716c'); px(c, 12, 11, 3, 2, '#78716c') } },
  { id: 'estatua', label: 'Estátua', group: 'Masmorra', block: 'solid', draw: (c) => { px(c, 3, 12, 10, 3, '#78716c'); px(c, 6, 3, 4, 4, '#a8a29e'); px(c, 5, 7, 6, 5, '#a8a29e'); px(c, 4, 7, 1, 4, '#a8a29e') } },
  { id: 'sarcofago', label: 'Sarcófago', group: 'Masmorra', draw: (c) => { px(c, 3, 1, 10, 14, '#44403c'); px(c, 4, 2, 8, 12, '#78716c'); px(c, 7, 4, 2, 7, '#a8a29e'); px(c, 5, 6, 6, 1, '#a8a29e') } },
  { id: 'altar', label: 'Altar', group: 'Masmorra', light: { color: '#ffd27a', radius: 3 }, draw: (c) => { px(c, 2, 6, 12, 7, '#57534e'); px(c, 5, 7, 6, 5, '#991b1b'); px(c, 3, 3, 1, 3, '#f5f5f4'); px(c, 12, 3, 1, 3, '#f5f5f4'); px(c, 3, 2, 1, 1, '#fbbf24'); px(c, 12, 2, 1, 1, '#fbbf24') } },
  { id: 'poco', label: 'Poço', group: 'Masmorra', block: 'window', draw: (c) => { px(c, 2, 4, 12, 10, '#78716c'); px(c, 4, 6, 8, 6, '#0c1a2a'); px(c, 2, 2, 12, 2, WOOD) } },
  { id: 'fonte', label: 'Fonte', group: 'Masmorra', block: 'window', draw: (c) => { px(c, 1, 4, 14, 10, '#78716c'); px(c, 3, 6, 10, 6, '#2f7fb0'); px(c, 7, 3, 2, 6, '#7cc4e8') } },
  { id: 'armadilha', label: 'Armadilha de espinhos', group: 'Masmorra', draw: (c) => { px(c, 1, 1, 14, 14, '#3f3f46'); for (let y = 3; y < 14; y += 4) for (let x = 3; x < 14; x += 4) { px(c, x, y, 1, 2, '#d1d5db'); px(c, x, y + 2, 1, 1, '#6b7280') } } },
  { id: 'placa_pressao', label: 'Placa de pressão', group: 'Masmorra', draw: (c) => { px(c, 3, 3, 10, 10, '#52525b'); outline(c, 3, 3, 10, 10, '#27272a'); px(c, 6, 6, 4, 4, '#71717a') } },
  { id: 'alavanca', label: 'Alavanca', group: 'Masmorra', draw: (c) => { px(c, 4, 10, 8, 4, '#52525b'); px(c, 7, 4, 2, 7, '#a1a1aa'); px(c, 6, 3, 4, 2, '#dc2626') } },
  { id: 'corrente', label: 'Correntes', group: 'Masmorra', draw: (c) => { for (let y = 1; y < 15; y += 3) outline(c, 7, y, 3, 3, '#9ca3af') } },
  { id: 'ossos', label: 'Ossos', group: 'Masmorra', draw: (c) => { px(c, 3, 10, 9, 1, '#e7e5e4'); px(c, 6, 4, 4, 4, '#e7e5e4'); px(c, 7, 5, 1, 1, '#18181b'); px(c, 9, 5, 1, 1, '#18181b'); px(c, 4, 12, 1, 3, '#e7e5e4') } },
  { id: 'teia', label: 'Teia', group: 'Masmorra', draw: (c) => { for (let i = 0; i < 16; i++) { px(c, i, i, 1, 1, '#e5e7eb'); px(c, 15 - i, i, 1, 1, '#e5e7eb') } px(c, 0, 7, 16, 1, '#e5e7eb'); px(c, 7, 0, 1, 16, '#e5e7eb') } },
]

export const TILE_BY_ID = Object.fromEntries(TILES.map((t) => [t.id, t]))
export const PROP_BY_ID = Object.fromEntries(PROPS.map((p) => [p.id, p]))

// ------------------------------------------------------------ cache de imagens (4 variações por textura)

const cache = new Map<string, HTMLCanvasElement>()
function render(key: string, draw: (c: Ctx, r: () => number) => void, variant: number, transparent: boolean) {
  const k = `${key}|${variant}`
  let cv = cache.get(k)
  if (cv) return cv
  cv = document.createElement('canvas')
  cv.width = cv.height = TILE_PX
  const ctx = cv.getContext('2d')!
  if (!transparent) ctx.fillStyle = '#000'
  draw(ctx, mulberry32(hash(key) + variant * 7919))
  cache.set(k, cv)
  return cv
}
function hash(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

export function tileImage(id: string, variant = 0) {
  const t = TILE_BY_ID[id]
  return t ? render(`t:${id}`, t.draw, variant % 4, false) : null
}
export function propImage(id: string) {
  const p = PROP_BY_ID[id]
  return p ? render(`p:${id}`, p.draw, 0, true) : null
}

/** Miniatura (data URL) para a paleta. */
const thumbs = new Map<string, string>()
export function thumb(kind: 'tile' | 'prop', id: string): string {
  const k = `${kind}:${id}`
  let u = thumbs.get(k)
  if (!u) {
    const c = document.createElement('canvas')
    c.width = c.height = TILE_PX
    const ctx = c.getContext('2d')!
    if (kind === 'prop') {
      ctx.drawImage(tileImage('pedra', 0)!, 0, 0)
      ctx.drawImage(propImage(id)!, 0, 0)
    } else ctx.drawImage(tileImage(id, 0)!, 0, 0)
    u = c.toDataURL()
    thumbs.set(k, u)
  }
  return u
}
