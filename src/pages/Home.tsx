import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Dices, LogOut, Mail, Plus, Sparkles, Swords, Users, Wand2 } from 'lucide-react'
import { backend, setDemoForced, supabaseConfigured } from '../data'
import type { Campaign } from '../types'
import { useGame } from '../store/game'
import { Button, Field, Input, Modal, Select, Spinner } from '../components/ui'
import { SYSTEMS } from '../systems'

function Logo() {
  return (
    <div className="flex items-center gap-3">
      <div className="grid size-12 place-items-center rounded-xl bg-gradient-to-br from-arcane-500 to-arcane-600 shadow-lg shadow-arcane-600/40 rotate-6">
        <Dices className="text-gold-400 -rotate-6" size={28} />
      </div>
      <div>
        <h1 className="font-display text-3xl font-extrabold text-gold-400 leading-none">Mesa Arcana</h1>
        <p className="text-sm text-parch-300">Sua mesa de RPG online com os amigos</p>
      </div>
    </div>
  )
}

function Login() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key)
    setErr(null)
    try {
      await fn()
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="panel w-full max-w-md rounded-2xl p-6 space-y-5 shadow-2xl">
      <h2 className="font-display text-xl text-parch-100">Entrar na taverna</h2>
      {backend.kind === 'supabase' ? (
        <>
          {sent ? (
            <p className="rounded-lg bg-emerald-900/40 border border-emerald-700 p-3 text-sm">
              Enviamos um link mágico para <b>{email}</b>. Abra seu e-mail neste aparelho para entrar.
            </p>
          ) : (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault()
                void run('mail', async () => {
                  await backend.signInMagicLink(email)
                  setSent(true)
                })
              }}
            >
              <Field label="E-mail">
                <Input type="email" required placeholder="voce@exemplo.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              </Field>
              <Button variant="primary" className="w-full" disabled={!!busy}>
                {busy === 'mail' ? <Spinner /> : <Mail size={16} />} Receber link mágico
              </Button>
            </form>
          )}
          <Button className="w-full bg-[#5865F2] hover:bg-[#4752c4] border-0 text-white" disabled={!!busy} onClick={() => run('discord', () => backend.signInDiscord())}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M20.3 4.4A19.8 19.8 0 0 0 15.4 3l-.6 1.3a18.4 18.4 0 0 0-5.6 0L8.6 3a19.7 19.7 0 0 0-4.9 1.4C.6 9-.3 13.6.1 18.1a19.9 19.9 0 0 0 6 3l1.3-2a13 13 0 0 1-2-1l.5-.4a14.2 14.2 0 0 0 12.2 0l.5.4-2 1 1.3 2a19.8 19.8 0 0 0 6-3c.5-5.2-.8-9.8-3.6-13.7ZM8 15.4c-1.2 0-2.2-1.1-2.2-2.4S6.8 10.6 8 10.6s2.2 1.1 2.2 2.4-1 2.4-2.2 2.4Zm8 0c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4 2.2 1.1 2.2 2.4-1 2.4-2.2 2.4Z" />
            </svg>
            Entrar com Discord
          </Button>
          <div className="flex items-center gap-3 text-xs text-ink-500">
            <span className="h-px flex-1 bg-ink-700" /> ou <span className="h-px flex-1 bg-ink-700" />
          </div>
        </>
      ) : (
        <p className="rounded-lg border border-gold-500/40 bg-gold-500/10 p-3 text-sm text-parch-200">
          <b className="text-gold-400">Modo demonstração.</b> Tudo fica salvo neste navegador e as abas abertas jogam juntas. Abra outra aba como
          jogador para testar. Para jogar online com amigos, configure o Supabase (veja o README).
        </p>
      )}
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          void run('guest', () => backend.signInGuest(name))
        }}
      >
        <Field label="Seu nome na mesa">
          <Input required maxLength={40} placeholder="Ex.: Ana" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Button variant={backend.kind === 'local' ? 'primary' : 'secondary'} className="w-full" disabled={!!busy}>
          {busy === 'guest' ? <Spinner /> : <Sparkles size={16} />} Entrar como convidado
        </Button>
      </form>
      {err && <p className="text-sm text-red-400">{err}</p>}
      {supabaseConfigured && backend.kind === 'supabase' && (
        <button
          className="text-xs text-ink-500 underline hover:text-parch-300"
          onClick={() => {
            setDemoForced(true)
            location.reload()
          }}
        >
          Testar no modo demonstração (sem servidor)
        </button>
      )}
    </div>
  )
}

function Campaigns() {
  const user = useGame((s) => s.user)!
  const nav = useNavigate()
  const [list, setList] = useState<Campaign[] | null>(null)
  const [creating, setCreating] = useState(false)
  const [joining, setJoining] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    backend
      .listMyCampaigns()
      .then(setList)
      .catch((e) => {
        setErr(e.message)
        setList([])
      })
  }, [])

  return (
    <div className="w-full max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-parch-300">
          Olá, <b className="text-parch-100">{user.name}</b>!
        </p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setJoining(true)}>
            <Users size={16} /> Entrar com código
          </Button>
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus size={16} /> Nova campanha
          </Button>
          <Button variant="ghost" onClick={() => backend.signOut()} title="Sair">
            <LogOut size={16} />
          </Button>
        </div>
      </div>
      {err && <p className="text-sm text-red-400">{err}</p>}
      {list === null ? (
        <Spinner />
      ) : list.length === 0 ? (
        <div className="panel rounded-2xl p-10 text-center space-y-3">
          <Swords className="mx-auto text-gold-400" size={40} />
          <p className="font-display text-xl">Nenhuma campanha ainda</p>
          <p className="text-sm text-parch-300">Crie uma campanha como mestre (com uma aventura de exemplo pronta) ou entre com o código que seu mestre enviou.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {list.map((c) => (
            <button
              key={c.id}
              onClick={() => nav(`/c/${c.id}`)}
              className="panel group rounded-2xl p-5 text-left transition hover:glow-gold hover:-translate-y-0.5"
            >
              <p className="font-display text-xl text-gold-400 group-hover:text-gold-400">{c.name}</p>
              <p className="text-sm text-parch-300">{SYSTEMS[c.system_id]?.name ?? c.system_id}</p>
              <p className="mt-3 text-xs text-ink-500">
                Convite: <span className="font-mono text-parch-200">{c.invite_code}</span>
              </p>
            </button>
          ))}
        </div>
      )}
      <CreateCampaign open={creating} onClose={() => setCreating(false)} />
      <JoinCampaign open={joining} onClose={() => setJoining(false)} />
    </div>
  )
}

function CreateCampaign({ open, onClose }: { open: boolean; onClose: () => void }) {
  const user = useGame((s) => s.user)!
  const nav = useNavigate()
  const [name, setName] = useState('A Cripta do Rei Goblin')
  const [system, setSystem] = useState('dnd5e')
  const [sample, setSample] = useState(true)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  return (
    <Modal open={open} onClose={onClose} title="Nova campanha">
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault()
          setBusy(true)
          setErr(null)
          try {
            const c = await backend.createCampaign(name, system, user.name)
            nav(`/c/${c.id}${sample ? '?exemplo=1' : ''}`)
          } catch (e) {
            setErr((e as Error).message)
            setBusy(false)
          }
        }}
      >
        <Field label="Nome">
          <Input required value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Sistema" hint={SYSTEMS[system].description}>
          <Select value={system} onChange={(e) => setSystem(e.target.value)}>
            {Object.values(SYSTEMS).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <label className="flex items-start gap-3 rounded-lg border border-ink-600 p-3 cursor-pointer">
          <input type="checkbox" className="mt-1 accent-arcane-500" checked={sample} onChange={(e) => setSample(e.target.checked)} />
          <span className="text-sm">
            <b className="text-parch-100">Incluir aventura de exemplo</b>
            <br />
            <span className="text-parch-300">Taverna (modo teatro), masmorra com paredes, luzes e névoa, 4 heróis prontos e monstros.</span>
          </span>
        </label>
        {err && <p className="text-sm text-red-400">{err}</p>}
        <Button variant="primary" className="w-full" disabled={busy}>
          {busy ? <Spinner /> : <Wand2 size={16} />} Criar e abrir a mesa
        </Button>
      </form>
    </Modal>
  )
}

function JoinCampaign({ open, onClose, initialCode = '' }: { open: boolean; onClose: () => void; initialCode?: string }) {
  const user = useGame((s) => s.user)!
  const nav = useNavigate()
  const [code, setCode] = useState(initialCode)
  const [name, setName] = useState(user.name)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  return (
    <Modal open={open} onClose={onClose} title="Entrar em uma campanha">
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault()
          setBusy(true)
          setErr(null)
          try {
            const id = await backend.joinCampaign(code, name)
            nav(`/c/${id}`)
          } catch (e) {
            setErr((e as Error).message)
            setBusy(false)
          }
        }}
      >
        <Field label="Código de convite">
          <Input required className="font-mono uppercase tracking-widest text-lg" maxLength={8} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
        </Field>
        <Field label="Seu nome nesta campanha">
          <Input required value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        {err && <p className="text-sm text-red-400">{err}</p>}
        <Button variant="primary" className="w-full" disabled={busy}>
          {busy ? <Spinner /> : <Users size={16} />} Entrar
        </Button>
      </form>
    </Modal>
  )
}

export function HomePage() {
  const user = useGame((s) => s.user)
  return (
    <div className="bg-arcane min-h-full flex flex-col items-center gap-10 px-4 py-12">
      <Logo />
      {user ? <Campaigns /> : <Login />}
      <Features />
    </div>
  )
}

export function InvitePage() {
  const { code = '' } = useParams()
  const user = useGame((s) => s.user)
  const nav = useNavigate()
  return (
    <div className="bg-arcane min-h-full flex flex-col items-center gap-10 px-4 py-12">
      <Logo />
      {user ? <JoinCampaign open initialCode={code} onClose={() => nav('/')} /> : <Login />}
    </div>
  )
}

function Features() {
  const items = [
    ['Fichas com sprites', 'Personagens animados em pixel art, cartão 3D e rolagens com um clique.'],
    ['Mapas vivos', 'Grid, névoa de guerra, paredes, portas, luzes e visão de cada herói.'],
    ['Dados 3D', 'Física real e o mesmo resultado na tela de todos.'],
    ['Cenários', 'Modo teatro, modo 2.5D, clima, magias e trilha sonora.'],
  ]
  return (
    <div className="grid w-full max-w-4xl gap-3 sm:grid-cols-2 lg:grid-cols-4 opacity-90">
      {items.map(([t, d]) => (
        <div key={t} className="rounded-xl border border-ink-700 bg-ink-900/50 p-4">
          <p className="font-display text-gold-400">{t}</p>
          <p className="text-xs text-parch-300 mt-1">{d}</p>
        </div>
      ))}
    </div>
  )
}
