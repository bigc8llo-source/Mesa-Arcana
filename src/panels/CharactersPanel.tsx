import { useMemo, useState } from 'react'
import { BookOpen, EyeOff, GripVertical, Hand, Plus, Skull, Trash2, UserRound } from 'lucide-react'
import type { Character } from '../types'
import { activeSceneId, useGame, useIsGm } from '../store/game'
import { Button, cn, Empty, Field, HpBar, Input, Modal, Select, Spinner } from '../components/ui'
import { Portrait } from '../characters/SpriteView'
import { systemOf, SYSTEMS } from '../systems'
import { MONSTERS } from '../systems/monsters'
import { SpriteEditor, type SpriteChoice } from '../characters/SpriteEditor'
import { resolveSpriteChoice } from '../characters/spriteActions'
import { DEFAULT_RECIPE, RECIPE_PRESETS } from '../engine/sprites'
import { createCharacter, placeToken } from '../game/actions'
import { PLAYER_COLORS, uid } from '../lib/id'

function CharacterRow({ c }: { c: Character }) {
  const gm = useIsGm()
  const userId = useGame((s) => s.user?.id)
  const owner = useGame((s) => (c.owner_id ? Object.values(s.members).find((m) => m.user_id === c.owner_id) : null))
  const sys = systemOf(c)
  const hp = sys.hp(c.sheet)
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('application/x-mesa-character', c.id)
        e.dataTransfer.effectAllowed = 'copy'
      }}
      onClick={() => useGame.getState().set({ openSheetId: c.id })}
      className="group flex cursor-pointer items-center gap-2 rounded-lg p-1.5 hover:bg-ink-800"
      data-testid="character-row"
    >
      <GripVertical size={14} className="shrink-0 text-ink-600 group-hover:text-parch-300" />
      <Portrait url={c.token_url} sprite={null} name={c.name} color={c.color} size={38} />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1 truncate text-sm font-semibold">
          {c.name} {c.hidden && <EyeOff size={12} className="text-ink-500" />}
        </p>
        <p className="truncate text-[11px] text-parch-300">
          {sys.summary(c.sheet)}
          {owner ? ` · ${owner.display_name}` : c.kind === 'pc' ? ' · sem jogador' : ''}
        </p>
        {hp.max > 0 && <HpBar hp={hp.hp} max={hp.max} temp={hp.temp} className="mt-1 h-1.5" />}
      </div>
      {!gm && c.kind === 'pc' && !c.owner_id && (
        <Button
          size="sm"
          variant="gold"
          onClick={(e) => {
            e.stopPropagation()
            void useGame.getState().patch('characters', c.id, { owner_id: userId ?? null })
          }}
        >
          <Hand size={12} /> Assumir
        </Button>
      )}
      {gm && (
        <button
          className="rounded p-1 text-ink-600 opacity-0 hover:text-red-400 group-hover:opacity-100"
          title="Excluir personagem"
          onClick={(e) => {
            e.stopPropagation()
            if (confirm(`Excluir ${c.name}? Os tokens dele no mapa também serão removidos.`)) {
              const s = useGame.getState()
              Object.values(s.tokens)
                .filter((t) => t.character_id === c.id)
                .forEach((t) => void s.removeRow('tokens', t))
              void s.removeRow('characters', c)
            }
          }}
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>
  )
}

export function CharactersPanel() {
  const characters = useGame((s) => s.characters)
  const gm = useIsGm()
  const [creating, setCreating] = useState<Character['kind'] | null>(null)
  const [compendium, setCompendium] = useState(false)
  const groups = useMemo(() => {
    const all = Object.values(characters).sort((a, b) => a.name.localeCompare(b.name))
    return {
      pc: all.filter((c) => c.kind === 'pc'),
      npc: all.filter((c) => c.kind === 'npc'),
      monster: all.filter((c) => c.kind === 'monster'),
    }
  }, [characters])

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap gap-1.5 border-b border-ink-700 p-2">
        <Button size="sm" variant="primary" onClick={() => setCreating('pc')} data-testid="new-character">
          <Plus size={14} /> Personagem
        </Button>
        {gm && (
          <>
            <Button size="sm" onClick={() => setCreating('npc')}>
              <UserRound size={14} /> NPC
            </Button>
            <Button size="sm" onClick={() => setCompendium(true)}>
              <BookOpen size={14} /> Bestiário
            </Button>
          </>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {Object.values(characters).length === 0 && (
          <Empty icon={<UserRound size={32} />} title="Nenhum personagem">
            Crie seu herói — ele ganha um sprite animado na hora.
          </Empty>
        )}
        {(
          [
            ['pc', 'Heróis'],
            ['npc', 'NPCs'],
            ['monster', 'Criaturas'],
          ] as const
        ).map(([k, label]) =>
          groups[k].length ? (
            <div key={k} className="mb-3">
              <p className="mb-1 px-1 text-[11px] font-bold uppercase tracking-widest text-parch-300">{label}</p>
              {groups[k].map((c) => (
                <CharacterRow key={c.id} c={c} />
              ))}
            </div>
          ) : null,
        )}
        {Object.values(characters).length > 0 && <p className="px-1 text-[11px] text-ink-500">Dica: arraste um personagem para o mapa para criar o token.</p>}
      </div>
      {creating && <CreateCharacterModal kind={creating} onClose={() => setCreating(null)} />}
      <CompendiumModal open={compendium} onClose={() => setCompendium(false)} />
    </div>
  )
}

function CreateCharacterModal({ kind, onClose }: { kind: Character['kind']; onClose: () => void }) {
  const gm = useIsGm()
  const userId = useGame((s) => s.user?.id ?? null)
  const campaign = useGame((s) => s.campaign)!
  const count = useGame((s) => Object.keys(s.characters).length)
  const [name, setName] = useState('')
  const [color, setColor] = useState(PLAYER_COLORS[count % PLAYER_COLORS.length])
  const [choice, setChoice] = useState<SpriteChoice>({ mode: 'recipe', recipe: kind === 'pc' ? DEFAULT_RECIPE : RECIPE_PRESETS.rei.recipe })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  return (
    <Modal open onClose={onClose} title={kind === 'pc' ? 'Novo personagem' : 'Novo NPC'} wide>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault()
          setBusy(true)
          setErr(null)
          try {
            const r = await resolveSpriteChoice(campaign.id, choice, color)
            const sys = SYSTEMS[campaign.system_id] ?? SYSTEMS.generico
            const c: Character = {
              id: uid(),
              campaign_id: campaign.id,
              owner_id: kind === 'pc' && !gm ? userId : null,
              kind,
              name,
              system_id: campaign.system_id,
              sheet: { ...sys.defaultSheet(), recipe: r.recipe },
              portrait_url: r.portrait_url,
              token_url: r.token_url,
              sprite: r.sprite,
              color,
              hidden: kind !== 'pc' && gm,
            }
            await useGame.getState().save('characters', c)
            onClose()
            useGame.getState().set({ openSheetId: c.id })
          } catch (e) {
            setErr((e as Error).message)
            setBusy(false)
          }
        }}
      >
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <Field label="Nome">
            <Input required autoFocus maxLength={40} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Thalia Ventoleste" />
          </Field>
          <Field label="Cor">
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-16 cursor-pointer rounded border border-ink-600 bg-transparent" />
          </Field>
        </div>
        <SpriteEditor value={choice} onChange={setChoice} />
        {err && <p className="text-sm text-red-400">{err}</p>}
        <Button variant="primary" className="w-full" disabled={busy || !name}>
          {busy ? <Spinner /> : <Plus size={16} />} Criar e abrir ficha
        </Button>
      </form>
    </Modal>
  )
}

function CompendiumModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const campaign = useGame((s) => s.campaign)
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [qty, setQty] = useState(1)
  const list = MONSTERS.filter((m) => m.name.toLowerCase().includes(q.toLowerCase()))
  const dnd = campaign?.system_id === 'dnd5e'
  return (
    <Modal open={open} onClose={onClose} title="Bestiário (SRD 5.2)">
      <div className="mb-3 flex gap-2">
        <Input placeholder="Buscar criatura…" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select className="w-24" value={qty} onChange={(e) => setQty(Number(e.target.value))} title="Quantidade de tokens">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <option key={n} value={n}>
              ×{n}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-1">
        {list.map((m) => (
          <div key={m.key} className="flex items-center gap-3 rounded-lg p-2 hover:bg-ink-800">
            <Skull size={18} className="text-red-400" />
            <div className="flex-1">
              <p className="font-semibold">{m.name}</p>
              <p className="text-xs text-parch-300">
                ND {m.cr} · CA {m.sheet.ac} · PV {m.sheet.hp} · {m.sheet.attacks?.map((a) => a.name).join(', ')}
              </p>
            </div>
            <Button
              size="sm"
              variant="primary"
              disabled={!!busy}
              onClick={async () => {
                setBusy(m.key)
                try {
                  const s = useGame.getState()
                  const existing = Object.values(s.characters).find((c) => c.kind === 'monster' && c.name === m.name)
                  const c =
                    existing ??
                    (await createCharacter({
                      name: m.name,
                      kind: 'monster',
                      recipe: RECIPE_PRESETS[m.sprite].recipe,
                      color: '#7f1d1d',
                      ownerId: null,
                      hidden: true,
                      sheet: dnd ? { ...m.sheet, cr: m.cr, size: m.size } : { hp: m.sheet.hp, hp_max: m.sheet.hp_max, defense: m.sheet.ac, size: m.size },
                    }))
                  const sid = activeSceneId(s)
                  const sc = sid ? s.scenes[sid] : null
                  if (sc && sc.kind === 'map')
                    for (let i = 0; i < qty; i++) await placeToken(c, sc.map_w / 2 + (i % 3) * sc.grid.size, sc.map_h / 2 + Math.floor(i / 3) * sc.grid.size)
                  onClose()
                } finally {
                  setBusy(null)
                }
              }}
            >
              {busy === m.key ? <Spinner /> : 'Adicionar'}
            </Button>
          </div>
        ))}
      </div>
      <p className={cn('mt-3 text-[10px] text-ink-500')}>{SYSTEMS.dnd5e.attribution}</p>
    </Modal>
  )
}
