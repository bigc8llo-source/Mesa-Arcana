import { useEffect, useMemo, useState } from 'react'
import { Upload } from 'lucide-react'
import type { SpriteConfig } from '../types'
import { DEFAULT_RECIPE, generateSpriteSheet, lpcConfig, RECIPE_PRESETS, spriteConfigFor, customSheetConfig, type SpriteRecipe } from '../engine/sprites'
import { Button, Field, NumberInput, Select, cn } from '../components/ui'
import { SpriteAnimator } from './SpriteView'
import { pickFile } from '../lib/images'

const ANIMS = ['idle', 'walk', 'attack', 'cast', 'hurt', 'death'] as const
export const ANIM_LABELS: Record<(typeof ANIMS)[number], string> = { idle: 'Parado', walk: 'Andando', attack: 'Ataque', cast: 'Magia', hurt: 'Ferido', death: 'Queda' }

export type SpriteChoice =
  | { mode: 'recipe'; recipe: SpriteRecipe }
  | { mode: 'upload'; file: File; config: Omit<SpriteConfig, 'url'> }
  | { mode: 'portrait'; file: File }

/** Prévia de um sprite procedural sem precisar enviar nada ao servidor. */
export function useRecipePreview(recipe: SpriteRecipe): SpriteConfig {
  return useMemo(() => {
    const c = generateSpriteSheet(recipe)
    return spriteConfigFor(c.toDataURL('image/png'))
  }, [recipe])
}

function AnimPreview({ sprite }: { sprite: SpriteConfig }) {
  const [anim, setAnim] = useState<(typeof ANIMS)[number]>('idle')
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="grid size-40 place-items-center rounded-xl bg-[radial-gradient(circle,#3d3452,#14111c)]">
        <SpriteAnimator key={anim} sprite={sprite} anim={anim} scale={128 / sprite.frameW} onEnd={() => setAnim('idle')} />
      </div>
      <div className="flex flex-wrap justify-center gap-1">
        {ANIMS.filter((a) => sprite.animations[a]).map((a) => (
          <button key={a} onClick={() => setAnim(a)} className={cn('rounded px-1.5 py-0.5 text-[11px]', anim === a ? 'bg-arcane-600 text-white' : 'bg-ink-700 text-parch-200')}>
            {ANIM_LABELS[a]}
          </button>
        ))}
      </div>
    </div>
  )
}

export function SpriteEditor({ value, onChange }: { value: SpriteChoice; onChange: (v: SpriteChoice) => void }) {
  const [tab, setTab] = useState<'recipe' | 'upload' | 'portrait'>(value.mode)
  const recipe = value.mode === 'recipe' ? value.recipe : DEFAULT_RECIPE
  const preview = useRecipePreview(recipe)
  const [uploadUrl, setUploadUrl] = useState<string | null>(null)
  const [cfg, setCfg] = useState<{ preset: 'lpc' | 'custom'; frameW: number; frameH: number; rows: Record<string, { row: number; frames: number }> }>({
    preset: 'lpc',
    frameW: 32,
    frameH: 32,
    rows: { idle: { row: 0, frames: 4 }, walk: { row: 1, frames: 4 }, attack: { row: 2, frames: 4 } },
  })
  const upFile = value.mode === 'upload' || value.mode === 'portrait' ? value.file : null
  useEffect(() => {
    if (!upFile) return setUploadUrl(null)
    const u = URL.createObjectURL(upFile)
    setUploadUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [upFile])

  const setR = (p: Partial<SpriteRecipe>) => onChange({ mode: 'recipe', recipe: { ...recipe, ...p } })
  const uploadConfig = (c = cfg): Omit<SpriteConfig, 'url'> => {
    const full = c.preset === 'lpc' ? lpcConfig('') : customSheetConfig('', c.frameW, c.frameH, c.rows)
    const { url: _url, ...rest } = full
    void _url
    return rest
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-1 rounded-lg bg-ink-850 p-1">
        {(
          [
            ['recipe', 'Criar pixel art'],
            ['upload', 'Enviar sprite sheet'],
            ['portrait', 'Enviar retrato'],
          ] as const
        ).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} className={cn('flex-1 rounded-md px-2 py-1.5 text-xs font-semibold', tab === id ? 'bg-ink-600 text-gold-400' : 'text-parch-300')}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'recipe' && (
        <div className="grid gap-4 sm:grid-cols-[auto_1fr]">
          <AnimPreview sprite={preview} />
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1">
              {Object.entries(RECIPE_PRESETS).map(([k, p]) => (
                <button key={k} onClick={() => onChange({ mode: 'recipe', recipe: p.recipe })} className="rounded-md bg-ink-700 px-2 py-1 text-xs hover:bg-ink-600">
                  {p.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Corpo">
                <Select value={recipe.body} onChange={(e) => setR({ body: e.target.value as SpriteRecipe['body'] })}>
                  {['human', 'elf', 'dwarf', 'orc', 'goblin', 'skeleton', 'slime'].map((b) => (
                    <option key={b} value={b}>
                      {{ human: 'Humano', elf: 'Elfo', dwarf: 'Anão', orc: 'Orc', goblin: 'Goblin', skeleton: 'Esqueleto', slime: 'Gosma' }[b]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Arma">
                <Select value={recipe.weapon} onChange={(e) => setR({ weapon: e.target.value as SpriteRecipe['weapon'] })}>
                  {Object.entries({ sword: 'Espada', axe: 'Machado', mace: 'Maça', dagger: 'Adaga', staff: 'Cajado', bow: 'Arco', none: 'Nenhuma' }).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Cabeça">
                <Select value={recipe.hat} onChange={(e) => setR({ hat: e.target.value as SpriteRecipe['hat'] })}>
                  {Object.entries({ none: 'Cabelo', hood: 'Capuz', wizard: 'Chapéu de mago', helmet: 'Elmo', crown: 'Coroa', horns: 'Chifres' }).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </Select>
              </Field>
              <label className="flex items-end gap-2 pb-2 text-sm">
                <input type="checkbox" className="accent-arcane-500" checked={recipe.shield} onChange={(e) => setR({ shield: e.target.checked })} /> Escudo
              </label>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {(
                [
                  ['skin', 'Pele'],
                  ['hair', 'Cabelo'],
                  ['outfit', 'Roupa'],
                  ['accent', 'Detalhe'],
                ] as const
              ).map(([k, label]) => (
                <label key={k} className="flex flex-col items-center gap-1 text-[11px] text-parch-300">
                  <input type="color" value={recipe[k]} onChange={(e) => setR({ [k]: e.target.value })} className="h-9 w-full cursor-pointer rounded border border-ink-600 bg-transparent" />
                  {label}
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'upload' && (
        <div className="space-y-3">
          <p className="text-xs text-parch-300">
            Envie uma folha de sprites PNG. A predefinição <b>LPC</b> funciona com folhas do{' '}
            <a className="text-arcane-400 underline" href="https://liberatedpixelcup.github.io/Universal-LPC-Spritesheet-Character-Generator/" target="_blank" rel="noreferrer">
              gerador Universal LPC
            </a>{' '}
            (lembre de creditar os artistas — licença CC-BY-SA/GPL).
          </p>
          <Button
            onClick={async () => {
              const f = await pickFile('image/png,image/webp,image/gif')
              if (f) onChange({ mode: 'upload', file: f, config: uploadConfig() })
            }}
          >
            <Upload size={16} /> Escolher arquivo
          </Button>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Formato">
              <Select
                value={cfg.preset}
                onChange={(e) => {
                  const next = { ...cfg, preset: e.target.value as 'lpc' | 'custom' }
                  setCfg(next)
                  if (value.mode === 'upload') onChange({ ...value, config: uploadConfig(next) })
                }}
              >
                <option value="lpc">LPC (64×64)</option>
                <option value="custom">Personalizado</option>
              </Select>
            </Field>
            {cfg.preset === 'custom' && (
              <>
                <Field label="Largura do quadro">
                  <NumberInput
                    value={cfg.frameW}
                    onChange={(v) => {
                      const next = { ...cfg, frameW: v }
                      setCfg(next)
                      if (value.mode === 'upload') onChange({ ...value, config: uploadConfig(next) })
                    }}
                  />
                </Field>
                <Field label="Altura do quadro">
                  <NumberInput
                    value={cfg.frameH}
                    onChange={(v) => {
                      const next = { ...cfg, frameH: v }
                      setCfg(next)
                      if (value.mode === 'upload') onChange({ ...value, config: uploadConfig(next) })
                    }}
                  />
                </Field>
              </>
            )}
          </div>
          {cfg.preset === 'custom' && (
            <div className="grid grid-cols-3 gap-2">
              {(['idle', 'walk', 'attack'] as const).map((a) => (
                <div key={a} className="rounded-lg border border-ink-700 p-2 text-xs">
                  <p className="mb-1 font-semibold">{ANIM_LABELS[a]}</p>
                  <div className="flex gap-1">
                    <NumberInput
                      title="linha"
                      value={cfg.rows[a]?.row ?? 0}
                      onChange={(v) => {
                        const next = { ...cfg, rows: { ...cfg.rows, [a]: { ...(cfg.rows[a] ?? { frames: 1 }), row: v } } }
                        setCfg(next)
                        if (value.mode === 'upload') onChange({ ...value, config: uploadConfig(next) })
                      }}
                    />
                    <NumberInput
                      title="quadros"
                      value={cfg.rows[a]?.frames ?? 1}
                      onChange={(v) => {
                        const next = { ...cfg, rows: { ...cfg.rows, [a]: { ...(cfg.rows[a] ?? { row: 0 }), frames: v } } }
                        setCfg(next)
                        if (value.mode === 'upload') onChange({ ...value, config: uploadConfig(next) })
                      }}
                    />
                  </div>
                  <p className="mt-1 text-[10px] text-ink-500">linha · quadros</p>
                </div>
              ))}
            </div>
          )}
          {value.mode === 'upload' && uploadUrl && <AnimPreview sprite={{ ...value.config, url: uploadUrl }} />}
        </div>
      )}

      {tab === 'portrait' && (
        <div className="space-y-3">
          <p className="text-xs text-parch-300">Uma imagem comum (ilustração, foto, arte). Vira retrato da ficha e token redondo no mapa.</p>
          <Button
            onClick={async () => {
              const f = await pickFile('image/*')
              if (f) onChange({ mode: 'portrait', file: f })
            }}
          >
            <Upload size={16} /> Escolher imagem
          </Button>
          {value.mode === 'portrait' && uploadUrl && <img src={uploadUrl} className="mx-auto max-h-56 rounded-xl" alt="Prévia" />}
        </div>
      )}
    </div>
  )
}

