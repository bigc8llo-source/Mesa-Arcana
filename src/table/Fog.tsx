import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Scene, Token } from '../types'
import { useGame, useIsGm } from '../store/game'
import { crossesWall, sightBlockers, visibilityPolygon, type Pt, type Seg } from '../engine/geometry'
import { canControl } from '../game/actions'
import { displayPos, useVision } from './vision'

const MAX_TEX = 1024

interface Source {
  x: number
  y: number
  range: number // px (Infinity = ilimitado)
  dark: number // visão no escuro (px)
}

function polyPath(ctx: CanvasRenderingContext2D, pts: Pt[] | number[], s: number) {
  ctx.beginPath()
  if (typeof pts[0] === 'number') {
    const a = pts as number[]
    for (let i = 0; i < a.length; i += 2) (i === 0 ? ctx.moveTo : ctx.lineTo).call(ctx, a[i] * s, a[i + 1] * s)
  } else (pts as Pt[]).forEach((p, i) => (i === 0 ? ctx.moveTo(p.x * s, p.y * s) : ctx.lineTo(p.x * s, p.y * s)))
  ctx.closePath()
}

/**
 * Desenha a névoa num canvas: preto = escondido, transparente = visível.
 * - Névoa manual: polígonos revelar/esconder do mestre.
 * - Visão dinâmica: polígono de visibilidade de cada token ∩ áreas iluminadas (ou visão no escuro).
 * - "Explorado": o que já foi visto fica em penumbra.
 */
class FogPainter {
  fog = document.createElement('canvas')
  vis = document.createElement('canvas')
  explored = document.createElement('canvas')
  tmp = document.createElement('canvas')
  mask = document.createElement('canvas')
  light = document.createElement('canvas') // branco = iluminado
  glow = document.createElement('canvas') // cor das luzes (brilho aditivo)
  manual = document.createElement('canvas')
  scale = 1
  sceneId = ''

  resize(scene: Scene) {
    const s = Math.min(1, MAX_TEX / Math.max(scene.map_w, scene.map_h))
    const w = Math.ceil(scene.map_w * s)
    const h = Math.ceil(scene.map_h * s)
    if (this.sceneId !== scene.id || this.fog.width !== w || this.fog.height !== h) {
      for (const c of [this.fog, this.vis, this.explored, this.tmp, this.mask, this.light, this.glow, this.manual]) {
        c.width = w
        c.height = h
      }
      this.scale = s
      this.sceneId = scene.id
      this.loadExplored(scene.id)
    }
  }

  private key(id: string) {
    return `mesa-arcana:explored:${id}`
  }
  loadExplored(id: string) {
    try {
      const data = localStorage.getItem(this.key(id))
      if (!data) return
      const img = new Image()
      img.onload = () => this.explored.getContext('2d')!.drawImage(img, 0, 0, this.explored.width, this.explored.height)
      img.src = data
    } catch {
      /* sem armazenamento */
    }
  }
  saveExplored() {
    try {
      localStorage.setItem(this.key(this.sceneId), this.explored.toDataURL('image/webp', 0.5))
    } catch {
      /* cota cheia */
    }
  }
  clearExplored() {
    this.explored.getContext('2d')!.clearRect(0, 0, this.explored.width, this.explored.height)
    this.saveExplored()
  }

  /** Mapa de iluminação: luz ambiente + cada luz recortada pelas paredes. */
  paintLight(scene: Scene, lights: { x: number; y: number; bright: number; dim: number; color: string; flicker: boolean }[], time: number) {
    const s = this.scale
    const W = this.light.width
    const H = this.light.height
    const segs = sightBlockers(scene.walls)
    const bounds = { w: scene.map_w, h: scene.map_h }
    const lctx = this.light.getContext('2d')!
    const gctx = this.glow.getContext('2d')!
    lctx.globalCompositeOperation = 'source-over'
    lctx.clearRect(0, 0, W, H)
    gctx.clearRect(0, 0, W, H)
    lctx.fillStyle = `rgba(255,255,255,${Math.min(1, scene.ambient)})`
    lctx.fillRect(0, 0, W, H)
    lctx.globalCompositeOperation = 'lighter'
    lights.forEach((l, i) => {
      const f = l.flicker ? 1 + 0.07 * Math.sin(time * 9 + i * 1.7) + 0.04 * Math.sin(time * 23 + i) : 1
      const dim = l.dim * f
      if (dim <= 0) return
      const poly = visibilityPolygon(l, segs, bounds, dim)
      const k = Math.min(0.99, Math.max(0.01, l.bright / l.dim))
      for (const [ctx, color, a] of [
        [lctx, '255,255,255', 1],
        [gctx, hexRgb(l.color), 0.55],
      ] as const) {
        ctx.save()
        polyPath(ctx, poly, s)
        ctx.clip()
        const g = ctx.createRadialGradient(l.x * s, l.y * s, 0, l.x * s, l.y * s, Math.max(1, dim * s))
        g.addColorStop(0, `rgba(${color},${a})`)
        g.addColorStop(k, `rgba(${color},${a * 0.85})`)
        g.addColorStop(1, `rgba(${color},0)`)
        ctx.fillStyle = g
        ctx.fillRect(0, 0, W, H)
        ctx.restore()
      }
    })
    lctx.globalCompositeOperation = 'source-over'
  }

  paint(scene: Scene, sources: Source[], gm: boolean) {
    const s = this.scale
    const W = this.fog.width
    const H = this.fog.height
    const segs: Seg[] = sightBlockers(scene.walls)
    const bounds = { w: scene.map_w, h: scene.map_h }
    const vctx = this.vis.getContext('2d')!
    vctx.clearRect(0, 0, W, H)

    const useVision = scene.vision_enabled && sources.length > 0
    if (useVision) {
      const tctx = this.tmp.getContext('2d')!
      for (const src of sources) {
        tctx.globalCompositeOperation = 'source-over'
        tctx.clearRect(0, 0, W, H)
        // 1) iluminação
        tctx.drawImage(this.light, 0, 0)
        if (src.dark > 0 && scene.ambient < 1) {
          tctx.fillStyle = 'rgba(255,255,255,0.75)'
          tctx.beginPath()
          tctx.arc(src.x * s, src.y * s, src.dark * s, 0, Math.PI * 2)
          tctx.fill()
        }
        // 2) ∩ linha de visão — a máscara é desenhada à parte e aplicada sobre o canvas inteiro
        // (destination-in com clip só afetaria a área recortada)
        const mctx = this.mask.getContext('2d')!
        mctx.clearRect(0, 0, W, H)
        const poly = visibilityPolygon(src, segs, bounds, src.range)
        mctx.fillStyle = '#fff'
        mctx.save()
        polyPath(mctx, poly, s)
        mctx.clip()
        if (Number.isFinite(src.range)) {
          mctx.beginPath()
          mctx.arc(src.x * s, src.y * s, src.range * s, 0, Math.PI * 2)
        } else mctx.rect(0, 0, W, H)
        mctx.fill()
        mctx.restore()
        tctx.globalCompositeOperation = 'destination-in'
        tctx.drawImage(this.mask, 0, 0)
        tctx.globalCompositeOperation = 'source-over'
        vctx.globalCompositeOperation = 'lighter'
        vctx.drawImage(this.tmp, 0, 0)
        vctx.globalCompositeOperation = 'source-over'
      }
      // acumula "explorado"
      const ectx = this.explored.getContext('2d')!
      ectx.drawImage(this.vis, 0, 0)
    }

    // ---- composição final: escuridão + névoa manual + visão
    const f = this.fog.getContext('2d')!
    f.globalCompositeOperation = 'source-over'
    f.globalAlpha = 1
    f.clearRect(0, 0, W, H)
    const dark = scene.ambient < 1
    if (useVision) {
      f.fillStyle = '#05040a'
      f.fillRect(0, 0, W, H)
      f.globalCompositeOperation = 'destination-out'
      f.globalAlpha = 0.55
      f.drawImage(this.explored, 0, 0)
      f.globalAlpha = 1
      f.drawImage(this.vis, 0, 0)
    } else if (dark) {
      // sem visão (mestre, ou visão dinâmica desligada): só a escuridão onde não há luz
      f.fillStyle = '#05040a'
      f.fillRect(0, 0, W, H)
      f.globalCompositeOperation = 'destination-out'
      f.drawImage(this.light, 0, 0)
    }
    f.globalCompositeOperation = 'source-over'
    if (scene.fog_enabled && !(useVision && scene.vision_enabled)) {
      const m = this.manual.getContext('2d')!
      m.globalCompositeOperation = 'source-over'
      m.clearRect(0, 0, W, H)
      m.fillStyle = '#05040a'
      m.fillRect(0, 0, W, H)
      for (const shape of scene.fog) {
        m.globalCompositeOperation = shape.mode === 'reveal' ? 'destination-out' : 'source-over'
        polyPath(m, shape.points, s)
        m.fill()
      }
      m.globalCompositeOperation = 'source-over'
      f.drawImage(this.manual, 0, 0)
    } else if (scene.fog_enabled && useVision) {
      // névoa manual "esconder" vale mesmo com visão; "revelar" soma à visão
      for (const shape of scene.fog) {
        f.globalCompositeOperation = shape.mode === 'reveal' ? 'destination-out' : 'source-over'
        f.fillStyle = '#05040a'
        polyPath(f, shape.points, s)
        f.fill()
      }
      f.globalCompositeOperation = 'source-over'
    }
    void gm
  }

  /** Um ponto está coberto pela névoa (para esconder tokens alheios)? */
  covered(x: number, y: number): boolean {
    const px = Math.floor(x * this.scale)
    const py = Math.floor(y * this.scale)
    if (px < 0 || py < 0 || px >= this.fog.width || py >= this.fog.height) return true
    const a = this.fog.getContext('2d', { willReadFrequently: true })!.getImageData(px, py, 1, 1).data[3]
    return a > 150
  }
}

function hexRgb(hex: string) {
  const n = parseInt(hex.replace('#', '').slice(0, 6), 16) || 0xffcf7a
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`
}

const painter = new FogPainter()
export function clearExploredFog() {
  painter.clearExplored()
}

function visionSources(scene: Scene, tokens: Token[], gm: boolean): { sources: Source[]; mine: Token[] } {
  const cell = scene.grid.size
  const inScene = tokens.filter((t) => t.scene_id === scene.id && !t.hidden)
  let mine = gm ? [] : inScene.filter((t) => canControl(t) && t.vision > 0)
  if (!gm && mine.length === 0) mine = inScene.filter((t) => t.vision > 0 && t.owner_ids.length > 0)
  if (useGame.getState().previewAsPlayer) mine = inScene.filter((t) => t.vision > 0 && (t.owner_ids.length > 0 || isPc(t)))
  return {
    mine,
    sources: mine.map((t) => {
      // durante um arrasto a visão acompanha o token, mas nunca "espia" através de paredes
      let p = displayPos.get(t.id) ?? { x: t.x, y: t.y }
      if (crossesWall({ x: t.x, y: t.y }, p, scene.walls)) p = { x: t.x, y: t.y }
      return { x: p.x, y: p.y, range: t.vision >= 999 ? Infinity : t.vision * cell, dark: t.darkvision * cell }
    }),
  }
}
function isPc(t: Token) {
  const c = t.character_id ? useGame.getState().characters[t.character_id] : null
  return c?.kind === 'pc'
}

export function FogLayer({ scene }: { scene: Scene }) {
  const gm = useIsGm()
  const tokens = useGame((s) => s.tokens)
  const dragging = useGame((s) => s.dragging)
  const texture = useMemo(() => {
    const t = new THREE.CanvasTexture(painter.fog)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [])
  const glowTex = useMemo(() => {
    const t = new THREE.CanvasTexture(painter.glow)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [])
  const dirty = useRef(true)
  const lastPos = useRef('')
  const glowMat = useRef<THREE.MeshBasicMaterial>(null)
  const setHidden = useVision((s) => s.set)

  useEffect(() => {
    dirty.current = true
  }, [scene, tokens, dragging, gm])

  useEffect(() => {
    const t = setInterval(() => painter.saveExplored(), 5000)
    return () => {
      clearInterval(t)
      painter.saveExplored()
    }
  }, [scene.id])

  useFrame(({ clock }) => {
    painter.resize(scene)
    const list = Object.values(tokens)
    const { sources, mine } = visionSources(scene, list, gm)
    const cell = scene.grid.size
    const tokenLights = list
      .filter((t) => t.scene_id === scene.id && !t.hidden && t.light_dim > 0)
      .map((t) => ({ ...(displayPos.get(t.id) ?? { x: t.x, y: t.y }), bright: t.light_bright * cell, dim: t.light_dim * cell, color: '#ffb35c', flicker: true }))
    const lights = [...scene.lights.map((l) => ({ ...l, bright: l.bright * cell, dim: l.dim * cell })), ...tokenLights]
    // cintilar das tochas: só a intensidade do brilho na GPU (barato)
    const now = clock.elapsedTime
    if (glowMat.current) {
      const base = scene.ambient < 1 ? 0.7 : 0.25
      const flick = lights.some((l) => l.flicker) && !useGame.getState().lowFx
      glowMat.current.opacity = flick ? base * (0.88 + 0.08 * Math.sin(now * 9) + 0.05 * Math.sin(now * 23)) : base
    }
    // redesenha só se algo mudou (inclusive posições suavizadas)
    const key = [...sources, ...tokenLights].map((s) => `${Math.round(s.x)},${Math.round(s.y)}`).join('|')
    if (!dirty.current && key === lastPos.current) return
    dirty.current = false
    lastPos.current = key
    painter.paintLight(scene, lights, 0)
    painter.paint(scene, sources, gm)
    texture.image = painter.fog
    texture.needsUpdate = true
    glowTex.image = painter.glow
    glowTex.needsUpdate = true

    if (!gm) {
      const mineIds = new Set(mine.map((t) => t.id))
      const hidden = new Set<string>()
      if (scene.fog_enabled || scene.vision_enabled)
        for (const t of list) {
          if (t.scene_id !== scene.id || mineIds.has(t.id) || canControl(t)) continue
          const p = displayPos.get(t.id) ?? { x: t.x, y: t.y }
          if (painter.covered(p.x, p.y)) hidden.add(t.id)
        }
      const prev = useVision.getState().hiddenByFog
      if (prev.size !== hidden.size || [...hidden].some((id) => !prev.has(id))) setHidden(hidden)
    } else if (useVision.getState().hiddenByFog.size) setHidden(new Set())
  })

  const dark = scene.ambient < 1
  if (!scene.fog_enabled && !scene.vision_enabled && !dark && scene.lights.length === 0) return null
  return (
    <>
      {/* brilho colorido das luzes, somado ao mapa */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[scene.map_w / 2, 3.5, scene.map_h / 2]} renderOrder={9}>
        <planeGeometry args={[scene.map_w, scene.map_h]} />
        <meshBasicMaterial ref={glowMat} map={glowTex} transparent blending={THREE.AdditiveBlending} opacity={dark ? 0.7 : 0.25} depthWrite={false} depthTest={false} toneMapped={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[scene.map_w / 2, 4, scene.map_h / 2]} renderOrder={10}>
      <planeGeometry args={[scene.map_w, scene.map_h]} />
      <meshBasicMaterial map={texture} transparent opacity={gm ? 0.55 : 1} depthWrite={false} depthTest={false} toneMapped={false} />
    </mesh>
    </>
  )
}
