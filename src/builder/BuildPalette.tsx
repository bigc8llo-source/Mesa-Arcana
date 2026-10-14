import { useState } from 'react'
import { Brush, Eraser, LayoutGrid, PaintBucket, Square, Sofa, Trash2 } from 'lucide-react'
import type { Scene } from '../types'
import { useToolOptions } from '../store/tools'
import { useGame } from '../store/game'
import { PROPS, TILES, thumb } from './tiles'
import { emptyBuild, sceneBuildPatch } from './build'
import { Button, cn, NumberInput } from '../components/ui'

const MODES = [
  { id: 'room', label: 'Sala', hint: 'Arraste: piso com paredes em volta', icon: <LayoutGrid size={16} /> },
  { id: 'brush', label: 'Pincel', hint: 'Pinte célula a célula', icon: <Brush size={16} /> },
  { id: 'rect', label: 'Retângulo', hint: 'Arraste para preencher uma área', icon: <Square size={16} /> },
  { id: 'fill', label: 'Balde', hint: 'Preenche a área contígua', icon: <PaintBucket size={16} /> },
  { id: 'prop', label: 'Objetos', hint: 'Clique para pôr · Ctrl+clique remove', icon: <Sofa size={16} /> },
  { id: 'erase', label: 'Borracha', hint: 'Apaga o piso', icon: <Eraser size={16} /> },
] as const

function Swatch({ src, label, active, onClick }: { src: string; label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" title={label} onClick={onClick} className={cn('flex flex-col items-center gap-0.5 rounded-md p-0.5', active ? 'bg-gold-500/25 ring-2 ring-gold-400' : 'hover:bg-ink-700')}>
      <img src={src} alt={label} className="pixelated size-9 rounded-sm" />
      <span className="line-clamp-2 w-12 text-center text-[9px] leading-tight text-parch-300">{label}</span>
    </button>
  )
}

export function BuildPalette({ scene }: { scene: Scene }) {
  const o = useToolOptions()
  const [cols, setCols] = useState(scene.build?.cols ?? Math.ceil(scene.map_w / scene.grid.size))
  const [rows, setRows] = useState(scene.build?.rows ?? Math.ceil(scene.map_h / scene.grid.size))
  const mode = MODES.find((m) => m.id === o.buildMode)!
  const floors = TILES.filter((t) => t.kind !== 'wall')
  const walls = TILES.filter((t) => t.kind === 'wall')
  const groups = [...new Set(PROPS.map((p) => p.group))]

  return (
    <div className="panel pointer-events-auto absolute bottom-3 left-16 top-3 z-20 flex w-64 flex-col overflow-hidden rounded-xl shadow-2xl" data-testid="build-palette" onPointerDown={(e) => e.stopPropagation()}>
      <div className="border-b border-ink-700 p-2">
        <p className="font-display text-sm text-gold-400">Construtor de mapas</p>
        <div className="mt-1.5 grid grid-cols-3 gap-1">
          {MODES.map((m) => (
            <button
              type="button"
              key={m.id}
              onClick={() => o.set({ buildMode: m.id })}
              className={cn('flex flex-col items-center gap-0.5 rounded-md px-1 py-1 text-[10px]', o.buildMode === m.id ? 'bg-arcane-600 text-white' : 'bg-ink-700 hover:bg-ink-600')}
            >
              {m.icon}
              {m.label}
            </button>
          ))}
        </div>
        <p className="mt-1 text-[10px] text-parch-300">{mode.hint}</p>
        {(o.buildMode === 'brush' || o.buildMode === 'erase') && (
          <label className="mt-1 flex items-center gap-2 text-xs">
            Pincel
            <input type="range" min={1} max={5} value={o.buildBrush} onChange={(e) => o.set({ buildBrush: Number(e.target.value) })} className="flex-1 accent-arcane-500" />
            {o.buildBrush}×{o.buildBrush}
          </label>
        )}
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-2">
        {o.buildMode === 'prop' ? (
          groups.map((g) => (
            <div key={g}>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-parch-300">{g}</p>
              <div className="grid grid-cols-4 gap-1">
                {PROPS.filter((p) => p.group === g).map((p) => (
                  <Swatch key={p.id} src={thumb('prop', p.id)} label={p.label + (p.light ? ' 💡' : '')} active={o.buildProp === p.id} onClick={() => o.set({ buildProp: p.id })} />
                ))}
              </div>
            </div>
          ))
        ) : o.buildMode === 'erase' ? (
          <p className="text-xs text-parch-300">Passe a borracha sobre o piso para apagar. Para tirar objetos, use o modo Objetos com Ctrl+clique.</p>
        ) : (
          <>
            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-parch-300">{o.buildMode === 'room' ? 'Piso da sala' : 'Pisos e líquidos'}</p>
              <div className="grid grid-cols-4 gap-1">
                {floors.map((t) => (
                  <Swatch key={t.id} src={thumb('tile', t.id)} label={t.label} active={o.buildTile === t.id} onClick={() => o.set({ buildTile: t.id })} />
                ))}
              </div>
            </div>
            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-parch-300">{o.buildMode === 'room' ? 'Parede da sala' : 'Paredes (bloqueiam visão)'}</p>
              <div className="grid grid-cols-4 gap-1">
                {walls.map((t) => (
                  <Swatch
                    key={t.id}
                    src={thumb('tile', t.id)}
                    label={t.label}
                    active={o.buildMode === 'room' ? o.buildWall === t.id : o.buildTile === t.id}
                    onClick={() => (o.buildMode === 'room' ? o.set({ buildWall: t.id }) : o.set({ buildTile: t.id }))}
                  />
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      <div className="space-y-1.5 border-t border-ink-700 p-2 text-xs">
        <p className="text-[10px] text-parch-300">Paredes, portas e objetos de luz viram automaticamente paredes, portas e luzes da visão dinâmica.</p>
        <div className="flex items-center gap-1">
          <span>Tamanho</span>
          <NumberInput className="!w-14 py-0.5" value={cols} onChange={(v) => setCols(Math.max(5, Math.min(120, v)))} />×
          <NumberInput className="!w-14 py-0.5" value={rows} onChange={(v) => setRows(Math.max(5, Math.min(120, v)))} />
          <Button
            type="button"
            size="sm"
            onClick={() => {
              const b = scene.build ?? emptyBuild(cols, rows)
              void useGame.getState().patch('scenes', scene.id, sceneBuildPatch(scene, { ...b, cols, rows }))
            }}
          >
            Aplicar
          </Button>
        </div>
        {scene.build && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="w-full text-red-300"
            onClick={() => {
              if (!confirm('Apagar tudo o que foi construído neste mapa?')) return
              const empty = emptyBuild(scene.build!.cols, scene.build!.rows)
              void useGame.getState().patch('scenes', scene.id, sceneBuildPatch(scene, empty))
            }}
          >
            <Trash2 size={12} /> Limpar construção
          </Button>
        )}
      </div>
    </div>
  )
}
