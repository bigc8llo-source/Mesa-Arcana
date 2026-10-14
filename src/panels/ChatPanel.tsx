import { useEffect, useMemo, useRef, useState } from 'react'
import { EyeOff, Send } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import type { ChatMessage, RollResult } from '../types'
import { useGame } from '../store/game'
import { handleChatInput, myCharacters, rollDice } from '../game/actions'
import { isValidNotation } from '../engine/dice'
import { Button, cn, Input } from '../components/ui'
import { DicePicker } from '../dice/DicePicker'

function RollCard({ roll }: { roll: RollResult }) {
  return (
    <div className={cn('mt-1 rounded-lg border px-3 py-2', roll.crit === 'success' ? 'border-gold-400/70 bg-amber-900/30' : roll.crit === 'fail' ? 'border-red-600/60 bg-red-950/40' : 'border-ink-600 bg-ink-850')}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs text-parch-300">{roll.notation}</span>
        <span className="font-display text-2xl font-extrabold text-gold-400">{roll.total}</span>
      </div>
      <div className="mt-1 flex flex-wrap gap-1">
        {roll.groups.flatMap((g, gi) =>
          g.dice.map((d, i) => (
            <span
              key={`${gi}-${i}`}
              title={`d${d.sides}`}
              className={cn(
                'grid min-w-6 place-items-center rounded px-1 text-xs font-bold',
                d.dropped ? 'bg-ink-700 text-ink-500 line-through' : d.value === d.sides ? 'bg-emerald-700 text-white' : d.value === 1 ? 'bg-red-800 text-white' : 'bg-ink-600 text-parch-100',
              )}
            >
              {d.value}
            </span>
          )),
        )}
        {roll.modifier !== 0 && <span className="text-xs text-parch-300 self-center">{roll.modifier > 0 ? `+${roll.modifier}` : roll.modifier}</span>}
      </div>
    </div>
  )
}

function Message({ m, myId }: { m: ChatMessage; myId: string | undefined }) {
  const time = new Date(m.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  if (m.kind === 'system') return <p className="my-2 text-center text-xs italic text-gold-400/80">{m.content}</p>
  if (m.kind === 'emote')
    return (
      <p className="my-1 text-sm italic text-arcane-400">
        * {m.character_name ?? m.author_name} {m.content}
      </p>
    )
  const secret = m.visibility !== 'public'
  return (
    <div className={cn('rounded-lg px-2 py-1.5', secret && 'bg-arcane-600/10 border border-arcane-600/30', m.author_id === myId && 'bg-ink-800/60')}>
      <div className="flex items-baseline gap-2">
        <span className="text-sm font-semibold text-parch-100">{m.character_name ?? m.author_name}</span>
        {m.character_name && <span className="text-[10px] text-ink-500">({m.author_name})</span>}
        {secret && (
          <span className="flex items-center gap-0.5 text-[10px] text-arcane-400">
            <EyeOff size={10} /> {m.visibility === 'gm' ? 'secreta' : 'sussurro'}
          </span>
        )}
        <span className="ml-auto text-[10px] text-ink-500">{time}</span>
      </div>
      {m.label && <p className="text-xs text-parch-300">{m.label}</p>}
      {m.content && <p className="whitespace-pre-wrap break-words text-sm text-parch-200">{m.content}</p>}
      {m.roll && <RollCard roll={m.roll} />}
    </div>
  )
}

export function ChatPanel() {
  const chat = useGame((s) => s.chat)
  const myId = useGame((s) => s.user?.id)
  const [text, setText] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [charId, setCharId] = useState<string>(() => myCharacters()[0]?.id ?? '')
  const end = useRef<HTMLDivElement>(null)
  const list = useMemo(() => Object.values(chat).sort((a, b) => a.created_at.localeCompare(b.created_at)).slice(-200), [chat])
  const mine = useGame(useShallow(() => myCharacters()))
  const character = useGame((s) => (charId ? s.characters[charId] : null)) ?? null

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: 'smooth' })
  }, [list.length])

  const submit = async () => {
    setErr(null)
    const t = text.trim()
    if (!t) return
    try {
      // atalho: digitar só a notação rola os dados
      if (!t.startsWith('/') && isValidNotation(t) && /d/i.test(t)) await rollDice(t, { character })
      else await handleChatInput(t, character)
      setText('')
    } catch (e) {
      setErr((e as Error).message)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-1 overflow-y-auto p-3" data-testid="chat-log">
        {list.length === 0 && <p className="py-8 text-center text-sm text-parch-300">Nada por aqui ainda. Role um dado ou diga olá!</p>}
        {list.map((m) => (
          <Message key={m.id} m={m} myId={myId} />
        ))}
        <div ref={end} />
      </div>
      <details className="group border-t border-ink-700" open={innerWidth > 900}>
        <summary className="cursor-pointer list-none px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-parch-300 hover:text-parch-100">🎲 Dados</summary>
        <div className="px-2 pb-2">
          <DicePicker compact character={character} />
        </div>
      </details>
      <form
        className="space-y-1.5 border-t border-ink-700 p-2"
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        {mine.length > 0 && (
          <select value={charId} onChange={(e) => setCharId(e.target.value)} className="w-full rounded-md bg-ink-850 border border-ink-600 px-2 py-1 text-xs">
            <option value="">Falar como: eu mesmo</option>
            {mine.map((c) => (
              <option key={c.id} value={c.id}>
                Falar como: {c.name}
              </option>
            ))}
          </select>
        )}
        <div className="flex gap-1.5">
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Mensagem, 2d6+3, /gr d20, /w Ana oi" data-testid="chat-input" />
          <Button variant="primary" className="px-3" aria-label="Enviar">
            <Send size={16} />
          </Button>
        </div>
        {err && <p className="text-xs text-red-400">{err}</p>}
      </form>
    </div>
  )
}
