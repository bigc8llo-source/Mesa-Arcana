import { create } from 'zustand'
import type { AoeShape } from '../engine/geometry'
import type { Wall } from '../types'

export interface ToolOptions {
  aoeShape: AoeShape
  aoeColor: string
  wallKind: Wall['kind']
  fogMode: 'reveal' | 'hide'
  fogShape: 'rect' | 'brush' | 'poly'
  brush: number // em células
  vfx: string
  lightRadius: number
  buildMode: 'brush' | 'rect' | 'room' | 'fill' | 'prop' | 'erase'
  buildTile: string
  buildWall: string
  buildProp: string
  buildBrush: number
  set(p: Partial<Omit<ToolOptions, 'set'>>): void
}

export const useToolOptions = create<ToolOptions>((set) => ({
  aoeShape: 'circle',
  aoeColor: '#f59e0b',
  wallKind: 'wall',
  fogMode: 'reveal',
  fogShape: 'rect',
  brush: 2,
  vfx: 'fireball',
  lightRadius: 6,
  buildMode: 'room',
  buildTile: 'pedra',
  buildWall: 'parede_tijolo',
  buildProp: 'tocha',
  buildBrush: 1,
  set: (p) => set(p),
}))
