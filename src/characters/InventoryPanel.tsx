import { useState } from 'react'
import { Backpack, Coins, Minus, Plus, Scissors, Shield, Trash2 } from 'lucide-react'
import { Button, cn, Input, NumberInput, Select } from '../components/ui'
import type { Character } from '../types'
import {
  addItem,
  CATALOG,
  COINS,
  carryInfo,
  fromCatalog,
  isCoin,
  KIND_LABEL,
  mergeStacks,
  readBag,
  splitStack,
  totalWeight,
  unitWeight,
  type InvItem,
  type ItemKind,
} from '../systems/inventory'

const fmt = (n: number) => (Math.round(n * 100) / 100).toLocaleString('pt-BR')

/** Inventário completo: moedas (sem peso), itens com peso, pilhas e carga. */
export function InventoryPanel({ c, sheet, editable, onPatch }: { c: Pick<Character, 'system_id'>; sheet: Record<string, unknown>; editable: boolean; onPatch: (p: Record<string, unknown>) => void }) {
  const onBag = (bag: InvItem[]) => onPatch({ bag })
  const bag = readBag(sheet)
  const { unit, capacity, max } = carryInfo({ system_id: c.system_id, sheet })
  const load = totalWeight(bag)
  const coins = bag.filter(isCoin)
  const items = bag.filter((i) => !isCoin(i))
  const upd = (id: string, p: Partial<InvItem>) => onBag(bag.map((x) => (x.id === id ? { ...x, ...p } : x)))
  const del = (id: string) => onBag(bag.filter((x) => x.id !== id))
  const over = capacity !== null && load > capacity
  const tooMuch = max !== null && load > max

  return (
    <div className="space-y-3 text-sm" data-testid="inventory">
      {/* Carga */}
      <div>
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1 text-parch-300">
            <Backpack size={12} /> Carga
          </span>
          <span className={cn('font-bold', tooMuch ? 'text-red-400' : over ? 'text-amber-300' : 'text-parch-100')} data-testid="carry-load">
            {fmt(load)}
            {capacity !== null && ` / ${fmt(capacity)}`} {unit}
          </span>
        </div>
        {capacity !== null && (
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-ink-700">
            <div className={cn('h-full transition-all', tooMuch ? 'bg-red-500' : over ? 'bg-amber-400' : 'bg-emerald-500')} style={{ width: `${Math.min(100, (load / Math.max(0.01, max ?? capacity)) * 100)}%` }} />
          </div>
        )}
        {over && (
          <p className="mt-1 text-xs text-amber-300">
            {tooMuch
              ? `Acima do máximo (${fmt(max!)} ${unit}): o personagem não consegue se mover carregando tudo isso.`
              : c.system_id === 'tormenta20'
                ? 'Sobrecarregado: −5 em testes de perícias afetadas por armadura e deslocamento reduzido em 3 m.'
                : 'Sobrecarregado: deslocamento reduzido (combine a penalidade com o mestre).'}
          </p>
        )}
        {c.system_id === 'generico' && editable && (
          <label className="mt-1 flex items-center gap-2 text-xs text-parch-300">
            Capacidade (kg, 0 = sem limite)
            <span className="w-20">
              <NumberInput value={Number(sheet.carry_max) || 0} onChange={(v) => onPatch({ carry_max: Math.max(0, v) })} title="Capacidade" />
            </span>
          </label>
        )}
      </div>

      {/* Moedas */}
      <div>
        <p className="mb-1 flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-parch-300">
          <Coins size={12} /> Moedas <span className="font-normal normal-case text-ink-500">(não pesam)</span>
        </p>
        {coins.length === 0 && <p className="text-xs text-ink-500">Sem moedas.</p>}
        <div className="space-y-1">
          {coins.map((m) => (
            <div key={m.id} className="flex items-center gap-1.5" data-testid="coin-row">
              <span className="min-w-0 flex-1 truncate text-gold-400">{m.name}</span>
              {editable ? (
                <>
                  <span className="w-24">
                    <NumberInput title={`Quantidade de ${m.name}`} value={m.qty} onChange={(v) => upd(m.id, { qty: Math.max(0, v) })} />
                  </span>
                  <button type="button" className="p-1 text-ink-500 hover:text-red-400" onClick={() => del(m.id)} aria-label={`Remover ${m.name}`}>
                    <Trash2 size={13} />
                  </button>
                </>
              ) : (
                <span className="font-mono font-bold">{m.qty}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Itens */}
      <div>
        <p className="mb-1 flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-parch-300">
          <Backpack size={12} /> Itens
        </p>
        {items.length === 0 && <p className="text-xs text-ink-500">Mochila vazia.</p>}
        <div className="space-y-1.5">
          {items.map((it) => (
            <ItemRow key={it.id} it={it} unit={unit} editable={editable} onChange={(p) => upd(it.id, p)} onDelete={() => del(it.id)} onSplit={(n) => onBag(splitStack(bag, it.id, n))} />
          ))}
        </div>
        {editable && bag.some((x, i) => x.stackable && bag.findIndex((y) => y.stackable && y.kind === x.kind && y.name.trim().toLowerCase() === x.name.trim().toLowerCase()) !== i) && (
          <Button size="sm" variant="ghost" className="mt-1 px-1" onClick={() => onBag(mergeStacks(bag))}>
            Juntar pilhas iguais
          </Button>
        )}
      </div>

      {editable && <AddItem systemId={c.system_id} onAdd={(it) => onBag(addItem(bag, it))} unit={unit} />}
    </div>
  )
}

function ItemRow({ it, unit, editable, onChange, onDelete, onSplit }: { it: InvItem; unit: string; editable: boolean; onChange: (p: Partial<InvItem>) => void; onDelete: () => void; onSplit: (n: number) => void }) {
  const [open, setOpen] = useState(false)
  const w = unitWeight(it)
  return (
    <div className={cn('rounded-lg border p-1.5', it.equipped ? 'border-gold-500/60 bg-gold-500/5' : 'border-ink-700')} data-testid="item-row">
      <div className="flex items-center gap-1.5">
        <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setOpen((o) => !o)}>
          <span className="block truncate font-semibold">
            {it.name}
            {it.stackable && <span className="ml-1 font-mono text-gold-400">×{it.qty}</span>}
          </span>
          <span className="block text-[11px] text-parch-300">
            {KIND_LABEL[it.kind]} · {w > 0 ? `${fmt(w)} ${w === 1 ? unit.replace(/s$/, '') : unit}${it.qty > 1 ? ` cada, ${fmt(w * it.qty)} no total` : ''}` : 'sem peso'}
            {it.equipped && ' · equipado'}
          </span>
        </button>
        {editable && it.stackable && (
          <>
            <button type="button" className="grid size-7 place-items-center rounded-md bg-ink-700" onClick={() => onChange({ qty: Math.max(0, it.qty - 1) })} aria-label={`Usar/remover 1 ${it.name}`}>
              <Minus size={12} />
            </button>
            <button type="button" className="grid size-7 place-items-center rounded-md bg-ink-700" onClick={() => onChange({ qty: it.qty + 1 })} aria-label={`Adicionar 1 ${it.name}`}>
              <Plus size={12} />
            </button>
          </>
        )}
        {editable && (it.kind === 'arma' || it.kind === 'armadura' || it.kind === 'equipamento') && (
          <button type="button" className={cn('grid size-7 place-items-center rounded-md', it.equipped ? 'bg-gold-500/30 text-gold-400' : 'bg-ink-700 text-ink-500')} onClick={() => onChange({ equipped: !it.equipped })} aria-label={it.equipped ? 'Desequipar' : 'Equipar'} title={it.equipped ? 'Desequipar' : 'Equipar'}>
            <Shield size={12} />
          </button>
        )}
      </div>
      {open && (
        <div className="mt-1.5 space-y-1 text-xs">
          {editable ? (
            <>
              <Input className="py-1 text-xs" value={it.name} onChange={(e) => onChange({ name: e.target.value })} aria-label="Nome do item" />
              <div className="grid grid-cols-3 gap-1">
                <label className="text-parch-300">
                  Tipo
                  <Select className="py-1 text-xs" value={it.kind} onChange={(e) => onChange({ kind: e.target.value as ItemKind, ...(e.target.value === 'moeda' ? { weight: 0, stackable: true } : {}) })}>
                    {Object.entries(KIND_LABEL).map(([k, l]) => (
                      <option key={k} value={k}>
                        {l}
                      </option>
                    ))}
                  </Select>
                </label>
                <label className="text-parch-300">
                  Peso ({unit})
                  <input type="number" min={0} step={0.05} className="w-full rounded-md border border-ink-700 bg-ink-900 px-2 py-1" value={it.weight} onChange={(e) => onChange({ weight: Math.max(0, Number(e.target.value) || 0) })} />
                </label>
                <label className="text-parch-300">
                  Qtd.
                  <NumberInput value={it.qty} onChange={(v) => onChange({ qty: Math.max(0, v) })} />
                </label>
              </div>
              <label className="flex items-center gap-1 text-parch-300">
                <input type="checkbox" checked={it.stackable} onChange={(e) => onChange({ stackable: e.target.checked })} /> Empilhável
              </label>
              <Input className="py-1 text-xs" placeholder="Anotações (efeito, valor…)" value={it.notes} onChange={(e) => onChange({ notes: e.target.value })} />
              <div className="flex gap-1">
                {it.stackable && it.qty > 1 && (
                  <Button size="sm" variant="ghost" onClick={() => onSplit(Math.floor(it.qty / 2))}>
                    <Scissors size={12} /> Dividir pilha
                  </Button>
                )}
                <Button size="sm" variant="ghost" className="ml-auto text-red-300" onClick={onDelete}>
                  <Trash2 size={12} /> Remover
                </Button>
              </div>
            </>
          ) : (
            it.notes && <p className="text-parch-300">{it.notes}</p>
          )}
        </div>
      )}
    </div>
  )
}

function AddItem({ systemId, onAdd, unit }: { systemId: string; onAdd: (it: InvItem) => void; unit: string }) {
  const coins = COINS[systemId] ?? COINS.generico
  const [pick, setPick] = useState('')
  const [custom, setCustom] = useState({ name: '', kind: 'equipamento' as ItemKind, qty: 1, weight: 1, stackable: false })
  const [mode, setMode] = useState<'lista' | 'novo'>('lista')
  const all = [...coins, ...CATALOG]
  const chosen = all.find((x) => x.name === pick)
  const [qty, setQty] = useState(1)
  return (
    <div className="space-y-1.5 rounded-lg border border-dashed border-ink-700 p-2 text-xs" data-testid="add-item">
      <div className="flex gap-1">
        <Button size="sm" variant={mode === 'lista' ? 'primary' : 'ghost'} onClick={() => setMode('lista')}>
          Da lista
        </Button>
        <Button size="sm" variant={mode === 'novo' ? 'primary' : 'ghost'} onClick={() => setMode('novo')}>
          Criar item
        </Button>
      </div>
      {mode === 'lista' ? (
        <div className="flex flex-wrap items-end gap-1">
          <Select
            className="w-full py-1 text-xs"
            value={pick}
            aria-label="Item da lista"
            onChange={(e) => {
              setPick(e.target.value)
              setQty(all.find((x) => x.name === e.target.value)?.qty ?? (e.target.value && coins.some((m) => m.name === e.target.value) ? 10 : 1))
            }}
          >
            <option value="">Escolha…</option>
            <optgroup label="Moedas">
              {coins.map((m) => (
                <option key={m.name}>{m.name}</option>
              ))}
            </optgroup>
            <optgroup label="Itens">
              {CATALOG.map((m) => (
                <option key={m.name}>{m.name}</option>
              ))}
            </optgroup>
          </Select>
          <span className="w-20">
            <NumberInput title="Quantidade" value={qty} onChange={(v) => setQty(Math.max(1, v))} />
          </span>
          <Button size="sm" variant="primary" className="flex-1" disabled={!chosen} onClick={() => chosen && onAdd(fromCatalog(chosen, systemId, qty))}>
            <Plus size={12} /> Adicionar
          </Button>
        </div>
      ) : (
        <div className="space-y-1">
          <Input className="py-1 text-xs" placeholder="Nome do item" value={custom.name} onChange={(e) => setCustom({ ...custom, name: e.target.value })} aria-label="Nome do novo item" />
          <div className="grid grid-cols-3 gap-1">
            <Select className="py-1 text-xs" value={custom.kind} aria-label="Tipo do novo item" onChange={(e) => setCustom({ ...custom, kind: e.target.value as ItemKind, ...(e.target.value === 'moeda' ? { stackable: true, weight: 0 } : {}) })}>
              {Object.entries(KIND_LABEL).map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </Select>
            <label className="flex items-center gap-1 text-parch-300">
              Qtd.
              <NumberInput value={custom.qty} onChange={(v) => setCustom({ ...custom, qty: Math.max(1, v) })} />
            </label>
            <label className="flex items-center gap-1 text-parch-300">
              {unit}
              <input
                type="number"
                min={0}
                step={0.05}
                aria-label="Peso por unidade"
                disabled={custom.kind === 'moeda'}
                className="w-full rounded-md border border-ink-700 bg-ink-900 px-1 py-1"
                value={custom.kind === 'moeda' ? 0 : custom.weight}
                onChange={(e) => setCustom({ ...custom, weight: Math.max(0, Number(e.target.value) || 0) })}
              />
            </label>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1 text-parch-300">
              <input type="checkbox" checked={custom.kind === 'moeda' || custom.stackable} disabled={custom.kind === 'moeda'} onChange={(e) => setCustom({ ...custom, stackable: e.target.checked })} /> Empilhável
            </label>
            <Button
              size="sm"
              variant="primary"
              className="ml-auto"
              disabled={!custom.name.trim()}
              onClick={() => {
                onAdd({ id: '', notes: '', ...custom, name: custom.name.trim() })
                setCustom({ ...custom, name: '' })
              }}
            >
              <Plus size={12} /> Criar
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
