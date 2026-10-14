import { useEffect, useState } from 'react'
import { Copy, Eye, EyeOff, FileText, Heart, Lock, LockOpen, Minus, Plus, Sun, Trash2, Swords, Eye as EyeIcon } from 'lucide-react'
import type { Condition, Token } from '../types'
import { useGame, useIsGm } from '../store/game'
import { canControl, changeHp, initiativeNotation, tokenHp, updateCombat } from '../game/actions'
import { CONDITION_ICONS } from '../game/conditions'
import { NumberInput, cn } from '../components/ui'
import { uid } from '../lib/id'
import { roll } from '../engine/dice'

/** Menu de contexto do token (clique direito). */
export function TokenMenu() {
  const [state, setState] = useState<{ id: string; x: number; y: number } | null>(null)
  const token = useGame((s) => (state ? s.tokens[state.id] : null))
  const gm = useIsGm()
  const [amount, setAmount] = useState(5)

  useEffect(() => {
    const open = (e: Event) => setState((e as CustomEvent).detail)
    const close = () => setState(null)
    window.addEventListener('token-menu', open)
    window.addEventListener('pointerdown', close)
    window.addEventListener('keydown', close)
    return () => {
      window.removeEventListener('token-menu', open)
      window.removeEventListener('pointerdown', close)
      window.removeEventListener('keydown', close)
    }
  }, [])

  if (!state || !token) return null
  const control = canControl(token)
  const hp = tokenHp(token)
  const ids = useGame.getState().selected.includes(token.id) ? useGame.getState().selected : [token.id]
  const patch = (p: Partial<Token>) => ids.forEach((id) => void useGame.getState().patch('tokens', id, p))
  const toggleCond = (c: Condition) => patch({ conditions: token.conditions.includes(c) ? token.conditions.filter((x) => x !== c) : [...token.conditions, c] })
  const left = Math.min(state.x, innerWidth - 270)
  const top = Math.min(state.y, innerHeight - 420)

  const Item = ({ icon, label, onClick, danger }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) => (
    <button
      onClick={() => {
        onClick()
        setState(null)
      }}
      className={cn('flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-ink-700', danger && 'text-red-400')}
    >
      {icon}
      {label}
    </button>
  )

  return (
    <div className="panel fixed z-50 w-64 rounded-xl p-2 shadow-2xl animate-pop" style={{ left, top }} onPointerDown={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      <p className="truncate px-2 pb-1 font-display text-gold-400">
        {token.name}
        {ids.length > 1 && <span className="text-xs text-parch-300"> (+{ids.length - 1})</span>}
      </p>
      {(gm || control) && (
        <div className="mb-1 flex items-center gap-1 px-1">
          <Heart size={14} className="text-red-400" />
          <span className="text-xs text-parch-300">
            {hp.hp}/{hp.max}
          </span>
          <button className="ml-auto rounded bg-red-800 p-1" onClick={() => changeHp(ids, -amount)} title="Dano">
            <Minus size={12} />
          </button>
          <NumberInput className="!w-12 py-0.5" value={amount} onChange={(v) => setAmount(Math.max(1, v))} />
          <button className="rounded bg-emerald-800 p-1" onClick={() => changeHp(ids, amount)} title="Cura">
            <Plus size={12} />
          </button>
        </div>
      )}
      {token.character_id && <Item icon={<FileText size={14} />} label="Abrir ficha" onClick={() => useGame.getState().set({ openSheetId: token.character_id })} />}
      {(gm || control) && (
        <div className="my-1 grid grid-cols-5 gap-0.5 px-1">
          {(Object.keys(CONDITION_ICONS) as Condition[]).map((c) => (
            <button
              key={c}
              title={CONDITION_ICONS[c].label}
              onClick={() => toggleCond(c)}
              className={cn('rounded p-1 text-base', token.conditions.includes(c) ? 'bg-arcane-600' : 'hover:bg-ink-700')}
            >
              {CONDITION_ICONS[c].icon}
            </button>
          ))}
        </div>
      )}
      {gm && (
        <>
          <Item
            icon={<Swords size={14} />}
            label="Adicionar ao combate"
            onClick={() =>
              updateCombat((c) => ({
                ...c,
                active: true,
                combatants: [...c.combatants, ...ids.filter((id) => !c.combatants.some((x) => x.token_id === id)).map((id) => ({ id: uid(), token_id: id, name: useGame.getState().tokens[id].name, initiative: roll(initiativeNotation(useGame.getState().tokens[id])).total }))],
              }))
            }
          />
          <Item icon={token.hidden ? <Eye size={14} /> : <EyeOff size={14} />} label={token.hidden ? 'Revelar aos jogadores' : 'Ocultar dos jogadores'} onClick={() => patch({ hidden: !token.hidden })} />
          <Item icon={token.locked ? <LockOpen size={14} /> : <Lock size={14} />} label={token.locked ? 'Destravar' : 'Travar posição'} onClick={() => patch({ locked: !token.locked })} />
          <Item icon={<EyeIcon size={14} />} label={token.show_bar ? 'Esconder barra de vida' : 'Mostrar barra de vida a todos'} onClick={() => patch({ show_bar: !token.show_bar })} />
          <div className="my-1 grid grid-cols-2 gap-1 px-2 text-xs">
            <label className="space-y-0.5">
              <span className="text-parch-300">Tamanho</span>
              <NumberInput value={token.size} onChange={(v) => patch({ size: Math.max(0.5, Math.min(6, v)) })} step={0.5} />
            </label>
            <label className="space-y-0.5">
              <span className="text-parch-300">Visão (cél.)</span>
              <NumberInput value={token.vision} onChange={(v) => patch({ vision: Math.max(0, v) })} />
            </label>
            <label className="space-y-0.5">
              <span className="flex items-center gap-1 text-parch-300">
                <Sun size={10} /> Luz (cél.)
              </span>
              <NumberInput value={token.light_dim} onChange={(v) => patch({ light_dim: Math.max(0, v), light_bright: Math.max(0, v) / 2 })} />
            </label>
            <label className="space-y-0.5">
              <span className="text-parch-300">Visão escuro</span>
              <NumberInput value={token.darkvision} onChange={(v) => patch({ darkvision: Math.max(0, v) })} />
            </label>
          </div>
          <Item
            icon={<Copy size={14} />}
            label="Duplicar"
            onClick={() => void useGame.getState().save('tokens', { ...token, id: uid(), x: token.x + 70, name: token.name })}
          />
          <Item
            danger
            icon={<Trash2 size={14} />}
            label="Remover do mapa"
            onClick={() => ids.forEach((id) => void useGame.getState().removeRow('tokens', useGame.getState().tokens[id]))}
          />
        </>
      )}
      {!gm && control && <Item icon={<Sun size={14} />} label={token.light_dim ? 'Apagar tocha' : 'Acender tocha (6 cél.)'} onClick={() => patch(token.light_dim ? { light_dim: 0, light_bright: 0 } : { light_dim: 6, light_bright: 3 })} />}
    </div>
  )
}
