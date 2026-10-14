import type { Dnd5eSheet } from './index'
import { uid } from '../lib/id'

/** Pequeno compêndio de criaturas do SRD 5.2 (CC-BY-4.0, Wizards of the Coast). */
export interface MonsterEntry {
  key: string
  name: string
  cr: string
  sprite: string // chave de RECIPE_PRESETS
  size: number
  sheet: Partial<Dnd5eSheet>
}

const atk = (name: string, bonus: number, damage: string, type: string) => ({ id: uid(), name, bonus, damage, type })
const ab = (f: number, d: number, c: number, i: number, s: number, ca: number) => ({ for: f, des: d, con: c, int: i, sab: s, car: ca })

export const MONSTERS: MonsterEntry[] = [
  { key: 'goblin', name: 'Goblin', cr: '1/4', sprite: 'goblin', size: 1, sheet: { abilities: ab(8, 14, 10, 10, 8, 8), ac: 15, hp: 7, hp_max: 7, speed: 9, skills: { furtividade: 2 }, attacks: [atk('Cimitarra', 4, '1d6+2', 'cortante'), atk('Arco curto', 4, '1d6+2', 'perfurante')], features: 'Fuga Ágil: Desengajar ou Esconder como ação bônus.' } },
  { key: 'kobold', name: 'Kobold', cr: '1/8', sprite: 'goblin', size: 1, sheet: { abilities: ab(7, 15, 9, 8, 7, 8), ac: 12, hp: 5, hp_max: 5, speed: 9, attacks: [atk('Adaga', 4, '1d4+2', 'perfurante'), atk('Funda', 4, '1d4+2', 'concussão')], features: 'Táticas de Matilha. Sensibilidade à Luz Solar.' } },
  { key: 'esqueleto', name: 'Esqueleto', cr: '1/4', sprite: 'esqueleto', size: 1, sheet: { abilities: ab(10, 14, 15, 6, 8, 5), ac: 13, hp: 13, hp_max: 13, speed: 9, attacks: [atk('Espada curta', 4, '1d6+2', 'perfurante'), atk('Arco curto', 4, '1d6+2', 'perfurante')], features: 'Vulnerável a concussão. Imune a veneno.' } },
  { key: 'zumbi', name: 'Zumbi', cr: '1/4', sprite: 'esqueleto', size: 1, sheet: { abilities: ab(13, 6, 16, 3, 6, 5), ac: 8, hp: 22, hp_max: 22, speed: 6, attacks: [atk('Pancada', 3, '1d6+1', 'concussão')], features: 'Fortitude de Morto-Vivo.' } },
  { key: 'bandido', name: 'Bandido', cr: '1/8', sprite: 'ladino', size: 1, sheet: { abilities: ab(11, 12, 12, 10, 10, 10), ac: 12, hp: 11, hp_max: 11, speed: 9, attacks: [atk('Cimitarra', 3, '1d6+1', 'cortante'), atk('Besta leve', 3, '1d8+1', 'perfurante')] } },
  { key: 'lobo', name: 'Lobo', cr: '1/4', sprite: 'barbaro', size: 1, sheet: { abilities: ab(12, 15, 12, 3, 12, 6), ac: 13, hp: 11, hp_max: 11, speed: 12, skills: { percepcao: 1, furtividade: 1 }, attacks: [atk('Mordida', 4, '2d4+2', 'perfurante')], features: 'Táticas de Matilha. Mordida derruba (CD 11 For).' } },
  { key: 'orc', name: 'Orc', cr: '1/2', sprite: 'orc', size: 1, sheet: { abilities: ab(16, 12, 16, 7, 11, 10), ac: 13, hp: 15, hp_max: 15, speed: 9, attacks: [atk('Machado grande', 5, '1d12+3', 'cortante'), atk('Azagaia', 5, '1d6+3', 'perfurante')], features: 'Agressivo: ação bônus para mover até seu deslocamento em direção a um inimigo.' } },
  { key: 'gnoll', name: 'Gnoll', cr: '1/2', sprite: 'barbaro', size: 1, sheet: { abilities: ab(14, 12, 11, 6, 10, 7), ac: 15, hp: 22, hp_max: 22, speed: 9, attacks: [atk('Lança', 4, '1d6+2', 'perfurante'), atk('Mordida', 4, '1d4+2', 'perfurante')] } },
  { key: 'bugbear', name: 'Bugbear', cr: '1', sprite: 'barbaro', size: 1, sheet: { abilities: ab(15, 14, 13, 8, 11, 9), ac: 16, hp: 27, hp_max: 27, speed: 9, skills: { furtividade: 1 }, attacks: [atk('Maça estrela', 4, '2d8+2', 'perfurante')], features: 'Ataque Surpresa: +2d6 contra criaturas surpreendidas.' } },
  { key: 'aranha', name: 'Aranha Gigante', cr: '1', sprite: 'slime', size: 2, sheet: { abilities: ab(14, 16, 12, 2, 11, 4), ac: 14, hp: 26, hp_max: 26, speed: 9, attacks: [atk('Mordida', 5, '1d8+3', 'perfurante')], features: 'Escalada de Aranha. Teia (recarga 5–6).' } },
  { key: 'ogro', name: 'Ogro', cr: '2', sprite: 'orc', size: 2, sheet: { abilities: ab(19, 8, 16, 5, 7, 7), ac: 11, hp: 59, hp_max: 59, speed: 12, attacks: [atk('Clava grande', 6, '2d8+4', 'concussão'), atk('Azagaia', 6, '2d6+4', 'perfurante')] } },
  { key: 'urso-coruja', name: 'Urso-Coruja', cr: '3', sprite: 'barbaro', size: 2, sheet: { abilities: ab(20, 12, 17, 3, 12, 7), ac: 13, hp: 59, hp_max: 59, speed: 12, skills: { percepcao: 1 }, attacks: [atk('Bico', 7, '1d10+5', 'perfurante'), atk('Garras', 7, '2d8+5', 'cortante')], features: 'Ataques múltiplos: bico e garras.' } },
  { key: 'gosma', name: 'Gosma Ocre', cr: '2', sprite: 'slime', size: 2, sheet: { abilities: ab(15, 6, 14, 2, 6, 1), ac: 8, hp: 45, hp_max: 45, speed: 3, attacks: [atk('Pseudópode', 4, '2d6+2', 'concussão + 1d6 ácido')], features: 'Amorfo. Divide-se ao sofrer dano cortante ou elétrico.' } },
]
