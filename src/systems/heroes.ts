import type { SpriteRecipe } from '../engine/sprites'
import type { T20Attr } from './tormenta20'

/**
 * Raças e classes prontas: cada escolha define parte do visual do personagem
 * (a raça define corpo/pele/cabelo; a classe define roupa, arma, capa e chapéu).
 */

export interface RaceDef {
  id: string
  label: string
  blurb: string
  /** Modificadores sugeridos (Tormenta20). "livre" = o jogador escolhe +1 em N atributos. */
  bonus: Partial<Record<T20Attr, number>>
  free?: number
  look: Pick<SpriteRecipe, 'body' | 'skin' | 'hair'> & Partial<Pick<SpriteRecipe, 'hairStyle' | 'beard'>>
  darkvision?: number
}

export interface ClassDef {
  id: string
  label: string
  blurb: string
  role: string
  /** atributos mais importantes (para a sugestão automática de pontos) */
  key: T20Attr[]
  look: Pick<SpriteRecipe, 'outfit' | 'accent' | 'weapon' | 'hat' | 'shield'> & Partial<Pick<SpriteRecipe, 'cape' | 'armor'>>
  /** perícias sugeridas */
  skills: string[]
  attack: { name: string; skill: 'luta' | 'pontaria'; damage: string; crit: string }
  /** quantos poderes/magias escolhe na criação */
  picks: number
  powers: { name: string; cost: number; notation: string; description: string }[]
}

// Valores seguem a lógica de Tormenta20 (atributos com bônus raciais). Confira no seu livro:
// a Mesa Arcana não reproduz texto das regras, só números para agilizar a criação.
export const RACES: RaceDef[] = [
  { id: 'humano', label: 'Humano', blurb: 'Versátil e ambicioso.', bonus: {}, free: 3, look: { body: 'human', skin: '#e0ac69', hair: '#4a2f1b', hairStyle: 'short' } },
  { id: 'anao', label: 'Anão', blurb: 'Robusto e teimoso, enxerga no escuro.', bonus: { con: 2, sab: 1, des: -1 }, look: { body: 'dwarf', skin: '#e0ac69', hair: '#b45309', beard: true }, darkvision: 12 },
  { id: 'elfo', label: 'Elfo', blurb: 'Gracioso e ligado à magia.', bonus: { int: 2, des: 1, con: -1 }, look: { body: 'elf', skin: '#fde3c4', hair: '#fef08a', hairStyle: 'long' }, darkvision: 12 },
  { id: 'goblin', label: 'Goblin', blurb: 'Pequeno, engenhoso e rápido.', bonus: { des: 2, int: 1, car: -1 }, look: { body: 'goblin', skin: '#65a30d', hair: '#1c1917', hairStyle: 'mohawk' }, darkvision: 12 },
  { id: 'minotauro', label: 'Minotauro', blurb: 'Força bruta com chifres.', bonus: { for: 2, con: 1, sab: -1 }, look: { body: 'minotaur', skin: '#7c4a2a', hair: '#3f2a1a' } },
  { id: 'dahllan', label: 'Dahllan', blurb: 'Parte planta, amiga da natureza.', bonus: { sab: 2, des: 1, int: -1 }, look: { body: 'elf', skin: '#86b06a', hair: '#3f6212', hairStyle: 'braids' } },
  { id: 'lefou', label: 'Lefou', blurb: 'Tocado pela Tormenta.', bonus: { car: -1 }, free: 3, look: { body: 'human', skin: '#d6a3a3', hair: '#7f1d1d', hairStyle: 'mohawk' } },
  { id: 'qareen', label: 'Qareen', blurb: 'Descendente de gênios.', bonus: { car: 2, int: 1, sab: -1 }, look: { body: 'human', skin: '#7dd3fc', hair: '#e0f2fe', hairStyle: 'long' } },
  { id: 'golem', label: 'Golem', blurb: 'Construto desperto.', bonus: { for: 2, con: 1, car: -1 }, look: { body: 'golem', skin: '#78716c', hair: '#57534e' } },
  { id: 'hynne', label: 'Hynne', blurb: 'Pequeno, sortudo e ágil.', bonus: { des: 2, car: 1, for: -1 }, look: { body: 'halfling', skin: '#f1c27d', hair: '#92400e', hairStyle: 'short' } },
  { id: 'kliren', label: 'Kliren', blurb: 'Inventivo e curioso.', bonus: { int: 2, car: 1, for: -1 }, look: { body: 'halfling', skin: '#fcd5b5', hair: '#f97316', hairStyle: 'mohawk' } },
  { id: 'medusa', label: 'Medusa', blurb: 'Olhar que petrifica.', bonus: { des: 2, car: 1 }, look: { body: 'human', skin: '#a3c48a', hair: '#166534', hairStyle: 'braids' } },
  { id: 'trog', label: 'Trog', blurb: 'Reptiliano resistente.', bonus: { con: 2, for: 1, int: -1 }, look: { body: 'lizard', skin: '#4d7c0f', hair: '#365314' }, darkvision: 12 },
  { id: 'osteon', label: 'Osteon', blurb: 'Morto-vivo consciente.', bonus: { con: -1 }, free: 3, look: { body: 'skeleton', skin: '#e7e5e4', hair: '#e7e5e4' }, darkvision: 12 },
]

export const CLASSES: ClassDef[] = [
  {
    id: 'Guerreiro', label: 'Guerreiro', blurb: 'Mestre das armas e da linha de frente.', role: 'Combate corpo a corpo', key: ['for', 'con', 'des'],
    look: { outfit: '#64748b', accent: '#dc2626', weapon: 'sword', hat: 'helmet', shield: true, armor: 'plate', cape: '#991b1b' },
    skills: ['luta', 'fortitude', 'atletismo', 'intimidacao'], attack: { name: 'Espada longa', skill: 'luta', damage: '1d8', crit: '19/x2' }, picks: 1,
    powers: [
      { name: 'Ataque Especial', cost: 1, notation: '', description: '+4 no ataque ou +1d8 no dano de um ataque.' },
      { name: 'Golpe Pessoal', cost: 2, notation: '1d8', description: 'Golpe característico com dano extra.' },
      { name: 'Investida Brutal', cost: 1, notation: '1d6', description: 'Avança e ataca com força.' },
    ],
  },
  {
    id: 'Arcanista', label: 'Arcanista', blurb: 'Estudioso da magia arcana.', role: 'Magias de dano e controle', key: ['int', 'con', 'des'],
    look: { outfit: '#4c1d95', accent: '#fde047', weapon: 'staff', hat: 'wizard', shield: false, armor: 'robe', cape: '#312e81' },
    skills: ['misticismo', 'vontade', 'conhecimento'], attack: { name: 'Bordão', skill: 'luta', damage: '1d6', crit: '20/x2' }, picks: 3,
    powers: [
      { name: 'Seta Infalível', cost: 1, notation: '2d4+2', description: 'Projéteis mágicos que não erram.' },
      { name: 'Explosão de Chamas', cost: 1, notation: '2d6', description: 'Cone de fogo; Reflexos reduz.' },
      { name: 'Raio Congelante', cost: 1, notation: '2d6', description: 'Dano de frio e lentidão.' },
      { name: 'Escudo Arcano', cost: 1, notation: '', description: '+5 na Defesa até o próximo turno.' },
      { name: 'Sono', cost: 1, notation: '', description: 'Faz criaturas adormecerem (Vontade evita).' },
    ],
  },
  {
    id: 'Clérigo', label: 'Clérigo', blurb: 'Servo de uma divindade.', role: 'Cura e suporte', key: ['sab', 'con', 'car'],
    look: { outfit: '#f8fafc', accent: '#eab308', weapon: 'mace', hat: 'none', shield: true, armor: 'plate', cape: '#ca8a04' },
    skills: ['religiao', 'vontade', 'cura'], attack: { name: 'Maça', skill: 'luta', damage: '1d8', crit: '20/x2' }, picks: 3,
    powers: [
      { name: 'Curar Ferimentos', cost: 1, notation: '2d8+2', description: 'Recupera PV pelo toque.' },
      { name: 'Bênção', cost: 1, notation: '', description: 'Aliados recebem +1 em ataques.' },
      { name: 'Luz Sagrada', cost: 1, notation: '2d6', description: 'Dano de luz contra mortos-vivos.' },
      { name: 'Escudo da Fé', cost: 1, notation: '', description: '+2 na Defesa de um aliado.' },
    ],
  },
  {
    id: 'Ladino', label: 'Ladino', blurb: 'Furtivo, esperto e certeiro.', role: 'Perícias e ataque furtivo', key: ['des', 'int', 'car'],
    look: { outfit: '#1f2937', accent: '#10b981', weapon: 'dagger', hat: 'hood', shield: false, armor: 'leather', cape: '#111827' },
    skills: ['ladinagem', 'furtividade', 'reflexos', 'enganacao', 'acrobacia'], attack: { name: 'Adaga', skill: 'luta', damage: '1d4', crit: '19/x2' }, picks: 1,
    powers: [
      { name: 'Ataque Furtivo', cost: 0, notation: '1d6', description: 'Dano extra contra alvo desprevenido.' },
      { name: 'Evasão', cost: 0, notation: '', description: 'Passou em Reflexos: não sofre dano.' },
    ],
  },
  {
    id: 'Bárbaro', label: 'Bárbaro', blurb: 'Fúria selvagem.', role: 'Muito PV e dano', key: ['for', 'con', 'des'],
    look: { outfit: '#7c2d12', accent: '#e5e7eb', weapon: 'axe', hat: 'horns', shield: false, armor: 'leather', cape: null },
    skills: ['luta', 'fortitude', 'atletismo', 'sobrevivencia'], attack: { name: 'Machado grande', skill: 'luta', damage: '1d12', crit: '20/x3' }, picks: 1,
    powers: [
      { name: 'Fúria', cost: 2, notation: '', description: '+2 em ataque e dano corpo a corpo.' },
      { name: 'Golpe Selvagem', cost: 1, notation: '1d8', description: 'Ataque brutal com dano extra.' },
    ],
  },
  {
    id: 'Bardo', label: 'Bardo', blurb: 'Artista inspirador.', role: 'Suporte e magia', key: ['car', 'des', 'int'],
    look: { outfit: '#be185d', accent: '#fde047', weapon: 'dagger', hat: 'none', shield: false, armor: 'cloth', cape: '#831843' },
    skills: ['atuacao', 'diplomacia', 'enganacao', 'reflexos'], attack: { name: 'Florete', skill: 'luta', damage: '1d6', crit: '18/x2' }, picks: 2,
    powers: [
      { name: 'Inspiração', cost: 1, notation: '', description: 'Aliados ganham +1 em testes.' },
      { name: 'Enfeitiçar', cost: 1, notation: '', description: 'Torna uma pessoa amistosa.' },
      { name: 'Som Trovejante', cost: 1, notation: '2d6', description: 'Dano sônico em área.' },
    ],
  },
  {
    id: 'Caçador', label: 'Caçador', blurb: 'Rastreador e atirador.', role: 'Ataque à distância', key: ['des', 'sab', 'con'],
    look: { outfit: '#166534', accent: '#a3e635', weapon: 'bow', hat: 'hood', shield: false, armor: 'leather', cape: '#14532d' },
    skills: ['pontaria', 'sobrevivencia', 'percepcao', 'furtividade'], attack: { name: 'Arco longo', skill: 'pontaria', damage: '1d8', crit: '20/x3' }, picks: 1,
    powers: [
      { name: 'Marca da Presa', cost: 1, notation: '1d4', description: 'Dano extra contra a presa marcada.' },
      { name: 'Tiro Certeiro', cost: 1, notation: '', description: '+2 no ataque à distância.' },
    ],
  },
  {
    id: 'Paladino', label: 'Paladino', blurb: 'Guerreiro sagrado.', role: 'Tanque com cura', key: ['for', 'car', 'con'],
    look: { outfit: '#e2e8f0', accent: '#3b82f6', weapon: 'sword', hat: 'helmet', shield: true, armor: 'plate', cape: '#1d4ed8' },
    skills: ['luta', 'vontade', 'religiao', 'cura'], attack: { name: 'Espada bastarda', skill: 'luta', damage: '1d10', crit: '19/x2' }, picks: 2,
    powers: [
      { name: 'Golpe Divino', cost: 2, notation: '1d8', description: 'Dano extra e bônus no ataque.' },
      { name: 'Cura pelas Mãos', cost: 1, notation: '1d8+1', description: 'Recupera PV pelo toque.' },
      { name: 'Aura Sagrada', cost: 1, notation: '', description: 'Aliados próximos ganham +1 em resistências.' },
    ],
  },
  {
    id: 'Druida', label: 'Druida', blurb: 'Guardião da natureza.', role: 'Magia natural', key: ['sab', 'con', 'des'],
    look: { outfit: '#365314', accent: '#facc15', weapon: 'staff', hat: 'hood', shield: false, armor: 'robe', cape: '#3f6212' },
    skills: ['sobrevivencia', 'vontade', 'adestramento'], attack: { name: 'Cajado', skill: 'luta', damage: '1d6', crit: '20/x2' }, picks: 2,
    powers: [
      { name: 'Controlar Plantas', cost: 1, notation: '', description: 'Raízes prendem os inimigos.' },
      { name: 'Curar Ferimentos', cost: 1, notation: '2d8+2', description: 'Recupera PV.' },
      { name: 'Relâmpago', cost: 1, notation: '2d8', description: 'Raio da tempestade.' },
    ],
  },
  {
    id: 'Lutador', label: 'Lutador', blurb: 'Briguento de mãos nuas.', role: 'Muitos ataques', key: ['for', 'des', 'con'],
    look: { outfit: '#b91c1c', accent: '#fbbf24', weapon: 'none', hat: 'none', shield: false, armor: 'cloth', cape: null },
    skills: ['luta', 'fortitude', 'atletismo', 'acrobacia'], attack: { name: 'Soco', skill: 'luta', damage: '1d6', crit: '20/x2' }, picks: 1,
    powers: [
      { name: 'Golpe Relâmpago', cost: 1, notation: '1d6', description: 'Um ataque extra.' },
      { name: 'Agarrão', cost: 1, notation: '', description: 'Agarra e imobiliza o alvo.' },
    ],
  },
  {
    id: 'Bucaneiro', label: 'Bucaneiro', blurb: 'Espadachim audaz.', role: 'Esgrima e carisma', key: ['des', 'car', 'con'],
    look: { outfit: '#0e7490', accent: '#fbbf24', weapon: 'sword', hat: 'none', shield: false, armor: 'leather', cape: '#164e63' },
    skills: ['luta', 'reflexos', 'acrobacia', 'enganacao'], attack: { name: 'Sabre', skill: 'luta', damage: '1d6', crit: '18/x2' }, picks: 1,
    powers: [
      { name: 'Audácia', cost: 2, notation: '', description: '+Carisma em um teste.' },
      { name: 'Esgrima', cost: 1, notation: '1d4', description: 'Dano extra com arma leve.' },
    ],
  },
  {
    id: 'Cavaleiro', label: 'Cavaleiro', blurb: 'Defensor honrado.', role: 'Proteger aliados', key: ['for', 'con', 'car'],
    look: { outfit: '#475569', accent: '#facc15', weapon: 'sword', hat: 'helmet', shield: true, armor: 'plate', cape: '#7c2d12' },
    skills: ['luta', 'fortitude', 'cavalgar', 'diplomacia'], attack: { name: 'Espada longa', skill: 'luta', damage: '1d8', crit: '19/x2' }, picks: 1,
    powers: [
      { name: 'Baluarte', cost: 1, notation: '', description: '+2 na Defesa e resistências.' },
      { name: 'Desafio', cost: 1, notation: '', description: 'Força um inimigo a atacar você.' },
    ],
  },
  {
    id: 'Nobre', label: 'Nobre', blurb: 'Líder nato.', role: 'Social e suporte', key: ['car', 'int', 'sab'],
    look: { outfit: '#991b1b', accent: '#fbbf24', weapon: 'sword', hat: 'crown', shield: false, armor: 'cloth', cape: '#7f1d1d' },
    skills: ['diplomacia', 'nobreza', 'intuicao', 'vontade'], attack: { name: 'Espada curta', skill: 'luta', damage: '1d6', crit: '19/x2' }, picks: 1,
    powers: [
      { name: 'Palavras Afiadas', cost: 1, notation: '2d6', description: 'Dano psíquico com ofensas.' },
      { name: 'Comandar', cost: 1, notation: '', description: 'Aliado faz uma ação extra de movimento.' },
    ],
  },
  {
    id: 'Inventor', label: 'Inventor', blurb: 'Gênio das engenhocas.', role: 'Itens e explosivos', key: ['int', 'des', 'con'],
    look: { outfit: '#78350f', accent: '#fbbf24', weapon: 'mace', hat: 'none', shield: false, armor: 'leather', cape: null },
    skills: ['oficio', 'conhecimento', 'pilotagem'], attack: { name: 'Martelo', skill: 'luta', damage: '1d6', crit: '20/x2' }, picks: 2,
    powers: [
      { name: 'Bomba', cost: 1, notation: '2d6', description: 'Explosivo arremessado em área.' },
      { name: 'Engenhoca', cost: 1, notation: '', description: 'Aparelho que resolve um problema.' },
      { name: 'Poção', cost: 1, notation: '1d8+1', description: 'Prepara uma poção de cura.' },
    ],
  },
]

export const CLASS_BY_ID = Object.fromEntries(CLASSES.map((c) => [c.id, c]))
export const RACE_BY_ID = Object.fromEntries(RACES.map((r) => [r.id, r]))

/** Visual combinado de raça + classe. */
export function heroLook(raceId: string, classId: string): SpriteRecipe {
  const r = RACE_BY_ID[raceId] ?? RACES[0]
  const c = CLASS_BY_ID[classId] ?? CLASSES[0]
  return { ...r.look, ...c.look, hat: r.look.body === 'minotaur' && c.look.hat === 'helmet' ? 'none' : c.look.hat } as SpriteRecipe
}

/** Compra de pontos: todos começam em 10; custo por valor. */
export const POINT_BUY_TOTAL = 20
export const POINT_COST: Record<number, number> = { 8: -2, 9: -1, 10: 0, 11: 1, 12: 2, 13: 3, 14: 4, 15: 6, 16: 8, 17: 11, 18: 14 }
export function pointsSpent(base: Record<T20Attr, number>) {
  return Object.values(base).reduce((s, v) => s + (POINT_COST[v] ?? 0), 0)
}

// ------------------------------------------------------------ origens, divindades e equipamento

export interface OriginDef {
  id: string
  label: string
  skills: string[]
  item: string
  look?: Partial<Pick<SpriteRecipe, 'accent' | 'cape' | 'hairStyle'>>
}
export const ORIGINS: OriginDef[] = [
  { id: 'acolito', label: 'Acólito', skills: ['religiao', 'vontade'], item: 'Símbolo sagrado', look: { accent: '#eab308' } },
  { id: 'amigo_animais', label: 'Amigo dos Animais', skills: ['adestramento', 'cavalgar'], item: 'Animal de estimação', look: { accent: '#65a30d' } },
  { id: 'aristocrata', label: 'Aristocrata', skills: ['diplomacia', 'nobreza'], item: 'Joia de família', look: { accent: '#fbbf24', cape: '#6d28d9' } },
  { id: 'artesao', label: 'Artesão', skills: ['oficio', 'vontade'], item: 'Ferramentas de ofício', look: { accent: '#a16207' } },
  { id: 'artista', label: 'Artista', skills: ['atuacao', 'enganacao'], item: 'Instrumento musical', look: { accent: '#ec4899' } },
  { id: 'batedor', label: 'Batedor', skills: ['furtividade', 'percepcao'], item: 'Capa camuflada', look: { cape: '#3f6212' } },
  { id: 'capanga', label: 'Capanga', skills: ['luta', 'intimidacao'], item: 'Tatuagem de gangue', look: { accent: '#7f1d1d', hairStyle: 'bald' } },
  { id: 'charlatao', label: 'Charlatão', skills: ['enganacao', 'jogatina'], item: 'Baralho marcado', look: { accent: '#a855f7' } },
  { id: 'circense', label: 'Circense', skills: ['acrobacia', 'atuacao'], item: 'Bolas de malabarismo', look: { accent: '#f97316' } },
  { id: 'criminoso', label: 'Criminoso', skills: ['enganacao', 'furtividade'], item: 'Gazua', look: { cape: '#111827' } },
  { id: 'curandeiro', label: 'Curandeiro', skills: ['cura', 'vontade'], item: 'Maleta de medicamentos', look: { accent: '#22c55e' } },
  { id: 'eremita', label: 'Eremita', skills: ['misticismo', 'religiao'], item: 'Diário de reflexões', look: { hairStyle: 'long' } },
  { id: 'estudioso', label: 'Estudioso', skills: ['conhecimento', 'guerra'], item: 'Livro raro', look: { accent: '#3b82f6' } },
  { id: 'fazendeiro', label: 'Fazendeiro', skills: ['adestramento', 'sobrevivencia'], item: 'Carroça', look: { accent: '#ca8a04' } },
  { id: 'forasteiro', label: 'Forasteiro', skills: ['cavalgar', 'sobrevivencia'], item: 'Mapa de terras distantes', look: { cape: '#92400e' } },
  { id: 'gladiador', label: 'Gladiador', skills: ['atuacao', 'luta'], item: 'Arma de arena', look: { accent: '#dc2626' } },
  { id: 'guarda', label: 'Guarda', skills: ['investigacao', 'luta'], item: 'Distintivo', look: { accent: '#1d4ed8' } },
  { id: 'herdeiro', label: 'Herdeiro', skills: ['misticismo', 'nobreza'], item: 'Herança misteriosa', look: { cape: '#4c1d95' } },
  { id: 'heroi_campones', label: 'Herói Camponês', skills: ['adestramento', 'oficio'], item: 'Ferramenta de trabalho', look: { accent: '#84cc16' } },
  { id: 'marujo', label: 'Marujo', skills: ['atletismo', 'jogatina'], item: 'Cordas e ganchos', look: { accent: '#0e7490', cape: '#0c4a6e' } },
  { id: 'mateiro', label: 'Mateiro', skills: ['atletismo', 'sobrevivencia'], item: 'Armadilhas', look: { cape: '#365314' } },
  { id: 'mercador', label: 'Mercador', skills: ['diplomacia', 'intuicao'], item: 'Balança e mercadorias', look: { accent: '#fbbf24' } },
  { id: 'minerador', label: 'Minerador', skills: ['atletismo', 'fortitude'], item: 'Picareta', look: { accent: '#78716c' } },
  { id: 'nomade', label: 'Nômade', skills: ['cavalgar', 'sobrevivencia'], item: 'Tenda', look: { cape: '#b45309' } },
  { id: 'pivete', label: 'Pivete', skills: ['furtividade', 'ladinagem'], item: 'Esconderijo na cidade', look: { hairStyle: 'mohawk' } },
  { id: 'refugiado', label: 'Refugiado', skills: ['fortitude', 'reflexos'], item: 'Lembrança da terra natal', look: { cape: '#57534e' } },
  { id: 'selvagem', label: 'Selvagem', skills: ['percepcao', 'sobrevivencia'], item: 'Troféu de caça', look: { hairStyle: 'braids' } },
  { id: 'soldado', label: 'Soldado', skills: ['fortitude', 'guerra'], item: 'Insígnia militar', look: { accent: '#b91c1c' } },
  { id: 'taverneiro', label: 'Taverneiro', skills: ['diplomacia', 'jogatina'], item: 'Caneca favorita', look: { accent: '#a16207' } },
]

export interface DeityDef {
  id: string
  label: string
  domain: string
  color: string
}
export const DEITIES: DeityDef[] = [
  { id: 'nenhuma', label: 'Nenhuma', domain: 'Sem devoção', color: '' },
  { id: 'aharadak', label: 'Aharadak', domain: 'Tormenta', color: '#b91c1c' },
  { id: 'allihanna', label: 'Allihanna', domain: 'Natureza', color: '#15803d' },
  { id: 'arsenal', label: 'Arsenal', domain: 'Guerra', color: '#57534e' },
  { id: 'azgher', label: 'Azgher', domain: 'Sol', color: '#f59e0b' },
  { id: 'hyninn', label: 'Hyninn', domain: 'Trapaça', color: '#7c3aed' },
  { id: 'kallyadranoch', label: 'Kallyadranoch', domain: 'Dragões', color: '#991b1b' },
  { id: 'khalmyr', label: 'Khalmyr', domain: 'Justiça', color: '#1d4ed8' },
  { id: 'lena', label: 'Lena', domain: 'Vida e cura', color: '#f8fafc' },
  { id: 'linwu', label: 'Lin-Wu', domain: 'Honra', color: '#dc2626' },
  { id: 'marah', label: 'Marah', domain: 'Paz e amor', color: '#f9a8d4' },
  { id: 'megalokk', label: 'Megalokk', domain: 'Monstros', color: '#3f6212' },
  { id: 'nimb', label: 'Nimb', domain: 'Sorte e caos', color: '#eab308' },
  { id: 'oceano', label: 'Oceano', domain: 'Mares', color: '#0e7490' },
  { id: 'sszzaas', label: 'Sszzaas', domain: 'Traição', color: '#4d7c0f' },
  { id: 'tannatoh', label: 'Tanna-Toh', domain: 'Conhecimento', color: '#2563eb' },
  { id: 'tenebra', label: 'Tenebra', domain: 'Noite', color: '#1e1b4b' },
  { id: 'thwor', label: 'Thwor', domain: 'Goblinoides', color: '#78350f' },
  { id: 'thyatis', label: 'Thyatis', domain: 'Ressurreição', color: '#ea580c' },
  { id: 'valkaria', label: 'Valkaria', domain: 'Ambição', color: '#a855f7' },
  { id: 'wynna', label: 'Wynna', domain: 'Magia', color: '#c026d3' },
]

export const WEAPONS: { id: string; label: string; weapon: SpriteRecipe['weapon']; skill: 'luta' | 'pontaria'; damage: string; crit: string }[] = [
  { id: 'espada_longa', label: 'Espada longa', weapon: 'sword', skill: 'luta', damage: '1d8', crit: '19/x2' },
  { id: 'espada_curta', label: 'Espada curta', weapon: 'sword', skill: 'luta', damage: '1d6', crit: '19/x2' },
  { id: 'machado', label: 'Machado de batalha', weapon: 'axe', skill: 'luta', damage: '1d8', crit: '20/x3' },
  { id: 'machado_grande', label: 'Machado grande', weapon: 'axe', skill: 'luta', damage: '1d12', crit: '20/x3' },
  { id: 'maca', label: 'Maça', weapon: 'mace', skill: 'luta', damage: '1d8', crit: '20/x2' },
  { id: 'adaga', label: 'Adaga', weapon: 'dagger', skill: 'luta', damage: '1d4', crit: '19/x2' },
  { id: 'arco_curto', label: 'Arco curto', weapon: 'bow', skill: 'pontaria', damage: '1d6', crit: '20/x3' },
  { id: 'arco_longo', label: 'Arco longo', weapon: 'bow', skill: 'pontaria', damage: '1d8', crit: '20/x3' },
  { id: 'bordao', label: 'Bordão / cajado', weapon: 'staff', skill: 'luta', damage: '1d6', crit: '20/x2' },
  { id: 'desarmado', label: 'Desarmado', weapon: 'none', skill: 'luta', damage: '1d3', crit: '20/x2' },
]
export const ARMORS: { id: string; label: string; armor: SpriteRecipe['armor']; defense: number; penalty: number }[] = [
  { id: 'nenhuma', label: 'Roupas comuns', armor: 'cloth', defense: 0, penalty: 0 },
  { id: 'manto', label: 'Manto de conjurador', armor: 'robe', defense: 0, penalty: 0 },
  { id: 'couro', label: 'Armadura de couro', armor: 'leather', defense: 2, penalty: 0 },
  { id: 'brunea', label: 'Brunea', armor: 'plate', defense: 5, penalty: 2 },
  { id: 'completa', label: 'Armadura completa', armor: 'plate', defense: 10, penalty: 5 },
]
export const SKIN_TONES = ['#fde3c4', '#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#5c3a21', '#86b06a', '#7dd3fc', '#a3a3a3', '#d6a3a3']
export const HAIR_COLORS = ['#111827', '#4a2f1b', '#92400e', '#b45309', '#f97316', '#fef08a', '#e5e7eb', '#7f1d1d', '#1e40af', '#166534']
export const HAIR_STYLES: { id: NonNullable<SpriteRecipe['hairStyle']>; label: string }[] = [
  { id: 'short', label: 'Curto' },
  { id: 'long', label: 'Longo' },
  { id: 'braids', label: 'Tranças' },
  { id: 'mohawk', label: 'Moicano' },
  { id: 'bald', label: 'Careca' },
]

export interface HeroChoices {
  origin?: string
  deity?: string
  weapon?: string
  armor?: string
  shield?: boolean
  skin?: string
  hair?: string
  hairStyle?: SpriteRecipe['hairStyle']
  beard?: boolean
  outfit?: string
}

/** Visual final: raça → classe → origem → divindade → equipamento → detalhes físicos. */
export function composeLook(raceId: string, classId: string, ch: HeroChoices): SpriteRecipe {
  const base = heroLook(raceId, classId)
  const o = ORIGINS.find((x) => x.id === ch.origin)
  const d = DEITIES.find((x) => x.id === ch.deity)
  const w = WEAPONS.find((x) => x.id === ch.weapon)
  const a = ARMORS.find((x) => x.id === ch.armor)
  return {
    ...base,
    ...(o?.look ?? {}),
    ...(d && d.color ? { cape: d.color } : {}),
    ...(w ? { weapon: w.weapon } : {}),
    ...(a ? { armor: a.armor } : {}),
    ...(ch.shield !== undefined ? { shield: ch.shield && w?.weapon !== 'bow' && w?.weapon !== 'staff' } : {}),
    ...(ch.skin ? { skin: ch.skin } : {}),
    ...(ch.hair ? { hair: ch.hair } : {}),
    ...(ch.hairStyle ? { hairStyle: ch.hairStyle } : {}),
    ...(ch.beard !== undefined ? { beard: ch.beard } : {}),
    ...(ch.outfit ? { outfit: ch.outfit } : {}),
  }
}

/** Equipamento inicial sugerido pela classe. */
export function defaultGear(classId: string): Pick<HeroChoices, 'weapon' | 'armor' | 'shield'> {
  const c = CLASS_BY_ID[classId] ?? CLASSES[0]
  const weapon = WEAPONS.find((w) => w.label.toLowerCase() === c.attack.name.toLowerCase())?.id ?? WEAPONS.find((w) => w.weapon === c.look.weapon)?.id ?? 'espada_longa'
  const armor = c.look.armor === 'plate' ? 'brunea' : c.look.armor === 'leather' ? 'couro' : c.look.armor === 'robe' ? 'manto' : 'nenhuma'
  return { weapon, armor, shield: c.look.shield }
}
