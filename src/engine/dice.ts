import type { RollDie, RollResult } from '../types'

/** PRNG determinístico (mulberry32): a mesma semente gera a mesma rolagem em todos os clientes. */
export function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function randomSeed(): number {
  const buf = new Uint32Array(1)
  crypto.getRandomValues(buf)
  return buf[0]
}

interface DiceTerm {
  kind: 'dice'
  sign: 1 | -1
  count: number
  sides: number
  keep?: { mode: 'kh' | 'kl' | 'dh' | 'dl'; n: number }
  explode: boolean
}
interface ConstTerm {
  kind: 'const'
  sign: 1 | -1
  value: number
}
type Term = DiceTerm | ConstTerm

export class DiceError extends Error {}

const MAX_DICE = 200

/**
 * Notação suportada: `d20`, `2d6+3`, `4d6kh3`, `2d20kl1`, `4d6dl1`, `3d6!`, `d%`,
 * `1d20 vantagem` / `adv`, `desvantagem` / `dis`, combinações com + e -.
 */
export function parseNotation(input: string): Term[] {
  // "2d6 3" não pode virar "2d63"
  if (/[\d%!]\s+\d/.test(input.trim())) throw new DiceError(`Falta + ou - em "${input}"`)
  let src = input.toLowerCase().replace(/\s+/g, '')
  if (!src) throw new DiceError('Notação vazia')

  // Atalhos de vantagem/desvantagem aplicados ao primeiro d20.
  const dis = /(desvantagem|dis|desv)$/.test(src)
  const adv = !dis && /(vantagem|adv)$/.test(src)
  src = src.replace(/(desvantagem|vantagem|adv|dis|desv)$/, '')
  if (!src) src = 'd20'

  const terms: Term[] = []
  const re = /([+-])?(?:(\d*)d(\d+|%)((?:kh|kl|dh|dl)\d*)?(!)?|(\d+))/gy
  let pos = 0
  while (pos < src.length) {
    re.lastIndex = pos
    const m = re.exec(src)
    if (!m || m[0] === '' || m.index !== pos) throw new DiceError(`Não entendi "${input}" perto de "${src.slice(pos)}"`)
    if (pos > 0 && !m[1]) throw new DiceError(`Falta + ou - em "${src.slice(pos)}"`)
    const sign: 1 | -1 = m[1] === '-' ? -1 : 1
    if (m[6] !== undefined) {
      terms.push({ kind: 'const', sign, value: parseInt(m[6], 10) })
    } else {
      const count = m[2] ? parseInt(m[2], 10) : 1
      const sides = m[3] === '%' ? 100 : parseInt(m[3], 10)
      if (count < 1 || count > MAX_DICE) throw new DiceError(`Quantidade de dados inválida (1–${MAX_DICE})`)
      if (sides < 2 || sides > 1000) throw new DiceError('Lados do dado inválidos')
      const t: DiceTerm = { kind: 'dice', sign, count, sides, explode: !!m[5] }
      if (m[4]) {
        const mode = m[4].slice(0, 2) as 'kh' | 'kl' | 'dh' | 'dl'
        const n = m[4].length > 2 ? parseInt(m[4].slice(2), 10) : 1
        t.keep = { mode, n }
      }
      terms.push(t)
    }
    pos = re.lastIndex
  }

  if (adv || dis) {
    const d20 = terms.find((t): t is DiceTerm => t.kind === 'dice' && t.sides === 20 && t.count === 1)
    if (!d20) throw new DiceError('Vantagem/desvantagem precisa de um 1d20')
    d20.count = 2
    d20.keep = { mode: adv ? 'kh' : 'kl', n: 1 }
  }
  return terms
}

export function roll(input: string, seed: number = randomSeed()): RollResult {
  const terms = parseNotation(input)
  const rng = mulberry32(seed)
  const die = (sides: number) => 1 + Math.floor(rng() * sides)

  let total = 0
  let modifier = 0
  const groups: RollResult['groups'] = []
  const parts: string[] = []
  let crit: RollResult['crit'] = null

  for (const t of terms) {
    if (t.kind === 'const') {
      total += t.sign * t.value
      modifier += t.sign * t.value
      parts.push(`${t.sign < 0 ? '-' : '+'} ${t.value}`)
      continue
    }
    const dice: RollDie[] = []
    for (let i = 0; i < t.count; i++) {
      let v = die(t.sides)
      dice.push({ sides: t.sides, value: v })
      let guard = 0
      while (t.explode && v === t.sides && guard++ < 50) {
        dice[dice.length - 1].exploded = true
        v = die(t.sides)
        dice.push({ sides: t.sides, value: v })
      }
    }
    if (t.keep) {
      const order = dice.map((d, i) => ({ v: d.value, i })).sort((a, b) => a.v - b.v)
      const n = Math.min(t.keep.n, dice.length)
      let dropIdx: number[] = []
      if (t.keep.mode === 'kh') dropIdx = order.slice(0, dice.length - n).map((o) => o.i)
      if (t.keep.mode === 'kl') dropIdx = order.slice(n).map((o) => o.i)
      if (t.keep.mode === 'dl') dropIdx = order.slice(0, n).map((o) => o.i)
      if (t.keep.mode === 'dh') dropIdx = order.slice(dice.length - n).map((o) => o.i)
      for (const i of dropIdx) dice[i].dropped = true
    }
    const sum = dice.filter((d) => !d.dropped).reduce((s, d) => s + d.value, 0)
    total += t.sign * sum
    groups.push({ sides: t.sides, dice })
    const shown = dice.map((d) => (d.dropped ? `~${d.value}~` : d.exploded ? `${d.value}!` : `${d.value}`)).join(', ')
    parts.push(`${parts.length ? (t.sign < 0 ? '- ' : '+ ') : t.sign < 0 ? '-' : ''}[${shown}]`)

    if (t.sides === 20 && crit === null) {
      const kept = dice.filter((d) => !d.dropped)
      if (kept.length === 1) crit = kept[0].value === 20 ? 'success' : kept[0].value === 1 ? 'fail' : null
    }
  }

  return { notation: input.trim(), total, groups, modifier, text: parts.join(' '), crit }
}

export function isValidNotation(input: string): boolean {
  try {
    parseNotation(input)
    return true
  } catch {
    return false
  }
}

export function formatMod(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`
}
