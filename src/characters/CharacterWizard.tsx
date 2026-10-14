import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, Minus, Plus, Sparkles, Wand2 } from 'lucide-react'
import type { Character } from '../types'
import { activeSceneId, useGame } from '../store/game'
import { Button, cn, Field, Input, Modal, Spinner } from '../components/ui'
import { SpriteEditor, useRecipePreview, type SpriteChoice } from './SpriteEditor'
import { SpriteAnimator } from './SpriteView'
import { resolveSpriteChoice } from './spriteActions'
import { SYSTEMS } from '../systems'
import { T20_ATTRS, t20mod, t20Resources, type T20Attr } from '../systems/tormenta20'
import { ARMORS, CLASSES, CLASS_BY_ID, DEITIES, HAIR_COLORS, HAIR_STYLES, ORIGINS, POINT_BUY_TOTAL, POINT_COST, RACES, RACE_BY_ID, SKIN_TONES, WEAPONS, composeLook, defaultGear, pointsSpent, type HeroChoices } from '../systems/heroes'
import { T20_SKILLS } from '../systems/tormenta20'
import { starterBag } from '../systems/inventory'
import { formatMod } from '../engine/dice'
import { PLAYER_COLORS, uid } from '../lib/id'
import { placeToken } from '../game/actions'
import { sfx } from '../audio/sfx'

type Step = 'race' | 'class' | 'origin' | 'deity' | 'attrs' | 'powers' | 'equip' | 'look' | 'review'
const STEP_TITLES: Record<Step, string> = { race: 'Raça', class: 'Classe', origin: 'Origem', deity: 'Divindade', attrs: 'Atributos', powers: 'Poderes', equip: 'Equipamento', look: 'Nome e aparência', review: 'Revisão' }
const BASE: Record<T20Attr, number> = { for: 10, des: 10, con: 10, int: 10, sab: 10, car: 10 }

function HeroPreview({ race, cls, ch = {}, size = 3, anim = 'idle' as const }: { race: string; cls: string; ch?: HeroChoices; size?: number; anim?: 'idle' | 'attack' | 'cast' }) {
  const key = JSON.stringify(ch)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const sprite = useRecipePreview(useMemo(() => composeLook(race, cls, ch), [race, cls, key]))
  return <SpriteAnimator sprite={sprite} scale={(size * 32) / sprite.frameW} anim={anim} />
}

function PickCard({ active, onClick, children, testid }: { active: boolean; onClick: () => void; children: React.ReactNode; testid?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testid}
      className={cn('relative flex flex-col items-center rounded-xl border p-2 text-center transition', active ? 'border-gold-400 bg-gold-500/10 glow-gold' : 'border-ink-600 hover:border-ink-500 hover:bg-ink-800')}
    >
      {active && <Check size={14} className="absolute right-1.5 top-1.5 text-gold-400" />}
      {children}
    </button>
  )
}

function bonusText(b: Partial<Record<T20Attr, number>>, free?: number) {
  const parts = Object.entries(b).map(([k, v]) => `${v! > 0 ? '+' : ''}${v! * 2} ${k.toUpperCase()}`)
  if (free) parts.unshift(`+2 em ${free} à escolha`)
  return parts.join(' · ')
}

/** Assistente de criação: raça e classe definem o visual, compra de pontos e poderes da classe. */
export function CharacterWizard({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated?: (c: Character) => void }) {
  const campaign = useGame((s) => s.campaign)
  const userId = useGame((s) => s.user?.id ?? null)
  const count = useGame((s) => Object.keys(s.characters).length)
  const system = campaign?.system_id ?? 'tormenta20'
  const t20 = system === 'tormenta20'
  const steps: Step[] = ['race', 'class', 'origin', 'deity', 'attrs', 'powers', 'equip', 'look', 'review']
  const [step, setStep] = useState<Step>('race')
  const [race, setRace] = useState('humano')
  const [cls, setCls] = useState('Guerreiro')
  const [base, setBase] = useState<Record<T20Attr, number>>({ ...BASE })
  const [freePicks, setFreePicks] = useState<T20Attr[]>([])
  const [powers, setPowers] = useState<string[]>([])
  const [ch, setCh] = useState<HeroChoices>({ origin: 'soldado', deity: 'nenhuma', ...defaultGear('Guerreiro') })
  const upd = (p: Partial<HeroChoices>) => setCh((c) => ({ ...c, ...p }))
  const [name, setName] = useState('')
  const [color, setColor] = useState(PLAYER_COLORS[count % PLAYER_COLORS.length])
  const [custom, setCustom] = useState<SpriteChoice | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const raceDef = RACE_BY_ID[race]
  const classDef = CLASS_BY_ID[cls]
  const idx = steps.indexOf(step)
  useEffect(() => {
    if (open) sfx('pagina', { volume: 0.6 })
  }, [step, open])
  const spent = pointsSpent(base)
  const left = POINT_BUY_TOTAL - spent
  const finalAttrs = useMemo(() => {
    const out = { ...base }
    for (const [k, v] of Object.entries(raceDef.bonus)) out[k as T20Attr] += v! * 2
    for (const k of freePicks) out[k] += 2
    return out
  }, [base, raceDef, freePicks])
  const res = t20Resources(cls, 1, finalAttrs.con)

  const chooseRace = (id: string) => {
    setRace(id)
    setFreePicks([])
    upd({ skin: undefined, hair: undefined, hairStyle: undefined, beard: undefined })
  }
  const chooseClass = (id: string) => {
    setCls(id)
    setPowers([])
    upd(defaultGear(id))
  }
  const origin = ORIGINS.find((o) => o.id === ch.origin)
  const deity = DEITIES.find((d) => d.id === ch.deity)
  const weapon = WEAPONS.find((w) => w.id === ch.weapon) ?? WEAPONS[0]
  const armor = ARMORS.find((a) => a.id === ch.armor) ?? ARMORS[0]
  const shieldOk = weapon.weapon !== 'bow' && weapon.weapon !== 'staff'
  const look = composeLook(race, cls, ch)
  const bump = (k: T20Attr, d: number) => {
    const v = base[k] + d
    if (v < 8 || v > 18) return
    const next = { ...base, [k]: v }
    if (pointsSpent(next) > POINT_BUY_TOTAL) return
    setBase(next)
  }
  const autoDistribute = () => {
    // gasta todos os pontos priorizando os atributos-chave da classe
    const others = T20_ATTRS.map((a) => a.key).filter((k) => !classDef.key.includes(k))
    const order = [...classDef.key, ...others]
    const caps: Record<string, number> = { [order[0]]: 17, [order[1]]: 15, [order[2]]: 14 }
    const next = { ...BASE }
    next[others[others.length - 1]] = 8
    let changed = true
    while (changed) {
      changed = false
      for (const k of order) {
        const cap = caps[k] ?? 12
        if (next[k] >= cap) continue
        const trial = { ...next, [k]: next[k] + 1 }
        if (pointsSpent(trial) <= POINT_BUY_TOTAL) {
          next[k]++
          changed = true
          break
        }
      }
    }
    setBase(next)
    if (raceDef.free) setFreePicks(order.filter((k) => !(k in raceDef.bonus)).slice(0, raceDef.free))
  }

  const canNext = (() => {
    if (step === 'attrs') return left >= 0 && (!raceDef.free || freePicks.length === raceDef.free)
    if (step === 'powers') return powers.length === Math.min(classDef.picks, classDef.powers.length)
    if (step === 'look') return name.trim().length > 0
    return true
  })()

  const create = async () => {
    if (!campaign) return
    setBusy(true)
    setErr(null)
    try {
      const choice: SpriteChoice = custom ?? { mode: 'recipe', recipe: look }
      const r = await resolveSpriteChoice(campaign.id, choice, color)
      const sys = SYSTEMS[system] ?? SYSTEMS.generico
      const chosen = classDef.powers.filter((p) => powers.includes(p.name)).map((p) => ({ id: uid(), ...p }))
      let sheet: Record<string, unknown> = { ...sys.defaultSheet(), recipe: r.recipe }
      if (t20)
        sheet = {
          ...sheet,
          race: raceDef.label,
          class: cls,
          level: 1,
          attrs: finalAttrs,
          trained: [...new Set([...classDef.skills, ...(origin?.skills ?? [])])],
          origin: origin?.label ?? '',
          deity: deity && deity.id !== 'nenhuma' ? deity.label : '',
          defense_armor: armor.defense + (ch.shield && shieldOk ? 2 : 0),
          armor_penalty: armor.penalty + (ch.shield && shieldOk ? 1 : 0),
          inventory: '',
          pv: res.pv,
          pv_max: res.pv,
          pm: res.pm,
          pm_max: res.pm,
          attacks: [{ id: uid(), name: weapon.label, skill: weapon.skill, damage: weapon.damage, crit: weapon.crit, extra: 0 }],
          powers: chosen,
          darkvision: raceDef.darkvision ?? 0,
        }
      else if (system === 'dnd5e') {
        // D&D 5e: mesmas escolhas traduzidas para a ficha de D&D
        const prof = 2
        const con = Math.floor((finalAttrs.con - 10) / 2)
        const dexMod = Math.floor((finalAttrs.des - 10) / 2)
        const atkMod = Math.floor(((weapon.skill === 'pontaria' ? finalAttrs.des : finalAttrs.for) - 10) / 2)
        const hitDie = Math.max(6, Math.min(12, Math.round(res.pv / 2)))
        const map5e: Record<string, string> = { luta: 'atletismo', atletismo: 'atletismo', acrobacia: 'acrobacia', furtividade: 'furtividade', percepcao: 'percepcao', intimidacao: 'intimidacao', enganacao: 'enganacao', diplomacia: 'persuasao', atuacao: 'atuacao', misticismo: 'arcanismo', conhecimento: 'historia', religiao: 'religiao', cura: 'medicina', sobrevivencia: 'sobrevivencia', adestramento: 'adestrar', intuicao: 'intuicao', investigacao: 'investigacao', ladinagem: 'prestidigitacao', guerra: 'historia', nobreza: 'historia' }
        const skills: Record<string, 1> = {}
        for (const k of [...classDef.skills, ...(origin?.skills ?? [])]) if (map5e[k]) skills[map5e[k]] = 1
        sheet = {
          ...sheet,
          race: raceDef.label,
          class: cls,
          level: 1,
          background: origin?.label ?? '',
          alignment: deity && deity.id !== 'nenhuma' ? `Devoto de ${deity.label}` : '',
          abilities: finalAttrs,
          saves: classDef.key.slice(0, 2),
          skills,
          hp: hitDie + con,
          hp_max: hitDie + con,
          ac: 10 + dexMod + armor.defense + (ch.shield && shieldOk ? 2 : 0),
          attacks: [{ id: uid(), name: weapon.label, bonus: atkMod + prof, damage: `${weapon.damage}${atkMod ? (atkMod > 0 ? `+${atkMod}` : atkMod) : ''}`, type: weapon.crit }],
          spells: chosen.map((p) => ({ id: p.id, name: p.name, level: p.cost, notation: p.notation, description: p.description })),
          spell_ability: classDef.key[0],
          features: '',
          darkvision: raceDef.darkvision ?? 0,
        }
      } else {
        // Genérico: atributos com os nomes de Tormenta, vida, defesa, ações e equipamento
        sheet = {
          ...sheet,
          concept: `${raceDef.label} ${cls}${origin ? ` (${origin.label})` : ''}`,
          attributes: T20_ATTRS.map((a) => ({ id: uid(), name: a.full, value: t20mod(finalAttrs[a.key]) })),
          hp: res.pv,
          hp_max: res.pv,
          defense: 10 + t20mod(finalAttrs.des) + armor.defense + (ch.shield && shieldOk ? 2 : 0),
          actions: [
            { id: uid(), name: `Ataque: ${weapon.label}`, notation: `1d20${formatMod(t20mod(weapon.skill === 'pontaria' ? finalAttrs.des : finalAttrs.for) + 2)}` },
            { id: uid(), name: `Dano: ${weapon.label}`, notation: weapon.damage },
            ...chosen.filter((p) => p.notation).map((p) => ({ id: p.id, name: p.name, notation: p.notation })),
          ],
          inventory: [],
          notes: [deity && deity.id !== 'nenhuma' ? `Devoto de ${deity.label}` : '', ...chosen.map((p) => `${p.name}: ${p.description}`)].filter(Boolean).join('\n'),
        }
      }
      sheet = { ...sheet, bag: starterBag(system, { weapon, armor, shield: !!ch.shield && shieldOk, originItem: origin?.item }) }
      const c: Character = {
        id: uid(),
        campaign_id: campaign.id,
        owner_id: userId,
        kind: 'pc',
        name: name.trim(),
        system_id: system,
        sheet,
        portrait_url: r.portrait_url,
        token_url: r.token_url,
        sprite: r.sprite,
        color,
        hidden: false,
      }
      const s = useGame.getState()
      await s.save('characters', c)
      const sid = activeSceneId(s)
      const sc = sid ? s.scenes[sid] : null
      if (sc?.kind === 'map') await placeToken(c, sc.map_w / 2, sc.map_h / 2, sc.id).catch(() => null)
      sfx('personagemCriado')
      onCreated?.(c)
      onClose()
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`Criar personagem · ${STEP_TITLES[step]}`} wide>
      <div className="mb-4 flex gap-1">
        {steps.map((s2, i) => (
          <button key={s2} type="button" onClick={() => i < idx && setStep(s2)} className={cn('h-1.5 flex-1 rounded-full', i <= idx ? 'bg-gold-400' : 'bg-ink-700')} aria-label={STEP_TITLES[s2]} />
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-[180px_1fr]">
        {/* prévia sempre visível */}
        <div className="flex flex-col items-center rounded-2xl bg-[radial-gradient(circle,#3d3452,#14111c)] p-3 md:sticky md:top-0 md:self-start">
          <HeroPreview race={race} cls={cls} ch={ch} size={4} anim={step === 'powers' ? 'cast' : step === 'class' || step === 'equip' ? 'attack' : 'idle'} />
          <p className="mt-1 font-display text-lg text-gold-400">{name || 'Seu herói'}</p>
          <p className="text-xs text-parch-300">
            {raceDef.label} · {cls}
          </p>
          {(origin || (deity && deity.id !== 'nenhuma')) && (
            <p className="text-[10px] text-parch-300">
              {origin?.label}
              {deity && deity.id !== 'nenhuma' ? ` · devoto de ${deity.label}` : ''}
            </p>
          )}
          {t20 && (
            <p className="mt-1 text-xs">
              <b className="text-red-300">{res.pv} PV</b> · <b className="text-sky-300">{res.pm} PM</b> · Def {10 + t20mod(finalAttrs.des) + armor.defense + (ch.shield && shieldOk ? 2 : 0)}
            </p>
          )}
        </div>

        <div className="min-w-0">
          {step === 'race' && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {RACES.map((r) => (
                <PickCard key={r.id} active={race === r.id} onClick={() => chooseRace(r.id)} testid={`race-${r.id}`}>
                  <HeroPreview race={r.id} cls={cls} ch={{ ...ch, skin: undefined, hair: undefined, hairStyle: undefined, beard: undefined }} size={2} />
                  <span className="text-sm font-semibold">{r.label}</span>
                  <span className="text-[10px] text-parch-300">{r.blurb}</span>
                  <span className="mt-0.5 text-[10px] text-gold-400">{bonusText(r.bonus, r.free)}</span>
                </PickCard>
              ))}
            </div>
          )}

          {step === 'class' && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {CLASSES.map((c) => {
                const r = t20Resources(c.id, 1, finalAttrs.con)
                return (
                  <PickCard key={c.id} active={cls === c.id} onClick={() => chooseClass(c.id)} testid={`class-${c.id}`}>
                    <HeroPreview race={race} cls={c.id} ch={{ ...ch, ...defaultGear(c.id) }} size={2} />
                    <span className="text-sm font-semibold">{c.label}</span>
                    <span className="text-[10px] text-parch-300">{c.role}</span>
                    <span className="mt-0.5 text-[10px] text-gold-400">
                      {r.pv} PV · {r.pm} PM
                    </span>
                  </PickCard>
                )
              })}
            </div>
          )}

          {step === 'origin' && (
            <div className="space-y-2">
              <p className="text-sm text-parch-300">De onde seu personagem veio? A origem dá perícias treinadas, um item e muda detalhes do visual.</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {ORIGINS.map((o) => (
                  <PickCard key={o.id} active={ch.origin === o.id} onClick={() => upd({ origin: o.id })} testid={`origin-${o.id}`}>
                    <span className="text-sm font-semibold">{o.label}</span>
                    <span className="text-[10px] text-parch-300">{o.skills.map((k) => T20_SKILLS.find((x) => x.key === k)?.label).join(' · ')}</span>
                    <span className="text-[10px] text-gold-400">{o.item}</span>
                  </PickCard>
                ))}
              </div>
            </div>
          )}

          {step === 'deity' && (
            <div className="space-y-2">
              <p className="text-sm text-parch-300">Seu personagem é devoto de algum deus? A cor da divindade aparece na capa.</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {DEITIES.map((d) => (
                  <PickCard key={d.id} active={ch.deity === d.id} onClick={() => upd({ deity: d.id })} testid={`deity-${d.id}`}>
                    <span className="mb-1 size-5 rounded-full border border-ink-500" style={{ background: d.color || 'transparent' }} />
                    <span className="text-sm font-semibold">{d.label}</span>
                    <span className="text-[10px] text-parch-300">{d.domain}</span>
                  </PickCard>
                ))}
              </div>
            </div>
          )}

          {step === 'equip' && (
            <div className="space-y-3">
              <div>
                <p className="mb-1 text-xs font-bold uppercase tracking-wide text-parch-300">Arma principal</p>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                  {WEAPONS.map((w) => (
                    <PickCard key={w.id} active={ch.weapon === w.id} onClick={() => upd({ weapon: w.id })} testid={`weapon-${w.id}`}>
                      <span className="text-sm font-semibold">{w.label}</span>
                      <span className="font-mono text-[10px] text-gold-400">
                        {w.damage} · {w.crit} · {w.skill === 'luta' ? 'Luta' : 'Pontaria'}
                      </span>
                    </PickCard>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-1 text-xs font-bold uppercase tracking-wide text-parch-300">Armadura</p>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                  {ARMORS.map((a) => (
                    <PickCard key={a.id} active={ch.armor === a.id} onClick={() => upd({ armor: a.id })}>
                      <span className="text-sm font-semibold">{a.label}</span>
                      <span className="text-[10px] text-gold-400">
                        Defesa +{a.defense}
                        {a.penalty ? ` · penalidade −${a.penalty}` : ''}
                      </span>
                    </PickCard>
                  ))}
                </div>
              </div>
              <label className={cn('flex items-center gap-2 text-sm', !shieldOk && 'opacity-40')}>
                <input type="checkbox" className="accent-arcane-500" disabled={!shieldOk} checked={!!ch.shield && shieldOk} onChange={(e) => upd({ shield: e.target.checked })} /> Escudo (+2 Defesa){!shieldOk && ' — não combina com arco/cajado'}
              </label>
            </div>
          )}

          {step === 'attrs' && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className={cn('rounded-lg px-3 py-1.5 text-sm font-bold', left < 0 ? 'bg-red-900 text-red-200' : left === 0 ? 'bg-emerald-900 text-emerald-200' : 'bg-ink-700')} data-testid="points-left">
                  Pontos restantes: {left} / {POINT_BUY_TOTAL}
                </p>
                <Button type="button" variant="gold" size="sm" onClick={autoDistribute} data-testid="auto-points">
                  <Wand2 size={14} /> Distribuir para {cls}
                </Button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {T20_ATTRS.map((a) => {
                  const racial = (raceDef.bonus[a.key] ?? 0) * 2 + (freePicks.includes(a.key) ? 2 : 0)
                  const v = finalAttrs[a.key]
                  return (
                    <div key={a.key} className={cn('flex items-center gap-2 rounded-xl border p-2', classDef.key.includes(a.key) ? 'border-gold-500/50 bg-gold-500/5' : 'border-ink-700')}>
                      <div className="w-24">
                        <p className="text-sm font-semibold">{a.full}</p>
                        {classDef.key.includes(a.key) && <p className="text-[10px] text-gold-400">importante para {cls}</p>}
                      </div>
                      <button type="button" className="grid size-8 place-items-center rounded-lg bg-ink-700 disabled:opacity-30" disabled={base[a.key] <= 8} onClick={() => bump(a.key, -1)} aria-label={`Diminuir ${a.full}`}>
                        <Minus size={14} />
                      </button>
                      <span className="w-6 text-center font-mono">{base[a.key]}</span>
                      <button type="button" className="grid size-8 place-items-center rounded-lg bg-ink-700 disabled:opacity-30" disabled={base[a.key] >= 18 || (POINT_COST[base[a.key] + 1] ?? 99) - (POINT_COST[base[a.key]] ?? 0) > left} onClick={() => bump(a.key, 1)} aria-label={`Aumentar ${a.full}`}>
                        <Plus size={14} />
                      </button>
                      {racial !== 0 && <span className={cn('text-xs', racial > 0 ? 'text-emerald-300' : 'text-red-300')}>{racial > 0 ? `+${racial}` : racial}</span>}
                      <span className="ml-auto text-right">
                        <span className="block font-display text-xl font-extrabold text-gold-400">{formatMod(t20mod(v))}</span>
                        <span className="text-[10px] text-parch-300">valor {v}</span>
                      </span>
                    </div>
                  )
                })}
              </div>
              {raceDef.free ? (
                <div className="rounded-xl border border-ink-700 p-2">
                  <p className="mb-1 text-xs text-parch-300">
                    {raceDef.label}: escolha {raceDef.free} atributos para +2 ({freePicks.length}/{raceDef.free})
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {T20_ATTRS.filter((a) => !(raceDef.bonus[a.key] && raceDef.bonus[a.key]! < 0)).map((a) => (
                      <button
                        type="button"
                        key={a.key}
                        onClick={() => setFreePicks((f) => (f.includes(a.key) ? f.filter((x) => x !== a.key) : f.length < raceDef.free! ? [...f, a.key] : f))}
                        className={cn('rounded-md px-2 py-1 text-xs', freePicks.includes(a.key) ? 'bg-arcane-600 text-white' : 'bg-ink-700')}
                      >
                        {a.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              <p className="text-[11px] text-ink-500">Compra de pontos: todos começam em 10 e você tem {POINT_BUY_TOTAL} pontos (valores altos custam mais). Bônus de raça somados automaticamente. Se sua mesa usa outra regra, o mestre ajusta depois na ficha.</p>
            </div>
          )}

          {step === 'powers' && (
            <div className="space-y-2">
              <p className="text-sm text-parch-300">
                Escolha {Math.min(classDef.picks, classDef.powers.length)} {classDef.picks > 1 ? 'poderes' : 'poder'} de {cls}. Na mesa, você só terá acesso a eles (o mestre pode liberar outros depois).
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {classDef.powers.map((p) => {
                  const on = powers.includes(p.name)
                  return (
                    <button
                      type="button"
                      key={p.name}
                      data-testid={`power-${p.name}`}
                      onClick={() => setPowers((list) => (on ? list.filter((x) => x !== p.name) : list.length < classDef.picks ? [...list, p.name] : [...list.slice(1), p.name]))}
                      className={cn('rounded-xl border p-3 text-left transition', on ? 'border-arcane-400 bg-arcane-600/20' : 'border-ink-700 hover:bg-ink-800')}
                    >
                      <p className="flex items-center justify-between font-semibold">
                        {p.name}
                        <span className="text-xs text-sky-300">{p.cost ? `${p.cost} PM` : 'grátis'}</span>
                      </p>
                      <p className="text-xs text-parch-300">{p.description}</p>
                      {p.notation && <p className="mt-1 font-mono text-xs text-gold-400">{p.notation}</p>}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {step === 'look' && (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <Field label="Nome do personagem">
                  <Input autoFocus value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Thalia Ventoleste" data-testid="wizard-name" />
                </Field>
                <Field label="Sua cor">
                  <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-16 rounded border border-ink-600 bg-transparent" />
                </Field>
              </div>
              {!custom && (
                <div className="space-y-2 rounded-xl border border-ink-700 p-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-parch-300">Tom de pele</p>
                  <div className="flex flex-wrap gap-1.5">
                    {[RACE_BY_ID[race].look.skin, ...SKIN_TONES].map((c2, i) => (
                      <button type="button" key={c2 + i} onClick={() => upd({ skin: c2 })} className={cn('size-7 rounded-full border-2', (ch.skin ?? RACE_BY_ID[race].look.skin) === c2 ? 'border-gold-400' : 'border-ink-600')} style={{ background: c2 }} aria-label="Tom de pele" />
                    ))}
                  </div>
                  <p className="text-xs font-bold uppercase tracking-wide text-parch-300">Cabelo</p>
                  <div className="flex flex-wrap gap-1.5">
                    {HAIR_COLORS.map((c2) => (
                      <button type="button" key={c2} onClick={() => upd({ hair: c2 })} className={cn('size-7 rounded-full border-2', ch.hair === c2 ? 'border-gold-400' : 'border-ink-600')} style={{ background: c2 }} aria-label="Cor do cabelo" />
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {HAIR_STYLES.map((h) => (
                      <button type="button" key={h.id} onClick={() => upd({ hairStyle: h.id })} className={cn('rounded-md px-2 py-1 text-xs', (look.hairStyle ?? 'short') === h.id ? 'bg-arcane-600 text-white' : 'bg-ink-700')}>
                        {h.label}
                      </button>
                    ))}
                    <button type="button" onClick={() => upd({ beard: !look.beard })} className={cn('rounded-md px-2 py-1 text-xs', look.beard ? 'bg-arcane-600 text-white' : 'bg-ink-700')}>
                      Barba
                    </button>
                  </div>
                  <p className="text-xs font-bold uppercase tracking-wide text-parch-300">Cor da roupa</p>
                  <input type="color" value={look.outfit} onChange={(e) => upd({ outfit: e.target.value })} className="h-8 w-14 rounded border border-ink-600 bg-transparent" />
                </div>
              )}
              {custom ? (
                <>
                  <SpriteEditor value={custom} onChange={setCustom} />
                  <Button type="button" size="sm" variant="ghost" onClick={() => setCustom(null)}>
                    Voltar ao visual de {raceDef.label} {cls}
                  </Button>
                </>
              ) : (
                <div className="rounded-xl border border-ink-700 p-3 text-sm text-parch-300">
                  O visual vem de todas as suas escolhas (raça, classe, origem, divindade e equipamento).{' '}
                  <button type="button" className="text-arcane-400 underline" onClick={() => setCustom({ mode: 'recipe', recipe: look })}>
                    Personalizar cores e equipamento
                  </button>{' '}
                  ou envie sua própria arte.
                </div>
              )}
            </div>
          )}

          {step === 'review' && (
            <div className="space-y-3 text-center">
              <Sparkles className="mx-auto text-gold-400" size={28} />
              <p className="font-display text-3xl font-extrabold text-gold-400">{name}</p>
              <p className="text-parch-300">
                {raceDef.label} {cls} · {classDef.role}
              </p>
              <div className="mx-auto grid max-w-md grid-cols-6 gap-1">
                {T20_ATTRS.map((a) => (
                  <div key={a.key} className="rounded-lg bg-ink-850 p-1">
                    <p className="text-[10px] text-parch-300">{a.label}</p>
                    <p className="font-bold text-gold-400">{formatMod(t20mod(finalAttrs[a.key]))}</p>
                  </div>
                ))}
              </div>
              <p className="text-sm">Poderes: {powers.join(', ') || '—'}</p>
              <p className="text-sm">
                {origin?.label} · {deity && deity.id !== 'nenhuma' ? `devoto de ${deity.label}` : 'sem divindade'}
              </p>
              <p className="text-sm">
                {weapon.label} ({weapon.damage}) · {armor.label}
                {ch.shield && shieldOk ? ' · escudo' : ''} · Defesa {10 + t20mod(finalAttrs.des) + armor.defense + (ch.shield && shieldOk ? 2 : 0)}
              </p>
              <p className="text-xs text-parch-300">
                Perícias treinadas: {[...new Set([...classDef.skills, ...(origin?.skills ?? [])])].map((k) => T20_SKILLS.find((x) => x.key === k)?.label ?? k).join(', ')}
              </p>
            </div>
          )}
        </div>
      </div>

      {err && <p className="mt-3 text-sm text-red-400">{err}</p>}
      <div className="mt-5 flex items-center justify-between">
        <Button type="button" variant="ghost" disabled={idx === 0} onClick={() => setStep(steps[idx - 1])}>
          <ArrowLeft size={16} /> Voltar
        </Button>
        {step === 'review' ? (
          <Button type="button" variant="gold" disabled={busy} onClick={create} data-testid="wizard-create">
            {busy ? <Spinner /> : <Sparkles size={16} />} Criar personagem
          </Button>
        ) : (
          <Button type="button" variant="primary" disabled={!canNext} onClick={() => setStep(steps[idx + 1])} data-testid="wizard-next">
            Próximo <ArrowRight size={16} />
          </Button>
        )}
      </div>
    </Modal>
  )
}
