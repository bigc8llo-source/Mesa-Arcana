import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import * as THREE from 'three'
import { create } from 'zustand'
import type { FogShape, Scene, Wall } from '../types'
import { emitLocalLive, isGmNow, useGame, useIsGm, useMe } from '../store/game'
import { useToolOptions } from '../store/tools'
import { camState, interaction, screenToGround, useCamRequests } from './camera'
import { useTexture } from './textures'
import { TokenOverlay } from './Overlay'
import { TokensLayer } from './Tokens'
import { FogLayer } from './Fog'
import { AoeShapeMesh, PingLayer, VfxLayer, VFX_LIST, WeatherLayer } from './Effects'
import { cellDistance, distToSegment, formatDistance, hexCorners, hexToPixel, inAoe, pixelToHex, type Pt } from '../engine/geometry'
import { uid } from '../lib/id'
import { handleDroppedFile } from './drop'
import { placeToken } from '../game/actions'
import { displayPos } from './vision'

// ------------------------------------------------------------ rascunhos das ferramentas

interface Draft {
  ruler: { a: Pt; b: Pt } | null
  aoe: { o: Pt; t: Pt } | null
  chain: { pts: Pt[]; cursor: Pt | null } | null
  fogRect: { a: Pt; b: Pt } | null
  fogStamps: Pt[]
  spell: { a: Pt; b: Pt } | null
  set(p: Partial<Omit<Draft, 'set'>>): void
}
const useDraft = create<Draft>((set) => ({ ruler: null, aoe: null, chain: null, fogRect: null, fogStamps: [], spell: null, set: (p) => set(p) }))

let threeCamera: THREE.Camera | null = null

function applyCamera(cam: THREE.OrthographicCamera) {
  const D = 3000
  cam.position.set(camState.x, D * Math.cos(camState.tilt), camState.z + D * Math.sin(camState.tilt))
  cam.up.set(0, 1, 0)
  if (camState.tilt < 0.001) cam.up.set(0, 0, -1)
  cam.lookAt(camState.x, 0, camState.z)
  cam.zoom = camState.zoom
  cam.updateProjectionMatrix()
  cam.updateMatrixWorld()
}

function CameraRig({ scene }: { scene: Scene }) {
  const { camera, size } = useThree()
  const mode25d = useGame((s) => s.mode25d)
  const focus = useCamRequests((s) => s.focus)
  const anim = useRef<{ x: number; z: number; zoom?: number } | null>(null)

  useEffect(() => {
    threeCamera = camera
  }, [camera])
  useEffect(() => {
    camState.targetTilt = mode25d ? 0.75 : 0
  }, [mode25d])
  // enquadra o mapa ao trocar de cena
  useEffect(() => {
    camState.x = scene.map_w / 2
    camState.z = scene.map_h / 2
    camState.zoom = Math.min(size.width / scene.map_w, size.height / scene.map_h) * 0.95
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene.id, scene.map_w, scene.map_h])
  useEffect(() => {
    if (focus) anim.current = { x: focus.x, z: focus.y, zoom: focus.zoom }
  }, [focus])

  useFrame((_, dt) => {
    const k = 1 - Math.pow(0.002, dt)
    camState.tilt += (camState.targetTilt - camState.tilt) * k
    if (Math.abs(camState.targetTilt - camState.tilt) < 0.001) camState.tilt = camState.targetTilt
    if (anim.current) {
      camState.x += (anim.current.x - camState.x) * k
      camState.z += (anim.current.z - camState.z) * k
      if (anim.current.zoom) camState.zoom += (anim.current.zoom - camState.zoom) * k
      if (Math.hypot(anim.current.x - camState.x, anim.current.z - camState.z) < 1) anim.current = null
    }
    applyCamera(camera as THREE.OrthographicCamera)
  })
  return null
}

// ------------------------------------------------------------ camadas

function MapLayer({ scene }: { scene: Scene }) {
  const tex = useTexture(scene.map_url, false)
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[scene.map_w / 2, -1, scene.map_h / 2]}>
        <planeGeometry args={[scene.map_w * 4, scene.map_h * 4]} />
        <meshBasicMaterial color="#0d0b12" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[scene.map_w / 2, 0, scene.map_h / 2]}>
        <planeGeometry args={[scene.map_w, scene.map_h]} />
        {tex ? <meshBasicMaterial key="tex" map={tex} toneMapped={false} /> : <meshBasicMaterial key="plain" color="#2b2438" />}
      </mesh>
    </group>
  )
}

function GridLayer({ scene }: { scene: Scene }) {
  const geo = useMemo(() => {
    const g = scene.grid
    const pts: number[] = []
    const W = scene.map_w
    const H = scene.map_h
    if (g.type === 'square') {
      for (let x = g.offsetX % g.size; x <= W; x += g.size) pts.push(x, 0.5, 0, x, 0.5, H)
      for (let y = g.offsetY % g.size; y <= H; y += g.size) pts.push(0, 0.5, y, W, 0.5, y)
    } else if (g.type === 'hex') {
      const h0 = pixelToHex({ x: 0, y: 0 }, g)
      const h1 = pixelToHex({ x: W, y: H }, g)
      for (let r = Math.floor(h0.r) - 1; r <= Math.ceil(h1.r) + 1; r++)
        for (let q = Math.floor(h0.q) - Math.ceil(h1.r) - 2; q <= Math.ceil(h1.q) + 2; q++) {
          const c = hexToPixel({ q, r }, g)
          if (c.x < -g.size || c.y < -g.size || c.x > W + g.size || c.y > H + g.size) continue
          const cs = hexCorners(c, g)
          for (let i = 0; i < 3; i++) {
            const a = cs[i]
            const b = cs[(i + 1) % 6]
            pts.push(a.x, 0.5, a.y, b.x, 0.5, b.y)
          }
        }
    }
    const geom = new THREE.BufferGeometry()
    geom.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    return geom
  }, [scene.grid, scene.map_w, scene.map_h])
  if (scene.grid.type === 'none') return null
  return (
    <lineSegments geometry={geo}>
      <lineBasicMaterial color={scene.grid.color} transparent opacity={scene.grid.opacity} depthWrite={false} />
    </lineSegments>
  )
}

const WALL_COLORS: Record<Wall['kind'], string> = { wall: '#f87171', door: '#fbbf24', window: '#38bdf8' }

function WallsLayer({ scene, editing }: { scene: Scene; editing: boolean }) {
  return (
    <>
      {scene.walls.map((w) => (
        <Line
          key={w.id}
          points={[
            [w.x1, 3, w.y1],
            [w.x2, 3, w.y2],
          ]}
          color={WALL_COLORS[w.kind]}
          lineWidth={editing ? 4 : 2}
          transparent
          opacity={editing ? 1 : 0.55}
          dashed={w.kind === 'door' && w.open}
          dashSize={10}
          gapSize={8}
        />
      ))}
      {scene.walls
        .filter((w) => w.kind === 'door')
        .map((w) => (
          <mesh key={`d${w.id}`} position={[(w.x1 + w.x2) / 2, 3.5, (w.y1 + w.y2) / 2]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[10, 16]} />
            <meshBasicMaterial color={w.open ? '#22c55e' : '#f59e0b'} toneMapped={false} />
          </mesh>
        ))}
    </>
  )
}

function LightsLayer({ scene }: { scene: Scene }) {
  return (
    <>
      {scene.lights.map((l) => (
        <group key={l.id}>
          <mesh position={[l.x, 3, l.y]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[12, 20]} />
            <meshBasicMaterial color={l.color} toneMapped={false} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[l.x, 2, l.y]}>
            <ringGeometry args={[l.dim * scene.grid.size - 2, l.dim * scene.grid.size, 64]} />
            <meshBasicMaterial color={l.color} transparent opacity={0.5} depthWrite={false} />
          </mesh>
        </group>
      ))}
    </>
  )
}

function ToolOverlay({ scene }: { scene: Scene }) {
  const d = useDraft()
  const opts = useToolOptions()
  const tokens = useGame((s) => s.tokens)
  const cell = scene.grid.size
  return (
    <>
      {d.ruler && (
        <>
          <Line points={[[d.ruler.a.x, 6, d.ruler.a.y], [d.ruler.b.x, 6, d.ruler.b.y]]} color="#f5d68a" lineWidth={3} dashed dashSize={12} gapSize={6} depthTest={false} renderOrder={30} />
        </>
      )}
      {d.aoe && (
        <>
          <AoeShapeMesh shape={opts.aoeShape} o={d.aoe.o} t={d.aoe.t} color={opts.aoeColor} opacity={0.35} width={cell} />
          {Object.values(tokens)
            .filter((t) => t.scene_id === scene.id && inAoe(opts.aoeShape, d.aoe!.o, d.aoe!.t, displayPos.get(t.id) ?? t, cell))
            .map((t) => (
              <mesh key={t.id} rotation={[-Math.PI / 2, 0, 0]} position={[t.x, 5, t.y]} renderOrder={31}>
                <ringGeometry args={[cell * 0.5 * t.size, cell * 0.58 * t.size, 32]} />
                <meshBasicMaterial color="#ef4444" depthTest={false} toneMapped={false} />
              </mesh>
            ))}
        </>
      )}
      {d.spell && <Line points={[[d.spell.a.x, 6, d.spell.a.y], [d.spell.b.x, 6, d.spell.b.y]]} color="#c084fc" lineWidth={3} dashed dashSize={10} gapSize={6} depthTest={false} renderOrder={30} />}
      {d.chain && d.chain.pts.length > 0 && (
        <Line
          points={[...d.chain.pts, ...(d.chain.cursor ? [d.chain.cursor] : [])].map((p) => [p.x, 6, p.y] as [number, number, number])}
          color={WALL_COLORS[opts.wallKind]}
          lineWidth={4}
          depthTest={false}
          renderOrder={30}
        />
      )}
      {d.fogRect && (
        <Line
          points={[
            [d.fogRect.a.x, 6, d.fogRect.a.y],
            [d.fogRect.b.x, 6, d.fogRect.a.y],
            [d.fogRect.b.x, 6, d.fogRect.b.y],
            [d.fogRect.a.x, 6, d.fogRect.b.y],
            [d.fogRect.a.x, 6, d.fogRect.a.y],
          ]}
          color={opts.fogMode === 'reveal' ? '#fde68a' : '#64748b'}
          lineWidth={3}
          dashed
          dashSize={10}
          gapSize={6}
          depthTest={false}
          renderOrder={30}
        />
      )}
      {d.fogStamps.map((p, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[p.x, 6, p.y]} renderOrder={30}>
          <circleGeometry args={[opts.brush * cell * 0.5, 20]} />
          <meshBasicMaterial color={opts.fogMode === 'reveal' ? '#fde68a' : '#334155'} transparent opacity={0.35} depthTest={false} />
        </mesh>
      ))}
    </>
  )
}

// ------------------------------------------------------------ interação

function circlePoly(c: Pt, r: number, n = 16): number[] {
  const out: number[] = []
  for (let i = 0; i < n; i++) out.push(c.x + Math.cos((i / n) * Math.PI * 2) * r, c.y + Math.sin((i / n) * Math.PI * 2) * r)
  return out
}

function snapCorner(p: Pt, scene: Scene, free: boolean): Pt {
  if (free || scene.grid.type !== 'square') return p
  const h = scene.grid.size / 2
  return { x: Math.round((p.x - scene.grid.offsetX) / h) * h + scene.grid.offsetX, y: Math.round((p.y - scene.grid.offsetY) / h) * h + scene.grid.offsetY }
}

function useTableInput(scene: Scene, wrap: React.RefObject<HTMLDivElement | null>) {
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pan = useRef<{ anchor: Pt; moved: boolean; startClient: Pt; button: number } | null>(null)
  const pinch = useRef<{ dist: number; zoom: number } | null>(null)
  const toolDown = useRef<{ start: Pt } | null>(null)
  const me = useMe()

  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const ground = (e: { clientX: number; clientY: number }) => (threeCamera ? screenToGround(e.clientX, e.clientY, threeCamera, el.getBoundingClientRect()) : null)
    const cam = () => threeCamera as THREE.OrthographicCamera | null

    const panTo = (anchor: Pt, e: { clientX: number; clientY: number }) => {
      const c = cam()
      if (!c) return
      applyCamera(c)
      const g = ground(e)
      if (!g) return
      camState.x += anchor.x - g.x
      camState.z += anchor.y - g.y
      applyCamera(c)
    }

    const onDown = (e: PointerEvent) => {
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (pointers.current.size === 2) {
        const [a, b] = [...pointers.current.values()]
        pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom: camState.zoom }
        pan.current = null
        toolDown.current = null
        return
      }
      if (interaction.consumed) {
        interaction.consumed = false
        return
      }
      const g = ground(e)
      if (!g) return
      const s = useGame.getState()
      const tool = s.tool
      el.setPointerCapture(e.pointerId)
      // botão do meio/direito sempre move a câmera
      if (e.button === 1 || e.button === 2 || (e.button === 0 && tool === 'select' && !e.altKey)) {
        pan.current = { anchor: g, moved: false, startClient: { x: e.clientX, y: e.clientY }, button: e.button }
        return
      }
      if (e.button !== 0) return
      if (tool === 'ping' || e.altKey) {
        const ev = { type: 'ping' as const, x: g.x, y: g.y, color: me?.color ?? '#fff', by: s.user?.id ?? '' }
        s.send(ev)
        emitLocalLive(ev)
        return
      }
      const d = useDraft.getState()
      const o = useToolOptions.getState()
      toolDown.current = { start: g }
      if (tool === 'ruler') d.set({ ruler: { a: g, b: g } })
      if (tool === 'aoe') d.set({ aoe: { o: g, t: g } })
      if (tool === 'spell') d.set({ spell: { a: g, b: g } })
      if (tool === 'fog' && isGmNow()) {
        if (o.fogShape === 'rect') d.set({ fogRect: { a: g, b: g } })
        else if (o.fogShape === 'brush') d.set({ fogStamps: [g] })
        else {
          const chain = d.chain ?? { pts: [], cursor: null }
          d.set({ chain: { pts: [...chain.pts, g], cursor: g } })
        }
      }
      if (tool === 'walls' && isGmNow()) {
        if (e.ctrlKey || e.metaKey) {
          // apaga a parede mais próxima
          const near = scene.walls.map((w) => ({ w, d: distToSegment(g, { a: { x: w.x1, y: w.y1 }, b: { x: w.x2, y: w.y2 } }) })).sort((a, b) => a.d - b.d)[0]
          if (near && near.d < 20) void s.patch('scenes', scene.id, { walls: scene.walls.filter((w) => w.id !== near.w.id) })
          return
        }
        const p = snapCorner(g, scene, e.shiftKey)
        const chain = d.chain
        if (chain && chain.pts.length) {
          const prev = chain.pts[chain.pts.length - 1]
          if (Math.hypot(prev.x - p.x, prev.y - p.y) > 2) {
            const wall: Wall = { id: uid(), x1: prev.x, y1: prev.y, x2: p.x, y2: p.y, kind: o.wallKind, open: false }
            void s.patch('scenes', scene.id, { walls: [...scene.walls, wall] })
          }
          d.set({ chain: o.wallKind === 'wall' ? { pts: [...chain.pts, p], cursor: p } : null })
        } else d.set({ chain: { pts: [p], cursor: p } })
      }
      if (tool === 'light' && isGmNow()) {
        if (e.ctrlKey || e.metaKey) {
          const near = scene.lights.map((l) => ({ l, d: Math.hypot(l.x - g.x, l.y - g.y) })).sort((a, b) => a.d - b.d)[0]
          if (near && near.d < 40) void s.patch('scenes', scene.id, { lights: scene.lights.filter((l) => l.id !== near.l.id) })
          return
        }
        void s.patch('scenes', scene.id, { lights: [...scene.lights, { id: uid(), x: g.x, y: g.y, bright: o.lightRadius / 2, dim: o.lightRadius, color: '#ffcf7a', flicker: true }] })
      }
    }

    const onMove = (e: PointerEvent) => {
      if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (pinch.current && pointers.current.size === 2) {
        const [a, b] = [...pointers.current.values()]
        const dist = Math.hypot(a.x - b.x, a.y - b.y)
        camState.zoom = Math.max(0.05, Math.min(6, (pinch.current.zoom * dist) / pinch.current.dist))
        return
      }
      if (pan.current) {
        if (Math.hypot(e.clientX - pan.current.startClient.x, e.clientY - pan.current.startClient.y) > 4) pan.current.moved = true
        if (pan.current.moved) panTo(pan.current.anchor, e)
        return
      }
      const g = ground(e)
      if (!g) return
      const d = useDraft.getState()
      if (d.chain && useGame.getState().tool === 'walls') d.set({ chain: { ...d.chain, cursor: snapCorner(g, scene, e.shiftKey) } })
      if (d.chain && useGame.getState().tool === 'fog') d.set({ chain: { ...d.chain, cursor: g } })
      if (!toolDown.current) return
      if (d.ruler) d.set({ ruler: { ...d.ruler, b: g } })
      if (d.aoe) d.set({ aoe: { ...d.aoe, t: g } })
      if (d.spell) d.set({ spell: { ...d.spell, b: g } })
      if (d.fogRect) d.set({ fogRect: { ...d.fogRect, b: g } })
      if (d.fogStamps.length) {
        const last = d.fogStamps[d.fogStamps.length - 1]
        const r = useToolOptions.getState().brush * scene.grid.size * 0.25
        if (Math.hypot(last.x - g.x, last.y - g.y) > r) d.set({ fogStamps: [...d.fogStamps, g] })
      }
    }

    const onUp = (e: PointerEvent) => {
      pointers.current.delete(e.pointerId)
      if (pointers.current.size < 2) pinch.current = null
      const s = useGame.getState()
      if (pan.current) {
        const p = pan.current
        pan.current = null
        if (!p.moved && p.button === 0) {
          // clique simples: porta (mestre) ou limpar seleção
          const g = ground(e)
          if (g && isGmNow()) {
            const door = scene.walls
              .filter((w) => w.kind === 'door')
              .map((w) => ({ w, d: Math.hypot((w.x1 + w.x2) / 2 - g.x, (w.y1 + w.y2) / 2 - g.y) }))
              .sort((a, b) => a.d - b.d)[0]
            if (door && door.d < scene.grid.size * 0.5) {
              void s.patch('scenes', scene.id, { walls: scene.walls.map((w) => (w.id === door.w.id ? { ...w, open: !w.open } : w)) })
              return
            }
          }
          s.set({ selected: [] })
        }
        return
      }
      if (!toolDown.current) return
      toolDown.current = null
      const d = useDraft.getState()
      const o = useToolOptions.getState()
      if (d.ruler) d.set({ ruler: null })
      if (d.aoe) {
        const { o: origin, t } = d.aoe
        if (Math.hypot(t.x - origin.x, t.y - origin.y) > 5) {
          const hit = Object.values(s.tokens).filter((tk) => tk.scene_id === scene.id && inAoe(o.aoeShape, origin, t, tk, scene.grid.size))
          s.set({ selected: hit.map((x) => x.id) })
          const ev = { type: 'vfx' as const, effect: `aoe:${o.aoeShape}`, x: origin.x, y: origin.y, tx: t.x, ty: t.y, color: o.aoeColor }
          s.send(ev)
          emitLocalLive(ev)
        }
        d.set({ aoe: null })
      }
      if (d.spell) {
        const fx = VFX_LIST.find((v) => v.id === o.vfx)
        const ev = fx?.needsTarget
          ? { type: 'vfx' as const, effect: o.vfx, x: d.spell.b.x, y: d.spell.b.y, tx: d.spell.a.x, ty: d.spell.a.y }
          : { type: 'vfx' as const, effect: o.vfx, x: d.spell.b.x, y: d.spell.b.y }
        s.send(ev)
        emitLocalLive(ev)
        d.set({ spell: null })
      }
      if (d.fogRect) {
        const { a, b } = d.fogRect
        if (Math.abs(a.x - b.x) > 5 && Math.abs(a.y - b.y) > 5) {
          const shape: FogShape = { id: uid(), mode: o.fogMode, points: [a.x, a.y, b.x, a.y, b.x, b.y, a.x, b.y] }
          void s.patch('scenes', scene.id, { fog: [...scene.fog, shape] })
        }
        d.set({ fogRect: null })
      }
      if (d.fogStamps.length) {
        const r = (o.brush * scene.grid.size) / 2
        const shapes: FogShape[] = d.fogStamps.map((p) => ({ id: uid(), mode: o.fogMode, points: circlePoly(p, r) }))
        void s.patch('scenes', scene.id, { fog: [...scene.fog, ...shapes] })
        d.set({ fogStamps: [] })
      }
    }

    const onDbl = () => {
      const d = useDraft.getState()
      const s = useGame.getState()
      if (d.chain && s.tool === 'fog' && d.chain.pts.length >= 3) {
        const shape: FogShape = { id: uid(), mode: useToolOptions.getState().fogMode, points: d.chain.pts.flatMap((p) => [p.x, p.y]) }
        void s.patch('scenes', scene.id, { fog: [...scene.fog, shape] })
      }
      d.set({ chain: null })
    }

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const c = cam()
      if (!c) return
      applyCamera(c)
      const before = ground(e)
      const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015))
      camState.zoom = Math.max(0.05, Math.min(6, camState.zoom * factor))
      applyCamera(c)
      const after = ground(e)
      if (before && after) {
        camState.x += before.x - after.x
        camState.z += before.y - after.y
      }
    }
    const onCtx = (e: MouseEvent) => {
      e.preventDefault()
      const d = useDraft.getState()
      if (d.chain) d.set({ chain: null })
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') useDraft.getState().set({ chain: null, ruler: null, aoe: null, fogRect: null, spell: null })
    }

    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onUp)
    el.addEventListener('dblclick', onDbl)
    el.addEventListener('wheel', onWheel, { passive: false })
    el.addEventListener('contextmenu', onCtx)
    window.addEventListener('keydown', onKey)
    return () => {
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onUp)
      el.removeEventListener('dblclick', onDbl)
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('contextmenu', onCtx)
      window.removeEventListener('keydown', onKey)
    }
  }, [scene, wrap, me])
}

// ------------------------------------------------------------ componente principal

const getCamera = () => threeCamera

/** Distância da régua / tamanho da área, seguindo o cursor (DOM). */
function MeasureLabel({ scene }: { scene: Scene }) {
  const d = useDraft()
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const target = d.ruler?.b ?? d.aoe?.t ?? null
  useEffect(() => {
    if (!target || !threeCamera) return setPos(null)
    const v = new THREE.Vector3(target.x, 0, target.y).project(threeCamera)
    const el = document.querySelector('[data-testid="map-view"]') as HTMLElement | null
    if (!el) return
    setPos({ x: ((v.x + 1) / 2) * el.clientWidth, y: ((1 - v.y) / 2) * el.clientHeight })
  }, [target])
  if (!pos || !target) return null
  const text = d.ruler
    ? formatDistance(cellDistance(d.ruler.a, d.ruler.b, scene.grid), scene.grid)
    : d.aoe
      ? formatDistance(Math.hypot(d.aoe.t.x - d.aoe.o.x, d.aoe.t.y - d.aoe.o.y) / scene.grid.size, scene.grid)
      : ''
  return (
    <span className="pointer-events-none absolute whitespace-nowrap rounded-md bg-black/80 px-2 py-1 text-sm font-bold text-gold-400" style={{ left: pos.x + 14, top: pos.y - 10 }}>
      {text}
    </span>
  )
}

export function MapView({ scene }: { scene: Scene }) {
  const wrap = useRef<HTMLDivElement>(null)
  const gm = useIsGm()
  const tool = useGame((s) => s.tool)
  const [shaking, setShaking] = useState(false)
  const [dropHint, setDropHint] = useState(false)
  useTableInput(scene, wrap)

  useEffect(() => {
    const f = () => {
      setShaking(true)
      setTimeout(() => setShaking(false), 450)
    }
    window.addEventListener('table-shake', f)
    return () => window.removeEventListener('table-shake', f)
  }, [])
  useEffect(() => {
    useDraft.getState().set({ chain: null, ruler: null, aoe: null, fogRect: null, fogStamps: [], spell: null })
  }, [tool])

  const onDrop = async (e: DragEvent) => {
    e.preventDefault()
    setDropHint(false)
    const el = wrap.current
    if (!el || !threeCamera) return
    const g = screenToGround(e.clientX, e.clientY, threeCamera, el.getBoundingClientRect()) ?? { x: scene.map_w / 2, y: scene.map_h / 2 }
    const charId = e.dataTransfer.getData('application/x-mesa-character')
    if (charId) {
      const c = useGame.getState().characters[charId]
      if (c) await placeToken(c, g.x, g.y, scene.id)
      return
    }
    const file = e.dataTransfer.files[0]
    if (file) await handleDroppedFile(file, scene, g)
  }

  const cursor = tool === 'select' ? 'grab' : tool === 'ping' ? 'pointer' : 'crosshair'
  return (
    <div
      ref={wrap}
      className={`absolute inset-0 touch-none select-none ${shaking ? 'animate-shake' : ''}`}
      style={{ cursor }}
      onDragOver={(e) => {
        e.preventDefault()
        setDropHint(true)
      }}
      onDragLeave={() => setDropHint(false)}
      onDrop={onDrop}
      data-testid="map-view"
    >
      <Canvas orthographic dpr={[1, 2]} camera={{ position: [0, 3000, 0], zoom: 0.5, near: 1, far: 10000 }} gl={{ antialias: true }} flat>
        <color attach="background" args={['#0d0b12']} />
        <CameraRig scene={scene} />
        <MapLayer scene={scene} />
        <GridLayer scene={scene} />
        <TokensLayer />
        <FogLayer scene={scene} />
        {gm && (tool === 'walls' || scene.walls.length < 400) && <WallsLayer scene={scene} editing={tool === 'walls'} />}
        {gm && (tool === 'light' || tool === 'walls') && <LightsLayer scene={scene} />}
        <WeatherLayer scene={scene} />
        <ToolOverlay scene={scene} />
        <VfxLayer />
        <PingLayer />
      </Canvas>
      <TokenOverlay scene={scene} getCamera={getCamera} />
      <MeasureLabel scene={scene} />
      {!scene.map_url && gm && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="w-72 rounded-xl border-2 border-dashed border-parch-300/40 bg-black/40 p-5 text-center text-sm text-parch-200">
            <p className="font-display text-lg text-gold-400">Arraste uma imagem aqui</p>
            <p>para usar como mapa (ou um arquivo .dd2vtt do Dungeondraft com paredes e luzes).</p>
          </div>
        </div>
      )}
      {dropHint && (
        <div className="pointer-events-none absolute inset-4 grid place-items-center rounded-2xl border-4 border-dashed border-gold-400/70 bg-black/30">
          <p className="font-display text-2xl text-gold-400">Solte para adicionar à cena</p>
        </div>
      )}
    </div>
  )
}
