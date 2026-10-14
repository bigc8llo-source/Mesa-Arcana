import { useMemo, useState } from 'react'
import { Clapperboard, Copy, Eye, FileUp, Image, Map, Music, Pause, Play, Trash2, Users } from 'lucide-react'
import type { Scene, Weather } from '../types'
import { activeSceneId, useGame } from '../store/game'
import { Button, cn, Field, Input, NumberInput, Select } from '../components/ui'
import { defaultScene, systemMessage } from '../game/actions'
import { MAX_MAP_PX, pickFile, uploadImage } from '../lib/images'
import { importUvtt } from '../table/drop'
import { clearExploredFog } from '../table/Fog'
import { uid } from '../lib/id'
import { backend } from '../data'

const WEATHERS: { id: Weather; label: string }[] = [
  { id: 'none', label: 'Limpo' },
  { id: 'rain', label: '🌧 Chuva' },
  { id: 'snow', label: '❄ Neve' },
  { id: 'fog', label: '🌫 Neblina' },
  { id: 'embers', label: '🔥 Brasas' },
  { id: 'leaves', label: '🍂 Folhas' },
]

export function ScenesPanel() {
  const scenes = useGame((s) => s.scenes)
  const campaign = useGame((s) => s.campaign)!
  const viewing = useGame(activeSceneId)
  const list = useMemo(() => Object.values(scenes).sort((a, b) => a.sort - b.sort), [scenes])
  const current = viewing ? scenes[viewing] : null

  const activate = async (sc: Scene) => {
    const s = useGame.getState()
    await s.patch('campaigns', campaign.id, { active_scene_id: sc.id })
    s.set({ viewSceneId: null })
    s.send({ type: 'pull', sceneId: sc.id, x: sc.map_w / 2, y: sc.map_h / 2 })
    await systemMessage(`📜 Cena: ${sc.name}`)
  }
  const create = async (kind: Scene['kind']) => {
    const sc = defaultScene(campaign.id, kind === 'map' ? 'Novo mapa' : 'Novo cenário', kind)
    await useGame.getState().save('scenes', sc)
    useGame.getState().set({ viewSceneId: sc.id })
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex gap-1.5 border-b border-ink-700 p-2">
        <Button size="sm" variant="primary" onClick={() => create('map')}>
          <Map size={14} /> Mapa
        </Button>
        <Button size="sm" onClick={() => create('theater')}>
          <Clapperboard size={14} /> Cenário (teatro)
        </Button>
      </div>
      <div className="max-h-[40%] space-y-1 overflow-y-auto border-b border-ink-700 p-2">
        {list.map((sc) => {
          const live = campaign.active_scene_id === sc.id
          return (
            <div key={sc.id} className={cn('flex items-center gap-2 rounded-lg p-1.5', viewing === sc.id ? 'bg-ink-700' : 'hover:bg-ink-800')}>
              {sc.kind === 'map' ? <Map size={14} className="text-parch-300" /> : <Clapperboard size={14} className="text-parch-300" />}
              <button className="flex-1 truncate text-left text-sm" onClick={() => useGame.getState().set({ viewSceneId: sc.id })} title="Ver só para mim">
                {sc.name}
              </button>
              {live ? (
                <span className="flex items-center gap-1 rounded bg-emerald-800 px-1.5 text-[10px] font-bold text-white">
                  <Users size={10} /> AO VIVO
                </span>
              ) : (
                <Button size="sm" variant="ghost" onClick={() => activate(sc)} title="Levar todos os jogadores para esta cena">
                  <Eye size={12} /> Ativar
                </Button>
              )}
            </div>
          )
        })}
      </div>
      <div className="flex-1 overflow-y-auto p-3">{current && <SceneSettings key={current.id} scene={current} />}</div>
    </div>
  )
}

function SceneSettings({ scene }: { scene: Scene }) {
  const [busy, setBusy] = useState<string | null>(null)
  const patch = (p: Partial<Scene>) => useGame.getState().patch('scenes', scene.id, p)
  const g = scene.grid
  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key)
    try {
      await fn()
    } catch (e) {
      useGame.getState().set({ error: (e as Error).message })
    } finally {
      setBusy(null)
    }
  }
  return (
    <div className="space-y-4">
      <Field label="Nome da cena">
        <Input value={scene.name} onChange={(e) => patch({ name: e.target.value })} />
      </Field>

      {scene.kind === 'theater' ? (
        <Button
          size="sm"
          className="w-full"
          disabled={!!busy}
          onClick={() =>
            run('bg', async () => {
              const f = await pickFile('image/*')
              if (!f) return
              const { url } = await uploadImage(scene.campaign_id, 'scene', f, 2560)
              await patch({ background_url: url })
            })
          }
        >
          <Image size={14} /> {busy === 'bg' ? 'Enviando…' : 'Trocar ilustração de fundo'}
        </Button>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-1.5">
            <Button
              size="sm"
              disabled={!!busy}
              onClick={() =>
                run('map', async () => {
                  const f = await pickFile('image/*')
                  if (!f) return
                  const { url, width, height } = await uploadImage(scene.campaign_id, 'map', f, MAX_MAP_PX)
                  await patch({ map_url: url, map_w: width, map_h: height })
                })
              }
            >
              <Image size={14} /> {busy === 'map' ? 'Enviando…' : 'Imagem do mapa'}
            </Button>
            <Button
              size="sm"
              disabled={!!busy}
              title="Arquivo Universal VTT do Dungeondraft (traz paredes, portas e luzes)"
              onClick={() =>
                run('uvtt', async () => {
                  const f = await pickFile('.dd2vtt,.uvtt,.df2vtt,application/json')
                  if (f) await importUvtt(f, scene)
                })
              }
            >
              <FileUp size={14} /> {busy === 'uvtt' ? 'Importando…' : 'Importar .dd2vtt'}
            </Button>
          </div>

          <fieldset className="space-y-2 rounded-lg border border-ink-700 p-3">
            <legend className="px-1 text-xs font-bold uppercase tracking-wide text-parch-300">Grid</legend>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Tipo">
                <Select value={g.type} onChange={(e) => patch({ grid: { ...g, type: e.target.value as Scene['grid']['type'] } })}>
                  <option value="square">Quadrado</option>
                  <option value="hex">Hexagonal</option>
                  <option value="none">Sem grid</option>
                </Select>
              </Field>
              <Field label="Tamanho (px)">
                <NumberInput value={g.size} onChange={(v) => patch({ grid: { ...g, size: Math.max(10, v) } })} />
              </Field>
              <Field label="Deslocamento X">
                <NumberInput value={g.offsetX} onChange={(v) => patch({ grid: { ...g, offsetX: v } })} />
              </Field>
              <Field label="Deslocamento Y">
                <NumberInput value={g.offsetY} onChange={(v) => patch({ grid: { ...g, offsetY: v } })} />
              </Field>
              <Field label="Distância/célula">
                <NumberInput value={g.unitDistance} step={0.5} onChange={(v) => patch({ grid: { ...g, unitDistance: v } })} />
              </Field>
              <Field label="Unidade">
                <Input value={g.unitLabel} onChange={(e) => patch({ grid: { ...g, unitLabel: e.target.value } })} />
              </Field>
            </div>
            <div className="flex items-center gap-2">
              <input type="color" value={g.color} onChange={(e) => patch({ grid: { ...g, color: e.target.value } })} className="h-7 w-10 rounded border border-ink-600 bg-transparent" />
              <input type="range" min={0} max={1} step={0.05} value={g.opacity} onChange={(e) => patch({ grid: { ...g, opacity: Number(e.target.value) } })} className="flex-1 accent-arcane-500" title="Opacidade" />
            </div>
          </fieldset>

          <fieldset className="space-y-2 rounded-lg border border-ink-700 p-3">
            <legend className="px-1 text-xs font-bold uppercase tracking-wide text-parch-300">Névoa e luz</legend>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="accent-arcane-500" checked={scene.fog_enabled} onChange={(e) => patch({ fog_enabled: e.target.checked })} /> Névoa manual (ferramenta Névoa)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="accent-arcane-500" checked={scene.vision_enabled} onChange={(e) => patch({ vision_enabled: e.target.checked })} /> Visão dinâmica (paredes bloqueiam)
            </label>
            <Field label={`Luz ambiente: ${Math.round(scene.ambient * 100)}%`}>
              <input type="range" min={0} max={1} step={0.05} value={scene.ambient} onChange={(e) => patch({ ambient: Number(e.target.value) })} className="w-full accent-gold-500" />
            </Field>
            <div className="grid grid-cols-2 gap-1.5">
              <Button size="sm" onClick={() => patch({ fog: [{ id: uid(), mode: 'reveal', points: [0, 0, scene.map_w, 0, scene.map_w, scene.map_h, 0, scene.map_h] }] })}>
                Revelar tudo
              </Button>
              <Button size="sm" onClick={() => patch({ fog: [] })}>
                Cobrir tudo
              </Button>
              <Button size="sm" variant="ghost" className="col-span-2" onClick={() => clearExploredFog()}>
                Esquecer áreas exploradas (minha tela)
              </Button>
            </div>
            <p className="text-[11px] text-ink-500">
              {scene.walls.length} paredes · {scene.lights.length} luzes. Use as ferramentas Paredes (W) e Luz (L) na barra lateral.
            </p>
          </fieldset>
        </>
      )}

      <Field label="Clima / partículas">
        <div className="grid grid-cols-3 gap-1">
          {WEATHERS.map((w) => (
            <button key={w.id} onClick={() => patch({ weather: w.id })} className={cn('rounded-md px-1.5 py-1 text-xs', scene.weather === w.id ? 'bg-arcane-600 text-white' : 'bg-ink-700')}>
              {w.label}
            </button>
          ))}
        </div>
      </Field>

      <AudioControls scene={scene} />

      <div className="flex gap-1.5 pt-2">
        <Button
          size="sm"
          variant="ghost"
          onClick={async () => {
            const copy = { ...structuredClone(scene), id: uid(), name: `${scene.name} (cópia)`, sort: Date.now() }
            await useGame.getState().save('scenes', copy)
          }}
        >
          <Copy size={14} /> Duplicar
        </Button>
        <Button
          size="sm"
          variant="danger"
          className="ml-auto"
          onClick={async () => {
            if (!confirm(`Excluir a cena "${scene.name}" e seus tokens?`)) return
            const s = useGame.getState()
            if (s.campaign?.active_scene_id === scene.id) await s.patch('campaigns', scene.campaign_id, { active_scene_id: null })
            s.set({ viewSceneId: null })
            await s.removeRow('scenes', scene)
          }}
        >
          <Trash2 size={14} /> Excluir
        </Button>
      </div>
    </div>
  )
}

function AudioControls({ scene }: { scene: Scene }) {
  const a = scene.audio
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (p: Partial<Scene['audio']>) => useGame.getState().patch('scenes', scene.id, { audio: { ...a, ...p } })
  return (
    <fieldset className="space-y-2 rounded-lg border border-ink-700 p-3">
      <legend className="flex items-center gap-1 px-1 text-xs font-bold uppercase tracking-wide text-parch-300">
        <Music size={12} /> Trilha da cena
      </legend>
      {a.url ? (
        <div className="flex items-center gap-2">
          <Button size="sm" variant={a.playing ? 'secondary' : 'primary'} onClick={() => set({ playing: !a.playing, startedAt: Date.now() })}>
            {a.playing ? <Pause size={14} /> : <Play size={14} />}
          </Button>
          <span className="flex-1 truncate text-xs">{a.name || 'Faixa'}</span>
          <button className="text-ink-500 hover:text-red-400" onClick={() => set({ url: null, playing: false, name: '' })} aria-label="Remover faixa">
            <Trash2 size={14} />
          </button>
        </div>
      ) : (
        <p className="text-xs text-parch-300">Nenhuma faixa. Envie um MP3/OGG ou cole um link direto de áudio.</p>
      )}
      <div className="flex items-center gap-2">
        <input type="range" min={0} max={1} step={0.05} value={a.volume} onChange={(e) => set({ volume: Number(e.target.value) })} className="flex-1 accent-arcane-500" title="Volume para todos" />
        <label className="flex items-center gap-1 text-xs">
          <input type="checkbox" className="accent-arcane-500" checked={a.loop} onChange={(e) => set({ loop: e.target.checked })} /> repetir
        </label>
      </div>
      <div className="flex gap-1">
        <Input className="py-1 text-xs" placeholder="https://…/musica.mp3" value={url} onChange={(e) => setUrl(e.target.value)} />
        <Button size="sm" disabled={!url} onClick={() => set({ url, name: url.split('/').pop() ?? 'Faixa', playing: true, startedAt: Date.now() }).then(() => setUrl(''))}>
          Usar
        </Button>
      </div>
      <Button
        size="sm"
        className="w-full"
        disabled={busy}
        onClick={async () => {
          const f = await pickFile('audio/*')
          if (!f) return
          if (f.size > 15 * 1024 * 1024) return useGame.getState().set({ error: 'Áudio muito grande (máx. 15 MB). Prefira OGG/Opus ou MP3 de 128 kbps.' })
          setBusy(true)
          try {
            const up = await backend.uploadAsset(scene.campaign_id, 'audio', f, f.name.split('.').pop() ?? 'mp3')
            await set({ url: up, name: f.name, playing: true, startedAt: Date.now() })
          } finally {
            setBusy(false)
          }
        }}
      >
        <FileUp size={14} /> {busy ? 'Enviando…' : 'Enviar arquivo de áudio'}
      </Button>
    </fieldset>
  )
}
