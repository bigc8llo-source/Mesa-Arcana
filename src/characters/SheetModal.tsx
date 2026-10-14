import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Dices, Eye, EyeOff, Heart, MapPin, Plus, Shield, Sparkles, Trash2, Wand2, Zap } from 'lucide-react'
import type { Character } from '../types'
import { useGame, useIsGm, activeSceneId, emitLocalLive } from '../store/game'
import { Button, cn, Field, HpBar, Input, Modal, NumberInput, Select, Textarea } from '../components/ui'
import {
  ABILITIES,
  SKILLS,
  asDnd,
  asGeneric,
  mod,
  profBonus,
  saveBonus,
  skillBonus,
  spellAttack,
  spellDc,
  systemOf,
  type Ability,
  type Dnd5eSheet,
  type GenericSheet,
} from '../systems'
import { formatMod } from '../engine/dice'
import { asT20, halfLevel, t20Defense, t20mod, t20Resources, t20Skill, trainingBonus, T20_ATTRS, T20_CLASSES, T20_RACES, T20_SKILLS, type T20Sheet } from '../systems/tormenta20'
import { placeToken, rollDice } from '../game/actions'
import { AttackCard, DamageEditor } from './AttackCard'
import { InventoryPanel } from './InventoryPanel'
import { t20AttackView } from './attackViews'
import { uid } from '../lib/id'
import { Portrait, SpriteAnimator, TiltCard, type SpriteAnimName } from './SpriteView'
import { playTokenAnim } from '../table/Tokens'
import { SpriteEditor, type SpriteChoice } from './SpriteEditor'
import { resolveSpriteChoice } from './spriteActions'
import type { SpriteRecipe } from '../engine/sprites'
import { DEFAULT_RECIPE } from '../engine/sprites'
import { sfx } from '../audio/sfx'

type Patch = (fn: (s: Record<string, unknown>) => Record<string, unknown>) => void

/** Edição local com gravação automática (debounce) para não inundar o banco. */
function useSheetDraft(c: Character) {
  const [sheet, setSheet] = useState(c.sheet)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pending = useRef<Record<string, unknown> | null>(null)
  const editing = useRef(false)
  useEffect(() => {
    if (!editing.current) setSheet(c.sheet)
  }, [c.sheet])
  const flush = () => {
    if (!pending.current) return
    const next = pending.current
    pending.current = null
    editing.current = false
    void useGame.getState().patch('characters', c.id, { sheet: next })
  }
  useEffect(() => () => flush(), []) // grava ao fechar
  const patch: Patch = (fn) => {
    setSheet((prev) => {
      const next = fn(prev)
      pending.current = next
      editing.current = true
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(flush, 600)
      return next
    })
  }
  return { sheet, patch }
}

function useRoller(c: Character, onAnim: (a: SpriteAnimName) => void) {
  return (notation: string, label: string, anim: SpriteAnimName = 'attack') => {
    onAnim(anim)
    const sid = activeSceneId(useGame.getState())
    Object.values(useGame.getState().tokens)
      .filter((t) => t.character_id === c.id && t.scene_id === sid)
      .forEach((t) => playTokenAnim(t.id, anim))
    void rollDice(notation, { label, character: c })
  }
}

function RollBtn({ bonus, onRoll, label, small }: { bonus: number; onRoll: () => void; label: string; small?: boolean }) {
  return (
    <button
      onClick={onRoll}
      title={`Rolar ${label}`}
      className={cn('group flex items-center justify-between gap-2 rounded-md px-2 text-left transition hover:bg-arcane-600/30', small ? 'py-0.5' : 'py-1')}
    >
      <span className="text-sm text-parch-200 group-hover:text-white">{label}</span>
      <span className="flex items-center gap-1 font-mono text-sm font-bold text-gold-400">
        <Dices size={12} className="opacity-0 transition group-hover:opacity-100" />
        {formatMod(bonus)}
      </span>
    </button>
  )
}

function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="rounded-xl border border-ink-700 bg-ink-850/60 p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-display text-sm text-gold-400">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  )
}

// ============================================================ D&D 5e

function DndSheet({ c, sheet, patch, editable, playEditable = editable, roll }: { c: Character; sheet: Dnd5eSheet; patch: Patch; editable: boolean; playEditable?: boolean; roll: ReturnType<typeof useRoller> }) {
  const pb = profBonus(sheet.level)
  const set = <K extends keyof Dnd5eSheet>(k: K, v: Dnd5eSheet[K]) => patch((s) => ({ ...s, [k]: v }))
  return (
    <div className="grid gap-3 lg:grid-cols-3">
      <div className="space-y-3">
        <Section title="Identidade">
          <div className="grid grid-cols-2 gap-2">
            {c.kind !== 'monster' ? (
              <>
                <Field label="Raça">
                  <Input disabled={!editable} value={sheet.race} onChange={(e) => set('race', e.target.value)} />
                </Field>
                <Field label="Classe">
                  <Input disabled={!editable} value={sheet.class} onChange={(e) => set('class', e.target.value)} />
                </Field>
                <Field label="Nível">
                  <NumberInput disabled={!editable} value={sheet.level} onChange={(v) => set('level', Math.max(1, Math.min(20, v)))} />
                </Field>
                <Field label="Antecedente">
                  <Input disabled={!editable} value={sheet.background} onChange={(e) => set('background', e.target.value)} />
                </Field>
              </>
            ) : (
              <Field label="Nível de desafio">
                <Input disabled={!editable} value={sheet.cr ?? ''} onChange={(e) => set('cr', e.target.value)} />
              </Field>
            )}
          </div>
        </Section>
        <Section title="Atributos">
          <div className="grid grid-cols-3 gap-2">
            {ABILITIES.map((a) => (
              <div key={a.key} className="rounded-lg border border-ink-600 bg-ink-900 p-1.5 text-center">
                <button className="w-full rounded hover:bg-arcane-600/30" onClick={() => roll(`1d20${formatMod(mod(sheet.abilities[a.key]))}`, `Teste de ${a.full}`, 'cast')} title={`Rolar teste de ${a.full}`}>
                  <p className="text-[10px] font-bold tracking-widest text-parch-300">{a.label}</p>
                  <p className="font-display text-xl font-extrabold text-gold-400">{formatMod(mod(sheet.abilities[a.key]))}</p>
                </button>
                <NumberInput
                  disabled={!editable}
                  className="mt-1 py-0 text-xs"
                  value={sheet.abilities[a.key]}
                  onChange={(v) => set('abilities', { ...sheet.abilities, [a.key]: Math.max(1, Math.min(30, v)) })}
                />
              </div>
            ))}
          </div>
          <p className="mt-2 text-center text-xs text-parch-300">
            Bônus de proficiência <b className="text-gold-400">{formatMod(pb)}</b>
          </p>
        </Section>
        <Section title="Salvaguardas">
          {ABILITIES.map((a) => (
            <div key={a.key} className="flex items-center gap-1">
              <input
                type="checkbox"
                disabled={!editable}
                className="accent-arcane-500"
                checked={sheet.saves.includes(a.key)}
                onChange={(e) => set('saves', e.target.checked ? [...sheet.saves, a.key] : sheet.saves.filter((x) => x !== a.key))}
                title="Proficiente"
              />
              <div className="flex-1">
                <RollBtn small label={a.full} bonus={saveBonus(sheet, a.key)} onRoll={() => roll(`1d20${formatMod(saveBonus(sheet, a.key))}`, `Salvaguarda de ${a.full}`, 'cast')} />
              </div>
            </div>
          ))}
        </Section>
      </div>

      <div className="space-y-3">
        <Section title="Perícias">
          {SKILLS.map((sk) => {
            const lvl = sheet.skills[sk.key] ?? 0
            return (
              <div key={sk.key} className="flex items-center gap-1">
                <button
                  disabled={!editable}
                  onClick={() => set('skills', { ...sheet.skills, [sk.key]: ((lvl + 1) % 3) as 0 | 1 | 2 })}
                  className={cn('size-3.5 shrink-0 rounded-full border', lvl === 2 ? 'border-gold-400 bg-gold-400' : lvl === 1 ? 'border-arcane-400 bg-arcane-500' : 'border-ink-500')}
                  title={['Sem proficiência', 'Proficiente', 'Especialista'][lvl]}
                />
                <div className="flex-1">
                  <RollBtn
                    small
                    label={`${sk.label} (${ABILITIES.find((a) => a.key === sk.ability)!.label})`}
                    bonus={skillBonus(sheet, sk.key)}
                    onRoll={() => roll(`1d20${formatMod(skillBonus(sheet, sk.key))}`, sk.label, 'cast')}
                  />
                </div>
              </div>
            )
          })}
        </Section>
      </div>

      <div className="space-y-3">
        <Section
          title="Ataques"
          action={
            editable && (
              <Button size="sm" variant="ghost" onClick={() => set('attacks', [...sheet.attacks, { id: uid(), name: 'Novo ataque', bonus: 0, damage: '1d6', type: '' }])}>
                <Plus size={14} />
              </Button>
            )
          }
        >
          <div className="space-y-2">
            {sheet.attacks.length === 0 && <p className="text-xs text-parch-300">Nenhum ataque.</p>}
            {sheet.attacks.map((a, i) => {
              const upd = (p: Partial<Dnd5eSheet['attacks'][number]>) => set('attacks', sheet.attacks.map((x, j) => (j === i ? { ...x, ...p } : x)))
              return (
                <div key={a.id} className="rounded-lg border border-ink-700 p-2">
                  <div className="mb-1.5 flex items-center gap-1">
                    {editable ? <Input className="py-1" value={a.name} onChange={(e) => upd({ name: e.target.value })} /> : <p className="flex-1 font-semibold">{a.name}</p>}
                    {editable && (
                      <button type="button" className="p-1 text-ink-500 hover:text-red-400" onClick={() => set('attacks', sheet.attacks.filter((x) => x.id !== a.id))} aria-label="Remover">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                  {editable && (
                    <div className="mb-1.5 space-y-1">
                      <label className="flex items-center gap-2 text-xs text-parch-300">
                        Bônus de ataque (total)
                        <span className="w-16">
                          <NumberInput title="Bônus de ataque" value={a.bonus} onChange={(v) => upd({ bonus: v })} />
                        </span>
                      </label>
                      <DamageEditor a={a} onChange={upd} />
                    </div>
                  )}
                  <AttackCard
                    a={{ ...a, bonus: Number.isFinite(a.bonus) ? a.bonus : null, rule: 'dnd', bonusSource: 'Bônus total cadastrado (já inclui atributo e proficiência).' }}
                    onRoll={(n, l) => roll(n, l)}
                  />
                </div>
              )
            })}
          </div>
        </Section>
        <Section
          title="Magias"
          action={
            editable && (
              <Button size="sm" variant="ghost" onClick={() => set('spells', [...sheet.spells, { id: uid(), name: 'Nova magia', level: 1, notation: '', description: '' }])}>
                <Plus size={14} />
              </Button>
            )
          }
        >
          <div className="mb-2 flex items-center gap-2 text-xs text-parch-300">
            <Select disabled={!editable} className="w-24 py-1 text-xs" value={sheet.spell_ability} onChange={(e) => set('spell_ability', e.target.value as Ability)}>
              {ABILITIES.map((a) => (
                <option key={a.key} value={a.key}>
                  {a.label}
                </option>
              ))}
            </Select>
            Ataque <b className="text-gold-400">{formatMod(spellAttack(sheet))}</b> · CD <b className="text-gold-400">{spellDc(sheet)}</b>
          </div>
          <div className="space-y-1.5">
            {sheet.spells.map((sp, i) => (
              <div key={sp.id} className="rounded-lg border border-ink-700 p-2 text-sm">
                {editable ? (
                  <div className="space-y-1">
                    <div className="flex gap-1">
                      <Input className="py-1" value={sp.name} onChange={(e) => set('spells', sheet.spells.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                      <NumberInput className="w-12" title="Círculo" value={sp.level} onChange={(v) => set('spells', sheet.spells.map((x, j) => (j === i ? { ...x, level: v } : x)))} />
                      <button className="p-1 text-ink-500 hover:text-red-400" onClick={() => set('spells', sheet.spells.filter((x) => x.id !== sp.id))} aria-label="Remover">
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <Input className="py-1 font-mono text-xs" placeholder="Dados (ex.: 8d6)" value={sp.notation} onChange={(e) => set('spells', sheet.spells.map((x, j) => (j === i ? { ...x, notation: e.target.value } : x)))} />
                    <Textarea rows={2} className="text-xs" value={sp.description} onChange={(e) => set('spells', sheet.spells.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} />
                  </div>
                ) : (
                  <>
                    <p className="font-semibold">
                      {sp.name} <span className="text-xs text-parch-300">{sp.level === 0 ? 'truque' : `${sp.level}º círculo`}</span>
                    </p>
                    <p className="text-xs text-parch-300">{sp.description}</p>
                  </>
                )}
                {sp.notation && (
                  <Button size="sm" variant="primary" className="mt-1 w-full" onClick={() => roll(sp.notation, sp.name, 'cast')}>
                    <Sparkles size={12} /> Conjurar ({sp.notation})
                  </Button>
                )}
              </div>
            ))}
          </div>
        </Section>
        <Section title="Inventário">
          <InventoryPanel c={{ system_id: 'dnd5e' }} sheet={sheet as unknown as Record<string, unknown>} editable={playEditable} onPatch={(p) => patch((s) => ({ ...s, ...p }))} />
        </Section>
        <Section title="Características e notas">
          <Textarea disabled={!playEditable} rows={3} placeholder="Características, itens antigos…" value={sheet.features} onChange={(e) => set('features', e.target.value)} />
          <Textarea disabled={!playEditable} rows={3} className="mt-2" placeholder="Anotações" value={sheet.notes} onChange={(e) => set('notes', e.target.value)} />
        </Section>
      </div>
    </div>
  )
}

// ============================================================ Genérico

function GenericSheetView({ sheet, patch, editable, playEditable = editable, roll }: { sheet: GenericSheet; patch: Patch; editable: boolean; playEditable?: boolean; roll: ReturnType<typeof useRoller> }) {
  const set = <K extends keyof GenericSheet>(k: K, v: GenericSheet[K]) => patch((s) => ({ ...s, [k]: v }))
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Section title="Conceito">
        <Input disabled={!editable} value={sheet.concept} onChange={(e) => set('concept', e.target.value)} placeholder="Ex.: Detetive ocultista" />
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Field label="Dado base">
            <Input disabled={!editable} className="font-mono" value={sheet.base_die} onChange={(e) => set('base_die', e.target.value)} />
          </Field>
          <Field label="Defesa">
            <NumberInput disabled={!editable} value={sheet.defense} onChange={(v) => set('defense', v)} />
          </Field>
        </div>
      </Section>
      <Section
        title="Atributos"
        action={
          editable && (
            <Button size="sm" variant="ghost" onClick={() => set('attributes', [...sheet.attributes, { id: uid(), name: 'Novo', value: 0 }])}>
              <Plus size={14} />
            </Button>
          )
        }
      >
        {sheet.attributes.map((a, i) => (
          <div key={a.id} className="flex items-center gap-1">
            {editable && <Input className="py-1" value={a.name} onChange={(e) => set('attributes', sheet.attributes.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />}
            {editable && <NumberInput className="w-14" value={a.value} onChange={(v) => set('attributes', sheet.attributes.map((x, j) => (j === i ? { ...x, value: v } : x)))} />}
            <div className="flex-1">
              <RollBtn label={editable ? '' : a.name} bonus={a.value} onRoll={() => roll(`${sheet.base_die}${formatMod(a.value)}`, a.name, 'cast')} />
            </div>
          </div>
        ))}
      </Section>
      <Section
        title="Ações"
        action={
          editable && (
            <Button size="sm" variant="ghost" onClick={() => set('actions', [...sheet.actions, { id: uid(), name: 'Nova ação', notation: '1d6' }])}>
              <Plus size={14} />
            </Button>
          )
        }
      >
        <div className="space-y-1.5">
          {sheet.actions.map((a, i) => (
            <div key={a.id} className="flex items-center gap-1">
              {editable ? (
                <>
                  <Input className="py-1" value={a.name} onChange={(e) => set('actions', sheet.actions.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                  <Input className="w-24 py-1 font-mono text-xs" value={a.notation} onChange={(e) => set('actions', sheet.actions.map((x, j) => (j === i ? { ...x, notation: e.target.value } : x)))} />
                </>
              ) : (
                <span className="flex-1 text-sm">{a.name}</span>
              )}
              <Button size="sm" variant="primary" onClick={() => roll(a.notation, a.name)}>
                {a.notation}
              </Button>
            </div>
          ))}
        </div>
      </Section>
      <Section title="Inventário">
        <InventoryPanel c={{ system_id: 'generico' }} sheet={sheet as unknown as Record<string, unknown>} editable={playEditable} onPatch={(p) => patch((s) => ({ ...s, ...p }))} />
      </Section>
      <Section title="Anotações">
        <Textarea disabled={!playEditable} rows={6} value={sheet.notes} onChange={(e) => set('notes', e.target.value)} />
      </Section>
    </div>
  )
}

// ============================================================ Tormenta20

function T20SheetView({ c, sheet, patch, editable, playEditable = editable, roll }: { c: Character; sheet: T20Sheet; patch: Patch; editable: boolean; playEditable?: boolean; roll: ReturnType<typeof useRoller> }) {
  const set = <K extends keyof T20Sheet>(k: K, v: T20Sheet[K]) => patch((s) => ({ ...s, [k]: v }))
  const recalc = (next: Partial<T20Sheet>) =>
    patch((s) => {
      const merged = { ...asT20(s), ...next }
      const r = t20Resources(merged.class, merged.level, merged.attrs.con)
      return { ...s, ...next, pv_max: r.pv, pm_max: r.pm, pv: Math.min(merged.pv, r.pv) || r.pv, pm: Math.min(merged.pm, r.pm) || r.pm }
    })
  return (
    <div className="grid gap-3 lg:grid-cols-3">
      <div className="space-y-3">
        <Section title="Personagem">
          <div className="grid grid-cols-2 gap-2">
            {c.kind !== 'monster' ? (
              <>
                <Field label="Raça">
                  <Select disabled={!editable} value={sheet.race} onChange={(e) => set('race', e.target.value)}>
                    {[sheet.race, ...T20_RACES.filter((r) => r !== sheet.race)].map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Classe">
                  <Select disabled={!editable} value={sheet.class} onChange={(e) => recalc({ class: e.target.value })}>
                    {Object.keys(T20_CLASSES).map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Nível">
                  <NumberInput disabled={!editable} value={sheet.level} onChange={(v) => recalc({ level: Math.max(1, Math.min(20, v)) })} />
                </Field>
                <Field label="Origem">
                  <Input disabled={!editable} value={sheet.origin} onChange={(e) => set('origin', e.target.value)} />
                </Field>
                <Field label="Divindade">
                  <Input disabled={!editable} value={sheet.deity} onChange={(e) => set('deity', e.target.value)} />
                </Field>
              </>
            ) : (
              <Field label="ND">
                <Input disabled={!editable} value={sheet.nd ?? ''} onChange={(e) => set('nd', e.target.value)} />
              </Field>
            )}
          </div>
        </Section>
        <Section title="Atributos">
          <div className="grid grid-cols-3 gap-2">
            {T20_ATTRS.map((a) => (
              <div key={a.key} className="rounded-lg border border-ink-600 bg-ink-900 p-1.5 text-center">
                <p className="text-[10px] font-bold tracking-widest text-parch-300">{a.label}</p>
                <p className="font-display text-xl font-extrabold text-gold-400">{formatMod(t20mod(sheet.attrs[a.key]))}</p>
                <NumberInput
                  disabled={!editable}
                  className="mt-1 py-0 text-xs"
                  value={sheet.attrs[a.key]}
                  onChange={(v) => {
                    const attrs = { ...sheet.attrs, [a.key]: Math.max(1, Math.min(30, v)) }
                    if (a.key === 'con') recalc({ attrs })
                    else set('attrs', attrs)
                  }}
                />
              </div>
            ))}
          </div>
          <p className="mt-2 text-center text-xs text-parch-300">
            ½ nível <b className="text-gold-400">+{halfLevel(sheet.level)}</b> · treino <b className="text-gold-400">+{trainingBonus(sheet.level)}</b>
          </p>
        </Section>
        <Section title="Defesa">
          <div className="grid grid-cols-3 gap-2 text-xs">
            <Field label="Armadura">
              <NumberInput disabled={!editable} value={sheet.defense_armor} onChange={(v) => set('defense_armor', v)} />
            </Field>
            <Field label="Outros">
              <NumberInput disabled={!editable} value={sheet.defense_other} onChange={(v) => set('defense_other', v)} />
            </Field>
            <Field label="Penalidade">
              <NumberInput disabled={!editable} value={sheet.armor_penalty} onChange={(v) => set('armor_penalty', Math.max(0, v))} />
            </Field>
          </div>
          <p className="mt-2 text-center text-sm">
            Defesa <b className="font-display text-2xl text-gold-400">{t20Defense(sheet)}</b>
          </p>
        </Section>
      </div>

      <div className="space-y-3">
        <Section title="Perícias">
          <p className="mb-1 text-[11px] text-parch-300">Marque as treinadas. Clique no nome para rolar.</p>
          {T20_SKILLS.map((sk) => {
            const tr = sheet.trained.includes(sk.key)
            const v = t20Skill(sheet, sk.key)
            return (
              <div key={sk.key} className="flex items-center gap-1">
                <input
                  type="checkbox"
                  disabled={!editable}
                  className="accent-arcane-500"
                  checked={tr}
                  title="Treinada"
                  onChange={(e) => set('trained', e.target.checked ? [...sheet.trained, sk.key] : sheet.trained.filter((x) => x !== sk.key))}
                />
                <div className={cn('flex-1', sk.onlyTrained && !tr && 'opacity-40')}>
                  <RollBtn small label={`${sk.label} (${T20_ATTRS.find((a) => a.key === sk.attr)!.label})`} bonus={v} onRoll={() => roll(`1d20${formatMod(v)}`, sk.label, 'cast')} />
                </div>
              </div>
            )
          })}
        </Section>
      </div>

      <div className="space-y-3">
        <Section
          title="Ataques"
          action={
            editable && (
              <Button size="sm" variant="ghost" onClick={() => set('attacks', [...sheet.attacks, { id: uid(), name: 'Novo ataque', skill: 'luta', damage: '1d6', crit: '20/x2', extra: 0 }])}>
                <Plus size={14} />
              </Button>
            )
          }
        >
          <div className="space-y-2">
            {sheet.attacks.map((a, i) => {
              const extra = Number.isFinite(a.extra) ? a.extra : 0
              const upd = (p: Partial<T20Sheet['attacks'][number]>) => set('attacks', sheet.attacks.map((x, j) => (j === i ? { ...x, ...p } : x)))
              return (
                <div key={a.id} className="rounded-lg border border-ink-700 p-2">
                  <div className="mb-1.5 flex items-center gap-1">
                    {editable ? <Input className="py-1" value={a.name} onChange={(e) => upd({ name: e.target.value })} /> : <p className="flex-1 font-semibold">{a.name}</p>}
                    {editable && (
                      <button type="button" className="p-1 text-ink-500 hover:text-red-400" onClick={() => set('attacks', sheet.attacks.filter((x) => x.id !== a.id))} aria-label="Remover">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                  {editable && (
                    <div className="mb-1.5 space-y-1 text-xs">
                      <div className="grid grid-cols-3 gap-1">
                        <label className="text-parch-300">
                          Perícia
                          <Select className="py-1 text-xs" value={a.skill} onChange={(e) => upd({ skill: e.target.value as 'luta' | 'pontaria' })}>
                            <option value="luta">Luta</option>
                            <option value="pontaria">Pontaria</option>
                          </Select>
                        </label>
                        <label className="text-parch-300">
                          Bônus extra
                          <NumberInput title="Bônus extra no ataque (arma, magia…)" value={extra} onChange={(v) => upd({ extra: v })} />
                        </label>
                        <label className="text-parch-300">
                          Crítico
                          <Input className="py-1 font-mono text-xs" title="Crítico, ex.: 19/x2" value={a.crit} onChange={(e) => upd({ crit: e.target.value })} />
                        </label>
                      </div>
                      <DamageEditor a={a} onChange={upd} />
                    </div>
                  )}
                  <AttackCard a={t20AttackView(sheet, a)} onRoll={(n, l) => roll(n, l)} />
                </div>
              )
            })}
          </div>
        </Section>
        <Section
          title="Poderes e magias"
          action={
            editable && (
              <Button size="sm" variant="ghost" onClick={() => set('powers', [...sheet.powers, { id: uid(), name: 'Novo poder', cost: 1, notation: '', description: '' }])}>
                <Plus size={14} />
              </Button>
            )
          }
        >
          <div className="space-y-1.5">
            {sheet.powers.length === 0 && <p className="text-xs text-parch-300">Nenhum poder.</p>}
            {sheet.powers.map((p, i) => {
              const upd = (q: Partial<T20Sheet['powers'][number]>) => set('powers', sheet.powers.map((x, j) => (j === i ? { ...x, ...q } : x)))
              return (
                <div key={p.id} className="rounded-lg border border-ink-700 p-2 text-sm">
                  {editable ? (
                    <div className="space-y-1">
                      <div className="flex gap-1">
                        <Input className="py-1" value={p.name} onChange={(e) => upd({ name: e.target.value })} />
                        <NumberInput className="!w-14" title="Custo em PM" value={p.cost} onChange={(v) => upd({ cost: Math.max(0, v) })} />
                        <button type="button" className="p-1 text-ink-500 hover:text-red-400" onClick={() => set('powers', sheet.powers.filter((x) => x.id !== p.id))} aria-label="Remover">
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <Input className="py-1 font-mono text-xs" placeholder="Dados (ex.: 2d6)" value={p.notation} onChange={(e) => upd({ notation: e.target.value })} />
                      <Textarea rows={2} className="text-xs" value={p.description} onChange={(e) => upd({ description: e.target.value })} />
                    </div>
                  ) : (
                    <>
                      <p className="font-semibold">
                        {p.name} <span className="text-xs text-sky-300">{p.cost} PM</span>
                      </p>
                      <p className="text-xs text-parch-300">{p.description}</p>
                    </>
                  )}
                  <Button
                    size="sm"
                    variant="primary"
                    className="mt-1 w-full"
                    disabled={sheet.pm < p.cost}
                    onClick={() => {
                      if (p.cost > 0) patch((s) => ({ ...s, pm: Math.max(0, asT20(s).pm - p.cost) }))
                      if (p.notation) roll(p.notation, `${p.name} (−${p.cost} PM)`, 'cast')
                    }}
                  >
                    <Sparkles size={12} /> Usar {p.cost > 0 ? `(${p.cost} PM)` : ''}
                  </Button>
                </div>
              )
            })}
          </div>
        </Section>
        <Section title="Inventário">
          <InventoryPanel c={{ system_id: 'tormenta20' }} sheet={sheet as unknown as Record<string, unknown>} editable={playEditable} onPatch={(p) => patch((s) => ({ ...s, ...p }))} />
        </Section>
        <Section title="Notas">
          {sheet.inventory && <p className="mb-1 text-xs text-parch-300">Inventário antigo (texto), mantido como anotação:</p>}
          <Textarea disabled={!playEditable} rows={3} placeholder="Anotações de equipamento…" value={sheet.inventory} onChange={(e) => set('inventory', e.target.value)} />
          <Textarea disabled={!playEditable} rows={3} className="mt-2" placeholder="Anotações" value={sheet.notes} onChange={(e) => set('notes', e.target.value)} />
        </Section>
      </div>
    </div>
  )
}

// ============================================================ Modal

export function SheetModal() {
  const id = useGame((s) => s.openSheetId)
  const c = useGame((s) => (id ? s.characters[id] : null))
  const close = () => useGame.getState().set({ openSheetId: null })
  return (
    <Modal open={!!c} onClose={close} wide className="max-w-6xl">
      {c && <SheetBody key={c.id} c={c} onClose={close} />}
    </Modal>
  )
}

function SheetBody({ c, onClose }: { c: Character; onClose: () => void }) {
  useEffect(() => sfx('livro', { volume: 0.7 }), [])
  const gm = useIsGm()
  const userId = useGame((s) => s.user?.id)
  const members = useGame((s) => s.members)
  const editable = gm || c.owner_id === userId
  // jogador: joga com a ficha (vida, PM, notas), mas atributos, classe, ataques e poderes só o mestre muda
  const coreEditable = gm
  const { sheet, patch } = useSheetDraft(c)
  const [anim, setAnim] = useState<SpriteAnimName>('idle')
  const roll = useRoller(c, setAnim)
  const sys = systemOf(c)
  const hp = sys.hp(sheet)
  const [delta, setDelta] = useState(5)
  const [editSprite, setEditSprite] = useState(false)
  const dead = hp.max > 0 && hp.hp <= 0
  const ac = sys.ac(sheet)

  const setHp = (n: number) => patch((s) => sys.setHp(s, n))
  const onHp = (d: number) => {
    setHp(hp.hp + d)
    setAnim(d < 0 ? (hp.hp + d <= 0 ? 'death' : 'hurt') : 'cast')
    const sid = activeSceneId(useGame.getState())
    const toks = Object.values(useGame.getState().tokens).filter((t) => t.character_id === c.id && t.scene_id === sid)
    toks.forEach((t) => {
      const ev = { type: 'float' as const, tokenId: t.id, text: d > 0 ? `+${d}` : `${d}`, color: d > 0 ? '#4ade80' : '#f87171' }
      useGame.getState().send(ev)
      emitLocalLive(ev)
    })
  }

  return (
    <div className="grid gap-5 md:grid-cols-[260px_1fr]">
      <div className="space-y-3">
        <TiltCard color={c.color}>
          <div className="flex flex-col items-center px-4 pb-4 pt-6">
            <div className={cn('grid h-48 place-items-center', dead && 'grayscale')}>
              {c.sprite ? (
                <SpriteAnimator key={anim} sprite={c.sprite} anim={dead ? 'death' : anim} scale={176 / c.sprite.frameW} onEnd={() => setAnim(dead ? 'death' : 'idle')} />
              ) : (
                <Portrait url={c.portrait_url ?? c.token_url} sprite={null} name={c.name} color={c.color} size={170} className="rounded-2xl" />
              )}
            </div>
            <input
              disabled={!editable}
              value={c.name}
              onChange={(e) => void useGame.getState().patch('characters', c.id, { name: e.target.value })}
              className="mt-2 w-full bg-transparent text-center font-display text-2xl font-extrabold text-gold-400 outline-none"
            />
            <p className="text-sm text-parch-300">{sys.summary(sheet)}</p>
            <div className="mt-3 grid w-full grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-black/30 p-1.5">
                <Shield size={14} className="mx-auto text-sky-300" />
                <p className="text-lg font-bold">{ac}</p>
                <p className="text-[10px] text-parch-300">{c.system_id === 'dnd5e' ? 'CA' : 'Defesa'}</p>
              </div>
              <button className="rounded-lg bg-black/30 p-1.5 hover:bg-arcane-600/30" onClick={() => roll(sys.initiative(sheet), 'Iniciativa', 'cast')} title="Rolar iniciativa">
                <Zap size={14} className="mx-auto text-amber-300" />
                <p className="text-lg font-bold">{sys.initiative(sheet).replace('1d20', '') || '+0'}</p>
                <p className="text-[10px] text-parch-300">Iniciativa</p>
              </button>
              <div className="rounded-lg bg-black/30 p-1.5">
                <Heart size={14} className="mx-auto text-red-400" />
                <p className="text-lg font-bold">{hp.hp}</p>
                <p className="text-[10px] text-parch-300">de {hp.max}</p>
              </div>
            </div>
          </div>
        </TiltCard>

        <div className="rounded-xl border border-ink-700 p-3 space-y-2">
          <HpBar hp={hp.hp} max={hp.max} temp={hp.temp} className="h-3" />
          {c.system_id === 'tormenta20' && (
            <div className="flex items-center gap-2 text-xs">
              <span className="font-bold text-sky-300">PM</span>
              <div className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-ink-700">
                <div className="h-full bg-sky-500 transition-all" style={{ width: `${Math.max(0, Math.min(1, asT20(sheet).pm / Math.max(1, asT20(sheet).pm_max))) * 100}%` }} />
              </div>
              <span>
                {asT20(sheet).pm}/{asT20(sheet).pm_max}
              </span>
              {editable && (
                <>
                  <button type="button" className="rounded bg-ink-700 px-1.5" onClick={() => patch((s) => ({ ...s, pm: Math.max(0, asT20(s).pm - 1) }))}>
                    −
                  </button>
                  <button type="button" className="rounded bg-ink-700 px-1.5" onClick={() => patch((s) => ({ ...s, pm: Math.min(asT20(s).pm_max, asT20(s).pm + 1) }))}>
                    +
                  </button>
                </>
              )}
            </div>
          )}
          {editable && (
            <>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="danger" onClick={() => onHp(-delta)}>
                  −{delta}
                </Button>
                <NumberInput value={delta} onChange={(v) => setDelta(Math.max(1, v))} />
                <Button size="sm" className="bg-emerald-700 hover:bg-emerald-600 text-white border-0" onClick={() => onHp(delta)}>
                  +{delta}
                </Button>
              </div>
              <div className="grid grid-cols-3 gap-1 text-xs">
                <Field label="PV">
                  <NumberInput value={hp.hp} onChange={(v) => patch((s) => ({ ...s, [c.system_id === 'tormenta20' ? 'pv' : 'hp']: v }))} />
                </Field>
                <Field label="Máx">
                  <NumberInput value={hp.max} onChange={(v) => patch((s) => ({ ...s, [c.system_id === 'tormenta20' ? 'pv_max' : 'hp_max']: v }))} />
                </Field>
                {c.system_id === 'dnd5e' ? (
                  <Field label="Temp">
                    <NumberInput value={hp.temp} onChange={(v) => patch((s) => ({ ...s, hp_temp: v }))} />
                  </Field>
                ) : (
                  <span />
                )}
              </div>
              {c.system_id === 'dnd5e' && (
                <div className="grid grid-cols-2 gap-1 text-xs">
                  <Field label="CA">
                    <NumberInput value={asDnd(sheet).ac} onChange={(v) => patch((s) => ({ ...s, ac: v }))} />
                  </Field>
                  <Field label="Desloc. (m)">
                    <NumberInput value={asDnd(sheet).speed} onChange={(v) => patch((s) => ({ ...s, speed: v }))} />
                  </Field>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {editable && (
            <Button size="sm" onClick={() => setEditSprite(true)}>
              <Wand2 size={14} /> Aparência
            </Button>
          )}
          {gm && (
            <Button
              size="sm"
              onClick={async () => {
                const s = useGame.getState()
                const sid = activeSceneId(s)
                const sc = sid ? s.scenes[sid] : null
                if (sc) await placeToken(c, sc.map_w / 2, sc.map_h / 2)
                onClose()
              }}
            >
              <MapPin size={14} /> Pôr no mapa
            </Button>
          )}
          {gm && (
            <Button size="sm" variant="ghost" onClick={() => void useGame.getState().patch('characters', c.id, { hidden: !c.hidden })} title="Ficha visível para jogadores?">
              {c.hidden ? <EyeOff size={14} /> : <Eye size={14} />} {c.hidden ? 'Oculta' : 'Visível'}
            </Button>
          )}
        </div>
        {gm && c.kind === 'pc' && (
          <Field label="Jogador dono">
            <Select value={c.owner_id ?? ''} onChange={(e) => void useGame.getState().patch('characters', c.id, { owner_id: e.target.value || null })}>
              <option value="">— ninguém —</option>
              {Object.values(members).map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.display_name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        {c.sprite?.credits && <p className="text-[10px] text-ink-500">Arte: {c.sprite.credits}</p>}
      </div>

      <div className="min-w-0">
        {c.system_id === 'tormenta20' ? (
          <T20SheetView c={c} sheet={asT20(sheet)} patch={patch} editable={coreEditable} playEditable={editable} roll={roll} />
        ) : c.system_id === 'dnd5e' ? (
          <DndSheet c={c} sheet={asDnd(sheet)} patch={patch} editable={coreEditable} playEditable={editable} roll={roll} />
        ) : (
          <GenericSheetView sheet={asGeneric(sheet)} patch={patch} editable={coreEditable} playEditable={editable} roll={roll} />
        )}
        {sys.attribution && <p className="mt-3 text-[10px] text-ink-500">{sys.attribution}</p>}
      </div>

      <AppearanceModal c={c} open={editSprite} onClose={() => setEditSprite(false)} />
    </div>
  )
}

function AppearanceModal({ c, open, onClose }: { c: Character; open: boolean; onClose: () => void }) {
  const [choice, setChoice] = useState<SpriteChoice>({ mode: 'recipe', recipe: ((c.sheet.recipe as SpriteRecipe) ?? DEFAULT_RECIPE) as SpriteRecipe })
  const [color, setColor] = useState(c.color)
  const [busy, setBusy] = useState(false)
  return (
    <Modal open={open} onClose={onClose} title="Aparência" wide>
      <SpriteEditor value={choice} onChange={setChoice} />
      <div className="mt-4 flex items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          Cor do anel <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-8 w-12 rounded border border-ink-600 bg-transparent" />
        </label>
        <Button
          variant="primary"
          className="ml-auto"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            try {
              const r = await resolveSpriteChoice(c.campaign_id, choice, color)
              const s = useGame.getState()
              await s.patch('characters', c.id, { sprite: r.sprite, token_url: r.token_url, portrait_url: r.portrait_url, color, sheet: { ...c.sheet, recipe: r.recipe ?? c.sheet.recipe } })
              for (const t of Object.values(s.tokens).filter((t) => t.character_id === c.id)) await s.patch('tokens', t.id, { image_url: r.token_url, color })
              onClose()
            } catch (e) {
              useGame.getState().set({ error: (e as Error).message })
            } finally {
              setBusy(false)
            }
          }}
        >
          Salvar aparência
        </Button>
      </div>
    </Modal>
  )
}
