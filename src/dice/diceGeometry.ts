import * as THREE from 'three'

export interface DieShape {
  sides: number
  geometry: THREE.BufferGeometry
  /** Faces lógicas: centro e normal em coordenadas locais. */
  faces: { center: THREE.Vector3; normal: THREE.Vector3 }[]
  hull: Float32Array
  /** d4 lê o resultado pela face de baixo e mostra o número flutuando. */
  readBottom: boolean
  labelScale: number
}

function d10Geometry(): THREE.BufferGeometry {
  const h = 1
  // acha e para que cada "pipa" seja plana
  const build = (e: number) => {
    const up: THREE.Vector3[] = []
    const lo: THREE.Vector3[] = []
    for (let i = 0; i < 5; i++) {
      const a = (i * 2 * Math.PI) / 5
      const b = a + Math.PI / 5
      up.push(new THREE.Vector3(Math.cos(a), e, Math.sin(a)))
      lo.push(new THREE.Vector3(Math.cos(b), -e, Math.sin(b)))
    }
    return { up, lo }
  }
  const planarity = (e: number) => {
    const { up, lo } = build(e)
    const T = new THREE.Vector3(0, h, 0)
    const n = new THREE.Vector3().subVectors(up[0], T).cross(new THREE.Vector3().subVectors(lo[0], T)).normalize()
    return n.dot(new THREE.Vector3().subVectors(up[1], T))
  }
  let lo = 0.0
  let hi = 0.5
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2
    if (Math.sign(planarity(mid)) === Math.sign(planarity(lo))) lo = mid
    else hi = mid
  }
  const { up, lo: low } = build((lo + hi) / 2)
  const T = new THREE.Vector3(0, h, 0)
  const B = new THREE.Vector3(0, -h, 0)
  const pos: number[] = []
  const tri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z)
  for (let i = 0; i < 5; i++) {
    const n = (i + 1) % 5
    // pipa de cima: T, up[n], low[i], up[i]
    tri(T, up[n], low[i])
    tri(T, low[i], up[i])
    // pipa de baixo: B, low[i], up[n], low[n]
    tri(B, low[i], up[n])
    tri(B, up[n], low[n])
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.computeVertexNormals()
  return g
}

function groupFaces(geo: THREE.BufferGeometry, tolerance = 0.995) {
  const p = geo.attributes.position
  const faces: { normal: THREE.Vector3; sum: THREE.Vector3; n: number }[] = []
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const c = new THREE.Vector3()
  for (let i = 0; i < p.count; i += 3) {
    a.fromBufferAttribute(p, i)
    b.fromBufferAttribute(p, i + 1)
    c.fromBufferAttribute(p, i + 2)
    const normal = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).normalize()
    const center = new THREE.Vector3().add(a).add(b).add(c).divideScalar(3)
    if (normal.dot(center) < 0) normal.negate()
    const f = faces.find((x) => x.normal.dot(normal) > tolerance)
    if (f) {
      f.sum.add(center)
      f.n++
    } else faces.push({ normal, sum: center.clone(), n: 1 })
  }
  return faces.map((f) => {
    // centro da face = projeção do centroide no plano da face
    const centroid = f.sum.divideScalar(f.n)
    return { normal: f.normal, center: f.normal.clone().multiplyScalar(centroid.dot(f.normal)) }
  })
}

/** Garante que todos os triângulos apontem para fora (iluminação e culling corretos). */
function fixWinding(geo: THREE.BufferGeometry) {
  const p = geo.attributes.position as THREE.BufferAttribute
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const c = new THREE.Vector3()
  for (let i = 0; i < p.count; i += 3) {
    a.fromBufferAttribute(p, i)
    b.fromBufferAttribute(p, i + 1)
    c.fromBufferAttribute(p, i + 2)
    const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a))
    const center = new THREE.Vector3().add(a).add(b).add(c)
    if (n.dot(center) < 0) {
      p.setXYZ(i + 1, c.x, c.y, c.z)
      p.setXYZ(i + 2, b.x, b.y, b.z)
    }
  }
  p.needsUpdate = true
}

const cache = new Map<number, DieShape>()

export function dieShape(sides: number): DieShape {
  const cached = cache.get(sides)
  if (cached) return cached
  let geo: THREE.BufferGeometry
  let labelScale = 0.55
  switch (sides) {
    case 4:
      geo = new THREE.TetrahedronGeometry(1.2)
      break
    case 6:
      geo = new THREE.BoxGeometry(1.4, 1.4, 1.4).toNonIndexed()
      labelScale = 0.8
      break
    case 8:
      geo = new THREE.OctahedronGeometry(1.15)
      labelScale = 0.5
      break
    case 10:
      geo = d10Geometry()
      labelScale = 0.45
      break
    case 12:
      geo = new THREE.DodecahedronGeometry(1.15)
      labelScale = 0.5
      break
    default:
      geo = new THREE.IcosahedronGeometry(1.2)
      labelScale = 0.42
  }
  geo = geo.index ? geo.toNonIndexed() : geo
  geo.deleteAttribute('uv')
  fixWinding(geo)
  geo.computeVertexNormals()
  const faces = groupFaces(geo)
  const hull = new Float32Array(geo.attributes.position.array)
  const shape: DieShape = { sides, geometry: geo, faces, hull, readBottom: sides === 4, labelScale }
  cache.set(sides, shape)
  return shape
}

const labelCache = new Map<string, THREE.Texture>()
export function labelTexture(text: string, ink: string): THREE.Texture {
  const key = `${text}|${ink}`
  let t = labelCache.get(key)
  if (t) return t
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const ctx = c.getContext('2d')!
  ctx.fillStyle = ink
  ctx.font = `bold ${text.length > 2 ? 54 : text.length > 1 ? 66 : 84}px Georgia, serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, 64, 70)
  if (text === '6' || text === '9') ctx.fillRect(40, 108, 48, 7)
  t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  labelCache.set(key, t)
  return t
}
