import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { Billboard } from '@react-three/drei'
import * as THREE from 'three'
import { useShallow } from 'zustand/react/shallow'
import type { Scene, SpriteConfig, Token } from '../types'
import { activeSceneId, isGmNow, useGame, useIsGm } from '../store/game'
import { canControl, tokenHp } from '../game/actions'
import { crossesWall, snapToGrid } from '../engine/geometry'
import { letterTexture, useTexture } from './textures'
import { displayPos, useHover, useVision } from './vision'
import { interaction } from './camera'

type Anim = 'idle' | 'walk' | 'attack' | 'hurt' | 'death' | 'cast'
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
const tmp = new THREE.Vector3()

/** Gatilhos de animação vindos de fora (rolagem de ataque na ficha, etc.). */
const animTriggers = new Map<string, (a: Anim) => void>()
export function playTokenAnim(tokenId: string, a: Anim) {
  animTriggers.get(tokenId)?.(a)
}

function SpritePlane({ sprite, size, anim, onAnimEnd, standing, dim }: { sprite: SpriteConfig; size: number; anim: Anim; onAnimEnd: () => void; standing: boolean; dim: boolean }) {
  const base = useTexture(sprite.url, true)
  const tex = useMemo(() => {
    if (!base) return null
    const t = base.clone()
    t.needsUpdate = true
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping
    return t
  }, [base])
  const state = useRef({ anim, frame: 0, time: 0 })
  useEffect(() => {
    state.current = { anim, frame: 0, time: 0 }
  }, [anim])

  useFrame((_, dt) => {
    if (!tex || !tex.image) return
    const img = tex.image as { width: number; height: number }
    const cols = Math.floor(img.width / sprite.frameW)
    const rows = Math.floor(img.height / sprite.frameH)
    const a = sprite.animations[state.current.anim] ?? sprite.animations.idle
    if (!a) return
    const s = state.current
    s.time += dt
    const step = 1 / a.fps
    while (s.time >= step) {
      s.time -= step
      s.frame++
      if (s.frame >= a.frames) {
        if (s.anim === 'death') s.frame = a.frames - 1
        else if (s.anim !== 'idle' && s.anim !== 'walk') {
          s.frame = a.frames - 1
          onAnimEnd()
        } else s.frame = 0
      }
    }
    tex.repeat.set(1 / cols, 1 / rows)
    tex.offset.set((s.frame % cols) / cols, 1 - (a.row + 1) / rows)
  })

  if (!tex) return null
  const w = size
  const h = (size * sprite.frameH) / sprite.frameW
  const mat = <meshBasicMaterial map={tex} transparent alphaTest={0.1} color={dim ? '#777' : '#fff'} toneMapped={false} />
  if (standing)
    return (
      <Billboard position={[0, h * 0.62, 0]} lockX lockZ>
        <mesh scale={[w * 1.3, h * 1.3, 1]}>
          <planeGeometry />
          {mat}
        </mesh>
      </Billboard>
    )
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.6, 0]} scale={[w * 1.15, h * 1.15, 1]}>
      <planeGeometry />
      {mat}
    </mesh>
  )
}

function ImageDisc({ token, size, dim }: { token: Token; size: number; dim: boolean }) {
  const tex = useTexture(token.image_url, false)
  const t = tex ?? letterTexture(token.name, token.color)
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.6, 0]}>
      <circleGeometry args={[size / 2, 48]} />
      <meshBasicMaterial map={t} transparent color={dim ? '#777' : '#fff'} toneMapped={false} />
    </mesh>
  )
}

function TokenView({ token, scene }: { token: Token; scene: Scene }) {
  const group = useRef<THREE.Group>(null)
  const selected = useGame((s) => s.selected.includes(token.id))
  const remoteDrag = useGame((s) => s.dragging[token.id])
  const character = useGame((s) => (token.character_id ? s.characters[token.character_id] : undefined))
  const mode25d = useGame((s) => s.mode25d)
  const userId = useGame((s) => s.user?.id)
  const hp = useGame(useShallow(() => tokenHp(token)))
  const [anim, setAnim] = useState<Anim>('idle')
  const drag = useRef<{ active: boolean; start: { x: number; y: number }; pos: { x: number; y: number }; lastSent: number; moved: boolean } | null>(null)
  const prevHp = useRef(hp.hp)
  const cell = scene.grid.size
  const size = token.size * cell
  const dead = hp.max > 0 && hp.hp <= 0
  const sprite = character?.sprite ?? null

  // animações ligadas ao estado
  useEffect(() => {
    if (hp.hp < prevHp.current) setAnim(hp.hp <= 0 ? 'death' : 'hurt')
    else if (hp.hp > prevHp.current && anim === 'death') setAnim('idle')
    prevHp.current = hp.hp
  }, [hp.hp])
  useEffect(() => {
    if (dead) setAnim('death')
  }, [dead])
  useEffect(() => {
    animTriggers.set(token.id, setAnim)
    return () => void animTriggers.delete(token.id)
  }, [token.id])

  // posição suavizada
  useFrame((_, dt) => {
    const g = group.current
    if (!g) return
    const target = drag.current?.active ? drag.current.pos : remoteDrag ? remoteDrag : { x: token.x, y: token.y }
    const k = drag.current?.active ? 1 : 1 - Math.pow(0.0001, dt)
    g.position.x += (target.x - g.position.x) * k
    g.position.z += (target.y - g.position.z) * k
    const moving = Math.hypot(target.x - g.position.x, target.y - g.position.z) > 2
    displayPos.set(token.id, { x: g.position.x, y: g.position.z })
    if (sprite && !dead) {
      if (moving && anim === 'idle') setAnim('walk')
      else if (!moving && anim === 'walk' && !drag.current?.active) setAnim('idle')
    }
  })
  useEffect(() => {
    group.current?.position.set(token.x, 0, token.y)
  }, [])
  useEffect(() => () => void displayPos.delete(token.id), [token.id])

  const onDown = (e: ThreeEvent<PointerEvent>) => {
    if (e.button !== 0) return
    const s = useGame.getState()
    if (s.tool !== 'select' || e.nativeEvent.altKey) return
    e.stopPropagation()
    interaction.consumed = true
    if (e.shiftKey) s.set({ selected: selected ? s.selected.filter((x) => x !== token.id) : [...s.selected, token.id] })
    else if (!selected) s.set({ selected: [token.id] })
    if (!canControl(token)) return
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    drag.current = { active: true, start: { x: token.x, y: token.y }, pos: { x: token.x, y: token.y }, lastSent: 0, moved: false }
  }
  const onMove = (e: ThreeEvent<PointerEvent>) => {
    const d = drag.current
    if (!d?.active) return
    e.stopPropagation()
    const hit = e.ray.intersectPlane(groundPlane, tmp)
    if (!hit) return
    d.pos = { x: hit.x, y: hit.z }
    d.moved = true
    const now = performance.now()
    if (now - d.lastSent > 100) {
      d.lastSent = now
      useGame.getState().send({ type: 'drag', tokenId: token.id, x: d.pos.x, y: d.pos.y, by: userId ?? '' })
    }
  }
  const onUp = (e: ThreeEvent<PointerEvent>) => {
    const d = drag.current
    if (!d?.active) return
    e.stopPropagation()
    d.active = false
    if (!d.moved) return
    let p = snapToGrid(d.pos, scene.grid, token.size)
    if (!isGmNow() && crossesWall(d.start, p, scene.walls)) p = d.start // jogadores não atravessam paredes
    p = { x: Math.max(0, Math.min(scene.map_w, p.x)), y: Math.max(0, Math.min(scene.map_h, p.y)) }
    d.pos = p
    void useGame.getState().patch('tokens', token.id, { x: p.x, y: p.y })
    setTimeout(() => (drag.current = null), 400)
  }

  const ringColor = selected ? '#f5d68a' : token.hidden ? '#6b7280' : token.color

  return (
    <group
      ref={group}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerOver={(e) => {
        e.stopPropagation()
        useHover.getState().set(token.id)
      }}
      onPointerOut={() => useHover.getState().id === token.id && useHover.getState().set(null)}
      onDoubleClick={(e) => {
        e.stopPropagation()
        if (token.character_id) useGame.getState().set({ openSheetId: token.character_id })
      }}
      onContextMenu={(e) => {
        e.stopPropagation()
        e.nativeEvent.preventDefault()
        window.dispatchEvent(new CustomEvent('token-menu', { detail: { id: token.id, x: e.nativeEvent.clientX, y: e.nativeEvent.clientY } }))
      }}
    >
      {/* base / anel */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.3, 0]}>
        <ringGeometry args={[size * 0.44, size * (selected ? 0.52 : 0.49), 48]} />
        <meshBasicMaterial color={ringColor} transparent opacity={token.hidden ? 0.5 : 0.95} toneMapped={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.25, 0]}>
        <circleGeometry args={[size * 0.46, 40]} />
        <meshBasicMaterial color="#000" transparent opacity={sprite ? 0.35 : 0} />
      </mesh>
      {sprite ? (
        <SpritePlane sprite={sprite} size={size} anim={anim} standing={mode25d} dim={token.hidden} onAnimEnd={() => setAnim(dead ? 'death' : 'idle')} />
      ) : (
        <ImageDisc token={token} size={size * 0.88} dim={token.hidden} />
      )}
      {/* área de clique */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 2, 0]}>
        <circleGeometry args={[size / 2, 24]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  )
}

/** Tokens que este cliente pode ver na cena atual. */
export function useVisibleTokens(): Token[] {
  const sceneId = useGame(activeSceneId)
  const tokens = useGame((s) => s.tokens)
  const gm = useIsGm()
  const hiddenByFog = useVision((s) => s.hiddenByFog)
  return useMemo(
    () =>
      Object.values(tokens)
        .filter((t) => t.scene_id === sceneId)
        .filter((t) => gm || (!t.hidden && t.layer !== 'gm'))
        .filter((t) => gm || !hiddenByFog.has(t.id))
        .sort((a, b) => (a.layer === 'object' ? -1 : 0) - (b.layer === 'object' ? -1 : 0) || a.y - b.y),
    [tokens, sceneId, gm, hiddenByFog],
  )
}

export function TokensLayer() {
  const sceneId = useGame(activeSceneId)
  const scene = useGame((s) => (sceneId ? s.scenes[sceneId] : null))
  const list = useVisibleTokens()
  if (!scene) return null
  return (
    <>
      {list.map((t) => (
        <TokenView key={t.id} token={t} scene={scene} />
      ))}
    </>
  )
}
