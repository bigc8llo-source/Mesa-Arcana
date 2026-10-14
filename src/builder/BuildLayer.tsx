import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { create } from 'zustand'
import type { BuildData, Scene } from '../types'
import { bakeBuild } from './build'

/** Rascunho enquanto o mestre pinta (só nesta tela; grava ao soltar o mouse). */
export const useBuildDraft = create<{ draft: BuildData | null; set(d: BuildData | null): void }>((set) => ({ draft: null, set: (draft) => set({ draft }) }))

export function BuildLayer({ scene }: { scene: Scene }) {
  const draft = useBuildDraft((s) => s.draft)
  const build = draft ?? scene.build
  const canvas = useMemo(() => document.createElement('canvas'), [])
  const texture = useMemo(() => {
    const t = new THREE.CanvasTexture(canvas)
    t.colorSpace = THREE.SRGBColorSpace
    t.magFilter = THREE.NearestFilter
    t.minFilter = THREE.LinearMipmapLinearFilter
    t.anisotropy = 4
    return t
  }, [canvas])
  useEffect(() => {
    if (!build) return
    bakeBuild(build, canvas, !!scene.map_url)
    texture.image = canvas
    texture.needsUpdate = true
  }, [build, canvas, texture, scene.map_url])
  if (!build) return null
  const G = scene.grid.size
  const w = build.cols * G
  const h = build.rows * G
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[w / 2, 0.1, h / 2]}>
      <planeGeometry args={[w, h]} />
      <meshBasicMaterial map={texture} transparent toneMapped={false} />
    </mesh>
  )
}
