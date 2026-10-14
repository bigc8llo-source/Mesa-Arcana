import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { ChatMessage } from '../types'
import { useGame } from '../store/game'
import { dieShape, labelTexture } from './diceGeometry'
import { simulate, type SimResult } from './simulate'
import { cn } from '../components/ui'
import { sfx } from '../audio/sfx'

const VISUAL = new Set([4, 6, 8, 10, 12, 20, 100])
const MAX_VISUAL_DICE = 12

interface Job {
  msg: ChatMessage
  sim: SimResult
  color: string
  ink: string
}

function inkFor(hex: string) {
  const c = new THREE.Color(hex)
  return c.r * 0.299 + c.g * 0.587 + c.b * 0.114 > 0.6 ? '#1a1325' : '#fff7e0'
}

/** Expande os grupos da rolagem em dados visuais (d100 vira dezena + unidade). */
function visualDice(msg: ChatMessage): { sides: number; value: string; others: string[] }[] {
  const out: { sides: number; value: string; others: string[] }[] = []
  for (const g of msg.roll?.groups ?? []) {
    if (!VISUAL.has(g.sides)) continue
    for (const d of g.dice) {
      if (out.length >= MAX_VISUAL_DICE) break
      if (g.sides === 100) {
        const tens = Math.floor((d.value % 100) / 10) * 10
        out.push({ sides: 10, value: String(tens).padStart(2, '0'), others: Array.from({ length: 10 }, (_, i) => String(i * 10).padStart(2, '0')).filter((x) => x !== String(tens).padStart(2, '0')) })
        const unit = d.value % 10
        out.push({ sides: 10, value: String(unit), others: Array.from({ length: 10 }, (_, i) => String(i)).filter((x) => x !== String(unit)) })
      } else {
        const all = Array.from({ length: g.sides }, (_, i) => String(i + 1))
        out.push({ sides: g.sides, value: String(d.value), others: all.filter((x) => x !== String(d.value)) })
      }
    }
  }
  return out
}

function Die({ die, color, ink, frameRef, index }: { die: SimResult['dice'][number]; color: string; ink: string; frameRef: React.RefObject<number>; index: number }) {
  const shape = dieShape(die.sides)
  const ref = useRef<THREE.Group>(null)
  const nFrames = die.frames.length / 7
  useFrame(() => {
    const g = ref.current
    if (!g) return
    const f = Math.min(nFrames - 1, Math.floor(frameRef.current ?? 0))
    const a = die.frames
    g.position.set(a[f * 7], a[f * 7 + 1], a[f * 7 + 2])
    g.quaternion.set(a[f * 7 + 3], a[f * 7 + 4], a[f * 7 + 5], a[f * 7 + 6])
  })
  const labels = useMemo(() => {
    if (shape.readBottom && die.vertexLabels) {
      // d4: em cada face, um número perto de cada canto, "em pé" apontando para o canto
      const out: { pos: THREE.Vector3; q: THREE.Quaternion; text: string }[] = []
      shape.faces.forEach((face, fi) => {
        for (const vi of shape.faceVertices[fi]) {
          const v = shape.vertices[vi]
          const up = v.clone().sub(face.center).normalize()
          const z = face.normal.clone()
          const x = new THREE.Vector3().crossVectors(up, z).normalize()
          const m = new THREE.Matrix4().makeBasis(x, up, z)
          out.push({ pos: face.center.clone().lerp(v, 0.5).addScaledVector(z, 0.01), q: new THREE.Quaternion().setFromRotationMatrix(m), text: die.vertexLabels![vi] })
        }
      })
      return out
    }
    return shape.faces.map((face, i) => {
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), face.normal)
      return { pos: face.center.clone().addScaledVector(face.normal, 0.01), q, text: die.faceLabels[i] }
    })
  }, [shape, die.faceLabels, die.vertexLabels])
  return (
    <group ref={ref} name={`die-${index}`}>
      <mesh geometry={shape.geometry} castShadow>
        <meshStandardMaterial color={color} metalness={0.25} roughness={0.35} flatShading />
      </mesh>
      {labels.map((l, i) =>
          l.text ? (
            <mesh key={i} position={l.pos} quaternion={l.q} scale={shape.readBottom ? 0.55 : shape.labelScale}>
              <planeGeometry />
              <meshBasicMaterial map={labelTexture(l.text, ink)} transparent depthWrite={false} toneMapped={false} />
            </mesh>
          ) : null,
        )}
    </group>
  )
}

function Scene3D({ job, onDone, onSettled }: { job: Job; onDone: () => void; onSettled: () => void }) {
  const frame = useRef(0)
  const t = useRef(0)
  const settled = useRef(false)
  // sons de quique: quando um dado muda de direção vertical perto do chão
  const lastVy = useRef<number[]>([])
  useEffect(() => {
    sfx('dadoAgitar', { volume: 0.5 })
  }, [])
  const { camera } = useThree()
  useEffect(() => {
    camera.position.set(0, 26, 9)
    camera.lookAt(0, 0, 0)
  }, [camera])
  useFrame((_, dt) => {
    const before = Math.floor(frame.current)
    frame.current += dt * 60
    const now = Math.min(job.sim.frameCount - 1, Math.floor(frame.current))
    for (let f = Math.max(1, before); f <= now; f++)
      job.sim.dice.forEach((d, i) => {
        const y0 = d.frames[(f - 1) * 7 + 1]
        const y1 = d.frames[f * 7 + 1]
        if (y1 === undefined) return
        const vy = y1 - y0
        const prevVy = lastVy.current[i] ?? 0
        if (prevVy < -0.04 && vy > -0.005 && y1 < 2.2) sfx('dado', { volume: Math.min(1, -prevVy * 4), gap: 40 })
        lastVy.current[i] = vy
      })
    if (frame.current >= job.sim.frameCount - 1) {
      if (!settled.current) {
        settled.current = true
        onSettled()
      }
      t.current += dt
      if (t.current > 3) onDone()
    }
  })
  return (
    <>
      <ambientLight intensity={1.2} />
      <directionalLight position={[6, 20, 8]} intensity={2.2} castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-20} shadow-camera-right={20} shadow-camera-top={20} shadow-camera-bottom={-20} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[80, 80]} />
        <shadowMaterial opacity={0.35} />
      </mesh>
      {job.sim.dice.map((d, i) => (
        <Die key={i} index={i} die={d} color={job.color} ink={job.ink} frameRef={frame} />
      ))}
    </>
  )
}

export function DiceOverlay() {
  const chat = useGame((s) => s.chat)
  const members = useGame((s) => s.members)
  const lowFx = useGame((s) => s.lowFx)
  const seen = useRef(new Set<string>())
  const initial = useRef(true)
  const [queue, setQueue] = useState<Job[]>([])
  const [badge, setBadge] = useState<ChatMessage | null>(null)
  const [aspect, setAspect] = useState(() => innerWidth / innerHeight)

  useEffect(() => {
    const f = () => setAspect(innerWidth / innerHeight)
    addEventListener('resize', f)
    return () => removeEventListener('resize', f)
  }, [])

  useEffect(() => {
    const msgs = Object.values(chat)
    if (initial.current) {
      msgs.forEach((m) => seen.current.add(m.id))
      initial.current = false
      return
    }
    for (const m of msgs) {
      if (seen.current.has(m.id)) continue
      seen.current.add(m.id)
      if (m.kind !== 'roll' || !m.roll) continue
      if (Date.now() - new Date(m.created_at).getTime() > 20000) continue
      const dice = visualDice(m)
      const member = Object.values(members).find((x) => x.user_id === m.author_id)
      const color = m.visibility === 'gm' ? '#4b5563' : (member?.color ?? '#7c3aed')
      if (dice.length === 0 || lowFx) {
        setBadge(m)
        setTimeout(() => setBadge((b) => (b?.id === m.id ? null : b)), 3000)
        continue
      }
      // arena proporcional à área visível (celular em pé = arena estreita e alta): dados sempre no centro da tela
      const visibleD = 21
      const visibleW = visibleD * aspect
      const arenaW = Math.max(6, visibleW * (aspect < 1 ? 0.72 : 0.6))
      const arenaD = visibleD * (aspect < 1 ? 0.55 : 0.75)
      void simulate(dice, m.seed || 1, { w: arenaW, d: arenaD }).then((sim) => setQueue((q) => [...q, { msg: m, sim, color, ink: inkFor(color) }]))
    }
  }, [chat, members, lowFx, aspect])

  const job = queue[0]
  return (
    <>
      {job && (
        <div className="pointer-events-none fixed inset-0 z-[90]" data-testid="dice-overlay">
          <Canvas shadows camera={{ fov: 45, position: [0, 26, 9] }} gl={{ alpha: true }}>
            <Scene3D
              key={job.msg.id}
              job={job}
              onSettled={() => {
                setBadge(job.msg)
                if (job.msg.roll?.crit === 'success') sfx('critico')
                if (job.msg.roll?.crit === 'fail') sfx('falha')
              }}
              onDone={() => {
                setQueue((q) => q.slice(1))
                setBadge((b) => (b?.id === job.msg.id ? null : b))
              }}
            />
          </Canvas>
        </div>
      )}
      {badge?.roll && (
        <div className="pointer-events-none fixed left-1/2 top-[14%] z-[91] -translate-x-1/2 animate-pop" data-testid="roll-badge">
          <div
            className={cn(
              'rounded-2xl border px-6 py-3 text-center shadow-2xl backdrop-blur',
              badge.roll.crit === 'success' ? 'border-gold-400 bg-amber-900/80 glow-gold' : badge.roll.crit === 'fail' ? 'border-red-500 bg-red-950/80' : 'border-ink-600 bg-ink-900/85',
            )}
          >
            <p className="text-xs uppercase tracking-widest text-parch-300">
              {badge.character_name ?? badge.author_name}
              {badge.label ? ` · ${badge.label}` : ''}
            </p>
            <p className="font-display text-5xl font-extrabold text-gold-400">{badge.roll.total}</p>
            {badge.roll.crit === 'success' && <p className="text-sm font-bold text-gold-400">CRÍTICO!</p>}
            {badge.roll.crit === 'fail' && <p className="text-sm font-bold text-red-400">Falha crítica</p>}
          </div>
        </div>
      )}
    </>
  )
}
