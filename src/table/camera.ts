import * as THREE from 'three'
import { create } from 'zustand'

/** Estado da câmera fora do React (atualizado a cada quadro). */
export interface CameraState {
  x: number
  z: number
  zoom: number
  tilt: number // 0 = de cima; até ~0.9 rad no modo 2.5D
  targetTilt: number
}

export const camState: CameraState = { x: 1050, z: 700, zoom: 0.5, tilt: 0, targetTilt: 0 }

/** Pedido de foco (usado por "centralizar", iniciativa, puxar jogadores). */
export const useCamRequests = create<{ focus: { x: number; y: number; zoom?: number; at: number } | null; requestFocus(x: number, y: number, zoom?: number): void }>((set) => ({
  focus: null,
  requestFocus: (x, y, zoom) => set({ focus: { x, y, zoom, at: Date.now() } }),
}))

const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
const ray = new THREE.Raycaster()
const ndc = new THREE.Vector2()
const out = new THREE.Vector3()

/** Converte coordenadas de tela para o ponto do chão (px do mapa). */
export function screenToGround(clientX: number, clientY: number, camera: THREE.Camera, rect: DOMRect): { x: number; y: number } | null {
  ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1)
  ray.setFromCamera(ndc, camera)
  const hit = ray.ray.intersectPlane(plane, out)
  return hit ? { x: hit.x, y: hit.z } : null
}

export function groundToScreen(x: number, y: number, h: number, camera: THREE.Camera, rect: DOMRect) {
  const v = new THREE.Vector3(x, h, y).project(camera)
  return { x: rect.left + ((v.x + 1) / 2) * rect.width, y: rect.top + ((1 - v.y) / 2) * rect.height }
}

/** Marcado pelos tokens quando eles "pegam" o clique, para a câmera não arrastar junto. */
export const interaction = { consumed: false }
