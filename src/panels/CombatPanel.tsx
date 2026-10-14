import { ChevronLeft, ChevronRight, Dices, Flag, Plus, Swords, X } from 'lucide-react'
import { useState } from 'react'
import type { Combatant } from '../types'
import { useGame, useIsGm, useScene } from '../store/game'
import { Button, cn, Empty, HpBar, NumberInput } from '../components/ui'
import { changeHp, initiativeNotation, systemMessage, tokenHp, updateCombat } from '../game/actions'
import { roll } from '../engine/dice'
import { uid } from '../lib/id'
import { useCamRequests } from '../table/camera'
import { CONDITION_ICONS } from '../game/conditions'

const sorted = (c: Combatant[]) => [...c].sort((a, b) => b.initiative - a.initiative)

export function CombatPanel() {
  const scene = useScene()
  const gm = useIsGm()
  const tokens = useGame((s) => s.tokens)
  const selected = useGame((s) => s.selected)
  if (!scene || scene.kind !== 'map') return <Empty icon={<Swords size={32} />} title="Combate acontece em cenas de mapa" />
  const combat = scene.combat
  const order = sorted(combat.combatants).filter((c) => gm || (tokens[c.token_id] && !tokens[c.token_id].hidden))
  const current = sorted(combat.combatants)[combat.turn]

  const addTokens = (ids: string[]) =>
    updateCombat((c) => {
      const existing = new Set(c.combatants.map((x) => x.token_id))
      const add = ids
        .filter((id) => !existing.has(id) && tokens[id] && tokens[id].layer === 'token')
        .map((id) => ({ id: uid(), token_id: id, name: tokens[id].name, initiative: roll(initiativeNotation(tokens[id])).total }))
      return { ...c, combatants: [...c.combatants, ...add] }
    })

  const start = async () => {
    const ids = Object.values(tokens)
      .filter((t) => t.scene_id === scene.id && t.layer === 'token')
      .map((t) => t.id)
    await updateCombat(() => ({
      active: true,
      round: 1,
      turn: 0,
      combatants: ids.map((id) => ({ id: uid(), token_id: id, name: tokens[id].name, initiative: roll(initiativeNotation(tokens[id])).total })),
    }))
    const s = useGame.getState().scenes[scene.id]
    const list = sorted(s.combat.combatants)
      .filter((c) => !tokens[c.token_id]?.hidden)
      .map((c) => `${c.name} (${c.initiative})`)
      .join(', ')
    await systemMessage(`⚔️ Rolem iniciativa! Ordem: ${list}`)
  }

  const advance = (dir: 1 | -1) =>
    updateCombat((c) => {
      const n = c.combatants.length
      if (!n) return c
      let turn = c.turn + dir
      let round = c.round
      if (turn >= n) {
        turn = 0
        round++
      }
      if (turn < 0) {
        turn = n - 1
        round = Math.max(1, round - 1)
      }
      return { ...c, turn, round }
    })

  if (!combat.active)
    return (
      <div className="p-4">
        <Empty icon={<Swords size={36} />} title="Fora de combate">
          {gm ? (
            <div className="mt-2 space-y-2">
              <p>Inicie para rolar a iniciativa de todos os tokens desta cena automaticamente.</p>
              <Button variant="primary" onClick={start} data-testid="start-combat">
                <Swords size={16} /> Iniciar combate
              </Button>
            </div>
          ) : (
            'O mestre ainda não iniciou um combate.'
          )}
        </Empty>
      </div>
    )

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-ink-700 p-2">
        <p className="font-display text-gold-400">Rodada {combat.round}</p>
        {gm && (
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" onClick={() => advance(-1)} title="Turno anterior">
              <ChevronLeft size={16} />
            </Button>
            <Button size="sm" variant="primary" onClick={() => advance(1)} data-testid="next-turn">
              Próximo <ChevronRight size={16} />
            </Button>
          </div>
        )}
      </div>
      <div className="flex-1 space-y-1 overflow-y-auto p-2">
        {order.map((c) => (
          <CombatRow key={c.id} c={c} active={current?.id === c.id} gm={gm} />
        ))}
      </div>
      {gm && (
        <div className="flex flex-wrap gap-1.5 border-t border-ink-700 p-2">
          <Button size="sm" disabled={!selected.length} onClick={() => addTokens(selected)}>
            <Plus size={14} /> Adicionar selecionados
          </Button>
          <Button
            size="sm"
            onClick={() =>
              updateCombat((c) => ({ ...c, combatants: c.combatants.map((x) => (tokens[x.token_id] ? { ...x, initiative: roll(initiativeNotation(tokens[x.token_id])).total } : x)), turn: 0 }))
            }
          >
            <Dices size={14} /> Rerrolar
          </Button>
          <Button
            size="sm"
            variant="danger"
            className="ml-auto"
            onClick={async () => {
              await updateCombat((c) => ({ ...c, active: false, combatants: [], round: 1, turn: 0 }))
              await systemMessage('🏳️ Fim do combate.')
            }}
          >
            <Flag size={14} /> Encerrar
          </Button>
        </div>
      )}
    </div>
  )
}

function CombatRow({ c, active, gm }: { c: Combatant; active: boolean; gm: boolean }) {
  const t = useGame((s) => s.tokens[c.token_id])
  const [dmg, setDmg] = useState(0)
  if (!t) return null
  const hp = tokenHp(t)
  return (
    <div
      className={cn('rounded-lg border p-2 transition', active ? 'border-gold-400 bg-gold-500/10 glow-gold' : 'border-ink-700 bg-ink-850/60', t.hidden && 'opacity-60')}
      onClick={() => {
        useGame.getState().set({ selected: [t.id] })
        useCamRequests.getState().requestFocus(t.x, t.y)
      }}
    >
      <div className="flex items-center gap-2">
        {gm ? (
          <NumberInput
            className="!w-14 shrink-0 font-bold"
            value={c.initiative}
            onClick={(e) => e.stopPropagation()}
            onChange={(v) => updateCombat((cs) => ({ ...cs, combatants: cs.combatants.map((x) => (x.id === c.id ? { ...x, initiative: v } : x)) }))}
          />
        ) : (
          <span className="w-8 text-center font-bold text-gold-400">{c.initiative}</span>
        )}
        <span className="flex-1 truncate text-sm font-semibold">
          {active && '▶ '}
          {t.name}
          {t.conditions.map((k) => CONDITION_ICONS[k]?.icon).join('')}
        </span>
        {gm && (
          <button
            className="text-ink-500 hover:text-red-400"
            title="Remover do combate"
            onClick={(e) => {
              e.stopPropagation()
              void updateCombat((cs) => ({ ...cs, combatants: cs.combatants.filter((x) => x.id !== c.id), turn: Math.min(cs.turn, Math.max(0, cs.combatants.length - 2)) }))
            }}
          >
            <X size={14} />
          </button>
        )}
      </div>
      {(gm || t.show_bar) && hp.max > 0 && <HpBar hp={hp.hp} max={hp.max} temp={hp.temp} className="mt-1.5" />}
      {gm && (
        <div className="mt-1.5 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <span className="text-[11px] text-parch-300">
            {hp.hp}/{hp.max}
          </span>
          <NumberInput className="ml-auto !w-16 py-0.5" value={dmg} onChange={setDmg} />
          <Button size="sm" variant="danger" onClick={() => dmg && changeHp([t.id], -Math.abs(dmg))} title="Dano">
            −
          </Button>
          <Button size="sm" className="bg-emerald-700 text-white border-0" onClick={() => dmg && changeHp([t.id], Math.abs(dmg))} title="Cura">
            +
          </Button>
        </div>
      )}
    </div>
  )
}
