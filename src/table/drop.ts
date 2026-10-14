import type { Scene, Token } from '../types'
import { useGame } from '../store/game'
import { MAX_MAP_PX, uploadImage } from '../lib/images'
import { parseUvtt } from '../engine/uvtt'
import { uid } from '../lib/id'
import { snapToGrid, type Pt } from '../engine/geometry'

/** Arquivo solto sobre o mapa: imagem vira mapa ou token; .dd2vtt/.uvtt vira cena completa. */
export async function handleDroppedFile(file: File, scene: Scene, at: Pt) {
  const s = useGame.getState()
  const gm = s.user && s.campaignId && s.members[`${s.campaignId}:${s.user.id}`]?.role === 'gm'
  const name = file.name.toLowerCase()
  try {
    if (/\.(dd2vtt|uvtt|df2vtt)$/.test(name)) {
      if (!gm) throw new Error('Apenas o mestre pode importar mapas.')
      await importUvtt(file, scene)
      return
    }
    if (!file.type.startsWith('image/')) throw new Error('Formato não suportado. Use imagens (PNG/JPG/WebP) ou .dd2vtt.')
    const asMap = gm && (!scene.map_url || window.confirm('Usar esta imagem como MAPA da cena?\n\nOK = mapa · Cancelar = criar um token'))
    if (asMap) {
      const { url, width, height } = await uploadImage(s.campaignId!, 'map', file, MAX_MAP_PX)
      await s.patch('scenes', scene.id, { map_url: url, map_w: width, map_h: height })
      return
    }
    const { url } = await uploadImage(s.campaignId!, 'token', file, 512)
    const p = snapToGrid(at, scene.grid)
    const t: Token = {
      id: uid(),
      campaign_id: s.campaignId!,
      scene_id: scene.id,
      character_id: null,
      name: file.name.replace(/\.[^.]+$/, '').slice(0, 30),
      image_url: url,
      color: '#94a3b8',
      x: p.x,
      y: p.y,
      size: 1,
      layer: 'token',
      hidden: false,
      locked: false,
      hp: 10,
      hp_max: 10,
      show_bar: false,
      conditions: [],
      vision: 0,
      darkvision: 0,
      light_bright: 0,
      light_dim: 0,
      owner_ids: gm ? [] : [s.user!.id],
    }
    await s.save('tokens', t)
  } catch (e) {
    useGame.getState().set({ error: (e as Error).message })
  }
}

export async function importUvtt(file: File, scene: Scene) {
  const s = useGame.getState()
  const data = parseUvtt(await file.text())
  let mapUrl = scene.map_url
  let w = data.width
  let h = data.height
  if (data.image) {
    const up = await uploadImage(s.campaignId!, 'map', data.image, MAX_MAP_PX)
    mapUrl = up.url
    // se a imagem foi reduzida, reescala paredes/luzes/grid
    const k = up.width / data.width
    if (Math.abs(k - 1) > 0.001) {
      data.walls.forEach((wl) => {
        wl.x1 *= k
        wl.y1 *= k
        wl.x2 *= k
        wl.y2 *= k
      })
      data.lights.forEach((l) => {
        l.x *= k
        l.y *= k
      })
      data.gridSize *= k
    }
    w = up.width
    h = up.height
  }
  await s.patch('scenes', scene.id, {
    map_url: mapUrl,
    map_w: w,
    map_h: h,
    walls: data.walls,
    lights: data.lights,
    grid: { ...scene.grid, size: data.gridSize, offsetX: 0, offsetY: 0 },
    vision_enabled: true,
    fog_enabled: true,
    ambient: data.lights.length ? 0.2 : 1,
  })
}
