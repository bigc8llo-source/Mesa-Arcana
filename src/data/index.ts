import type { Backend } from './backend'
import { LocalBackend } from './localBackend'
import { SupabaseBackend } from './supabaseBackend'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

export const supabaseConfigured = !!(url && key && /^https?:\/\//.test(url) && !url.includes('SEU-PROJETO'))

const FORCE_LOCAL_KEY = 'mesa-arcana:force-local'

export function isDemoForced() {
  return sessionStorage.getItem(FORCE_LOCAL_KEY) === '1'
}
export function setDemoForced(v: boolean) {
  if (v) sessionStorage.setItem(FORCE_LOCAL_KEY, '1')
  else sessionStorage.removeItem(FORCE_LOCAL_KEY)
}

export const backend: Backend = supabaseConfigured && !isDemoForced() ? new SupabaseBackend(url!, key!) : new LocalBackend()
