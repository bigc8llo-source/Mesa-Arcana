import { useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, Dices, Sparkles } from 'lucide-react'
import type { Character } from '../types'
import { activeSceneId, useGame } from '../store/game'
import { Button, cn, Field, Input, Modal, NumberInput, Select, Spinner } from '../components/ui'
import { SpriteEditor, useRecipePreview, type SpriteChoice } from './SpriteEditor'
import { SpriteAnimator } from './SpriteView'
import { resolveSpriteChoice } from './spriteActions'
import { RECIPE_PRESETS, DEFAULT_RECIPE } from '../engine/sprites'
import { SYSTEMS } from '../systems'
import { T20_ATTRS, T20_CLASSES, T20_RACES, T20_SKILLS, t20mod, t20Resources, type T20Attr } from '../systems/tormenta20'
import { formatMod, roll, randomSeed } from '../engine/dice'
import { PLAYER_COLORS, uid } from '../lib/id'
import { placeToken } from '../game/actions'

type Step = 'concept' | 'attrs' | 'skills' | 'look' | 'review'

function ClassCard({ name, active, onClick }: { name: string; active: boolean; onClick: () => void }) {
  const preset = RECIPE_PRESETS[T20_CLASSES[name]?.sprite ?? 'guerreiro']?.recipe ?? DEFAULT_RECIPE
  const sprite = useRecipePreview(preset)
  const c = T20_CLASSES[name]
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('flex flex-col items-center rounded-xl border p-2 transition', active ? 'border-gold-400 bg-gold-500/10 glow-gold' : 'border-ink-600 hover:border-ink-500 hover:bg-ink-800')}
    >
      <SpriteAnimator sprite={sprite} scale={2} />
      <span className="text-sm font-semibold">{name}</span>
      <span className="text-[10px] text-parch-300">
        PV {c.pv} · PM {c.pm}/nív.
      </span>
    </button>
  )
}

/** Assistente passo a passo para o jogador criar a ficha (Tormenta20 completo; outros sistemas simplificado). */
export function CharacterWizard({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated?: (c: Character) => void }) {
  const campaign = useGame((s) => s.campaign)
  const userId = useGame((s) => s.user?.id ?? null)
  const count = useGame((s) => Object.keys(s.characters).length)
  const system = campaign?.system_id ?? 'tormenta20'
  const t20 = system === 'tormenta20'
  const steps: Step[] = t20 ? ['concept', 'attrs', 'skills', 'look', 'review'] : ['concept', 'look', 'review']
  const [step, setStep] = useState<Step>('concept')
  const [name, setName] = useState('')
  const [race, setRace] = useState(t20 ? 'Humano' : '')
  const [cls, setCls] = useState(t20 ? 'Guerreiro' : '')
  const [origin, setOrigin] = useState('')
  const [deity, setDeity] = useState('')
  const [attrs, setAttrs] = useState<Record<T20Attr, number>>({ for: 10, des: 10, con: 10, int: 10, sab: 10, car: 10 })
  const [trained, setTrained] = useState<string[]>([])
  const [color, setColor] = useState(PLAYER_COLORS[count % PLAYER_COLORS.length])
  const [choice, setChoice] = useState<SpriteChoice>({ mode: 'recipe', recipe: RECIPE_PRESETS.guerreiro.recipe })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const idx = steps.indexOf(step)
  const res = useMemo(() => t20Resources(cls, 1, attrs.con), [cls, attrs.con])

  const pickClass = (c: string) => {
    setCls(c)
    if (choice.mode === 'recipe') setChoice({ mode: 'recipe', recipe: RECIPE_PRESETS[T20_CLASSES[c]?.sprite ?? 'guerreiro'].recipe })
  }
  const rollAttrs = () => {
    const next = { ...attrs }
    for (const a of T20_ATTRS) next[a.key] = roll('4d6kh3', randomSeed()).total
    setAttrs(next)
  }

  const create = async () => {
    if (!campaign) return
    setBusy(true)
    setErr(null)
    try {
      const r = await resolveSpriteChoice(campaign.id, choice, color)
      const sys = SYSTEMS[system] ?? SYSTEMS.generico
      let sheet: Record<string, unknown> = { ...sys.defaultSheet(), recipe: r.recipe }
      if (t20) sheet = { ...sheet, race, class: cls, origin, deity, level: 1, attrs, trained, pv: res.pv, pv_max: res.pv, pm: res.pm, pm_max: res.pm }
      else if (system === 'dnd5e') sheet = { ...sheet, race: race || 'Humano', class: cls || 'Guerreiro' }
      else sheet = { ...sheet, concept: [race, cls].filter(Boolean).join(' ') }
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
      // já coloca o herói no mapa ativo, se houver
      const sid = activeSceneId(s)
      const sc = sid ? s.scenes[sid] : null
      if (sc?.kind === 'map') await placeToken(c, sc.map_w / 2, sc.map_h / 2, sc.id).catch(() => null)
      onCreated?.(c)
      onClose()
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const canNext = step !== 'concept' || name.trim().length > 0
  const titles: Record<Step, string> = { concept: 'Quem é você?', attrs: 'Atributos', skills: 'Perícias treinadas', look: 'Aparência', review: 'Tudo pronto!' }

  return (
    <Modal open={open} onClose={onClose} title={`Criar ficha · ${titles[step]}`} wide>
      <div className="mb-4 flex gap-1">
        {steps.map((s2, i) => (
          <div key={s2} className={cn('h-1.5 flex-1 rounded-full', i <= idx ? 'bg-gold-400' : 'bg-ink-700')} />
        ))}
      </div>

      {step === 'concept' && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nome do personagem">
              <Input autoFocus required value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Thalia Ventoleste" data-testid="wizard-name" />
            </Field>
            {t20 ? (
              <Field label="Raça">
                <Select value={race} onChange={(e) => setRace(e.target.value)}>
                  {T20_RACES.map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </Select>
              </Field>
            ) : (
              <Field label="Raça / ancestralidade">
                <Input value={race} onChange={(e) => setRace(e.target.value)} />
              </Field>
            )}
          </div>
          {t20 ? (
            <>
              <p className="text-xs font-semibold uppercase tracking-wide text-parch-300">Classe</p>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-7">
                {Object.keys(T20_CLASSES).map((c) => (
                  <ClassCard key={c} name={c} active={cls === c} onClick={() => pickClass(c)} />
                ))}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Origem (opcional)">
                  <Input value={origin} onChange={(e) => setOrigin(e.target.value)} placeholder="Ex.: Soldado, Acólito…" />
                </Field>
                <Field label="Divindade (opcional)">
                  <Input value={deity} onChange={(e) => setDeity(e.target.value)} placeholder="Ex.: Khalmyr, Lena…" />
                </Field>
              </div>
            </>
          ) : (
            <Field label="Classe / conceito">
              <Input value={cls} onChange={(e) => setCls(e.target.value)} />
            </Field>
          )}
        </div>
      )}

      {step === 'attrs' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-parch-300">Digite os valores combinados com o mestre ou role 4d6 (descarta o menor) para cada atributo.</p>
            <Button type="button" variant="gold" onClick={rollAttrs}>
              <Dices size={16} /> Rolar atributos
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {T20_ATTRS.map((a) => (
              <div key={a.key} className="rounded-xl border border-ink-600 bg-ink-850 p-2 text-center">
                <p className="text-[11px] font-bold tracking-widest text-parch-300">{a.full}</p>
                <p className="font-display text-2xl font-extrabold text-gold-400">{formatMod(t20mod(attrs[a.key]))}</p>
                <NumberInput value={attrs[a.key]} onChange={(v) => setAttrs({ ...attrs, [a.key]: Math.max(1, Math.min(30, v)) })} />
              </div>
            ))}
          </div>
          <p className="text-center text-sm text-parch-300">
            Com {cls}: <b className="text-red-300">{res.pv} PV</b> · <b className="text-sky-300">{res.pm} PM</b> no 1º nível
          </p>
        </div>
      )}

      {step === 'skills' && (
        <div className="space-y-3">
          <p className="text-sm text-parch-300">Marque as perícias em que seu personagem é treinado (veja quantas sua classe e origem dão no livro). Dá para mudar depois na ficha.</p>
          <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
            {T20_SKILLS.map((sk) => (
              <label key={sk.key} className={cn('flex cursor-pointer items-center gap-2 rounded-lg border px-2 py-1.5 text-sm', trained.includes(sk.key) ? 'border-arcane-400 bg-arcane-600/20' : 'border-ink-700 hover:bg-ink-800')}>
                <input type="checkbox" className="accent-arcane-500" checked={trained.includes(sk.key)} onChange={(e) => setTrained(e.target.checked ? [...trained, sk.key] : trained.filter((x) => x !== sk.key))} />
                {sk.label}
                <span className="ml-auto text-[10px] text-parch-300">{T20_ATTRS.find((a) => a.key === sk.attr)!.label}</span>
              </label>
            ))}
          </div>
          <p className="text-xs text-parch-300">{trained.length} treinadas</p>
        </div>
      )}

      {step === 'look' && (
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm">
            Sua cor na mesa <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-8 w-12 rounded border border-ink-600 bg-transparent" />
          </label>
          <SpriteEditor value={choice} onChange={setChoice} />
        </div>
      )}

      {step === 'review' && (
        <div className="space-y-2 text-center">
          <Sparkles className="mx-auto text-gold-400" size={32} />
          <p className="font-display text-3xl font-extrabold text-gold-400">{name}</p>
          <p className="text-parch-300">{[race, cls].filter(Boolean).join(' · ')}</p>
          {t20 && (
            <p>
              <b className="text-red-300">{res.pv} PV</b> · <b className="text-sky-300">{res.pm} PM</b> · Defesa <b>{10 + t20mod(attrs.des)}</b> · {trained.length} perícias treinadas
            </p>
          )}
          <p className="text-sm text-parch-300">Depois de criar, a ficha completa abre para você ajustar ataques, poderes e equipamento.</p>
        </div>
      )}

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
