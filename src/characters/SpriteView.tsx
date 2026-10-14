import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import type { SpriteConfig } from '../types'
import { useAssetUrl } from '../lib/images'
import { cn } from '../components/ui'

export type SpriteAnimName = keyof SpriteConfig['animations']

/** Sprite animado em DOM (ficha, listas, modo teatro). */
export function SpriteAnimator({
  sprite,
  anim = 'idle',
  scale = 4,
  onEnd,
  className,
  style,
}: {
  sprite: SpriteConfig
  anim?: SpriteAnimName
  scale?: number
  onEnd?: () => void
  className?: string
  style?: CSSProperties
}) {
  const url = useAssetUrl(sprite.url)
  const [frame, setFrame] = useState(0)
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null)
  const a = sprite.animations[anim] ?? sprite.animations.idle ?? { row: 0, frames: 1, fps: 1 }
  const endRef = useRef(onEnd)
  endRef.current = onEnd

  useEffect(() => {
    if (!url) return
    const img = new Image()
    img.onload = () => setDims({ w: img.width, h: img.height })
    img.src = url
  }, [url])

  useEffect(() => {
    setFrame(0)
    let f = 0
    const loop = anim === 'idle' || anim === 'walk'
    const id = setInterval(() => {
      f++
      if (f >= a.frames) {
        if (loop) f = 0
        else {
          f = a.frames - 1
          clearInterval(id)
          endRef.current?.()
        }
      }
      setFrame(f)
    }, 1000 / a.fps)
    return () => clearInterval(id)
  }, [anim, a.frames, a.fps])

  if (!url || !dims) return <div className={className} style={{ width: sprite.frameW * scale, height: sprite.frameH * scale, ...style }} />
  return (
    <div
      className={cn('pixelated', className)}
      style={{
        width: sprite.frameW * scale,
        height: sprite.frameH * scale,
        backgroundImage: `url(${url})`,
        backgroundSize: `${dims.w * scale}px ${dims.h * scale}px`,
        backgroundPosition: `-${frame * sprite.frameW * scale}px -${a.row * sprite.frameH * scale}px`,
        backgroundRepeat: 'no-repeat',
        imageRendering: 'pixelated',
        ...style,
      }}
    />
  )
}

/** Cartão com inclinação 3D e brilho que segue o ponteiro. */
export function TiltCard({ children, color, className }: { children: ReactNode; color: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [t, setT] = useState({ rx: 0, ry: 0, gx: 50, gy: 50, on: false })
  const move = (e: ReactPointerEvent) => {
    const r = ref.current!.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width
    const y = (e.clientY - r.top) / r.height
    setT({ rx: (0.5 - y) * 18, ry: (x - 0.5) * 22, gx: x * 100, gy: y * 100, on: true })
  }
  return (
    <div style={{ perspective: 900 }} className={className}>
      <div
        ref={ref}
        onPointerMove={move}
        onPointerLeave={() => setT({ rx: 0, ry: 0, gx: 50, gy: 50, on: false })}
        className="relative overflow-hidden rounded-2xl border-2 shadow-2xl transition-transform duration-150 ease-out"
        style={{
          transform: `rotateX(${t.rx}deg) rotateY(${t.ry}deg)`,
          transformStyle: 'preserve-3d',
          borderColor: color,
          background: `radial-gradient(120% 90% at 50% 20%, ${color}55, #14111c 70%)`,
          boxShadow: `0 20px 50px -10px ${color}66`,
        }}
      >
        {children}
        <div
          className="pointer-events-none absolute inset-0 mix-blend-overlay transition-opacity"
          style={{
            opacity: t.on ? 1 : 0,
            background: `radial-gradient(circle at ${t.gx}% ${t.gy}%, rgba(255,255,255,0.55), transparent 45%), linear-gradient(${115 + t.ry * 2}deg, transparent 30%, rgba(180,140,255,0.35) 45%, rgba(255,220,140,0.35) 55%, transparent 70%)`,
          }}
        />
      </div>
    </div>
  )
}

export function Portrait({ url, sprite, name, color, size = 48, className }: { url: string | null; sprite: SpriteConfig | null; name: string; color: string; size?: number; className?: string }) {
  const resolved = useAssetUrl(url)
  if (resolved) return <img src={resolved} alt={name} className={cn('rounded-full object-cover pixelated', className)} style={{ width: size, height: size }} />
  if (sprite) return <SpriteAnimator sprite={sprite} scale={size / sprite.frameW} className={className} />
  return (
    <div className={cn('grid place-items-center rounded-full font-bold text-white', className)} style={{ width: size, height: size, background: color }}>
      {name[0]}
    </div>
  )
}
