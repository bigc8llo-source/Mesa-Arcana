import { useState } from 'react'
import { Dices, EyeOff, Minus, Plus, RotateCcw, X } from 'lucide-react'
import type { Character } from '../types'
import { useGame, useIsGm } from '../store/game'
import { rollDice } from '../game/actions'
import { cn } from '../components/ui'

const DICE = [4, 6, 8, 10, 12, 20, 100]

export function DieIcon({ sides, className }: { sides: number; className?: string }) {
  const shapes: Record<number, string> = {
    4: '50,8 92,88 8,88',
    6: '14,14 86,14 86,86 14,86',
    8: '50,4 92,50 50,96 8,50',
    10: '50,4 92,42 50,96 8,42',
    12: '50,4 93,35 77,90 23,90 7,35',
    20: '50,4 92,28 92,72 50,96 8,72 8,28',
    100: '50,4 92,42 50,96 8,42',
  }
  return (
    <svg viewBox="0 0 100 100" className={cn('size-8', className)}>
      <polygon points={shapes[sides]} className="fill-ink-700 stroke-gold-500" strokeWidth={5} />
      <text x="50" y="62" textAnchor="middle" className="fill-parch-100" style={{ font: 'bold 30px Georgia' }}>
        {sides === 100 ? '%' : sides}
      </text>
    </svg>
  )
}

/**
 * Escolha de dados com −/+ para cada tipo (fácil no celular), modificador,
 * vantagem/desvantagem e rolagem secreta para o mestre.
 */
export function DicePicker({ character, onRolled, compact }: { character: Character | null; onRolled?: () => void; compact?: boolean }) {
  const gm = useIsGm()
  const [pool, setPool] = useState<Record<number, number>>({})
  const [mod, setMod] = useState(0)
  const [mode, setMode] = useState<'normal' | 'vantagem' | 'desvantagem'>('normal')
  const [secret, setSecret] = useState(false)
  const add = (s: number, d: number) => setPool((p) => ({ ...p, [s]: Math.max(0, Math.min(30, (p[s] ?? 0) + d)) }))
  const total = Object.values(pool).reduce((a, b) => a + b, 0)
  const notation = Object.entries(pool)
    .filter(([, n]) => n > 0)
    .map(([s, n]) => (Number(s) === 20 && n === 1 && mode !== 'normal' ? `1d20` : `${n}d${s}`))
    .join('+')
  const modTxt = mod ? (mod > 0 ? `+${mod}` : `${mod}`) : ''
  const advOk = (pool[20] ?? 0) === 1
  const full = notation ? `${notation}${modTxt}${advOk && mode !== 'normal' ? ` ${mode}` : ''}` : ''

  const go = async () => {
    if (!full) return
    await rollDice(full, { character, visibility: secret ? 'gm' : 'public', label: advOk && mode !== 'normal' ? (mode === 'vantagem' ? 'Com vantagem' : 'Com desvantagem') : undefined })
    setPool({})
    setMod(0)
    setMode('normal')
    onRolled?.()
  }

  return (
    <div className="space-y-2" data-testid="dice-picker">
      <div className={cn('grid gap-1.5', compact ? 'grid-cols-7' : 'grid-cols-4 sm:grid-cols-7')}>
        {DICE.map((s) => {
          const n = pool[s] ?? 0
          return (
            <div key={s} className={cn('flex flex-col items-center rounded-xl border p-1', n ? 'border-gold-400 bg-gold-500/10' : 'border-ink-700 bg-ink-850')}>
              <button type="button" onClick={() => add(s, 1)} className="rounded-md p-0.5 active:scale-95" aria-label={`Adicionar d${s}`} data-testid={`die-${s}`}>
                <DieIcon sides={s} className={compact ? 'size-7' : 'size-9'} />
              </button>
              <div className="mt-0.5 flex w-full items-center justify-between">
                <button type="button" onClick={() => add(s, -1)} disabled={!n} className="grid size-6 place-items-center rounded bg-ink-700 disabled:opacity-25" aria-label={`Remover d${s}`}>
                  <Minus size={12} />
                </button>
                <span className={cn('text-sm font-bold', n ? 'text-gold-400' : 'text-ink-500')}>{n}</span>
                <button type="button" onClick={() => add(s, 1)} className="grid size-6 place-items-center rounded bg-ink-700" aria-label={`Mais d${s}`}>
                  <Plus size={12} />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-parch-300">Bônus</span>
        <button type="button" className="grid size-8 place-items-center rounded-lg bg-ink-700" onClick={() => setMod((m) => m - 1)} aria-label="Diminuir bônus">
          <Minus size={14} />
        </button>
        <span className="w-9 text-center font-mono text-sm">{mod >= 0 ? `+${mod}` : mod}</span>
        <button type="button" className="grid size-8 place-items-center rounded-lg bg-ink-700" onClick={() => setMod((m) => m + 1)} aria-label="Aumentar bônus">
          <Plus size={14} />
        </button>
        <div className="ml-auto flex overflow-hidden rounded-lg border border-ink-600 text-[11px]">
          {(['normal', 'vantagem', 'desvantagem'] as const).map((m) => (
            <button
              type="button"
              key={m}
              disabled={m !== 'normal' && !advOk}
              title={m !== 'normal' && !advOk ? 'Escolha exatamente 1d20' : undefined}
              onClick={() => setMode(m)}
              className={cn('px-2 py-1 disabled:opacity-30', mode === m ? 'bg-arcane-600 text-white' : 'bg-ink-800')}
            >
              {m === 'normal' ? 'Normal' : m === 'vantagem' ? '⬆ Vant.' : '⬇ Desv.'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {total > 0 && (
          <button type="button" onClick={() => setPool({})} className="grid size-10 place-items-center rounded-xl bg-ink-700" aria-label="Limpar dados">
            <RotateCcw size={16} />
          </button>
        )}
        {gm && (
          <button type="button" onClick={() => setSecret((v) => !v)} className={cn('grid size-10 place-items-center rounded-xl', secret ? 'bg-arcane-600 text-white' : 'bg-ink-700')} title="Rolagem secreta (só o mestre vê)" aria-pressed={secret}>
            <EyeOff size={16} />
          </button>
        )}
        <button
          type="button"
          onClick={go}
          disabled={!full}
          data-testid="roll-button"
          className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-gold-500 font-bold text-ink-950 shadow-lg shadow-gold-500/20 transition active:scale-[0.98] disabled:opacity-40"
        >
          <Dices size={18} /> {full ? `Lançar ${full}` : 'Escolha os dados'}
        </button>
      </div>
    </div>
  )
}

/** Botão central 🎲 que abre a bandeja de dados sobre a mesa. */
export function DiceFab({ character }: { character: Character | null }) {
  const [open, setOpen] = useState(false)
  const lowered = useGame((s) => s.selected.length > 0)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        data-testid="dice-fab"
        aria-label="Abrir dados"
        className={cn(
          'absolute left-1/2 z-30 grid size-16 -translate-x-1/2 place-items-center rounded-full border-4 border-ink-950 bg-gradient-to-br from-gold-400 to-gold-500 text-ink-950 shadow-2xl shadow-gold-500/40 transition active:scale-95',
          lowered ? 'bottom-20' : 'bottom-4',
          open && 'rotate-45',
        )}
      >
        {open ? <X size={28} /> : <Dices size={30} />}
      </button>
      {open && (
        <div className="panel absolute inset-x-2 bottom-24 z-30 mx-auto max-w-xl rounded-2xl p-3 shadow-2xl animate-pop" onPointerDown={(e) => e.stopPropagation()}>
          <p className="mb-2 font-display text-gold-400">
            Rolar dados {character && <span className="text-xs text-parch-300">como {character.name}</span>}
          </p>
          <DicePicker character={character} onRolled={() => setOpen(false)} />
        </div>
      )}
    </>
  )
}
