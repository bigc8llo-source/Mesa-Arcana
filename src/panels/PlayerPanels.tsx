import { useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { FileText, Minus, Plus, Search, Sparkles, Swords, Wand2 } from 'lucide-react'
import type { Character } from '../types'
import { activeSceneId, emitLocalLive, useGame } from '../store/game'
import { Button, cn, Empty, HpBar } from '../components/ui'
import { Portrait, SpriteAnimator } from '../characters/SpriteView'
import { systemOf } from '../systems'
import { asT20, t20Skill, T20_SKILLS } from '../systems/tormenta20'
import { formatMod } from '../engine/dice'
import { rollDice } from '../game/actions'
import { playTokenAnim } from '../table/Tokens'
import { CharacterWizard } from '../characters/CharacterWizard'
import { AttackCard, NotationHint } from '../characters/AttackCard'
import { attackViews } from '../characters/attackViews'
import { InventoryPanel } from '../characters/InventoryPanel'

export function useMyCharacter(): Character | null {
  const userId = useGame((s) => s.user?.id)
  const list = useGame(useShallow((s) => Object.values(s.characters).filter((c) => c.owner_id === userId && c.kind === 'pc')))
  return list[0] ?? null
}

function myToken(c: Character) {
  const s = useGame.getState()
  const sid = activeSceneId(s)
  return Object.values(s.tokens).find((t) => t.character_id === c.id && t.scene_id === sid) ?? null
}

/** Rola, anima o sprite e (opcional) solta um efeito visual no próprio token. */
function act(c: Character, notation: string, label: string, anim: 'attack' | 'cast', vfx?: string) {
  const t = myToken(c)
  if (t) {
    playTokenAnim(t.id, anim)
    if (vfx) {
      const ev = { type: 'vfx' as const, effect: vfx, x: t.x, y: t.y }
      useGame.getState().send(ev)
      emitLocalLive(ev)
    }
  }
  if (notation) void rollDice(notation, { character: c, label })
}

function NoCharacter() {
  const [open, setOpen] = useState(false)
  const userId = useGame((s) => s.user?.id ?? null)
  const ready = useGame(useShallow((s) => Object.values(s.characters).filter((c) => c.kind === 'pc' && !c.owner_id && !c.hidden)))
  return (
    <div className="p-4">
      <Empty icon={<Wand2 size={32} />} title="Você ainda não tem personagem">
        <Button className="mt-2" variant="gold" onClick={() => setOpen(true)} data-testid="create-sheet-table">
          Criar meu personagem
        </Button>
      </Empty>
      {ready.length > 0 && (
        <div className="space-y-1">
          <p className="text-center text-xs text-parch-300">…ou jogue com um personagem pronto:</p>
          {ready.map((c) => (
            <button
              type="button"
              key={c.id}
              data-testid={`claim-${c.name}`}
              onClick={() => void useGame.getState().patch('characters', c.id, { owner_id: userId })}
              className="flex w-full items-center gap-2 rounded-lg border border-ink-700 p-2 text-left hover:bg-ink-800"
            >
              <Portrait url={c.token_url} sprite={null} name={c.name} color={c.color} size={32} />
              <span className="flex-1 text-sm font-semibold">{c.name}</span>
              <span className="text-xs text-parch-300">{systemOf(c).summary(c.sheet)}</span>
            </button>
          ))}
        </div>
      )}
      <CharacterWizard open={open} onClose={() => setOpen(false)} onCreated={(c) => useGame.getState().set({ openSheetId: c.id })} />
    </div>
  )
}

/** Ficha resumida para jogar rápido (vida, PM, ataques e perícias com um toque). */
export function MySheetPanel() {
  const c = useMyCharacter()
  const [q, setQ] = useState('')
  if (!c) return <NoCharacter />
  const sys = systemOf(c)
  const hp = sys.hp(c.sheet)
  const t20 = c.system_id === 'tormenta20'
  const s20 = t20 ? asT20(c.sheet) : null
  const setSheet = (p: Record<string, unknown>) => void useGame.getState().patch('characters', c.id, { sheet: { ...c.sheet, ...p } })
  const hpKey = t20 ? 'pv' : 'hp'
  const rollables = sys.rollables(c.sheet)
  const attacks = attackViews(c)
  const skills = t20
    ? T20_SKILLS.filter((sk) => sk.label.toLowerCase().includes(q.toLowerCase())).map((sk) => ({ id: sk.key, label: sk.label, bonus: t20Skill(s20!, sk.key), trained: s20!.trained.includes(sk.key) }))
    : rollables.filter((r) => r.group !== 'Ataques' && r.label.toLowerCase().includes(q.toLowerCase())).map((r) => ({ id: r.id, label: r.label, bonus: Number(r.notation.replace('1d20', '')) || 0, trained: false }))

  return (
    <div className="h-full space-y-3 overflow-y-auto p-3" data-testid="my-sheet">
      <div className="flex items-center gap-3">
        <div className="grid size-20 shrink-0 place-items-center rounded-2xl" style={{ background: `radial-gradient(circle, ${c.color}55, #14111c)` }}>
          {c.sprite ? <SpriteAnimator sprite={c.sprite} scale={64 / c.sprite.frameW} /> : <Portrait url={c.portrait_url ?? c.token_url} sprite={null} name={c.name} color={c.color} size={64} />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-xl font-extrabold text-gold-400">{c.name}</p>
          <p className="text-xs text-parch-300">
            {sys.summary(c.sheet)} · {c.system_id === 'dnd5e' ? 'CA' : 'Defesa'} {sys.ac(c.sheet)}
          </p>
          <Button size="sm" variant="ghost" className="mt-1 px-0" onClick={() => useGame.getState().set({ openSheetId: c.id })}>
            <FileText size={14} /> Ficha completa
          </Button>
        </div>
      </div>

      <div className="space-y-2 rounded-xl border border-ink-700 p-2">
        <div className="flex items-center gap-2">
          <span className="w-7 text-xs font-bold text-red-300">PV</span>
          <HpBar hp={hp.hp} max={hp.max} className="h-3 flex-1" />
          <span className="w-12 text-right text-sm font-bold">
            {hp.hp}/{hp.max}
          </span>
          <button type="button" className="grid size-8 place-items-center rounded-lg bg-red-800" onClick={() => setSheet(sys.setHp(c.sheet, hp.hp - 1))} aria-label="Perder 1 PV">
            <Minus size={14} />
          </button>
          <button type="button" className="grid size-8 place-items-center rounded-lg bg-emerald-800" onClick={() => setSheet({ [hpKey]: Math.min(hp.max, hp.hp + 1) })} aria-label="Recuperar 1 PV">
            <Plus size={14} />
          </button>
        </div>
        {s20 && (
          <div className="flex items-center gap-2">
            <span className="w-7 text-xs font-bold text-sky-300">PM</span>
            <div className="h-3 flex-1 overflow-hidden rounded-full bg-ink-700">
              <div className="h-full bg-sky-500 transition-all" style={{ width: `${(s20.pm / Math.max(1, s20.pm_max)) * 100}%` }} />
            </div>
            <span className="w-12 text-right text-sm font-bold">
              {s20.pm}/{s20.pm_max}
            </span>
            <button type="button" className="grid size-8 place-items-center rounded-lg bg-ink-700" onClick={() => setSheet({ pm: Math.max(0, s20.pm - 1) })} aria-label="Gastar 1 PM">
              <Minus size={14} />
            </button>
            <button type="button" className="grid size-8 place-items-center rounded-lg bg-ink-700" onClick={() => setSheet({ pm: Math.min(s20.pm_max, s20.pm + 1) })} aria-label="Recuperar 1 PM">
              <Plus size={14} />
            </button>
          </div>
        )}
      </div>

      <div>
        <p className="mb-1 flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-parch-300">
          <Swords size={12} /> Ataques
        </p>
        <div className="space-y-1.5">
          {attacks.map((a) => (
            <div key={a.id} className="rounded-xl border border-ink-700 p-2">
              <p className="mb-1 font-semibold">{a.name}</p>
              <AttackCard a={a} onRoll={(n, l) => act(c, n, l, 'attack', l.startsWith('Ataque') ? 'slash' : undefined)} />
            </div>
          ))}
          {attacks.length === 0 && <p className="text-xs text-parch-300">Sem ataques.</p>}
        </div>
      </div>

      <div>
        <div className="mb-1 flex items-center gap-2">
          <p className="text-xs font-bold uppercase tracking-wide text-parch-300">Testes</p>
          <label className="ml-auto flex items-center gap-1 rounded-md bg-ink-850 px-2">
            <Search size={12} className="text-ink-500" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="buscar" className="w-24 bg-transparent py-1 text-xs outline-none" />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-1">
          {skills.map((sk) => (
            <button
              type="button"
              key={sk.id}
              onClick={() => act(c, `1d20${formatMod(sk.bonus)}`, sk.label, 'cast')}
              className={cn('flex items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs transition active:scale-[0.98]', sk.trained ? 'bg-arcane-600/25 text-parch-100' : 'bg-ink-850 text-parch-200')}
            >
              <span className="truncate">{sk.label}</span>
              <b className="font-mono text-gold-400">{formatMod(sk.bonus)}</b>
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1 text-xs font-bold uppercase tracking-wide text-parch-300">Inventário</p>
        <InventoryPanel c={c} sheet={c.sheet} editable onPatch={setSheet} />
      </div>
    </div>
  )
}

const POWER_VFX: [RegExp, string][] = [
  [/cura|curar|poção/i, 'heal'],
  [/chama|fogo|explos|bomba/i, 'fireball'],
  [/raio|relâmpago|trov/i, 'lightning'],
  [/gelo|congel/i, 'frost'],
  [/luz|sagrad|divin|bênção|fé/i, 'holy'],
  [/seta|míssil|arcan/i, 'arcane'],
  [/veneno/i, 'poison'],
  [/sono|enfeit|escur/i, 'darkness'],
]

/** Só as magias/poderes escolhidos na criação (o mestre pode liberar outros na ficha). */
export function PowersPanel() {
  const c = useMyCharacter()
  const spells = useMemo(() => {
    if (!c) return []
    if (c.system_id === 'tormenta20') return asT20(c.sheet).powers.map((p) => ({ id: p.id, name: p.name, cost: p.cost, notation: p.notation, description: p.description }))
    const sp = (c.sheet.spells as { id: string; name: string; notation: string; description: string; level: number }[] | undefined) ?? []
    const ac = (c.sheet.actions as { id: string; name: string; notation: string }[] | undefined) ?? []
    return [...sp.map((s) => ({ ...s, cost: 0 })), ...ac.map((a) => ({ ...a, cost: 0, description: '' }))]
  }, [c])
  if (!c) return <NoCharacter />
  const pm = c.system_id === 'tormenta20' ? asT20(c.sheet).pm : Infinity
  return (
    <div className="h-full space-y-2 overflow-y-auto p-3" data-testid="powers-panel">
      {c.system_id === 'tormenta20' && (
        <p className="text-sm">
          <b className="text-sky-300">{asT20(c.sheet).pm}</b> / {asT20(c.sheet).pm_max} PM disponíveis
        </p>
      )}
      {spells.length === 0 && <Empty icon={<Sparkles size={28} />} title="Nenhum poder" />}
      {spells.map((p) => {
        const vfx = POWER_VFX.find(([re]) => re.test(p.name))?.[1]
        return (
          <div key={p.id} className="rounded-xl border border-ink-700 bg-ink-850/60 p-3">
            <p className="flex items-center justify-between font-semibold">
              {p.name}
              {p.cost > 0 && <span className="text-xs text-sky-300">{p.cost} PM</span>}
            </p>
            {p.description && <p className="text-xs text-parch-300">{p.description}</p>}
            <NotationHint notation={p.notation} />
            <Button
              size="md"
              variant="primary"
              className="mt-2 w-full"
              disabled={pm < p.cost}
              onClick={() => {
                if (p.cost > 0) void useGame.getState().patch('characters', c.id, { sheet: { ...c.sheet, pm: Math.max(0, asT20(c.sheet).pm - p.cost) } })
                act(c, p.notation, `${p.name}${p.cost ? ` (−${p.cost} PM)` : ''}`, 'cast', vfx)
                if (!p.notation) void import('../game/actions').then((m) => m.sendChat(`usa ${p.name}!`, 'emote', [], c.name))
              }}
            >
              <Sparkles size={14} /> Usar {p.notation && `· ${p.notation}`}
            </Button>
          </div>
        )
      })}
      <p className="text-[11px] text-ink-500">Poderes definidos na criação. Peça ao mestre para liberar novos ao subir de nível.</p>
    </div>
  )
}
