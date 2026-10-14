// Leitura e explicação de rolagens de ataque e dano, em português.
// Nada aqui inventa valores: o que não puder ser interpretado com segurança
// é preservado como texto e marcado para revisão manual.

/** Um componente de dano: `count`d`sides` + `mod` do tipo `type`. count 0 = dano fixo. */
export interface DamagePart {
  count: number
  sides: number
  mod: number
  type: string
}

export interface ParsedDamage {
  /** true quando o texto foi entendido por completo. */
  ok: boolean
  parts: DamagePart[]
  /** Texto original, sempre preservado. */
  raw: string
}

const SIDES = new Set([2, 3, 4, 6, 8, 10, 12, 20, 100])

/** Interpreta textos como "1d6+2", "2d8 + 3 de corte", "1d6 + 2 de corte e 1d4 de fogo", "5", "1d6-1". */
export function parseDamage(text: string | undefined | null): ParsedDamage {
  const raw = (text ?? '').trim()
  if (!raw) return { ok: false, parts: [], raw }
  const src = raw.toLowerCase()
  // Letras coladas em números (4d6kh3, 1d6!, 2x) e símbolos estranhos não são entendidos com segurança.
  if (/\d[a-ce-zà-ú]/.test(src) || /d\d+[a-zà-ú]/.test(src) || /[^\p{L}\d\s+\-,.]/u.test(src) || /d\s*%/.test(src) || /[x×]\s*\d/.test(src)) return { ok: false, parts: [], raw }

  const parts: DamagePart[] = []
  let cur: DamagePart | null = null
  let sign = 1
  let pendingSign = false
  const re = /\s*(?:(\d*)d(\d+)|(\d+)|([+-])|(,)|([\p{L}.]+))/uy
  let m: RegExpExecArray | null
  let pos = 0
  const fail = (): ParsedDamage => ({ ok: false, parts: [], raw })
  const startNew = () => {
    cur = { count: 0, sides: 0, mod: 0, type: '' }
    parts.push(cur)
    return cur
  }
  while (pos < src.length) {
    re.lastIndex = pos
    m = re.exec(src)
    if (!m) {
      if (/^\s*$/.test(src.slice(pos))) break
      return fail()
    }
    pos = re.lastIndex
    if (m[2] !== undefined) {
      const count = m[1] === '' ? 1 : Number(m[1])
      const sides = Number(m[2])
      if (count < 1 || count > 100 || !SIDES.has(sides) || sign < 0) return fail()
      let p: DamagePart = cur ?? startNew()
      if (p.count > 0 || p.type || p.mod !== 0) p = startNew()
      p.count = count
      p.sides = sides
      sign = 1
      pendingSign = false
    } else if (m[3] !== undefined) {
      const n = Number(m[3]) * sign
      let p: DamagePart = cur ?? startNew()
      // Número depois do tipo ("1d6 corte + 2 fogo") começa um novo componente.
      if (p.type) p = startNew()
      else if (cur && !pendingSign && (p.count > 0 || p.mod !== 0)) return fail() // "2d6 3"
      p.mod += n
      sign = 1
      pendingSign = false
    } else if (m[4] !== undefined) {
      if (pendingSign) return fail()
      sign = m[4] === '-' ? -1 : 1
      pendingSign = true
    } else if (m[5] !== undefined) {
      if (pendingSign || !cur) return fail()
      cur = null
    } else if (m[6] !== undefined) {
      const w = m[6].replace(/\.+$/, '')
      if (pendingSign) return fail()
      if (w === 'e' || w === 'mais') {
        if (!cur) return fail()
        cur = null
        continue
      }
      if (!cur) return fail() // tipo antes dos números: ambíguo
      const p: DamagePart = cur
      if (w === 'de' && !p.type) continue
      if (w === 'dano' && !p.type) continue
      p.type = p.type ? `${p.type} ${w}` : w
    }
  }
  if (pendingSign || parts.length === 0) return fail()
  if (parts.some((p) => p.count === 0 && p.mod === 0)) return fail()
  return { ok: true, parts, raw }
}

const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`)

/** Notação pura, sem tipos, para o rolador de dados ("1d6+2+1d4"). */
export function partsNotation(parts: DamagePart[]): string {
  return parts
    .filter((p) => p.count > 0 || p.mod !== 0)
    .map((p, i) => {
      const dice = p.count > 0 ? `${p.count}d${p.sides}` : ''
      const mod = p.mod !== 0 ? (dice ? signed(p.mod) : String(p.mod)) : ''
      const body = dice + mod
      return i === 0 || body.startsWith('-') ? body : `+${body}`
    })
    .join('')
}

/** Ex.: "1d6 + 2", "2d6", "5", "1d6 − 1". */
export function formatPart(p: DamagePart): string {
  const dice = p.count > 0 ? `${p.count}d${p.sides}` : ''
  if (!dice) return String(p.mod)
  if (p.mod === 0) return dice
  return `${dice} ${p.mod > 0 ? '+' : '−'} ${Math.abs(p.mod)}`
}

export function explainPart(p: DamagePart): string {
  if (p.count === 0) return `Dano fixo de ${p.mod}: não role dados.`
  const dice = p.count === 1 ? `1 dado de ${p.sides} faces` : `${p.count} dados de ${p.sides} faces`
  if (p.mod > 0) return `Role ${dice} e some ${p.mod}.`
  if (p.mod < 0) return `Role ${dice} e subtraia ${-p.mod}.`
  return p.count > 1 ? `Role ${dice} e some os resultados.` : `Role ${dice}.`
}

/** "Role um dado de 20 faces e some 4." */
export function explainHit(bonus: number): string {
  if (bonus > 0) return `Role um dado de 20 faces e some ${bonus}.`
  if (bonus < 0) return `Role um dado de 20 faces e subtraia ${-bonus}.`
  return 'Role um dado de 20 faces.'
}

/** "19/x2" → { from: 19, mult: 2 }. Formatos desconhecidos → null. */
export function parseCrit(text: string | undefined): { from: number; mult: number } | null {
  const m = /^\s*(\d{1,2})?\s*(?:[-–]\s*20)?\s*\/?\s*[x×]\s*(\d)\s*$/i.exec(text ?? '')
  if (!m) return null
  const from = m[1] ? Number(m[1]) : 20
  const mult = Number(m[2])
  if (from < 2 || from > 20 || mult < 2) return null
  return { from, mult }
}

/**
 * Dano no crítico. Tormenta20: só os dados do primeiro componente (a arma) são multiplicados;
 * bônus fixos e dados extras não. D&D 5e: todos os dados são rolados em dobro, modificadores uma vez.
 */
export function critParts(parts: DamagePart[], rule: 't20' | 'dnd', mult = 2): DamagePart[] {
  return parts.map((p, i) => {
    if (p.count === 0) return p
    if (rule === 't20') return i === 0 ? { ...p, count: p.count * mult } : p
    return { ...p, count: p.count * 2 }
  })
}

/** Junta os componentes do mesmo texto legado, p.ex. tipo "concussão" guardado em outro campo. */
export function withType(parts: DamagePart[], type: string): DamagePart[] {
  if (!type || parts.length === 0 || parts[0].type) return parts
  return [{ ...parts[0], type }, ...parts.slice(1)]
}

export interface ResolvedDamage {
  /** ok: entendido; review: texto preservado, precisa de revisão manual; missing: nada cadastrado. */
  status: 'ok' | 'review' | 'missing'
  parts: DamagePart[]
  raw: string
  /** Texto legado que não coube nos componentes (mostrado como observação). */
  note: string
}

/** Lê o dano de um ataque, novo (`damage_parts`) ou antigo (`damage` em texto + `type`). */
export function resolveDamage(a: { damage?: string; damage_parts?: DamagePart[]; type?: string }): ResolvedDamage {
  const raw = (a.damage ?? '').trim()
  let note = ''
  let legacyType = (a.type ?? '').trim()
  // Fichas antigas guardavam crítico ("19/x2") ou "extra" no campo de tipo.
  if (/^\d{1,2}(\s*[-–]\s*20)?\s*\/\s*[x×]\d$/i.test(legacyType) || /^[x×]\d$/i.test(legacyType)) legacyType = ''
  if (legacyType && /\d/.test(legacyType)) {
    note = legacyType
    legacyType = ''
  }
  if (a.damage_parts && a.damage_parts.length > 0) return { status: 'ok', parts: a.damage_parts, raw, note }
  if (!raw) return { status: 'missing', parts: [], raw, note }
  const parsed = parseDamage(raw)
  if (!parsed.ok) return { status: 'review', parts: [], raw, note }
  return { status: 'ok', parts: withType(parsed.parts, legacyType), raw, note }
}
