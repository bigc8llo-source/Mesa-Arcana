import { useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useShallow } from 'zustand/react/shallow'
import { AlertTriangle, ArrowLeft, Check, Clapperboard, Copy, Crown, Flame, Map as MapIcon, MessageCircle, Play, RefreshCw, Skull, Square, Swords, UserPlus, Users, Wand2 } from 'lucide-react'
import { useGame, useMe } from '../store/game'
import { useCampaignBootstrap } from '../game/bootstrap'
import { Button, cn, Field, HpBar, Input, Spinner, Textarea } from '../components/ui'
import { Portrait, SpriteAnimator, TiltCard } from '../characters/SpriteView'
import { CharacterWizard } from '../characters/CharacterWizard'
import { SheetModal } from '../characters/SheetModal'
import { SYSTEMS, systemOf } from '../systems'
import { backend } from '../data'
import { inviteCode } from '../lib/id'
import { systemMessage } from '../game/actions'

function Card({ title, icon, children, action }: { title: string; icon: ReactNode; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="panel rounded-2xl p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-lg text-gold-400">
          {icon} {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  )
}

function InviteCard() {
  const campaign = useGame((s) => s.campaign)!
  const me = useMe()
  const [copied, setCopied] = useState<string | null>(null)
  const link = `${location.origin}/convite/${campaign.invite_code}`
  const copy = (text: string, key: string) => {
    void navigator.clipboard?.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 1500)
  }
  const msg = `Bora jogar "${campaign.name}" na Mesa Arcana! Entre por este link: ${link} (código ${campaign.invite_code})`
  return (
    <Card title="Convidar jogadores" icon={<UserPlus size={18} />}>
      {backend.kind === 'local' && (
        <p className="mb-3 flex gap-2 rounded-lg border border-amber-600/60 bg-amber-900/30 p-2 text-xs text-amber-200">
          <AlertTriangle size={16} className="shrink-0" />
          Modo demonstração: o convite só funciona em outras abas deste navegador. Para jogar online, configure as variáveis do Supabase na Vercel (veja o README) e faça um novo deploy.
        </p>
      )}
      <div className="flex items-center gap-2">
        <span className="rounded-lg border border-gold-500/50 bg-ink-850 px-3 py-2 font-mono text-2xl font-bold tracking-[0.3em] text-gold-400" data-testid="invite-code">
          {campaign.invite_code}
        </span>
        <Button type="button" onClick={() => copy(campaign.invite_code, 'code')} title="Copiar código">
          {copied === 'code' ? <Check size={16} /> : <Copy size={16} />}
        </Button>
        {me?.role === 'gm' && (
          <Button
            type="button"
            variant="ghost"
            title="Gerar novo código (o antigo deixa de funcionar)"
            onClick={() => {
              if (confirm('Gerar um novo código? O link antigo deixará de funcionar.')) void useGame.getState().patch('campaigns', campaign.id, { invite_code: inviteCode() })
            }}
          >
            <RefreshCw size={16} />
          </Button>
        )}
      </div>
      <div className="mt-3 flex gap-2">
        <Input readOnly value={link} onFocus={(e) => e.target.select()} className="font-mono text-xs" />
        <Button type="button" variant="primary" onClick={() => copy(link, 'link')}>
          {copied === 'link' ? <Check size={16} /> : <Copy size={16} />} Link
        </Button>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <a className="inline-flex items-center gap-1.5 rounded-lg bg-[#25D366] px-3 py-1.5 text-sm font-semibold text-white" href={`https://wa.me/?text=${encodeURIComponent(msg)}`} target="_blank" rel="noreferrer">
          <MessageCircle size={16} /> WhatsApp
        </a>
        <Button type="button" size="sm" onClick={() => copy(msg, 'msg')}>
          {copied === 'msg' ? <Check size={14} /> : <Copy size={14} />} Copiar mensagem (Discord)
        </Button>
        {'share' in navigator && (
          <Button type="button" size="sm" onClick={() => navigator.share({ title: campaign.name, text: msg, url: link }).catch(() => null)}>
            Compartilhar…
          </Button>
        )}
      </div>
    </Card>
  )
}

function PlayersCard() {
  const members = useGame(useShallow((s) => Object.values(s.members)))
  const characters = useGame((s) => s.characters)
  const presence = useGame((s) => s.presence)
  const me = useMe()
  const gm = me?.role === 'gm'
  return (
    <Card title={`Grupo (${members.length})`} icon={<Users size={18} />}>
      <div className="space-y-2">
        {members.map((m) => {
          const chars = Object.values(characters).filter((c) => c.owner_id === m.user_id && c.kind === 'pc')
          const online = presence.some((p) => p.user_id === m.user_id)
          return (
            <div key={m.id} className="flex items-center gap-3 rounded-xl bg-ink-850/70 p-2">
              <span className="relative grid size-9 shrink-0 place-items-center rounded-full font-bold text-white" style={{ background: m.color }}>
                {m.display_name[0]?.toUpperCase()}
                <span className={cn('absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-ink-900', online ? 'bg-emerald-400' : 'bg-ink-500')} title={online ? 'Online' : 'Offline'} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1 text-sm font-semibold">
                  {m.display_name} {m.role === 'gm' && <Crown size={13} className="text-gold-400" />}
                </p>
                <p className="truncate text-xs text-parch-300">
                  {m.role === 'gm' ? 'Mestre' : chars.length ? chars.map((c) => `${c.name} (${systemOf(c).summary(c.sheet)})`).join(', ') : 'ainda sem ficha'}
                </p>
              </div>
              {chars[0] && (
                <button type="button" onClick={() => useGame.getState().set({ openSheetId: chars[0].id })} title="Ver ficha">
                  <Portrait url={chars[0].token_url} sprite={null} name={chars[0].name} color={chars[0].color} size={36} />
                </button>
              )}
              {gm && m.role !== 'gm' && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  title="Remover da campanha"
                  onClick={() => confirm(`Remover ${m.display_name} da campanha?`) && void useGame.getState().removeRow('members', m)}
                >
                  ✕
                </Button>
              )}
            </div>
          )
        })}
        {members.length <= 1 && <p className="text-sm text-parch-300">Ninguém entrou ainda. Envie o convite ao lado!</p>}
      </div>
    </Card>
  )
}

function GmPrep({ onOpenTable }: { onOpenTable: () => void }) {
  const campaign = useGame((s) => s.campaign)!
  const scenes = useGame(useShallow((s) => Object.values(s.scenes)))
  const npcs = useGame(useShallow((s) => Object.values(s.characters).filter((c) => c.kind !== 'pc')))
  const pcs = useGame(useShallow((s) => Object.values(s.characters).filter((c) => c.kind === 'pc')))
  const members = useGame((s) => Object.keys(s.members).length)
  const session = campaign.session ?? { live: false, number: 0 }
  const desc = campaign.description ?? ''
  const steps: { done: boolean; label: string; hint: string }[] = [
    { done: !!desc.trim(), label: 'Descrever a campanha', hint: 'Um parágrafo de apresentação para os jogadores.' },
    { done: scenes.some((s) => s.kind === 'map' && s.map_url), label: 'Preparar mapas e cenários', hint: 'Abra a mesa em modo preparação e use o painel Cenas.' },
    { done: npcs.length > 0, label: 'Criar NPCs e criaturas', hint: 'Fichas → NPC ou Bestiário.' },
    { done: members > 1, label: 'Convidar os jogadores', hint: 'Envie o link ou o código.' },
    { done: pcs.some((c) => c.owner_id), label: 'Jogadores criam suas fichas', hint: 'Cada jogador cria a ficha ao entrar.' },
  ]
  const start = async () => {
    const s = useGame.getState()
    const n = (session.number ?? 0) + 1
    await s.patch('campaigns', campaign.id, { session: { live: true, number: n, started_at: new Date().toISOString() } })
    await systemMessage(`🎲 Sessão ${n} começou! Boa aventura.`)
    onOpenTable()
  }
  const stop = async () => {
    await useGame.getState().patch('campaigns', campaign.id, { session: { ...session, live: false } })
    await systemMessage(`🌙 Fim da sessão ${session.number}.`)
  }
  return (
    <Card title="Preparação do mestre" icon={<Wand2 size={18} />}>
      <div className="space-y-3">
        <Field label="Nome da campanha">
          <Input value={campaign.name} onChange={(e) => void useGame.getState().patch('campaigns', campaign.id, { name: e.target.value })} />
        </Field>
        <Field label="Apresentação (os jogadores veem)">
          <Textarea
            rows={3}
            defaultValue={desc}
            placeholder="Em Arton, a Tormenta avança… Os heróis se encontram na Taverna do Javali Dourado."
            onBlur={(e) => void useGame.getState().patch('campaigns', campaign.id, { description: e.target.value })}
          />
        </Field>
        <ul className="space-y-1.5">
          {steps.map((st) => (
            <li key={st.label} className="flex items-start gap-2 text-sm">
              <span className={cn('mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-xs', st.done ? 'bg-emerald-600 text-white' : 'border border-ink-500 text-ink-500')}>{st.done ? '✓' : ''}</span>
              <span>
                <b className={st.done ? 'text-parch-300 line-through' : 'text-parch-100'}>{st.label}</b>
                <span className="block text-xs text-parch-300">{st.hint}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-parch-300">
          <MapIcon size={12} className="inline" /> {scenes.filter((s) => s.kind === 'map').length} mapas · <Clapperboard size={12} className="inline" /> {scenes.filter((s) => s.kind === 'theater').length} cenários · <Skull size={12} className="inline" /> {npcs.length} NPCs/criaturas
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          <Button type="button" onClick={onOpenTable} data-testid="open-prep">
            <Wand2 size={16} /> Preparar na mesa
          </Button>
          {session.live ? (
            <>
              <Button type="button" variant="gold" onClick={onOpenTable}>
                <Play size={16} /> Voltar à sessão {session.number}
              </Button>
              <Button type="button" variant="danger" onClick={stop}>
                <Square size={14} /> Encerrar sessão
              </Button>
            </>
          ) : (
            <Button type="button" variant="gold" size="lg" onClick={start} data-testid="start-session">
              <Flame size={18} /> Iniciar sessão {(session.number ?? 0) + 1}
            </Button>
          )}
        </div>
      </div>
    </Card>
  )
}

function PlayerArea({ onOpenTable }: { onOpenTable: () => void }) {
  const campaign = useGame((s) => s.campaign)!
  const userId = useGame((s) => s.user?.id)
  const mine = useGame(useShallow((s) => Object.values(s.characters).filter((c) => c.owner_id === userId && c.kind === 'pc')))
  const unowned = useGame(useShallow((s) => Object.values(s.characters).filter((c) => c.kind === 'pc' && !c.owner_id && !c.hidden)))
  const [wizard, setWizard] = useState(false)
  const live = campaign.session?.live
  return (
    <Card title="Seu personagem" icon={<Swords size={18} />}>
      {mine.length === 0 ? (
        <div className="space-y-3 text-center">
          <p className="text-parch-200">Você ainda não tem ficha nesta campanha.</p>
          <Button type="button" variant="gold" size="lg" onClick={() => setWizard(true)} data-testid="create-sheet">
            <Wand2 size={18} /> Criar minha ficha
          </Button>
          {unowned.length > 0 && (
            <div className="pt-2">
              <p className="mb-2 text-xs text-parch-300">…ou escolha um personagem pronto:</p>
              <div className="flex flex-wrap justify-center gap-2">
                {unowned.map((c) => (
                  <button
                    type="button"
                    key={c.id}
                    className="flex items-center gap-2 rounded-lg border border-ink-600 px-2 py-1 text-sm hover:bg-ink-800"
                    onClick={() => void useGame.getState().patch('characters', c.id, { owner_id: userId ?? null })}
                  >
                    <Portrait url={c.token_url} sprite={null} name={c.name} color={c.color} size={28} /> {c.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap justify-center gap-4">
          {mine.map((c) => {
            const hp = systemOf(c).hp(c.sheet)
            return (
              <button type="button" key={c.id} className="w-56 text-left" onClick={() => useGame.getState().set({ openSheetId: c.id })}>
                <TiltCard color={c.color}>
                  <div className="flex flex-col items-center p-4">
                    {c.sprite ? <SpriteAnimator sprite={c.sprite} scale={128 / c.sprite.frameW} /> : <Portrait url={c.portrait_url ?? c.token_url} sprite={null} name={c.name} color={c.color} size={120} />}
                    <p className="mt-1 font-display text-xl font-extrabold text-gold-400">{c.name}</p>
                    <p className="text-xs text-parch-300">{systemOf(c).summary(c.sheet)}</p>
                    <HpBar hp={hp.hp} max={hp.max} className="mt-2 w-full" />
                    <p className="mt-1 text-[11px] text-parch-300">Clique para abrir a ficha</p>
                  </div>
                </TiltCard>
              </button>
            )
          })}
        </div>
      )}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-3 border-t border-ink-700 pt-4">
        <p className={cn('flex items-center gap-2 text-sm', live ? 'text-emerald-300' : 'text-parch-300')}>
          <span className={cn('size-2.5 rounded-full', live ? 'animate-pulse bg-emerald-400' : 'bg-ink-500')} />
          {live ? `Sessão ${campaign.session?.number} em andamento!` : 'Aguardando o mestre iniciar a sessão'}
        </p>
        <Button type="button" variant={live ? 'gold' : 'secondary'} onClick={onOpenTable} data-testid="enter-table">
          <Play size={16} /> Entrar na mesa
        </Button>
      </div>
      <CharacterWizard open={wizard} onClose={() => setWizard(false)} onCreated={(c) => useGame.getState().set({ openSheetId: c.id })} />
    </Card>
  )
}

export default function LobbyPage() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const user = useGame((s) => s.user)
  const campaign = useGame((s) => s.campaign)
  const loading = useGame((s) => s.loading)
  const error = useGame((s) => s.error)
  const me = useMe()
  const seeding = useCampaignBootstrap(id)
  const openTable = () => nav(`/c/${id}/mesa`)

  if (!user)
    return (
      <div className="bg-arcane grid h-full place-items-center">
        <Button variant="primary" onClick={() => nav('/')}>
          Entrar
        </Button>
      </div>
    )
  if (!campaign || loading)
    return (
      <div className="bg-arcane grid h-full place-items-center text-parch-300">
        {error ? (
          <div className="space-y-3 text-center">
            <p className="text-red-400">{error}</p>
            <Button onClick={() => nav('/')}>Voltar</Button>
          </div>
        ) : (
          <span className="flex items-center gap-2">
            <Spinner /> Abrindo a campanha…
          </span>
        )}
      </div>
    )
  const desc = campaign.description
  return (
    <div className="bg-arcane min-h-full overflow-y-auto px-4 py-6">
      <div className="mx-auto max-w-5xl space-y-5">
        <header className="flex flex-wrap items-center gap-3">
          <Button variant="ghost" onClick={() => nav('/')}>
            <ArrowLeft size={16} /> Campanhas
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-3xl font-extrabold text-gold-400">{campaign.name}</h1>
            <p className="text-sm text-parch-300">
              {SYSTEMS[campaign.system_id]?.name ?? campaign.system_id} · {me?.role === 'gm' ? 'você é o mestre' : 'você é jogador'}
            </p>
          </div>
        </header>
        {desc && me?.role !== 'gm' && <p className="panel rounded-2xl p-4 italic text-parch-200">{desc}</p>}
        {seeding && (
          <p className="panel flex items-center gap-2 rounded-xl p-3 text-sm">
            <Flame className="animate-pulse text-gold-400" size={16} /> {seeding}
          </p>
        )}
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="space-y-5">{me?.role === 'gm' ? <GmPrep onOpenTable={openTable} /> : <PlayerArea onOpenTable={openTable} />}</div>
          <div className="space-y-5">
            <InviteCard />
            <PlayersCard />
          </div>
        </div>
      </div>
      <SheetModal />
    </div>
  )
}
