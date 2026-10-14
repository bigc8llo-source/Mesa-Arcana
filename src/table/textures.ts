import { useEffect, useState } from 'react'
import * as THREE from 'three'
import { backend } from '../data'

const cache = new Map<string, Promise<THREE.Texture>>()
const loader = new THREE.TextureLoader()
loader.setCrossOrigin('anonymous')

export function loadTexture(url: string, pixelated: boolean): Promise<THREE.Texture> {
  const key = `${url}|${pixelated}`
  let p = cache.get(key)
  if (!p) {
    p = backend.resolveUrl(url).then(
      (resolved) =>
        new Promise<THREE.Texture>((resolve, reject) => {
          loader.load(
            resolved,
            (t) => {
              t.colorSpace = THREE.SRGBColorSpace
              if (pixelated) {
                t.magFilter = THREE.NearestFilter
                t.minFilter = THREE.NearestFilter
                t.generateMipmaps = false
              } else t.anisotropy = 4
              resolve(t)
            },
            undefined,
            reject,
          )
        }),
    )
    cache.set(key, p)
    p.catch(() => cache.delete(key))
  }
  return p
}

export function useTexture(url: string | null | undefined, pixelated = false): THREE.Texture | null {
  const [tex, setTex] = useState<THREE.Texture | null>(null)
  useEffect(() => {
    let alive = true
    if (!url) {
      setTex(null)
      return
    }
    loadTexture(url, pixelated)
      .then((t) => alive && setTex(t))
      .catch(() => alive && setTex(null))
    return () => {
      alive = false
    }
  }, [url, pixelated])
  return tex
}

/** Textura de disco com a inicial do nome (tokens sem imagem). */
const letterCache = new Map<string, THREE.Texture>()
export function letterTexture(name: string, color: string): THREE.Texture {
  const key = `${name[0] ?? '?'}|${color}`
  let t = letterCache.get(key)
  if (t) return t
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const ctx = c.getContext('2d')!
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(64, 64, 60, 0, Math.PI * 2)
  ctx.fill()
  ctx.lineWidth = 6
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'
  ctx.stroke()
  ctx.fillStyle = '#fff'
  ctx.font = 'bold 64px Georgia, serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText((name[0] ?? '?').toUpperCase(), 64, 68)
  t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  letterCache.set(key, t)
  return t
}
