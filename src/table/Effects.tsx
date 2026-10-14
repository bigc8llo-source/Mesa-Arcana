import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import * as THREE from 'three'
import type { Scene, Weather } from '../types'
import { onLive, useGame } from '../store/game'
import { conePoints, type AoeShape } from '../engine/geometry'
import { camState } from './camera'

// ============================================================ Partículas genéricas

let dotTex: THREE.Texture | null = null
/** Ponto redondo e suave (sem isso as partículas seriam quadrados). */
function softDot(): THREE.Texture {
  if (dotTex) return dotTex
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.4, 'rgba(255,255,255,0.8)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 64, 64)
  dotTex = new THREE.CanvasTexture(c)
  return dotTex
}

interface BurstOpts {
  count: number
  color: string
  color2?: string
  speed: number
  life: number
  gravity: number
  size: number
  spread: number // raio inicial
  up: number // velocidade vertical
}

function Burst({ x, y, opts, onDone }: { x: number; y: number; opts: BurstOpts; onDone: () => void }) {
  const ref = useRef<THREE.Points>(null)
  const t = useRef(0)
  const { geo, vel } = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const pos = new Float32Array(opts.count * 3)
    const col = new Float32Array(opts.count * 3)
    const v = new Float32Array(opts.count * 3)
    const c1 = new THREE.Color(opts.color)
    const c2 = new THREE.Color(opts.color2 ?? opts.color)
    for (let i = 0; i < opts.count; i++) {
      const a = Math.random() * Math.PI * 2
      const r = Math.random() * opts.spread
      pos.set([x + Math.cos(a) * r, 5 + Math.random() * 10, y + Math.sin(a) * r], i * 3)
      const sp = opts.speed * (0.3 + Math.random() * 0.7)
      v.set([Math.cos(a) * sp, opts.up * (0.5 + Math.random()), Math.sin(a) * sp], i * 3)
      const c = c1.clone().lerp(c2, Math.random())
      col.set([c.r, c.g, c.b], i * 3)
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    return { geo: g, vel: v }
  }, [x, y, opts])

  useFrame((_, dt) => {
    t.current += dt
    const p = geo.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < opts.count; i++) {
      vel[i * 3 + 1] -= opts.gravity * dt
      p.array[i * 3] += vel[i * 3] * dt
      p.array[i * 3 + 1] += vel[i * 3 + 1] * dt
      p.array[i * 3 + 2] += vel[i * 3 + 2] * dt
    }
    p.needsUpdate = true
    const m = ref.current?.material as THREE.PointsMaterial | undefined
    if (m) {
      m.opacity = Math.max(0, 1 - t.current / opts.life)
      // tamanho em pixels acompanha o zoom da câmera ortográfica
      m.size = opts.size * Math.max(0.8, Math.min(4, camState.zoom * 2.2))
    }
    if (t.current > opts.life) onDone()
  })
  return (
    <points ref={ref} geometry={geo} renderOrder={20}>
      <pointsMaterial map={softDot()} vertexColors size={opts.size} sizeAttenuation transparent depthWrite={false} depthTest={false} blending={THREE.AdditiveBlending} toneMapped={false} />
    </points>
  )
}

function Flash({ x, y, color, radius, life, onDone }: { x: number; y: number; color: string; radius: number; life: number; onDone: () => void }) {
  const ref = useRef<THREE.Mesh>(null)
  const t = useRef(0)
  useFrame((_, dt) => {
    t.current += dt
    const k = t.current / life
    if (ref.current) {
      const s = radius * (0.2 + Math.min(1, k * 2.5))
      ref.current.scale.set(s, s, s)
      ;(ref.current.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.8 * (1 - k))
    }
    if (t.current > life) onDone()
  })
  return (
    <mesh ref={ref} position={[x, 6, y]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={19}>
      <circleGeometry args={[1, 48]} />
      <meshBasicMaterial color={color} transparent depthTest={false} blending={THREE.AdditiveBlending} toneMapped={false} />
    </mesh>
  )
}

function Bolt({ x, y, tx, ty, color, onDone }: { x: number; y: number; tx: number; ty: number; color: string; onDone: () => void }) {
  const [pts, setPts] = useState<[number, number, number][]>([])
  const t = useRef(0)
  useFrame((_, dt) => {
    t.current += dt
    if (t.current > 0.7) return onDone()
    const n = 12
    const arr: [number, number, number][] = []
    for (let i = 0; i <= n; i++) {
      const k = i / n
      const j = i === 0 || i === n ? 0 : (Math.random() - 0.5) * 30
      const nx = -(ty - y)
      const ny = tx - x
      const len = Math.hypot(nx, ny) || 1
      arr.push([tx + (x - tx) * k + (nx / len) * j, 8, ty + (y - ty) * k + (ny / len) * j])
    }
    setPts(arr)
  })
  if (pts.length < 2) return null
  return <Line points={pts} color={color} lineWidth={4} transparent opacity={0.9} depthTest={false} renderOrder={21} />
}

function Projectile({ x, y, tx, ty, color, onDone }: { x: number; y: number; tx: number; ty: number; color: string; onDone: () => void }) {
  const ref = useRef<THREE.Mesh>(null)
  const t = useRef(0)
  const dist = Math.hypot(x - tx, y - ty)
  const dur = Math.max(0.2, dist / 1400)
  useFrame((_, dt) => {
    t.current += dt
    const k = Math.min(1, t.current / dur)
    if (ref.current) ref.current.position.set(tx + (x - tx) * k, 10 + Math.sin(k * Math.PI) * 30, ty + (y - ty) * k)
    if (k >= 1) onDone()
  })
  return (
    <mesh ref={ref} renderOrder={21}>
      <sphereGeometry args={[9, 12, 12]} />
      <meshBasicMaterial color={color} toneMapped={false} />
    </mesh>
  )
}

function AoeFlash({ shape, x, y, tx, ty, color, onDone }: { shape: AoeShape; x: number; y: number; tx: number; ty: number; color: string; onDone: () => void }) {
  const t = useRef(0)
  const [op, setOp] = useState(0.6)
  useFrame((_, dt) => {
    t.current += dt
    setOp(Math.max(0, 0.6 * (1 - t.current / 2.5)))
    if (t.current > 2.5) onDone()
  })
  return <AoeShapeMesh shape={shape} o={{ x, y }} t={{ x: tx, y: ty }} color={color} opacity={op} />
}

export function AoeShapeMesh({ shape, o, t, color, opacity, width = 70 }: { shape: AoeShape; o: { x: number; y: number }; t: { x: number; y: number }; color: string; opacity: number; width?: number }) {
  const geo = useMemo(() => {
    const len = Math.hypot(t.x - o.x, t.y - o.y)
    let pts: { x: number; y: number }[] = []
    if (shape === 'circle') pts = Array.from({ length: 48 }, (_, i) => ({ x: o.x + Math.cos((i / 48) * Math.PI * 2) * len, y: o.y + Math.sin((i / 48) * Math.PI * 2) * len }))
    else if (shape === 'square') pts = [{ x: o.x - len, y: o.y - len }, { x: o.x + len, y: o.y - len }, { x: o.x + len, y: o.y + len }, { x: o.x - len, y: o.y + len }]
    else if (shape === 'cone') pts = conePoints(o, t)
    else {
      const a = Math.atan2(t.y - o.y, t.x - o.x)
      const nx = (-Math.sin(a) * width) / 2
      const ny = (Math.cos(a) * width) / 2
      pts = [{ x: o.x + nx, y: o.y + ny }, { x: t.x + nx, y: t.y + ny }, { x: t.x - nx, y: t.y - ny }, { x: o.x - nx, y: o.y - ny }]
    }
    const s = new THREE.Shape(pts.map((p) => new THREE.Vector2(p.x, -p.y)))
    return new THREE.ShapeGeometry(s)
  }, [shape, o.x, o.y, t.x, t.y, width])
  return (
    <mesh geometry={geo} rotation={[-Math.PI / 2, 0, 0]} position={[0, 3, 0]} renderOrder={18}>
      <meshBasicMaterial color={color} transparent opacity={opacity} depthTest={false} side={THREE.DoubleSide} toneMapped={false} />
    </mesh>
  )
}

// ============================================================ Catálogo de efeitos

export const VFX_LIST: { id: string; label: string; icon: string; needsTarget: boolean }[] = [
  { id: 'fireball', label: 'Bola de fogo', icon: '🔥', needsTarget: false },
  { id: 'lightning', label: 'Relâmpago', icon: '⚡', needsTarget: true },
  { id: 'heal', label: 'Cura', icon: '💚', needsTarget: false },
  { id: 'frost', label: 'Gelo', icon: '❄️', needsTarget: false },
  { id: 'darkness', label: 'Escuridão', icon: '🌑', needsTarget: false },
  { id: 'arcane', label: 'Míssil arcano', icon: '✴️', needsTarget: true },
  { id: 'arrow', label: 'Flecha', icon: '🏹', needsTarget: true },
  { id: 'slash', label: 'Golpe', icon: '⚔️', needsTarget: false },
  { id: 'holy', label: 'Luz sagrada', icon: '🌟', needsTarget: false },
  { id: 'poison', label: 'Veneno', icon: '☠️', needsTarget: false },
]

type Active = { key: number; effect: string; x: number; y: number; tx?: number; ty?: number; color?: string }

function EffectView({ e, done }: { e: Active; done: () => void }) {
  const tx = e.tx ?? e.x
  const ty = e.ty ?? e.y
  switch (e.effect) {
    case 'fireball':
      return (
        <>
          <Flash x={e.x} y={e.y} color="#ff7a1a" radius={140} life={0.9} onDone={() => {}} />
          <Burst x={e.x} y={e.y} onDone={done} opts={{ count: 260, color: '#ffdd55', color2: '#ff3b0a', speed: 260, life: 1.4, gravity: -40, size: 14, spread: 30, up: 60 }} />
        </>
      )
    case 'frost':
      return (
        <>
          <Flash x={e.x} y={e.y} color="#7dd3fc" radius={120} life={0.8} onDone={() => {}} />
          <Burst x={e.x} y={e.y} onDone={done} opts={{ count: 200, color: '#e0f2fe', color2: '#38bdf8', speed: 180, life: 1.5, gravity: 30, size: 10, spread: 20, up: 20 }} />
        </>
      )
    case 'heal':
      return <Burst x={e.x} y={e.y} onDone={done} opts={{ count: 120, color: '#86efac', color2: '#fef08a', speed: 25, life: 1.8, gravity: -120, size: 10, spread: 40, up: 40 }} />
    case 'holy':
      return (
        <>
          <Flash x={e.x} y={e.y} color="#fef3c7" radius={90} life={1.2} onDone={() => {}} />
          <Burst x={e.x} y={e.y} onDone={done} opts={{ count: 160, color: '#fffbeb', color2: '#facc15', speed: 60, life: 1.6, gravity: -150, size: 12, spread: 30, up: 60 }} />
        </>
      )
    case 'darkness':
      return (
        <>
          <Flash x={e.x} y={e.y} color="#1e1b4b" radius={200} life={2.5} onDone={() => {}} />
          <Burst x={e.x} y={e.y} onDone={done} opts={{ count: 180, color: '#4c1d95', color2: '#0f172a', speed: 90, life: 2.5, gravity: 0, size: 26, spread: 80, up: 5 }} />
        </>
      )
    case 'poison':
      return <Burst x={e.x} y={e.y} onDone={done} opts={{ count: 160, color: '#84cc16', color2: '#14532d', speed: 70, life: 2.2, gravity: -10, size: 20, spread: 50, up: 10 }} />
    case 'slash':
      return <Burst x={e.x} y={e.y} onDone={done} opts={{ count: 60, color: '#ffffff', color2: '#fca5a5', speed: 300, life: 0.5, gravity: 0, size: 8, spread: 5, up: 0 }} />
    case 'lightning':
      return (
        <>
          <Bolt x={e.x} y={e.y} tx={tx} ty={ty} color="#bae6fd" onDone={done} />
          <Flash x={e.x} y={e.y} color="#e0f2fe" radius={60} life={0.5} onDone={() => {}} />
        </>
      )
    case 'arcane':
      return <ProjectileThen e={e} color="#c084fc" burst="#e9d5ff" done={done} />
    case 'arrow':
      return <ProjectileThen e={e} color="#d6d3d1" burst="#fafaf9" done={done} />
    default:
      if (e.effect.startsWith('aoe:')) return <AoeFlash shape={e.effect.slice(4) as AoeShape} x={e.x} y={e.y} tx={tx} ty={ty} color={e.color ?? '#f59e0b'} onDone={done} />
      return null
  }
}

function ProjectileThen({ e, color, burst, done }: { e: Active; color: string; burst: string; done: () => void }) {
  const [hit, setHit] = useState(false)
  if (!hit) return <Projectile x={e.x} y={e.y} tx={e.tx ?? e.x} ty={e.ty ?? e.y} color={color} onDone={() => setHit(true)} />
  return <Burst x={e.x} y={e.y} onDone={done} opts={{ count: 80, color: burst, color2: color, speed: 160, life: 0.6, gravity: 0, size: 9, spread: 4, up: 20 }} />
}

export function VfxLayer() {
  const [list, setList] = useState<Active[]>([])
  const lowFx = useGame((s) => s.lowFx)
  useEffect(
    () =>
      onLive((ev) => {
        if (ev.type !== 'vfx') return
        setList((l) => [...l, { key: Math.random(), effect: ev.effect, x: ev.x, y: ev.y, tx: ev.tx, ty: ev.ty, color: ev.color }])
        if (!lowFx && ['fireball', 'lightning', 'darkness'].includes(ev.effect)) window.dispatchEvent(new Event('table-shake'))
      }),
    [lowFx],
  )
  return (
    <>
      {list.map((e) => (
        <EffectView key={e.key} e={e} done={() => setList((l) => l.filter((x) => x.key !== e.key))} />
      ))}
    </>
  )
}

// ============================================================ Pings

export function PingLayer() {
  const [pings, setPings] = useState<{ id: number; x: number; y: number; color: string }[]>([])
  useEffect(
    () =>
      onLive((e) => {
        if (e.type !== 'ping') return
        const key = Math.random()
        setPings((p) => [...p, { id: key, x: e.x, y: e.y, color: e.color }])
        setTimeout(() => setPings((p) => p.filter((x) => x.id !== key)), 2000)
      }),
    [],
  )
  return (
    <>
      {pings.map((p) => (
        <PingRing key={p.id} x={p.x} y={p.y} color={p.color} />
      ))}
    </>
  )
}

function PingRing({ x, y, color }: { x: number; y: number; color: string }) {
  const refs = [useRef<THREE.Mesh>(null), useRef<THREE.Mesh>(null)]
  const t = useRef(0)
  useFrame((_, dt) => {
    t.current += dt
    refs.forEach((r, i) => {
      const k = ((t.current + i * 0.5) % 1) / 1
      if (r.current) {
        r.current.scale.setScalar(20 + k * 80)
        ;(r.current.material as THREE.MeshBasicMaterial).opacity = (1 - k) * Math.max(0, 1 - t.current / 2)
      }
    })
  })
  return (
    <>
      {refs.map((r, i) => (
        <mesh key={i} ref={r} position={[x, 7, y]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={22}>
          <ringGeometry args={[0.8, 1, 48]} />
          <meshBasicMaterial color={color} transparent depthTest={false} toneMapped={false} />
        </mesh>
      ))}
    </>
  )
}

// ============================================================ Clima

const WEATHER: Record<Exclude<Weather, 'none'>, { color: string; color2: string; size: number; vy: number; vx: number; up?: boolean; drift: number; opacity: number; count: number }> = {
  rain: { color: '#93c5fd', color2: '#dbeafe', size: 5, vy: 0, vx: 260, drift: 0, opacity: 0.6, count: 1600 },
  snow: { color: '#ffffff', color2: '#e2e8f0', size: 9, vy: 0, vx: 50, drift: 40, opacity: 0.85, count: 1200 },
  embers: { color: '#fb923c', color2: '#fde047', size: 7, vy: 0, vx: -40, up: true, drift: 30, opacity: 0.9, count: 500 },
  leaves: { color: '#ca8a04', color2: '#65a30d', size: 14, vy: 0, vx: 90, drift: 60, opacity: 0.9, count: 300 },
  fog: { color: '#cbd5e1', color2: '#94a3b8', size: 260, vy: 0, vx: 15, drift: 10, opacity: 0.08, count: 120 },
}

export function WeatherLayer({ scene }: { scene: Scene }) {
  const lowFx = useGame((s) => s.lowFx)
  if (scene.weather === 'none') return null
  return <WeatherPoints key={scene.weather + scene.id + lowFx} kind={scene.weather} w={scene.map_w} h={scene.map_h} low={lowFx} />
}

function WeatherPoints({ kind, w, h, low }: { kind: Exclude<Weather, 'none'>; w: number; h: number; low: boolean }) {
  const cfg = WEATHER[kind]
  const count = Math.round(cfg.count * (low ? 0.3 : 1))
  const ref = useRef<THREE.Points>(null)
  const { geo, seeds } = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const pos = new Float32Array(count * 3)
    const col = new Float32Array(count * 3)
    const sd = new Float32Array(count)
    const c1 = new THREE.Color(cfg.color)
    const c2 = new THREE.Color(cfg.color2)
    for (let i = 0; i < count; i++) {
      pos.set([Math.random() * w, 20, Math.random() * h], i * 3)
      const c = c1.clone().lerp(c2, Math.random())
      col.set([c.r, c.g, c.b], i * 3)
      sd[i] = Math.random() * 100
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    return { geo: g, seeds: sd }
  }, [count, w, h, cfg])
  const t = useRef(0)
  useFrame((_, dt) => {
    t.current += dt
    const p = geo.attributes.position as THREE.BufferAttribute
    const a = p.array as Float32Array
    const fall = kind === 'rain' ? 900 : kind === 'snow' ? 90 : kind === 'leaves' ? 70 : kind === 'embers' ? -60 : 5
    for (let i = 0; i < count; i++) {
      const s = seeds[i]
      a[i * 3] += (cfg.vx + Math.sin(t.current + s) * cfg.drift) * dt
      a[i * 3 + 2] += (fall + Math.cos(t.current * 0.7 + s) * cfg.drift) * dt
      if (a[i * 3] > w) a[i * 3] -= w
      if (a[i * 3] < 0) a[i * 3] += w
      if (a[i * 3 + 2] > h) a[i * 3 + 2] -= h
      if (a[i * 3 + 2] < 0) a[i * 3 + 2] += h
    }
    p.needsUpdate = true
  })
  return (
    <points ref={ref} geometry={geo} renderOrder={15}>
      <pointsMaterial
        map={softDot()}
        vertexColors
        size={cfg.size}
        sizeAttenuation
        transparent
        opacity={cfg.opacity}
        depthWrite={false}
        depthTest={false}
        blending={kind === 'embers' ? THREE.AdditiveBlending : THREE.NormalBlending}
        toneMapped={false}
      />
    </points>
  )
}
