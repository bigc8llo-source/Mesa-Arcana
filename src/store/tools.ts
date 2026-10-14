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
  set: (p) => set(p),
}))
