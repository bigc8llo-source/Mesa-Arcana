import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { BookOpen, ChevronDown, ChevronUp, Map as MapIcon, Plus, Trash2, Users } from 'lucide-react'
import type { Chapter } from '../types'
import { useGame } from '../store/game'
import { Button, cn, Input, Textarea } from '../components/ui'
import { uid } from '../lib/id'
import { defaultScene } from '../game/actions'

const STATUS: Chapter['status'][] = ['planejado', 'em andamento', 'concluído']
const STATUS_STYLE: Record<Chapter['status'], string> = {
  planejado: 'bg-ink-700 text-parch-300',
  'em andamento': 'bg-emerald-800 text-white',
  concluído: 'bg-ink-600 text-parch-300 line-through',
}

/** Mestre: número de vagas e roteiro em capítulos (com cenas e NPCs ligados). */
export function CampaignPlanner({ onOpenScene }: { onOpenScene: (sceneId: string) => void }) {
  const campaign = useGame((s) => s.campaign)!
  const scenes = useGame(useShallow((s) => Object.values(s.scenes).sort((a, b) => a.sort - b.sort)))
  const npcs = useGame(useShallow((s) => Object.values(s.characters).filter((c) => c.kind !== 'pc')))
  const players = useGame((s) => Object.values(s.members).filter((m) => m.role === 'player').length)
  const chapters = campaign.chapters ?? []
  const [openId, setOpenId] = useState<string | null>(chapters[0]?.id ?? null)
  const save = (next: Chapter[]) => void useGame.getState().patch('campaigns', campaign.id, { chapters: next })
  const updCh = (id: string, p: Partial<Chapter>) => save(chapters.map((c) => (c.id === id ? { ...c, ...p } : c)))
  const move = (i: number, d: number) => {
    const next = [...chapters]
    const [x] = next.splice(i, 1)
    next.splice(Math.max(0, Math.min(next.length, i + d)), 0, x)
    save(next)
  }
  const add = () => {
    const c: Chapter = { id: uid(), title: `Capítulo ${chapters.length + 1}`, summary: '', gm_notes: '', scene_ids: [], npc_ids: [], status: 'planejado' }
    save([...chapters, c])
    setOpenId(c.id)
  }

  return (
    <section className="panel space-y-4 rounded-2xl p-4" data-testid="planner">
      <div>
        <h2 className="flex items-center gap-2 font-display text-lg text-gold-400">
          <Users size={18} /> Vagas na mesa
        </h2>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {[2, 3, 4, 5, 6, 8].map((n) => (
            <button
              type="button"
              key={n}
              data-testid={`seats-${n}`}
              onClick={() => void useGame.getState().patch('campaigns', campaign.id, { max_players: n })}
              className={cn('size-10 rounded-xl text-sm font-bold', campaign.max_players === n ? 'bg-gold-500 text-ink-950' : 'bg-ink-700 hover:bg-ink-600')}
            >
              {n}
            </button>
          ))}
          <button
            type="button"
            onClick={() => void useGame.getState().patch('campaigns', campaign.id, { max_players: undefined })}
            className={cn('h-10 rounded-xl px-3 text-xs', !campaign.max_players ? 'bg-gold-500 text-ink-950' : 'bg-ink-700')}
          >
            Sem limite
          </button>
        </div>
        <p className="mt-1 text-xs text-parch-300">
          {players} jogador(es) entraram{campaign.max_players ? ` de ${campaign.max_players} vagas` : ''}. Com as vagas cheias, o convite deixa de aceitar gente nova.
        </p>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-display text-lg text-gold-400">
            <BookOpen size={18} /> Roteiro da campanha
          </h2>
          <Button type="button" size="sm" variant="primary" onClick={add} data-testid="add-chapter">
            <Plus size={14} /> Capítulo
          </Button>
        </div>
        {chapters.length === 0 && <p className="mt-2 text-sm text-parch-300">Monte a campanha em capítulos: cada um com resumo (os jogadores veem), notas secretas, as cenas/mapas e os NPCs que aparecem.</p>}
        <div className="mt-2 space-y-2">
          {chapters.map((c, i) => {
            const open = openId === c.id
            return (
              <div key={c.id} className="rounded-xl border border-ink-700 bg-ink-850/60">
                <div className="flex items-center gap-2 p-2">
                  <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => setOpenId(open ? null : c.id)}>
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-ink-700 text-xs font-bold">{i + 1}</span>
                    <span className="truncate font-semibold">{c.title}</span>
                    <span className={cn('shrink-0 rounded px-1.5 text-[10px]', STATUS_STYLE[c.status])}>{c.status}</span>
                  </button>
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="disabled:opacity-20" aria-label="Subir">
                    <ChevronUp size={16} />
                  </button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === chapters.length - 1} className="disabled:opacity-20" aria-label="Descer">
                    <ChevronDown size={16} />
                  </button>
                </div>
                {open && (
                  <div className="space-y-2 border-t border-ink-700 p-2">
                    <Input value={c.title} onChange={(e) => updCh(c.id, { title: e.target.value })} placeholder="Título do capítulo" />
                    <Textarea rows={2} defaultValue={c.summary} onBlur={(e) => updCh(c.id, { summary: e.target.value })} placeholder="Resumo (os jogadores veem)" />
                    <Textarea rows={2} defaultValue={c.gm_notes} onBlur={(e) => updCh(c.id, { gm_notes: e.target.value })} placeholder="Notas secretas do mestre: ganchos, segredos, tesouros…" />
                    <div className="flex flex-wrap gap-1">
                      {STATUS.map((st) => (
                        <button type="button" key={st} onClick={() => updCh(c.id, { status: st })} className={cn('rounded-md px-2 py-1 text-xs', c.status === st ? 'bg-arcane-600 text-white' : 'bg-ink-700')}>
                          {st}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs font-bold uppercase tracking-wide text-parch-300">Cenas</p>
                    <div className="flex flex-wrap gap-1">
                      {scenes.map((sc) => {
                        const on = c.scene_ids.includes(sc.id)
                        return (
                          <button
                            type="button"
                            key={sc.id}
                            onClick={() => updCh(c.id, { scene_ids: on ? c.scene_ids.filter((x) => x !== sc.id) : [...c.scene_ids, sc.id] })}
                            className={cn('rounded-md px-2 py-1 text-xs', on ? 'bg-gold-500 text-ink-950' : 'bg-ink-700')}
                          >
                            {sc.name}
                          </button>
                        )
                      })}
                      <button
                        type="button"
                        className="rounded-md border border-dashed border-ink-500 px-2 py-1 text-xs"
                        onClick={async () => {
                          const sc = defaultScene(campaign.id, `${c.title} – mapa`)
                          await useGame.getState().save('scenes', sc)
                          updCh(c.id, { scene_ids: [...c.scene_ids, sc.id] })
                        }}
                      >
                        + nova cena
                      </button>
                    </div>
                    {c.scene_ids.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {c.scene_ids.map((id) => {
                          const sc = scenes.find((x) => x.id === id)
                          return sc ? (
                            <Button type="button" key={id} size="sm" onClick={() => onOpenScene(id)}>
                              <MapIcon size={12} /> Preparar “{sc.name}”
                            </Button>
                          ) : null
                        })}
                      </div>
                    )}
                    <p className="text-xs font-bold uppercase tracking-wide text-parch-300">NPCs e criaturas</p>
                    <div className="flex flex-wrap gap-1">
                      {npcs.length === 0 && <span className="text-xs text-parch-300">Crie NPCs na mesa (Fichas → NPC ou Bestiário).</span>}
                      {npcs.map((n) => {
                        const on = c.npc_ids.includes(n.id)
                        return (
                          <button
                            type="button"
                            key={n.id}
                            onClick={() => updCh(c.id, { npc_ids: on ? c.npc_ids.filter((x) => x !== n.id) : [...c.npc_ids, n.id] })}
                            className={cn('rounded-md px-2 py-1 text-xs', on ? 'bg-red-800 text-white' : 'bg-ink-700')}
                          >
                            {n.name}
                          </button>
                        )
                      })}
                    </div>
                    <Button type="button" size="sm" variant="ghost" className="text-red-300" onClick={() => confirm(`Excluir "${c.title}"?`) && save(chapters.filter((x) => x.id !== c.id))}>
                      <Trash2 size={12} /> Excluir capítulo
                    </Button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

/** Jogadores: só títulos, resumos e situação dos capítulos (sem notas do mestre). */
const NO_CHAPTERS: Chapter[] = []
export function ChapterList() {
  const chapters = useGame((s) => s.campaign?.chapters ?? NO_CHAPTERS)
  if (!chapters.length) return null
  return (
    <section className="panel rounded-2xl p-4">
      <h2 className="mb-2 flex items-center gap-2 font-display text-lg text-gold-400">
        <BookOpen size={18} /> Jornada
      </h2>
      <ol className="space-y-1.5">
        {chapters.map((c, i) => (
          <li key={c.id} className={cn('rounded-lg p-2', c.status === 'em andamento' ? 'bg-emerald-900/30' : 'bg-ink-850/60')}>
            <p className="flex items-center gap-2 text-sm font-semibold">
              {i + 1}. {c.title} <span className={cn('rounded px-1.5 text-[10px]', STATUS_STYLE[c.status])}>{c.status}</span>
            </p>
            {c.summary && <p className="text-xs text-parch-300">{c.summary}</p>}
          </li>
        ))}
      </ol>
    </section>
  )
}
