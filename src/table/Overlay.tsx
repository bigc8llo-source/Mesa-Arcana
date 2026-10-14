import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import type { Scene, Token } from '../types'
import { onLive, useGame, useIsGm } from '../store/game'
import { tokenHp } from '../game/actions'
import { CONDITION_ICONS } from '../game/conditions'
import { displayPos, useHover } from './vision'
import { useVisibleTokens } from './Tokens'

/**
 * Rótulos (nome, vida, condições) e números flutuantes desenhados em DOM por cima do canvas.
 * As posições são projetadas a cada quadro — mais leve que um <Html> por token.
 */
export function TokenOverlay({ scene, getCamera }: { scene: Scene; getCamera: () => THREE.Camera | null }) {
  const root = useRef<HTMLDivElement>(null)
  const tokens = useVisibleTokens()
  const gm = useIsGm()
  const hover = useHover((s) => s.id)
  const selected = useGame((s) => s.selected)
  useGame((s) => s.characters) // re-renderiza quando a vida na ficha muda
  const [floats, setFloats] = useState<{ id: number; tokenId: string; text: string; color: string }[]>([])

  useEffect(
    () =>
      onLive((e) => {
        if (e.type !== 'float') return
        const id = Math.random()
        setFloats((f) => [...f, { id, tokenId: e.tokenId, text: e.text, color: e.color }])
        setTimeout(() => setFloats((f) => f.filter((x) => x.id !== id)), 1600)
      }),
    [],
  )

  useEffect(() => {
    let raf = 0
    const v = new THREE.Vector3()
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const el = root.current
      const cam = getCamera()
      if (!el || !cam) return
      const w = el.clientWidth
      const h = el.clientHeight
      el.querySelectorAll<HTMLElement>('[data-token]').forEach((node) => {
        const id = node.dataset.token!
        const p = displayPos.get(id)
        if (!p) {
          node.style.visibility = 'hidden'
          return
        }
        const off = Number(node.dataset.off ?? 0)
        v.set(p.x, 0, p.y + off).project(cam)
        node.style.visibility = 'visible'
        node.style.transform = `translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px) translate(-50%, 0)`
      })
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [getCamera])

  const cell = scene.grid.size
  const label = (t: Token) => {
    const show = hover === t.id || selected.includes(t.id) || t.show_bar || gm
    const hp = tokenHp(t)
    const pct = hp.max > 0 ? Math.max(0, Math.min(1, hp.hp / hp.max)) : 0
    return (
      <div key={t.id} data-token={t.id} data-off={(t.size * cell) / 2} className="absolute left-0 top-0 transition-opacity duration-150" style={{ opacity: show ? 1 : 0, visibility: 'hidden' }}>
        <div className="flex flex-col items-center gap-0.5 whitespace-nowrap">
          <span className="rounded bg-black/70 px-1.5 text-[11px] font-semibold text-white">
            {t.hidden && '👁‍🗨 '}
            {t.name}
            {t.conditions.length > 0 && <span className="ml-1">{t.conditions.map((c) => CONDITION_ICONS[c]?.icon).join('')}</span>}
          </span>
          {(t.show_bar || gm) && hp.max > 0 && (
            <span className="block h-1.5 w-14 overflow-hidden rounded-full bg-black/70">
              <span className="block h-full transition-all" style={{ width: `${pct * 100}%`, background: pct > 0.5 ? '#22c55e' : pct > 0.25 ? '#f59e0b' : '#dc2626' }} />
            </span>
          )}
        </div>
      </div>
    )
  }

  return (
    <div ref={root} className="pointer-events-none absolute inset-0 overflow-hidden" data-testid="token-overlay">
      {tokens.map(label)}
      {floats.map((f) => (
        <div key={f.id} data-token={f.tokenId} data-off={-cell * 0.6} className="absolute left-0 top-0" style={{ visibility: 'hidden' }}>
          <span className="animate-float-up absolute left-0 text-2xl font-extrabold drop-shadow-[0_2px_2px_rgba(0,0,0,0.9)]" style={{ color: f.color }}>
            {f.text}
          </span>
        </div>
      ))}
    </div>
  )
}
