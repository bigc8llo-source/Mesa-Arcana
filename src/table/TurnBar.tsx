import { useEffect, useRef, useState } from 'react'
import { ChevronRight, Hourglass } from 'lucide-react'
import type { Scene } from '../types'
import { useGame, useIsGm } from '../store/game'
import { canControl, systemMessage } from '../game/actions'
import { backend } from '../data'
import { Portrait } from '../characters/SpriteView'
import { Button, cn } from '../components/ui'
import { useCamRequests } from './camera'

/**
 * Barra de turnos no topo da mesa: ordem de iniciativa com retratos, quem joga agora,
 * e o botão "Encerrar turno" para o mestre ou para o dono do personagem da vez.
 */
export function TurnBar({ scene }: { scene: Scene }) {
  const tokens = useGame((s) => s.tokens)
  const characters = useGame((s) => s.characters)
  const gm = useIsGm()
  const [busy, setBusy] = useState(false)
  const [myTurnFlash, setMyTurnFlash] = useState(false)
  const lastKey = useRef('')
  const combat = scene.combat
  const ordered = [...combat.combatants].sort((a, b) => b.initiative - a.initiative)
  const current = ordered[combat.turn]
  const currentToken = current ? tokens[current.token_id] : null
  const mine = !!currentToken && !gm && canControl(currentToken)
  const canEnd = !!currentToken && (gm || mine)

  // aviso "Sua vez!" quando o turno chega ao jogador
  useEffect(() => {
    const key = `${combat.round}:${combat.turn}`
    if (key === lastKey.current) return
    lastKey.current = key
    if (mine) {
      setMyTurnFlash(true)
      const t = setTimeout(() => setMyTurnFlash(false), 2600)
      return () => clearTimeout(t)
    }
  }, [combat.round, combat.turn, mine])

  if (!combat.active || !ordered.length) return null
  const visible = ordered.filter((c) => gm || (tokens[c.token_id] && !tokens[c.token_id].hidden))

  const endTurn = async () => {
    setBusy(true)
    try {
      const next = ordered[(combat.turn + 1) % ordered.length]
      await backend.endTurn(scene.id)
      const nt = next ? tokens[next.token_id] : null
      if (nt && !nt.hidden) await systemMessage(`⏳ Vez de ${nt.name}.`)
    } catch (e) {
      useGame.getState().set({ error: (e as Error).message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="panel pointer-events-auto absolute left-1/2 top-2 z-20 flex max-w-[calc(100%-6rem)] -translate-x-1/2 items-center gap-2 rounded-2xl px-2 py-1.5 shadow-xl" data-testid="turn-bar">
        <span className="hidden shrink-0 items-center gap-1 px-1 text-xs font-bold uppercase tracking-wide text-gold-400 sm:flex">
          <Hourglass size={14} /> R{combat.round}
        </span>
        <div className="flex min-w-0 items-center gap-1 overflow-x-auto">
          {visible.map((c) => {
            const t = tokens[c.token_id]
            if (!t) return null
            const ch = t.character_id ? characters[t.character_id] : null
            const active = c.id === current?.id
            return (
              <button
                type="button"
                key={c.id}
                title={`${t.name} (${c.initiative})`}
                onClick={() => {
                  useGame.getState().set({ selected: [t.id] })
                  useCamRequests.getState().requestFocus(t.x, t.y)
                }}
                className={cn('relative shrink-0 rounded-full p-0.5 transition', active ? 'scale-110 bg-gold-400 shadow-lg shadow-gold-500/40' : 'opacity-70 hover:opacity-100')}
              >
                <Portrait url={ch?.token_url ?? t.image_url} sprite={null} name={t.name} color={t.color} size={active ? 38 : 30} />
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded bg-black/80 px-1 text-[9px] font-bold text-white">{c.initiative}</span>
              </button>
            )
          })}
        </div>
        <div className="flex shrink-0 items-center gap-2 pl-1">
          <span className="hidden max-w-32 truncate text-sm font-semibold md:inline">{currentToken && (!currentToken.hidden || gm) ? currentToken.name : '…'}</span>
          {canEnd && (
            <Button size="sm" variant={mine ? 'gold' : 'primary'} disabled={busy} onClick={endTurn} data-testid="end-turn">
              {mine ? 'Encerrar meu turno' : 'Próximo'} <ChevronRight size={14} />
            </Button>
          )}
        </div>
      </div>
      {myTurnFlash && currentToken && (
        <div className="pointer-events-none absolute left-1/2 top-1/3 z-30 -translate-x-1/2 animate-pop rounded-2xl border border-gold-400 bg-black/80 px-8 py-4 text-center glow-gold">
          <p className="text-xs uppercase tracking-widest text-parch-300">Sua vez!</p>
          <p className="font-display text-3xl font-extrabold text-gold-400">{currentToken.name}</p>
        </div>
      )}
    </>
  )
}
