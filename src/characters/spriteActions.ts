import type { Character } from '../types'
import type { SpriteChoice } from './SpriteEditor'
import { buildSpriteAssets } from '../game/actions'
import { compressImage, loadImage, uploadCanvas, uploadImage } from '../lib/images'
import { backend } from '../data'
import { makeTokenCanvas } from '../engine/sprites'

/** Converte a escolha do editor em URLs salvas (sprite, token e/ou retrato). */
export async function resolveSpriteChoice(campaignId: string, choice: SpriteChoice, color: string): Promise<Pick<Character, 'sprite' | 'token_url' | 'portrait_url'> & { recipe?: unknown }> {
  if (choice.mode === 'recipe') {
    const { sprite, tokenUrl } = await buildSpriteAssets(campaignId, choice.recipe, color)
    return { sprite, token_url: tokenUrl, portrait_url: null, recipe: choice.recipe }
  }
  if (choice.mode === 'upload') {
    const { blob } = await compressImage(choice.file, 4096, true)
    const url = await backend.uploadAsset(campaignId, 'sprite', blob, blob.type === 'image/png' ? 'png' : 'webp')
    const local = URL.createObjectURL(blob)
    try {
      const img = await loadImage(local)
      const idle = choice.config.animations.idle ?? { row: 0 }
      const token = makeTokenCanvas(img, 0, idle.row * choice.config.frameH, choice.config.frameW, choice.config.frameH, color, true)
      const tokenUrl = await uploadCanvas(campaignId, 'token', token, true)
      return { sprite: { ...choice.config, url }, token_url: tokenUrl, portrait_url: null }
    } finally {
      URL.revokeObjectURL(local)
    }
  }
  const { url } = await uploadImage(campaignId, 'portrait', choice.file, 768)
  const local = URL.createObjectURL(choice.file)
  try {
    const img = await loadImage(local)
    const side = Math.min(img.width, img.height)
    const token = makeTokenCanvas(img, (img.width - side) / 2, 0, side, side, color, false)
    const tokenUrl = await uploadCanvas(campaignId, 'token', token)
    return { sprite: null, token_url: tokenUrl, portrait_url: url }
  } finally {
    URL.revokeObjectURL(local)
  }
}
