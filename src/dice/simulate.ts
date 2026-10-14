import type RapierNS from '@dimforge/rapier3d-compat'
import * as THREE from 'three'
import { mulberry32 } from '../engine/dice'
import { dieShape } from './diceGeometry'

// Rapier (física em WASM) só é baixado quando a mesa abre — fora do pacote inicial.
let RAPIER: typeof RapierNS
let ready: Promise<void> | null = null
export function initPhysics() {
  if (!ready)
    ready = import('@dimforge/rapier3d-compat').then(async (m) => {
      RAPIER = m.default
      await RAPIER.init()
    })
  return ready
}

export interface SimDie {
  sides: number
  /** Valores a mostrar em cada face (índice = face lógica). */
  faceLabels: string[]
  /** Face que ficou para cima (ou para baixo no d4). */
  resultFace: number
  frames: Float32Array // [x,y,z,qx,qy,qz,qw] por quadro
}

export interface SimResult {
  dice: SimDie[]
  frameCount: number
}

const STEP = 1 / 60
const MAX_FRAMES = 60 * 6

/**
 * Simula toda a rolagem antes de mostrar. Depois descobre qual face ficou para cima e
 * escreve o valor sorteado nela — assim a animação é física e o resultado é sempre o sorteado.
 */
export async function simulate(dice: { sides: number; value: string; others: string[] }[], seed: number, arena: { w: number; d: number }): Promise<SimResult> {
  await initPhysics()
  const rng = mulberry32(seed ^ 0x9e3779b9)
  const world = new RAPIER.World({ x: 0, y: -60, z: 0 })
  const ground = world.createRigidBody(RAPIER.RigidBodyDesc.fixed())
  world.createCollider(RAPIER.ColliderDesc.cuboid(arena.w, 0.5, arena.d).setTranslation(0, -0.5, 0).setFriction(0.8).setRestitution(0.3), ground)
  const wall = (x: number, z: number, hx: number, hz: number) => world.createCollider(RAPIER.ColliderDesc.cuboid(hx, 20, hz).setTranslation(x, 20, z).setRestitution(0.4), ground)
  wall(arena.w / 2 + 0.5, 0, 0.5, arena.d)
  wall(-arena.w / 2 - 0.5, 0, 0.5, arena.d)
  wall(0, arena.d / 2 + 0.5, arena.w, 0.5)
  wall(0, -arena.d / 2 - 0.5, arena.w, 0.5)

  const bodies = dice.map((d, i) => {
    const shape = dieShape(d.sides)
    const side = rng() < 0.5 ? -1 : 1
    const x = side * (arena.w / 2 - 1.5)
    const z = (rng() - 0.5) * arena.d * 0.6
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rng() * 6.28, rng() * 6.28, rng() * 6.28))
    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(x, 4 + i * 1.6, z)
        .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w })
        .setLinvel(-side * (14 + rng() * 10), 2 + rng() * 4, (rng() - 0.5) * 12)
        .setAngvel({ x: (rng() - 0.5) * 30, y: (rng() - 0.5) * 30, z: (rng() - 0.5) * 30 })
        .setCanSleep(true)
        .setLinearDamping(0.1)
        .setAngularDamping(0.2),
    )
    const col = RAPIER.ColliderDesc.convexHull(shape.hull)!.setRestitution(0.35).setFriction(0.6).setDensity(1.2)
    world.createCollider(col, body)
    return body
  })

  const frames = dice.map(() => new Float32Array(MAX_FRAMES * 7))
  let n = 0
  let calm = 0
  for (; n < MAX_FRAMES; n++) {
    world.timestep = STEP
    world.step()
    let allSlow = true
    bodies.forEach((b, i) => {
      const t = b.translation()
      const r = b.rotation()
      frames[i].set([t.x, t.y, t.z, r.x, r.y, r.z, r.w], n * 7)
      const v = b.linvel()
      const w = b.angvel()
      if (Math.hypot(v.x, v.y, v.z) > 0.05 || Math.hypot(w.x, w.y, w.z) > 0.05) allSlow = false
    })
    calm = allSlow ? calm + 1 : 0
    if (calm > 20) {
      n++
      break
    }
  }

  const up = new THREE.Vector3(0, 1, 0)
  const result: SimDie[] = dice.map((d, i) => {
    const shape = dieShape(d.sides)
    const f = frames[i]
    const k = (n - 1) * 7
    const q = new THREE.Quaternion(f[k + 3], f[k + 4], f[k + 5], f[k + 6])
    let best = 0
    let bestDot = shape.readBottom ? Infinity : -Infinity
    shape.faces.forEach((face, idx) => {
      const dot = face.normal.clone().applyQuaternion(q).dot(up)
      if (shape.readBottom ? dot < bestDot : dot > bestDot) {
        bestDot = dot
        best = idx
      }
    })
    // distribui os outros números pelas demais faces
    const others = [...d.others]
    for (let j = others.length - 1; j > 0; j--) {
      const r = Math.floor(rng() * (j + 1))
      ;[others[j], others[r]] = [others[r], others[j]]
    }
    const faceLabels = shape.faces.map((_, idx) => (idx === best ? d.value : (others.pop() ?? '')))
    return { sides: d.sides, faceLabels, resultFace: best, frames: f.slice(0, n * 7) }
  })
  world.free()
  return { dice: result, frameCount: n }
}
