import { formatMod } from '../engine/dice'
import { asDnd } from '../systems'
import { asT20, t20Skill, type T20Attack, type T20Sheet } from '../systems/tormenta20'
import type { Character } from '../types'
import type { AttackView } from './AttackCard'

export function t20AttackView(sheet: T20Sheet, a: T20Attack): AttackView {
  const skill = t20Skill(sheet, a.skill)
  const extra = Number.isFinite(a.extra) ? a.extra : 0
  const label = a.skill === 'luta' ? 'Luta' : 'Pontaria'
  return {
    ...a,
    bonus: skill + extra,
    rule: 't20',
    bonusSource: `${label} ${formatMod(skill)} (já inclui atributo, ½ nível e treino)${extra ? ` ${extra > 0 ? '+' : '−'} ${Math.abs(extra)} de bônus extra` : ''}.`,
    houseNote:
      a.skill === 'luta'
        ? 'Tormenta20: ataques corpo a corpo somam Força ao dano. O app usa o dano exatamente como cadastrado e não soma Força sozinho; confira se o modificador acima já a inclui.'
        : undefined,
  }
}

/** Ataques de qualquer ficha no formato do cartão "Para acertar / Dano ao acertar". */
export function attackViews(c: Character): (AttackView & { id: string })[] {
  if (c.system_id === 'tormenta20') {
    const s = asT20(c.sheet)
    return s.attacks.map((a) => ({ ...t20AttackView(s, a), id: a.id }))
  }
  if (c.system_id === 'dnd5e') {
    return asDnd(c.sheet).attacks.map((a) => ({ ...a, bonus: Number.isFinite(a.bonus) ? a.bonus : null, rule: 'dnd' as const, bonusSource: 'Bônus total cadastrado (já inclui atributo e proficiência).' }))
  }
  return []
}
