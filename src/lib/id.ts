export function uid(): string {
  return crypto.randomUUID()
}

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export function inviteCode(len = 6): string {
  const buf = new Uint8Array(len)
  crypto.getRandomValues(buf)
  return Array.from(buf, (b) => CODE_CHARS[b % CODE_CHARS.length]).join('')
}

export const PLAYER_COLORS = ['#e11d48', '#2563eb', '#16a34a', '#d97706', '#9333ea', '#0891b2', '#db2777', '#65a30d']

export function nowIso() {
  return new Date().toISOString()
}
