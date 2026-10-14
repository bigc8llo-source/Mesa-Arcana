import { clsx } from 'clsx'
import { X } from 'lucide-react'
import { createPortal } from 'react-dom'
import { useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'

export function cn(...a: Parameters<typeof clsx>) {
  return clsx(...a)
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'gold'
export function Button({ variant = 'secondary', size = 'md', className, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <button
      {...p}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition select-none disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-arcane-400',
        size === 'sm' && 'px-2.5 py-1 text-xs',
        size === 'md' && 'px-3.5 py-2 text-sm',
        size === 'lg' && 'px-5 py-3 text-base',
        variant === 'primary' && 'bg-arcane-600 hover:bg-arcane-500 text-white shadow-lg shadow-arcane-600/25',
        variant === 'gold' && 'bg-gold-500 hover:bg-gold-400 text-ink-950 shadow-lg shadow-gold-500/20',
        variant === 'secondary' && 'bg-ink-700 hover:bg-ink-600 text-parch-100 border border-ink-600',
        variant === 'ghost' && 'hover:bg-ink-700/70 text-parch-200',
        variant === 'danger' && 'bg-red-700 hover:bg-red-600 text-white',
        className,
      )}
    />
  )
}

export function IconButton({ active, label, className, children, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean; label: string }) {
  return (
    <button
      {...p}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        'grid place-items-center size-10 rounded-lg transition text-parch-200 focus-visible:outline-2 focus-visible:outline-arcane-400',
        active ? 'bg-arcane-600 text-white shadow-md shadow-arcane-600/30' : 'hover:bg-ink-700',
        className,
      )}
    >
      {children}
    </button>
  )
}

export function Input({ className, ...p }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...p}
      className={cn(
        'w-full rounded-lg bg-ink-850 border border-ink-600 px-3 py-2 text-sm text-parch-100 placeholder:text-ink-500 focus:outline-none focus:border-arcane-400 focus:ring-2 focus:ring-arcane-400/20',
        className,
      )}
    />
  )
}

export function NumberInput({ value, onChange, className, ...p }: Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> & { value: number; onChange: (v: number) => void }) {
  return (
    <input
      type="number"
      {...p}
      value={Number.isFinite(value) ? value : 0}
      onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
      className={cn(
        'w-full rounded-md bg-ink-850 border border-ink-600 px-2 py-1 text-sm text-center text-parch-100 focus:outline-none focus:border-arcane-400 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none',
        className,
      )}
    />
  )
}

export function Textarea({ className, ...p }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...p}
      className={cn(
        'w-full rounded-lg bg-ink-850 border border-ink-600 px-3 py-2 text-sm text-parch-100 placeholder:text-ink-500 focus:outline-none focus:border-arcane-400 resize-y',
        className,
      )}
    />
  )
}

export function Select({ className, children, ...p }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...p}
      className={cn('w-full rounded-lg bg-ink-850 border border-ink-600 px-3 py-2 text-sm text-parch-100 focus:outline-none focus:border-arcane-400', className)}
    >
      {children}
    </select>
  )
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-semibold uppercase tracking-wide text-parch-300">{label}</span>
      {children}
      {hint && <span className="block text-xs text-ink-500">{hint}</span>}
    </label>
  )
}

export function Modal({ open, onClose, title, children, wide, className }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; wide?: boolean; className?: string }) {
  useEffect(() => {
    if (!open) return
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [open, onClose])
  if (!open) return null
  // portal: elementos com backdrop-filter "prendem" filhos position:fixed
  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm p-3" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal className={cn('panel animate-pop rounded-2xl shadow-2xl w-full max-h-[92vh] flex flex-col', wide ? 'max-w-5xl' : 'max-w-lg', className)}>
        {title !== undefined && (
          <div className="flex items-center justify-between gap-3 border-b border-ink-700 px-5 py-3">
            <h2 className="font-display text-lg text-gold-400">{title}</h2>
            <button onClick={onClose} className="rounded-md p-1 hover:bg-ink-700" aria-label="Fechar">
              <X size={18} />
            </button>
          </div>
        )}
        <div className="overflow-y-auto p-5">{children}</div>
      </div>
    </div>,
    document.body,
  )
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string; icon?: ReactNode; badge?: number }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div role="tablist" className="flex border-b border-ink-700">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          title={t.label}
          className={cn(
            'relative flex min-w-0 flex-1 flex-col items-center gap-0.5 px-1 py-2 text-[10px] font-semibold uppercase tracking-wide transition',
            value === t.id ? 'text-gold-400' : 'text-parch-300 hover:text-parch-100',
          )}
        >
          {t.icon}
          <span className="max-w-full truncate">{t.label}</span>
          {!!t.badge && <span className="absolute right-1 top-1 rounded-full bg-arcane-600 px-1.5 text-[10px] text-white">{t.badge}</span>}
          {value === t.id && <span className="absolute inset-x-1 -bottom-px h-0.5 rounded bg-gold-400" />}
        </button>
      ))}
    </div>
  )
}

export function Spinner({ className }: { className?: string }) {
  return <span className={cn('inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent', className)} />
}

export function Empty({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-10 text-center text-parch-300">
      {icon && <div className="text-ink-500">{icon}</div>}
      <p className="font-semibold text-parch-200">{title}</p>
      {children && <div className="text-sm">{children}</div>}
    </div>
  )
}

export function HpBar({ hp, max, temp = 0, className }: { hp: number; max: number; temp?: number; className?: string }) {
  const pct = max > 0 ? Math.max(0, Math.min(1, hp / max)) : 0
  const color = pct > 0.5 ? 'bg-emerald-500' : pct > 0.25 ? 'bg-amber-500' : 'bg-red-600'
  return (
    <div className={cn('relative h-2 overflow-hidden rounded-full bg-ink-700', className)}>
      <div className={cn('h-full transition-all duration-500', color)} style={{ width: `${pct * 100}%` }} />
      {temp > 0 && <div className="absolute inset-y-0 right-0 bg-sky-400/70" style={{ width: `${Math.min(1, temp / Math.max(1, max)) * 100}%` }} />}
    </div>
  )
}
