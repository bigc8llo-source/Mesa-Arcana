import { Howl, Howler } from 'howler'

/**
 * Efeitos sonoros com arquivos de áudio reais (Howler.js), sem sintetizador.
 * Arquivos em public/sfx (créditos em public/sfx/CREDITOS.md).
 */
const SOUNDS = {
  dado: ['dado-1', 'dado-2', 'dado-3'],
  dadoAgitar: ['dado-agitar'],
  critico: ['critico'],
  falha: ['falha'],
  clique: ['clique'],
  ping: ['ping'],
  livro: ['livro'],
  pagina: ['pagina-1', 'pagina-2'],
  mensagem: ['mensagem'],
  suaVez: ['sua-vez'],
  sessao: ['sessao'],
  combate: ['combate'],
  golpe: ['golpe-1', 'golpe-2'],
  dano: ['dano-1', 'dano-2'],
  derrota: ['derrota'],
  cura: ['cura'],
  curaMagica: ['cura-magica'],
  bolaDeFogo: ['bola-de-fogo'],
  explosao: ['explosao'],
  relampago: ['relampago'],
  gelo: ['gelo'],
  luzSagrada: ['luz-sagrada'],
  arcano: ['arcano'],
  escuridao: ['escuridao'],
  veneno: ['veneno'],
  flecha: ['flecha'],
  porta: ['porta'],
  passo: ['passo-1', 'passo-2'],
  personagemCriado: ['personagem-criado'],
  bau: ['bau'],
  equipar: ['equipar'],
} as const

export type SoundName = keyof typeof SOUNDS

const KEY = 'mesa-arcana:sfx'
function loadPrefs(): { volume: number; muted: boolean } {
  try {
    return { volume: 0.6, muted: false, ...JSON.parse(localStorage.getItem(KEY) || '{}') }
  } catch {
    return { volume: 0.6, muted: false }
  }
}
const prefs = loadPrefs()
const howls = new Map<string, Howl>()
const lastPlayed = new Map<string, number>()

function howl(file: string) {
  let h = howls.get(file)
  if (!h) {
    h = new Howl({ src: [`/sfx/${file}.mp3`], preload: true, volume: 1 })
    howls.set(file, h)
  }
  return h
}

/** Toca um efeito (variação aleatória). Evita repetir o mesmo som em menos de `gap` ms. */
export function sfx(name: SoundName, opts: { volume?: number; rate?: number; gap?: number } = {}) {
  if (prefs.muted || typeof window === 'undefined') return
  const now = performance.now()
  const gap = opts.gap ?? 60
  if (now - (lastPlayed.get(name) ?? -1e9) < gap) return
  lastPlayed.set(name, now)
  const list = SOUNDS[name]
  const file = list[Math.floor(Math.random() * list.length)]
  const h = howl(file)
  const id = h.play()
  h.volume(Math.max(0, Math.min(1, (opts.volume ?? 1) * prefs.volume)), id)
  h.rate(opts.rate ?? 0.94 + Math.random() * 0.12, id) // pequena variação natural
}

/** Pré-carrega os sons mais usados (chamado ao abrir a mesa). */
export function preloadSfx() {
  for (const n of ['dado', 'dadoAgitar', 'mensagem', 'clique', 'dano', 'golpe'] as SoundName[]) SOUNDS[n].forEach(howl)
}

export function sfxPrefs() {
  return { ...prefs }
}
export function setSfxPrefs(p: Partial<{ volume: number; muted: boolean }>) {
  Object.assign(prefs, p)
  Howler.mute(prefs.muted)
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs))
  } catch {
    /* sem armazenamento */
  }
}

/** Som de um efeito visual de magia/ataque. */
export function sfxForVfx(effect: string) {
  const map: Record<string, SoundName[]> = {
    fireball: ['bolaDeFogo', 'explosao'],
    lightning: ['relampago'],
    heal: ['curaMagica'],
    frost: ['gelo'],
    darkness: ['escuridao'],
    arcane: ['arcano'],
    arrow: ['flecha'],
    slash: ['golpe'],
    holy: ['luzSagrada'],
    poison: ['veneno'],
  }
  const list = effect.startsWith('aoe:') ? (['arcano'] as SoundName[]) : map[effect]
  if (!list) return
  sfx(list[0])
  if (list[1]) setTimeout(() => sfx(list[1]), 380)
}
