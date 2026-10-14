import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  Box,
  CircleDot,
  Cloud,
  Copy,
  Crosshair,
  Flame,
  HelpCircle,
  Lightbulb,
  Map as MapIcon,
  MessageSquare,
  MousePointer2,
  PanelRightClose,
  PanelRightOpen,
  Ruler,
  Sparkles,
  Swords,
  UserRound,
  Users,
  Volume2,
  VolumeX,
  WandSparkles,
  Wifi,
  WifiOff,
  BrickWall,
} from 'lucide-react'
import { activeSceneId, trackPresence, useGame, useIsGm, useMe, useScene, type Tool } from '../store/game'
import { useToolOptions } from '../store/tools'
import { Button, cn, IconButton, Modal, Spinner, Tabs } from '../components/ui'
import { MapView } from '../table/MapView'
import { TheaterView } from '../table/TheaterView'
import { TokenMenu } from '../table/TokenMenu'
import { DiceOverlay } from '../dice/DiceOverlay'
import { ChatPanel } from '../panels/ChatPanel'
import { CharactersPanel } from '../panels/CharactersPanel'
import { CombatPanel } from '../panels/CombatPanel'
import { ScenesPanel } from '../panels/ScenesPanel'
import { SheetModal } from '../characters/SheetModal'
import { canControl, changeHp, defaultScene, seedSampleCampaign } from '../game/actions'
import { useCamRequests } from '../table/camera'
import { VFX_LIST } from '../table/Effects'
import { useAssetUrl } from '../lib/images'
import { backend } from '../data'
import { snapToGrid } from '../engine/geometry'
import { initPhysics } from '../dice/simulate'

type PanelTab = 'chat' | 'chars' | 'combat' | 'scenes'

const TOOLS: { id: Tool; label: string; key: string; icon: React.ReactNode; gm?: boolean }[] = [
  { id: 'select', label: 'Selecionar e mover (V)', key: 'v', icon: <MousePointer2 size={18} /> },
  { id: 'ruler', label: 'Régua (R)', key: 'r', icon: <Ruler size={18} /> },
  { id: 'aoe', label: 'Área de efeito (A)', key: 'a', icon: <CircleDot size={18} /> },
  { id: 'spell', label: 'Efeitos de magia (E)', key: 'e', icon: <WandSparkles size={18} /> },
  { id: 'ping', label: 'Apontar (P) — ou Alt+clique', key: 'p', icon: <Crosshair size={18} /> },
  { id: 'walls', label: 'Paredes e portas (W)', key: 'w', icon: <BrickWall size={18} />, gm: true },
  { id: 'fog', label: 'Névoa de guerra (F)', key: 'f', icon: <Cloud size={18} />, gm: true },
  { id: 'light', label: 'Luzes (L)', key: 'l', icon: <Lightbulb size={18} />, gm: true },
]

function ToolOptionsBar() {
  const tool = useGame((s) => s.tool)
  const o = useToolOptions()
  const chip = (active: boolean) => cn('rounded-md px-2 py-1 text-xs', active ? 'bg-arcane-600 text-white' : 'bg-ink-700 hover:bg-ink-600')
  let content: React.ReactNode = null
  if (tool === 'aoe')
    content = (
      <>
        {(
          [
            ['circle', 'Círculo'],
            ['cone', 'Cone'],
            ['line', 'Linha'],
            ['square', 'Cubo'],
          ] as const
        ).map(([k, l]) => (
          <button key={k} className={chip(o.aoeShape === k)} onClick={() => o.set({ aoeShape: k })}>
            {l}
          </button>
        ))}
        <input type="color" value={o.aoeColor} onChange={(e) => o.set({ aoeColor: e.target.value })} className="h-6 w-8 rounded border border-ink-600 bg-transparent" />
        <span className="text-[11px] text-parch-300">Arraste da origem ao alcance. Os atingidos ficam selecionados.</span>
      </>
    )
  if (tool === 'spell')
    content = (
      <>
        {VFX_LIST.map((v) => (
          <button key={v.id} className={chip(o.vfx === v.id)} onClick={() => o.set({ vfx: v.id })} title={v.label}>
            {v.icon} <span className="hidden lg:inline">{v.label}</span>
          </button>
        ))}
        <span className="text-[11px] text-parch-300">{VFX_LIST.find((v) => v.id === o.vfx)?.needsTarget ? 'Arraste do conjurador até o alvo.' : 'Clique onde o efeito acontece.'}</span>
      </>
    )
  if (tool === 'walls')
    content = (
      <>
        {(
          [
            ['wall', 'Parede'],
            ['door', 'Porta'],
            ['window', 'Janela'],
          ] as const
        ).map(([k, l]) => (
          <button key={k} className={chip(o.wallKind === k)} onClick={() => o.set({ wallKind: k })}>
            {l}
          </button>
        ))}
        <span className="text-[11px] text-parch-300">Clique ponto a ponto · Esc/botão direito termina · Shift sem encaixe · Ctrl+clique apaga</span>
      </>
    )
  if (tool === 'fog')
    content = (
      <>
        <button className={chip(o.fogMode === 'reveal')} onClick={() => o.set({ fogMode: 'reveal' })}>
          Revelar
        </button>
        <button className={chip(o.fogMode === 'hide')} onClick={() => o.set({ fogMode: 'hide' })}>
          Esconder
        </button>
        <span className="mx-1 h-4 w-px bg-ink-600" />
        {(
          [
            ['rect', 'Retângulo'],
            ['brush', 'Pincel'],
            ['poly', 'Polígono'],
          ] as const
        ).map(([k, l]) => (
          <button key={k} className={chip(o.fogShape === k)} onClick={() => o.set({ fogShape: k })}>
            {l}
          </button>
        ))}
        {o.fogShape === 'brush' && <input type="range" min={1} max={8} value={o.brush} onChange={(e) => o.set({ brush: Number(e.target.value) })} className="w-20 accent-arcane-500" title="Tamanho do pincel" />}
        {o.fogShape === 'poly' && <span className="text-[11px] text-parch-300">Clique os vértices, duplo clique fecha.</span>}
      </>
    )
  if (tool === 'light')
    content = (
      <>
        <span className="text-xs">Alcance</span>
        <input type="range" min={2} max={20} value={o.lightRadius} onChange={(e) => o.set({ lightRadius: Number(e.target.value) })} className="w-24 accent-gold-500" />
        <span className="text-xs">{o.lightRadius} cél.</span>
        <span className="text-[11px] text-parch-300">Clique para pôr uma luz · Ctrl+clique remove. Ajuste a luz ambiente em Cenas.</span>
      </>
    )
  if (!content) return null
  return <div className="panel pointer-events-auto absolute left-1/2 top-3 z-20 flex max-w-[calc(100%-7rem)] -translate-x-1/2 flex-wrap items-center gap-1.5 rounded-xl px-3 py-2 shadow-xl">{content}</div>
}

function TopBar({ panelOpen, onTogglePanel, onHelp }: { panelOpen: boolean; onTogglePanel: () => void; onHelp: () => void }) {
  const nav = useNavigate()
  const campaign = useGame((s) => s.campaign)!
  const presence = useGame((s) => s.presence)
  const status = useGame((s) => s.status)
  const me = useMe()
  const isRealGm = me?.role === 'gm'
  const preview = useGame((s) => s.previewAsPlayer)
  const mode25d = useGame((s) => s.mode25d)
  const lowFx = useGame((s) => s.lowFx)
  const scene = useScene()
  const viewSceneId = useGame((s) => s.viewSceneId)
  const [copied, setCopied] = useState(false)
  const [muted, setMuted] = useState(false)
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('audio-mute', { detail: muted }))
  }, [muted])
  const link = `${location.origin}/convite/${campaign.invite_code}`
  return (
    <header className="panel relative z-30 flex h-12 shrink-0 items-center gap-2 border-x-0 border-t-0 px-2">
      <IconButton label="Voltar às campanhas" onClick={() => nav('/')}>
        <ArrowLeft size={18} />
      </IconButton>
      <div className="min-w-0">
        <p className="truncate font-display text-sm font-bold text-gold-400 leading-tight">{campaign.name}</p>
        <p className="truncate text-[11px] text-parch-300 leading-tight">
          {scene?.name ?? 'Sem cena'}
          {isRealGm && viewSceneId && viewSceneId !== campaign.active_scene_id && <span className="ml-1 text-amber-400">(só você está vendo)</span>}
        </p>
      </div>
      <button
        className="ml-2 hidden items-center gap-1 rounded-md border border-ink-600 px-2 py-1 text-xs hover:bg-ink-700 sm:flex"
        title="Copiar link de convite"
        onClick={() => {
          void navigator.clipboard?.writeText(`${link}`)
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        }}
      >
        <Copy size={12} /> {copied ? 'Link copiado!' : <span className="font-mono">{campaign.invite_code}</span>}
      </button>
      <div className="ml-auto flex items-center gap-1">
        <div className="mr-1 flex -space-x-2" title={presence.map((p) => p.name).join(', ')}>
          {presence.slice(0, 6).map((p) => (
            <span key={p.user_id} className="grid size-7 place-items-center rounded-full border-2 border-ink-900 text-[11px] font-bold text-white" style={{ background: p.color }}>
              {p.name[0]?.toUpperCase()}
            </span>
          ))}
        </div>
        <span title={status === 'online' ? 'Conectado' : status === 'connecting' ? 'Conectando…' : 'Sem conexão — reconectando'} className={cn('px-1', status === 'online' ? 'text-emerald-400' : status === 'connecting' ? 'text-amber-400' : 'text-red-400')}>
          {status === 'offline' ? <WifiOff size={16} /> : <Wifi size={16} />}
        </span>
        {scene?.kind === 'map' && (
          <IconButton label="Modo 2.5D (miniaturas em pé)" active={mode25d} onClick={() => useGame.getState().set({ mode25d: !mode25d })}>
            <Box size={18} />
          </IconButton>
        )}
        <IconButton label={lowFx ? 'Efeitos reduzidos (clique para efeitos completos)' : 'Efeitos completos (clique para reduzir)'} active={!lowFx} onClick={() => useGame.getState().set({ lowFx: !lowFx })}>
          <Sparkles size={18} />
        </IconButton>
        <IconButton label={muted ? 'Ativar som' : 'Silenciar som'} onClick={() => setMuted(!muted)}>
          {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </IconButton>
        {isRealGm && (
          <IconButton label={preview ? 'Voltar à visão do mestre' : 'Ver como jogador'} active={preview} onClick={() => useGame.getState().set({ previewAsPlayer: !preview, tool: 'select' })}>
            <Users size={18} />
          </IconButton>
        )}
        <IconButton label="Ajuda e atalhos (?)" onClick={onHelp}>
          <HelpCircle size={18} />
        </IconButton>
        <IconButton label={panelOpen ? 'Fechar painel' : 'Abrir painel'} onClick={onTogglePanel}>
          {panelOpen ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}
        </IconButton>
      </div>
    </header>
  )
}

function AudioPlayer() {
  const scene = useScene()
  const audio = scene?.audio
  const url = useAssetUrl(audio?.url ?? null)
  const el = useRef<HTMLAudioElement | null>(null)
  const [muted, setMuted] = useState(false)
  const [blocked, setBlocked] = useState(false)
  useEffect(() => {
    const f = (e: Event) => setMuted((e as CustomEvent).detail)
    window.addEventListener('audio-mute', f)
    return () => window.removeEventListener('audio-mute', f)
  }, [])
  useEffect(() => {
    if (!el.current) el.current = new Audio()
    const a = el.current
    if (!url || !audio?.playing) {
      a.pause()
      return
    }
    if (a.src !== url) a.src = url
    a.loop = audio.loop
    a.volume = muted ? 0 : audio.volume
    a.play().then(
      () => setBlocked(false),
      () => setBlocked(true),
    )
  }, [url, audio?.playing, audio?.loop, audio?.volume, muted, audio])
  useEffect(() => () => el.current?.pause(), [])
  if (!blocked) return null
  return (
    <button className="panel fixed bottom-4 left-1/2 z-40 -translate-x-1/2 rounded-full px-4 py-2 text-sm shadow-xl" onClick={() => el.current?.play().then(() => setBlocked(false))}>
      🔊 Clique para ouvir a trilha da cena
    </button>
  )
}

function HelpModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const rows = [
    ['Arrastar no vazio / botão direito', 'Mover a câmera'],
    ['Roda do mouse / pinça', 'Zoom'],
    ['Clique / Shift+clique no token', 'Selecionar (vários)'],
    ['Arrastar token', 'Mover (encaixa no grid; jogadores não atravessam paredes)'],
    ['Duplo clique no token', 'Abrir a ficha'],
    ['Botão direito no token', 'Vida, condições, ocultar, luz…'],
    ['Alt+clique', 'Apontar (ping) para todos'],
    ['Setas', 'Mover token selecionado uma casa'],
    ['Delete', 'Remover tokens selecionados (mestre)'],
    ['+ / -  com tokens selecionados', 'Curar / ferir 1 PV'],
    ['V R A E P W F L', 'Ferramentas'],
    ['Chat: 2d6+3, /gr d20, /w Nome msg, /me ri', 'Rolar, rolagem secreta, sussurro, ação'],
    ['Arrastar imagem para o mapa', 'Vira mapa ou token'],
    ['Arrastar personagem da lista', 'Cria o token no mapa'],
  ]
  return (
    <Modal open={open} onClose={onClose} title="Como jogar">
      <table className="w-full text-sm">
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k} className="border-b border-ink-700/60">
              <td className="py-1.5 pr-3 font-mono text-xs text-gold-400">{k}</td>
              <td className="py-1.5 text-parch-200">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Modal>
  )
}

function Toasts() {
  const error = useGame((s) => s.error)
  useEffect(() => {
    if (!error) return
    const t = setTimeout(() => useGame.getState().set({ error: null }), 6000)
    return () => clearTimeout(t)
  }, [error])
  if (!error) return null
  return (
    <div role="alert" className="fixed bottom-4 left-4 z-50 max-w-sm rounded-xl border border-red-700 bg-red-950/95 px-4 py-3 text-sm shadow-2xl animate-pop" onClick={() => useGame.getState().set({ error: null })}>
      {error}
    </div>
  )
}

function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (el.closest('input, textarea, select, [contenteditable]')) return
      const s = useGame.getState()
      const gmNow = s.user && s.campaignId && s.members[`${s.campaignId}:${s.user.id}`]?.role === 'gm' && !s.previewAsPlayer
      const k = e.key.toLowerCase()
      const tool = TOOLS.find((t) => t.key === k && (!t.gm || gmNow))
      if (tool && !e.ctrlKey && !e.metaKey && !e.altKey) {
        s.set({ tool: tool.id })
        return
      }
      if (k === '?') window.dispatchEvent(new Event('open-help'))
      const sel = s.selected.map((id) => s.tokens[id]).filter(Boolean)
      if (!sel.length) return
      if ((e.key === 'Delete' || e.key === 'Backspace') && gmNow) sel.forEach((t) => void s.removeRow('tokens', t))
      if (e.key === '+' || e.key === '=') void changeHp(sel.filter(canControl).map((t) => t.id), 1)
      if (e.key === '-') void changeHp(sel.filter(canControl).map((t) => t.id), -1)
      const dirs: Record<string, [number, number]> = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }
      const d = dirs[e.key]
      if (d) {
        e.preventDefault()
        for (const t of sel) {
          if (!canControl(t)) continue
          const sc = s.scenes[t.scene_id]
          const p = snapToGrid({ x: t.x + d[0] * sc.grid.size, y: t.y + d[1] * sc.grid.size }, sc.grid, t.size)
          void s.patch('tokens', t.id, { x: p.x, y: p.y })
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}

export default function TablePage() {
  const { id = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const nav = useNavigate()
  const user = useGame((s) => s.user)
  const loading = useGame((s) => s.loading)
  const error = useGame((s) => s.error)
  const campaign = useGame((s) => s.campaign)
  const campaignId = useGame((s) => s.campaignId)
  const scene = useScene()
  const me = useMe()
  const gm = useIsGm()
  const tool = useGame((s) => s.tool)
  const [tab, setTab] = useState<PanelTab>('chat')
  const [panelOpen, setPanelOpen] = useState(() => innerWidth > 900)
  const [help, setHelp] = useState(false)
  const [seeding, setSeeding] = useState<string | null>(null)
  const unread = useRef(0)
  useShortcuts()

  useEffect(() => {
    void initPhysics()
  }, [])
  useEffect(() => {
    const f = () => setHelp(true)
    window.addEventListener('open-help', f)
    return () => window.removeEventListener('open-help', f)
  }, [])
  useEffect(() => {
    if (!user) return
    void useGame.getState().enter(id)
    return () => useGame.getState().leave()
  }, [id, user])

  // campanha nova: semeia exemplo ou cria a primeira cena
  useEffect(() => {
    if (!campaign || campaignId !== id || !me || me.role !== 'gm' || loading) return
    const s = useGame.getState()
    if (Object.keys(s.scenes).length > 0) return
    if (params.get('exemplo') === '1') {
      setParams({}, { replace: true })
      setSeeding('Preparando a aventura…')
      seedSampleCampaign(setSeeding)
        .catch((e) => s.set({ error: (e as Error).message }))
        .finally(() => setSeeding(null))
    } else if (!seeding) {
      const sc = defaultScene(id, 'Primeira cena')
      void s.save('scenes', sc).then(() => s.patch('campaigns', id, { active_scene_id: sc.id }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign?.id, campaignId, me?.role, loading])

  // presença
  useEffect(() => {
    if (me) trackPresence({ name: me.display_name, sceneId: scene?.id ?? null, color: me.color })
  }, [me, scene?.id])

  // câmera acompanha o turno de combate
  const turnToken = useGame((s) => {
    const sid = activeSceneId(s)
    const sc = sid ? s.scenes[sid] : null
    if (!sc?.combat.active) return null
    const ordered = [...sc.combat.combatants].sort((a, b) => b.initiative - a.initiative)
    return ordered[sc.combat.turn]?.token_id ?? null
  })
  useEffect(() => {
    if (!turnToken) return
    const t = useGame.getState().tokens[turnToken]
    if (t && (!t.hidden || gm)) useCamRequests.getState().requestFocus(t.x, t.y)
  }, [turnToken, gm])

  // jogadores: ferramentas de mestre não ficam ativas
  useEffect(() => {
    if (!gm && TOOLS.find((t) => t.id === tool)?.gm) useGame.getState().set({ tool: 'select' })
  }, [gm, tool])

  const chatCount = useGame((s) => Object.keys(s.chat).length)
  const [seenCount, setSeenCount] = useState(chatCount)
  useEffect(() => {
    if (tab === 'chat' && panelOpen) setSeenCount(chatCount)
  }, [tab, panelOpen, chatCount])
  unread.current = Math.max(0, chatCount - seenCount)

  if (!user)
    return (
      <div className="bg-arcane grid h-full place-items-center p-6 text-center">
        <div className="space-y-3">
          <p>Entre para acessar a mesa.</p>
          <Button variant="primary" onClick={() => nav('/')}>
            Entrar
          </Button>
        </div>
      </div>
    )
  if (error && !campaign)
    return (
      <div className="bg-arcane grid h-full place-items-center p-6 text-center">
        <div className="space-y-3">
          <p className="text-red-400">{error}</p>
          {backend.kind === 'local' && <p className="text-sm text-parch-300">No modo demonstração, abra a campanha no mesmo navegador em que ela foi criada.</p>}
          <Button onClick={() => nav('/')}>Voltar</Button>
        </div>
      </div>
    )
  if (!campaign || loading)
    return (
      <div className="bg-arcane grid h-full place-items-center text-parch-300">
        <span className="flex items-center gap-2">
          <Spinner /> Abrindo a mesa…
        </span>
      </div>
    )

  const tabs: { id: PanelTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'chat', label: 'Chat', icon: <MessageSquare size={16} />, badge: unread.current },
    { id: 'chars', label: 'Fichas', icon: <UserRound size={16} /> },
    { id: 'combat', label: 'Combate', icon: <Swords size={16} /> },
    ...(gm ? [{ id: 'scenes' as const, label: 'Cenas', icon: <MapIcon size={16} /> }] : []),
  ]

  return (
    <div className="flex h-full flex-col overflow-hidden bg-ink-950">
      <TopBar panelOpen={panelOpen} onTogglePanel={() => setPanelOpen((v) => !v)} onHelp={() => setHelp(true)} />
      <div className="relative flex min-h-0 flex-1">
        <main className="relative min-w-0 flex-1 overflow-hidden">
          {scene ? scene.kind === 'theater' ? <TheaterView scene={scene} /> : <MapView scene={scene} /> : <div className="grid h-full place-items-center text-parch-300">{seeding ? '' : 'Nenhuma cena ativa ainda.'}</div>}
          {scene?.kind === 'map' && (
            <nav className="panel absolute left-2 top-1/2 z-20 flex -translate-y-1/2 flex-col gap-1 rounded-xl p-1 shadow-xl" aria-label="Ferramentas">
              {TOOLS.filter((t) => !t.gm || gm).map((t, i) => (
                <div key={t.id}>
                  {t.gm && !TOOLS[i - 1]?.gm && <div className="my-1 h-px bg-ink-600" />}
                  <IconButton label={t.label} active={tool === t.id} onClick={() => useGame.getState().set({ tool: t.id })} data-testid={`tool-${t.id}`}>
                    {t.icon}
                  </IconButton>
                </div>
              ))}
            </nav>
          )}
          {scene?.kind === 'map' && <ToolOptionsBar />}
          {scene?.kind === 'map' && <SelectionBar />}
          {seeding && (
            <div className="absolute inset-0 z-40 grid place-items-center bg-black/60 backdrop-blur-sm">
              <div className="panel flex items-center gap-3 rounded-2xl px-6 py-4">
                <Flame className="animate-pulse text-gold-400" /> {seeding}
              </div>
            </div>
          )}
        </main>
        <aside
          className={cn(
            'panel z-20 flex w-[340px] max-w-[92vw] shrink-0 flex-col border-y-0 border-r-0 transition-[margin] duration-200',
            'max-md:absolute max-md:inset-y-0 max-md:right-0 max-md:shadow-2xl',
            !panelOpen && 'max-md:hidden md:-mr-[340px]',
          )}
        >
          <Tabs tabs={tabs} value={tab} onChange={setTab} />
          <div className="min-h-0 flex-1">
            {tab === 'chat' && <ChatPanel />}
            {tab === 'chars' && <CharactersPanel />}
            {tab === 'combat' && <CombatPanel />}
            {tab === 'scenes' && gm && <ScenesPanel />}
          </div>
        </aside>
      </div>
      <DiceOverlay />
      <SheetModal />
      <TokenMenu />
      <AudioPlayer />
      <HelpModal open={help} onClose={() => setHelp(false)} />
      <Toasts />
    </div>
  )
}

function SelectionBar() {
  const selected = useGame((s) => s.selected)
  const tokens = useGame((s) => s.tokens)
  const list = selected.map((id) => tokens[id]).filter(Boolean)
  const controllable = list.filter(canControl)
  const [n, setN] = useState(5)
  if (!controllable.length) return null
  return (
    <div className="panel absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-xl px-3 py-2 shadow-xl animate-pop">
      <span className="max-w-40 truncate text-sm font-semibold">{list.length === 1 ? list[0].name : `${list.length} selecionados`}</span>
      <input type="number" value={n} min={1} onChange={(e) => setN(Math.max(1, Number(e.target.value)))} className="w-14 rounded-md border border-ink-600 bg-ink-850 px-1 py-0.5 text-center text-sm" />
      <Button size="sm" variant="danger" onClick={() => changeHp(controllable.map((t) => t.id), -n)}>
        Dano
      </Button>
      <Button size="sm" className="border-0 bg-emerald-700 text-white hover:bg-emerald-600" onClick={() => changeHp(controllable.map((t) => t.id), n)}>
        Cura
      </Button>
      {list.length === 1 && list[0].character_id && (
        <Button size="sm" variant="ghost" onClick={() => useGame.getState().set({ openSheetId: list[0].character_id })}>
          Ficha
        </Button>
      )}
    </div>
  )
}
