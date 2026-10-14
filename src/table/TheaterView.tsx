import { useEffect, useMemo, useState } from 'react'
import type { ChatMessage, Scene } from '../types'
import { useGame, useIsGm } from '../store/game'
import { useAssetUrl } from '../lib/images'
import { SpriteAnimator, Portrait } from '../characters/SpriteView'
import { cn } from '../components/ui'

/**
 * Modo teatro: ilustração em tela cheia com os personagens "em pé" no palco,
 * e as falas do chat aparecendo como balões sobre quem falou.
 */
export function TheaterView({ scene }: { scene: Scene }) {
  const bg = useAssetUrl(scene.background_url)
  const characters = useGame((s) => s.characters)
  const chat = useGame((s) => s.chat)
  const gm = useIsGm()
  const onStage = useMemo(() => scene.stage ?? [], [scene.stage])
  const setOnStage = (fn: (s: string[]) => string[]) => void useGame.getState().patch('scenes', scene.id, { stage: fn(onStage) })
  const cast = useMemo(() => {
    const all = Object.values(characters).filter((c) => !c.hidden || gm)
    const pcs = all.filter((c) => c.kind === 'pc')
    const extra = all.filter((c) => c.kind !== 'pc' && onStage.includes(c.id))
    return [...pcs, ...extra]
  }, [characters, gm, onStage])

  const [bubbles, setBubbles] = useState<Record<string, ChatMessage>>({})
  const last = useMemo(() => Object.values(chat).sort((a, b) => b.created_at.localeCompare(a.created_at))[0], [chat])
  useEffect(() => {
    if (!last || last.kind === 'system' || Date.now() - new Date(last.created_at).getTime() > 15000) return
    const speaker = cast.find((c) => c.name === last.character_name) ?? cast.find((c) => c.owner_id === last.author_id)
    const key = speaker?.id ?? 'narrator'
    setBubbles((b) => ({ ...b, [key]: last }))
    const t = setTimeout(() => setBubbles((b) => (b[key]?.id === last.id ? Object.fromEntries(Object.entries(b).filter(([k]) => k !== key)) : b)), 7000)
    return () => clearTimeout(t)
  }, [last, cast])

  const narrator = bubbles.narrator
  return (
    <div className="absolute inset-0 overflow-hidden bg-ink-950" data-testid="theater-view">
      {bg && <img src={bg} alt="" className="absolute inset-0 size-full object-cover animate-[pop-in_1.2s_ease-out]" />}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30" />
      <h2 className="absolute left-1/2 top-6 -translate-x-1/2 font-display text-3xl font-extrabold text-gold-400 drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">{scene.name}</h2>
      {narrator && (
        <div className="absolute left-1/2 top-20 max-w-xl -translate-x-1/2 rounded-xl border border-gold-500/50 bg-black/70 px-5 py-3 text-center italic text-parch-100 animate-pop">
          {narrator.roll ? `${narrator.author_name} rolou ${narrator.roll.total}` : narrator.content}
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-center gap-4 px-6 pb-8 sm:gap-10">
        {cast.map((c) => {
          const b = bubbles[c.id]
          return (
            <div key={c.id} className="relative flex flex-col items-center">
              {b && (
                <div className="absolute bottom-full mb-2 w-48 rounded-xl bg-parch-100 px-3 py-2 text-sm text-ink-950 shadow-xl animate-pop">
                  {b.roll ? (
                    <span>
                      🎲 <b>{b.roll.total}</b> {b.label && <span className="text-xs">({b.label})</span>}
                    </span>
                  ) : (
                    b.content
                  )}
                  <span className="absolute left-1/2 top-full -translate-x-1/2 border-8 border-transparent border-t-parch-100" />
                </div>
              )}
              {c.sprite ? (
                <SpriteAnimator sprite={c.sprite} scale={Math.min(6, 192 / c.sprite.frameW)} className="drop-shadow-[0_10px_10px_rgba(0,0,0,0.7)]" />
              ) : (
                <Portrait url={c.portrait_url ?? c.token_url} sprite={null} name={c.name} color={c.color} size={150} className="rounded-2xl shadow-2xl" />
              )}
              <span className={cn('mt-1 rounded-full px-3 py-0.5 text-sm font-semibold text-white')} style={{ background: `${c.color}cc` }}>
                {c.name}
              </span>
              {gm && c.kind !== 'pc' && (
                <button className="mt-1 text-[10px] text-parch-300 underline" onClick={() => setOnStage((s) => s.filter((x) => x !== c.id))}>
                  tirar do palco
                </button>
              )}
            </div>
          )
        })}
      </div>
      {gm && (
        <div className="absolute right-3 top-3">
          <select
            className="rounded-md bg-black/70 px-2 py-1 text-xs"
            value=""
            onChange={(e) => e.target.value && setOnStage((s) => [...s, e.target.value])}
            title="Coloca um NPC no palco para todos"
          >
            <option value="">+ NPC no palco</option>
            {Object.values(characters)
              .filter((c) => c.kind !== 'pc' && !onStage.includes(c.id))
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
        </div>
      )}
    </div>
  )
}
