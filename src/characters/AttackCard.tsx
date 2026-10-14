import { Crosshair, Plus, Trash2, TriangleAlert } from 'lucide-react'
import { Button, Input, NumberInput, Select } from '../components/ui'
import { critParts, explainHit, explainPart, formatPart, parseCrit, partsNotation, resolveDamage, type DamagePart } from '../engine/damage'
import { formatMod, isValidNotation } from '../engine/dice'

export type CritRule = 't20' | 'dnd'

export interface AttackView {
  name: string
  /** null = bônus não cadastrado */
  bonus: number | null
  /** Explica de onde vem o bônus (ex.: "Luta +5 + 1 extra"). */
  bonusSource?: string
  damage?: string
  damage_parts?: DamagePart[]
  type?: string
  crit?: string
  rule: CritRule
  /** Aviso sobre regra da mesa/adaptação. */
  houseNote?: string
}

type Roll = (notation: string, label: string) => void

/** Bloco "Para acertar" / "Dano ao acertar", legível no celular. */
export function AttackCard({ a, onRoll, compact }: { a: AttackView; onRoll: Roll; compact?: boolean }) {
  const dmg = resolveDamage(a)
  const crit = a.rule === 't20' ? parseCrit(a.crit) : { from: 20, mult: 2 }
  const notation = dmg.status === 'ok' ? partsNotation(dmg.parts) : dmg.status === 'review' && isValidNotation(dmg.raw) ? dmg.raw : ''
  const critNotation = dmg.status === 'ok' && crit ? partsNotation(critParts(dmg.parts, a.rule, crit.mult)) : ''
  const defense = a.rule === 't20' ? 'a Defesa' : 'a Classe de Armadura (CA)'
  return (
    <div className="space-y-2 text-sm" data-testid="attack-card">
      <div className="rounded-lg bg-ink-900/60 p-2">
        <p className="text-[11px] font-bold uppercase tracking-wide text-parch-300">Para acertar</p>
        {a.bonus === null ? (
          <p className="font-semibold text-amber-300">Bônus não cadastrado</p>
        ) : (
          <>
            <p className="font-mono text-base font-bold text-gold-400">1d20{a.bonus !== 0 && ` ${a.bonus > 0 ? '+' : '−'} ${Math.abs(a.bonus)}`}</p>
            {!compact && (
              <p className="text-xs text-parch-200">
                {explainHit(a.bonus)} Compare o total com {defense} do alvo.
              </p>
            )}
            {a.bonusSource && <p className="text-[11px] text-parch-300">{a.bonusSource}</p>}
          </>
        )}
        {a.bonus !== null && (
          <Button size="sm" variant="primary" className="mt-1 w-full" onClick={() => onRoll(`1d20${formatMod(a.bonus!)}`, `Ataque: ${a.name}${a.crit ? ` (crít. ${a.crit})` : ''}`)}>
            <Crosshair size={12} /> Rolar acerto
          </Button>
        )}
      </div>

      <div className="rounded-lg bg-ink-900/60 p-2">
        <p className="text-[11px] font-bold uppercase tracking-wide text-parch-300">Dano ao acertar</p>
        {dmg.status === 'missing' && <p className="font-semibold text-amber-300">Dano não cadastrado</p>}
        {dmg.status === 'review' && (
          <>
            <p className="font-mono font-bold text-gold-400">{dmg.raw}</p>
            <p className="flex items-start gap-1 text-xs text-amber-300">
              <TriangleAlert size={12} className="mt-0.5 shrink-0" /> Não deu para interpretar este dano com segurança. Ele foi mantido como foi escrito; revise no editor da ficha.
            </p>
          </>
        )}
        {dmg.status === 'ok' && (
          <ul className="space-y-1">
            {dmg.parts.map((p, i) => (
              <li key={i}>
                <span className="font-mono text-base font-bold text-gold-400">{formatPart(p)}</span>
                {p.type && <span className="ml-1 text-parch-200">de {p.type}</span>}
                {!compact && <p className="text-xs text-parch-200">{explainPart(p)}</p>}
              </li>
            ))}
          </ul>
        )}
        {dmg.note && <p className="text-xs text-parch-300">Observação: {dmg.note}</p>}
        {!compact && dmg.status !== 'missing' && (
          <p className="mt-1 text-xs text-parch-300">Desconte o dano dos pontos de vida do alvo, aplicando as reduções ou resistências previstas.</p>
        )}
        {!compact && dmg.status === 'ok' && crit && (
          <p className="mt-1 text-xs text-parch-300">
            {a.rule === 't20'
              ? `Crítico ${a.crit}: com ${crit.from < 20 ? `${crit.from} a 20` : '20'} natural no d20, role os dados da arma ${crit.mult} vezes (${critNotation}). Bônus fixos e dados extras não são multiplicados.`
              : `Crítico (20 natural): role os dados de dano duas vezes e some o modificador uma vez (${critNotation}).`}
          </p>
        )}
        {!compact && a.rule === 't20' && a.crit && !crit && <p className="mt-1 text-xs text-parch-300">Crítico: {a.crit} (formato não reconhecido, aplique manualmente).</p>}
        {a.houseNote && !compact && <p className="mt-1 text-xs italic text-parch-300">{a.houseNote}</p>}
        {notation && (
          <div className="mt-1 flex gap-1">
            <Button size="sm" className="flex-1" onClick={() => onRoll(notation, `Dano: ${a.name}`)}>
              Rolar dano
            </Button>
            {critNotation && (
              <Button size="sm" variant="ghost" className="flex-1" onClick={() => onRoll(critNotation, `Dano crítico: ${a.name}`)}>
                Crítico
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

const DIE_OPTIONS = [4, 6, 8, 10, 12, 20, 100]

/**
 * Editor estruturado do dano. Ao salvar grava `damage_parts` e também `damage` em notação pura,
 * para que versões antigas do app continuem rolando. Texto ambíguo é mantido até o mestre editar.
 */
export function DamageEditor({ a, onChange }: { a: { damage?: string; damage_parts?: DamagePart[]; type?: string }; onChange: (p: { damage: string; damage_parts: DamagePart[] }) => void }) {
  const dmg = resolveDamage(a)
  const parts = dmg.parts
  const commit = (next: DamagePart[]) => onChange({ damage_parts: next, damage: partsNotation(next) })
  const upd = (i: number, q: Partial<DamagePart>) => commit(parts.map((p, j) => (j === i ? { ...p, ...q } : p)))
  return (
    <div className="space-y-1 rounded-lg border border-dashed border-ink-700 p-1.5 text-xs">
      <p className="font-bold text-parch-300">Dano (componentes)</p>
      {dmg.status === 'review' && (
        <p className="text-amber-300">
          Texto original mantido: <span className="font-mono">{dmg.raw}</span>. Cadastre os componentes abaixo para substituí-lo.
        </p>
      )}
      {parts.map((p, i) => (
        <div key={i} className="grid grid-cols-[3rem_4.5rem_3.5rem_1fr_auto] items-center gap-1">
          <NumberInput title="Quantidade de dados" value={p.count} onChange={(v) => upd(i, { count: Math.max(0, Math.min(100, v)), sides: v > 0 && !p.sides ? 6 : p.sides })} />
          <Select className="py-1 text-xs" title="Tipo de dado" value={p.count > 0 ? p.sides : 0} onChange={(e) => {
            const sides = Number(e.target.value)
            upd(i, sides ? { sides, count: p.count || 1 } : { sides: 0, count: 0 })
          }}>
            <option value={0}>sem dado</option>
            {DIE_OPTIONS.map((d) => (
              <option key={d} value={d}>
                d{d}
              </option>
            ))}
          </Select>
          <NumberInput title="Modificador fixo" value={p.mod} onChange={(v) => upd(i, { mod: v })} />
          <Input className="py-1 text-xs" placeholder="tipo (corte, fogo…)" value={p.type} onChange={(e) => upd(i, { type: e.target.value })} />
          <button type="button" className="p-1 text-ink-500 hover:text-red-400" onClick={() => commit(parts.filter((_, j) => j !== i))} aria-label="Remover componente">
            <Trash2 size={12} />
          </button>
        </div>
      ))}
      <Button size="sm" variant="ghost" className="px-1" onClick={() => commit([...parts, { count: 1, sides: 6, mod: 0, type: '' }])}>
        <Plus size={12} /> {parts.length ? 'Componente adicional' : 'Cadastrar dano'}
      </Button>
    </div>
  )
}

/** Para poderes, magias e ações: explica a rolagem sem impor um teste de ataque. */
export function NotationHint({ notation }: { notation: string }) {
  if (!notation.trim()) return null
  if (/^\s*1?d20\b/i.test(notation)) return <p className="text-xs text-parch-300">Teste: role um dado de 20 faces{notation.replace(/^\s*1?d20/i, '').trim() ? ` e aplique ${notation.replace(/^\s*1?d20/i, '').trim()}` : ''}.</p>
  const d = resolveDamage({ damage: notation })
  if (d.status !== 'ok') return null
  return (
    <ul className="text-xs text-parch-300">
      {d.parts.map((p, i) => (
        <li key={i}>
          <span className="font-mono text-parch-200">{formatPart(p)}</span>
          {p.type && ` de ${p.type}`}: {explainPart(p)}
        </li>
      ))}
    </ul>
  )
}
