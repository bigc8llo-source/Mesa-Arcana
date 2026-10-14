import { useEffect, useState } from 'react'
import { backend } from '../data'

export const MAX_MAP_PX = 4096

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Não foi possível carregar a imagem'))
    img.src = src
  })
}

export function canvasToBlob(c: HTMLCanvasElement, type = 'image/webp', quality = 0.85): Promise<Blob> {
  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('Falha ao gerar imagem'))), type, quality))
}

/** Redimensiona (máx. `maxPx` no maior lado) e converte para WebP antes do upload. */
export async function compressImage(file: Blob, maxPx: number, pixelated = false): Promise<{ blob: Blob; width: number; height: number }> {
  const url = URL.createObjectURL(file)
  try {
    const img = await loadImage(url)
    const scale = Math.min(1, maxPx / Math.max(img.width, img.height))
    const w = Math.round(img.width * scale)
    const h = Math.round(img.height * scale)
    // GIFs/PNGs pequenos de pixel art: mantém PNG para não borrar
    if (pixelated && scale === 1 && file.type === 'image/png') return { blob: file, width: w, height: h }
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    const ctx = c.getContext('2d')!
    ctx.imageSmoothingEnabled = !pixelated
    ctx.drawImage(img, 0, 0, w, h)
    return { blob: await canvasToBlob(c, pixelated ? 'image/png' : 'image/webp'), width: w, height: h }
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function uploadImage(campaignId: string, kind: string, file: Blob, maxPx: number, pixelated = false) {
  const { blob, width, height } = await compressImage(file, maxPx, pixelated)
  const url = await backend.uploadAsset(campaignId, kind, blob, blob.type === 'image/png' ? 'png' : 'webp')
  return { url, width, height }
}

export async function uploadCanvas(campaignId: string, kind: string, c: HTMLCanvasElement, png = false) {
  const blob = await canvasToBlob(c, png ? 'image/png' : 'image/webp')
  return backend.uploadAsset(campaignId, kind, blob, png ? 'png' : 'webp')
}

/** Resolve URLs internas (ex.: `idb:` do modo demonstração) para algo carregável. */
export function useAssetUrl(url: string | null | undefined): string | null {
  const [resolved, setResolved] = useState<string | null>(url && !url.startsWith('idb:') ? url : null)
  useEffect(() => {
    let alive = true
    if (!url) {
      setResolved(null)
      return
    }
    void backend.resolveUrl(url).then((u) => alive && setResolved(u || null))
    return () => {
      alive = false
    }
  }, [url])
  return resolved
}

export function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.onchange = () => resolve(input.files?.[0] ?? null)
    input.click()
  })
}
