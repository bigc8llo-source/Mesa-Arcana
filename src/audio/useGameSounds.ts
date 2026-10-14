import { useEffect, useRef } from 'react'
import { onLive, useGame, activeSceneId } from '../store/game'
import { preloadSfx, sfx, sfxForVfx } from './sfx'

/** Liga os efeitos sonoros aos acontecimentos da mesa (eventos ao vivo e mudanças de estado). */
export function useGameSounds() {
  useEffect(() => {
    preloadSfx()
    return onLive((e) => {
      if (e.type === 'vfx') sfxForVfx(e.effect)
      if (e.type === 'ping') sfx('ping')
      if (e.type === 'float') sfx(e.text.startsWith('-') ? 'dano' : 'cura', { gap: 120 })
    })
  }, [])

  const prev = useRef<{ chat: Set<string> | null; combat: string; session: boolean | null; doors: string; tokens: string }>({ chat: null, combat: '', session: null, doors: '', tokens: '' })
  useEffect(
    () =>
      useGame.subscribe((s) => {
        const p = prev.current
        // mensagens novas de outras pessoas
        const ids = Object.keys(s.chat)
        if (p.chat === null) p.chat = new Set(ids)
        else {
          for (const id of ids) {
            if (p.chat.has(id)) continue
            p.chat.add(id)
            const m = s.chat[id]
            if (m.kind !== 'roll' && m.author_id !== s.user?.id) sfx('mensagem', { volume: 0.7, gap: 300 })
          }
        }
        const sid = activeSceneId(s)
        const scene = sid ? s.scenes[sid] : null
        if (scene) {
          const c = scene.combat
          const key = `${scene.id}:${c.active}:${c.round}:${c.turn}`
          if (p.combat && key !== p.combat) {
            const [, wasActive] = p.combat.split(':')
            if (c.active && wasActive === 'false') sfx('combate')
            else if (c.active) sfx('pagina', { volume: 0.6 })
          }
          p.combat = key
          const doors = scene.walls
            .filter((w) => w.kind === 'door')
            .map((w) => `${w.id}:${w.open}`)
            .join('|')
          if (p.doors && doors !== p.doors && doors.split('|').length === p.doors.split('|').length) sfx('porta')
          p.doors = doors
          const toks = Object.values(s.tokens)
            .filter((t) => t.scene_id === scene.id)
            .map((t) => `${t.id}:${Math.round(t.x)},${Math.round(t.y)}`)
            .sort()
            .join('|')
          if (p.tokens && toks !== p.tokens && toks.split('|').length === p.tokens.split('|').length) sfx('passo', { volume: 0.5, gap: 150 })
          p.tokens = toks
        }
        const live = !!s.campaign?.session?.live
        if (p.session === false && live) sfx('sessao')
        p.session = s.campaign ? live : p.session
      }),
    [],
  )
}
