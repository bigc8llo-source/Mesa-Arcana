import type { Condition } from '../types'

export const CONDITION_ICONS: Record<Condition, { icon: string; label: string }> = {
  caido: { icon: '🛌', label: 'Caído' },
  envenenado: { icon: '🤢', label: 'Envenenado' },
  atordoado: { icon: '💫', label: 'Atordoado' },
  cego: { icon: '🙈', label: 'Cego' },
  amedrontado: { icon: '😱', label: 'Amedrontado' },
  invisivel: { icon: '👻', label: 'Invisível' },
  paralisado: { icon: '🧊', label: 'Paralisado' },
  concentrando: { icon: '🧘', label: 'Concentrando' },
  abencoado: { icon: '✨', label: 'Abençoado' },
  inconsciente: { icon: '💀', label: 'Inconsciente' },
}
