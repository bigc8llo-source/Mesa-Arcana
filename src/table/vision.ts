import { create } from 'zustand'

/** Resultado do cálculo de visão deste cliente: quais tokens alheios estão visíveis agora. */
export const useVision = create<{ hiddenByFog: Set<string>; set(h: Set<string>): void }>((set) => ({
  hiddenByFog: new Set(),
  set: (h) => set({ hiddenByFog: h }),
}))

/** Posição exibida de cada token (suavizada), lida pelo cálculo de névoa e pelos rótulos. */
export const displayPos = new Map<string, { x: number; y: number }>()

/** Token sob o ponteiro (para mostrar o rótulo). */
export const useHover = create<{ id: string | null; set(id: string | null): void }>((set) => ({ id: null, set: (id) => set({ id }) }))
