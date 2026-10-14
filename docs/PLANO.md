# Mesa Arcana — Plano de Desenvolvimento

Um webapp de mesa virtual (VTT) para jogar RPG com amigos: fichas com sprites animados,
mapas com grid, névoa de guerra, iluminação dinâmica, dados 3D com física, efeitos de magia,
cenários em "modo teatro", som ambiente e tudo sincronizado em tempo real via Supabase.

> Status: **planejamento**. Nenhum código foi escrito ainda. Este documento é a fonte de
> verdade das decisões; atualize-o quando uma decisão mudar.

---

## 1. Como uma mesa virtual funciona (resumo da pesquisa)

As mesas virtuais de referência resolvem o mesmo conjunto de problemas, com profundidades diferentes:

| Referência | Ponto forte | O que copiar | O que evitar |
|---|---|---|---|
| **Owlbear Rodeo** | Simplicidade: mapa + tokens + névoa, sem instalar nada | Fluxo de "entrar por link", arrastar imagem e jogar em segundos | Ausência de fichas/automação |
| **Roll20** | Equilíbrio de recursos, fichas, iluminação dinâmica | Fichas clicáveis que rolam dados, camadas (mapa/tokens/GM) | Interface poluída e lenta |
| **Foundry VTT** | Profundidade: visão por paredes, luz, automação, módulos | Paredes + linha de visão + luz; sistema de "templates" de ficha | Curva de aprendizado alta, precisa hospedar servidor |

Os blocos que toda VTT tem, e que este plano cobre:

1. **Sessão compartilhada**: mestre (GM) e jogadores entram na mesma "campanha" e veem o mesmo estado.
2. **Mapa com grid**: imagem de fundo, grid quadrado/hexagonal, zoom/pan, régua de distância.
3. **Tokens**: peças no mapa ligadas a fichas, com barras de vida, condições e controle de quem pode mover.
4. **Névoa e visão**: o GM esconde partes do mapa; com paredes, cada token só vê o que está na linha de visão.
5. **Fichas**: atributos, perícias, inventário, magias; clicar em algo rola o dado correspondente.
6. **Dados + chat**: rolagens com notação (`1d20+5`, `4d6kh3`), histórico, rolagens secretas do GM.
7. **Combate**: ordem de iniciativa, turno atual, dano/cura, áreas de efeito.
8. **Mídia**: música/ambiente sincronizados, imagens para mostrar aos jogadores (handouts).

O diferencial da Mesa Arcana: **visual** (sprites animados, modo 2.5D, partículas, dados 3D)
e **intuição** (arrastar e soltar em tudo, menus contextuais, interface em português).

---

## 2. Decisões de arquitetura

### 2.1 Stack

| Camada | Escolha | Por quê |
|---|---|---|
| Build / app | **Vite + React 19 + TypeScript** (SPA) | Não precisamos de SSR; SPA hospeda grátis em qualquer CDN. |
| Rotas | React Router | Simples, maduro. |
| UI | **Tailwind CSS v4 + shadcn/ui (Radix)** + lucide-react | Componentes acessíveis, fácil de tematizar ("pergaminho escuro"). |
| Animações de UI | **Motion** (ex-Framer Motion) | Transições de painéis, cartas, números de dano. |
| Estado local | **Zustand** | Estado da mesa (câmera, seleção, ferramentas) fora do ciclo do React. |
| Dados do servidor | **TanStack Query** + supabase-js | Cache, refetch ao reconectar, updates otimistas. |
| Renderização da mesa | **three.js via @react-three/fiber + drei** | Um único motor para o mapa 2D, o modo 2.5D, partículas, luz e dados 3D. |
| Física dos dados | **@react-three/rapier** | Física WASM rápida; dados no mesmo ecossistema R3F. |
| Partículas / pós-processamento | **three.quarks** (partículas) + **@react-three/postprocessing** (bloom) | Bola de fogo, raios, curas com brilho. |
| Áudio | **Howler.js** | Loops de ambiente, crossfade, efeitos sonoros. |
| Validação | **zod** (+ react-hook-form nas fichas) | Mesma validação no cliente e nas Edge Functions. |
| Notação de dados | **@dice-roller/rpg-dice-roller** (parser) | Suporta `kh/kl`, explosões, rerolagem; não reinventar o parser. |
| Backend | **Supabase** (Postgres + Auth + Realtime + Storage + Edge Functions) | Conta separada do usuário; tudo versionado em `supabase/migrations`. |
| Testes | Vitest (lógica), Playwright (E2E com 2 navegadores), pgTAP (RLS) | Ver seção 9. |
| Hospedagem do front | Vercel, Netlify ou Cloudflare Pages (plano grátis) | Deploy automático por branch. |

**Por que three.js para o mapa em vez de PixiJS/Konva?** PixiJS é excelente para 2D puro e
Konva é ótimo para editores, mas o pedido inclui *efeitos 3D*. Com three.js usamos uma câmera
ortográfica de cima (fica idêntico a um mapa 2D) e, com o mesmo código, inclinamos a câmera para
um modo 2.5D com tokens "em pé" como miniaturas, sombras, partículas e luz por shader. Ter um só
motor evita sincronizar dois canvas. O custo é que texto e hit-testing são um pouco mais
trabalhosos — o R3F já resolve eventos de ponteiro por raycast, e textos de UI ficam em HTML por cima do canvas.

### 2.2 Visão geral

```
┌──────────────────────────── Navegador (cada jogador) ────────────────────────────┐
│  React UI (painéis, fichas, chat)   │   Canvas R3F (mapa, tokens, névoa, VFX)   │
│               │  Zustand (estado da mesa)  │  TanStack Query (cache do servidor)  │
│               └──────────── camada de sincronização (sync/) ─────────────┘       │
└───────────────────────┬──────────────────────────────┬───────────────────────────┘
       REST/PostgREST   │                              │ WebSocket (Realtime)
┌───────────────────────▼──────────────────────────────▼───────────────────────────┐
│ Supabase: Postgres (+RLS)  │  Realtime: Broadcast + Presence │ Storage │ Edge Fn │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### 2.3 Modelo de sincronização em tempo real

Duas classes de dados:

- **Persistentes** (tokens, fichas, cenas, paredes, chat, rolagens): gravados no Postgres.
  Quando uma linha muda, um trigger usa `realtime.broadcast_changes(...)` para avisar todos
  no canal da campanha. Preferimos isso a *Postgres Changes*, que a Supabase indica como menos
  escalável e que avalia RLS por assinante.
- **Efêmeros** (arrastar token antes de soltar, ping no mapa, cursor do GM, animação de dado,
  disparo de efeito visual): enviados por **Broadcast** cliente→clientes, nunca gravados.

Canais (todos **privados**, autorizados por RLS em `realtime.messages`):

| Tópico | Quem entra | Uso |
|---|---|---|
| `campaign:{id}` | membros | eventos de mesa, chat público, presença (quem está online) |
| `campaign:{id}:gm` | apenas GM | tokens ocultos, rolagens secretas, notas do GM |
| `campaign:{id}:user:{uid}` | o jogador e o GM | sussurros, handouts privados |

**Orçamento de mensagens (plano grátis).** Limites oficiais do Free: 200 conexões simultâneas,
**100 mensagens/s por projeto** (contando enviadas *e* entregues), 20 mensagens de Presence/s,
payload de broadcast até 256 KB. Com 6 pessoas na mesa, um arrasto a 10 Hz gera
10 envios + 50 entregas = 60 msg/s. Regras derivadas:

- Arrasto de token: throttle em **10 Hz**, só enquanto arrasta; os outros clientes interpolam
  suavemente entre as posições recebidas. Ao soltar, grava no banco (1 evento).
- Presence só para "quem está online / em qual cena"; **nunca** para cursores.
- Cursor do GM / ping: só sob demanda (segurar `Alt`), também a 10 Hz.
- Nada de imagens em mensagens: só IDs de assets do Storage.
- Agrupar eventos de ferramenta de névoa (pincel) em lotes de 100 ms.

**Conflitos:** last-write-wins por linha, com coluna `version` incrementada no update para
descartar eventos atrasados. Ações de GM prevalecem em itens ocultos (só ele os enxerga).
**Reconexão:** ao receber `SUBSCRIBED` novamente, o cliente refaz o snapshot da cena ativa.

### 2.4 Segredos e anti-trapaça

Entre amigos não precisamos de segurança paranoica, mas o básico evita spoilers:

- Tokens/paredes/notas marcados como ocultos **não chegam** ao jogador: RLS filtra no
  `select`, e eventos deles saem só no canal `:gm`.
- Rolagens: geradas com `crypto.getRandomValues` no cliente e gravadas com `user_id = auth.uid()`
  (RLS). Fase futura opcional: "modo justo" com a rolagem feita numa Edge Function.
- A animação 3D **não decide** o resultado: o resultado é sorteado primeiro e a física é simulada
  com uma semente; no fim, as texturas das faces são remapeadas para que a face de cima mostre o
  valor sorteado. Todos os clientes recebem `{seed, resultados}` e veem a mesma animação.

---

## 3. Modelo de dados (Supabase / Postgres)

Todas as tabelas com RLS ligada. Funções auxiliares `is_member(campaign_id)` e
`is_gm(campaign_id)` como `security definer stable` (evita recursão de RLS).

```
profiles            id (=auth.users.id), display_name, avatar_path, created_at
campaigns           id, name, description, cover_path, system_id, owner_id, active_scene_id, settings jsonb
campaign_members    campaign_id, user_id, role ('gm'|'player'), color, joined_at   PK(campaign_id,user_id)
campaign_invites    code (único, curto), campaign_id, created_by, expires_at, max_uses, uses

game_systems        id ('dnd5e-srd', 'generico', ...), name, sheet_schema jsonb, rules jsonb
characters          id, campaign_id, owner_id (null = NPC do GM), kind ('pc'|'npc'|'monster'),
                    name, data jsonb (ficha), portrait_path, token_path,
                    sprite jsonb (sheet_path, frame_w, frame_h, animations{idle,walk,attack,hurt,death}),
                    hidden bool, version int, updated_at

assets              id, campaign_id, kind ('map'|'token'|'portrait'|'sprite'|'audio'|'handout'|'scene_art'),
                    path, width, height, bytes, uploaded_by, created_at

scenes              id, campaign_id, name, kind ('map'|'theater'), sort,
                    map_asset_id, background_asset_id,
                    grid jsonb (type 'square'|'hex', size_px, offset, color, opacity, units, distance),
                    lighting jsonb (ambient 0..1, global_light bool),
                    weather jsonb (type, intensity), audio jsonb (playlist, volume),
                    fog_enabled bool, version int
walls               id, scene_id, points jsonb ([x1,y1,x2,y2]), kind ('wall'|'door'|'window'|'invisible'),
                    door_state ('closed'|'open'|'locked'), blocks_sight bool, blocks_move bool
lights              id, scene_id, x, y, bright_radius, dim_radius, color, animation ('none'|'torch'|'pulse'), hidden
tokens              id, scene_id, character_id (nullable), x, y, size (em células), rotation,
                    layer ('map'|'object'|'token'|'gm'), hidden, locked,
                    vision jsonb (enabled, range, darkvision), light jsonb,
                    bars jsonb (hp atual/max ou link à ficha), conditions text[], elevation,
                    owner_ids uuid[] (quem pode mover), version int, updated_at
fog_reveals         id, scene_id, polygon jsonb, mode ('reveal'|'hide'), created_by, created_at
explored            scene_id, user_id, mask_path (PNG reduzido no Storage), updated_at

encounters          id, scene_id, round, turn_index, active bool
combatants          id, encounter_id, token_id, initiative numeric, sort, defeated bool

chat_messages       id, campaign_id, author_id, kind ('text'|'roll'|'system'|'whisper'|'emote'),
                    content, roll_id, whisper_to uuid[], character_id, created_at
rolls               id, campaign_id, user_id, character_id, notation, label, result jsonb (dados, total),
                    seed bigint, visibility ('public'|'gm'|'self'), created_at
handouts            id, campaign_id, title, asset_id, body, shared_with uuid[] (vazio = todos)
journal_entries     id, campaign_id, title, body (markdown), gm_only bool, updated_at
audio_tracks        id, campaign_id, asset_id, name, loop bool, category ('music'|'ambient'|'sfx')
```

**Storage (buckets privados):** `campaign-assets/{campaign_id}/{kind}/{uuid}.webp` com policies
por membro da campanha; `avatars/{user_id}/...`. Leitura via URL assinada com cache longo.

**Orçamento do plano grátis:** banco 500 MB (sobra), **Storage 1 GB** (o gargalo), egress ~5 GB/mês.
Por isso todo upload é comprimido no navegador para **WebP**, mapas limitados a **4096 px** no
maior lado (também é o limite seguro de textura WebGL em celulares), tokens a 512 px, áudio em
Opus/OGG. Projetos Free são **pausados após 7 dias sem atividade** — com sessões semanais isso
raramente acontece, mas o painel mostra como reativar; o plano Pro remove isso.

---

## 4. Funcionalidades em detalhe

### 4.1 Contas, campanhas e convites
- Login por **link mágico** (e-mail) e **Discord OAuth** (grupos de RPG vivem no Discord);
  opcional: login anônimo para convidados que só querem testar.
- Criar campanha → escolher sistema → recebe código/link de convite (`/c/ABC123`).
- Lobby da campanha: capa, jogadores online (Presence), personagens, botão grande "Entrar na mesa".
- Papéis: GM (pode haver mais de um) e jogador.

### 4.2 Fichas de personagem com sprites
- **Sistemas como dados**: cada sistema é um `sheet_schema` (JSON) que descreve seções, campos,
  fórmulas (`mod(for) = floor((for-10)/2)`) e ações roláveis. O renderizador da ficha é genérico.
  Primeiro sistema: **D&D 5e via SRD 5.2** (licença CC-BY-4.0, exige atribuição à Wizards of
  the Coast); segundo: **"Genérico"** (atributos livres) para qualquer outro jogo.
- **Tudo clicável rola**: clicar em "Furtividade +5" rola `1d20+5` com rótulo; botão direito
  oferece vantagem/desvantagem/secreto.
- **Cartão do personagem em 3D**: retrato em um cartão com inclinação por perspectiva seguindo
  o ponteiro (parallax em camadas: fundo, sprite, moldura), brilho "foil" opcional por shader.
- **Sprite animado**: o personagem fica em `idle` na ficha; ataca quando você rola ataque,
  pisca vermelho quando toma dano, cai quando chega a 0 PV. No mapa, anda enquanto é arrastado.
- **Pipeline de imagem**:
  1. Upload ou arrastar arquivo para a ficha.
  2. Recorte (react-easy-crop) → gera **retrato** e **token redondo** com anel na cor do jogador.
  3. Sprite sheet: informar largura/altura do quadro e quais linhas são cada animação,
     com **predefinição LPC** (o gerador Universal LPC exporta folhas 64×64 com animações padrão;
     a arte LPC é CC-BY-SA/GPL e exige créditos — salvamos o CREDITS junto ao asset).
  4. Compressão para WebP e upload.
- Barras (PV, PV temporário), condições com ícones, inventário com arrastar e soltar,
  magias com espaços, anotações. Botão "subir de nível" fica fora do MVP.

### 4.3 Mapa / mesa
- **Ferramentas** (barra lateral com atalho de teclado): Selecionar (V), Régua (R),
  Desenho/Área (A), Paredes (W, só GM), Névoa (F, só GM), Luz (L, só GM), Ping (segurar Alt).
- **Arrastar e soltar**: soltar uma imagem no canvas pergunta "usar como mapa / criar token";
  arrastar uma ficha da lista para o mapa cria o token dela.
- **Grid** quadrado ou hexagonal, ajuste visual (desenhar 1 célula sobre o mapa para calibrar
  tamanho e offset), snap ao grid, distância por célula (1,5 m / 5 ft), regra de diagonal.
- **Camadas**: mapa → objetos → tokens → GM (invisível a jogadores) → efeitos.
- **Tokens**: tamanho por categoria (Minúsculo..Colossal), barras, condições, menu radial no
  clique direito (dano/cura, condição, iniciativa, ocultar, trazer ficha), movimento mostra
  rastro e distância percorrida.
- **Áreas de efeito**: cone, círculo, linha, quadrado; destacam os tokens atingidos.
- **Importação Universal VTT** (`.dd2vtt` / `.uvtt`, exportados pelo Dungeondraft e similares):
  o arquivo traz imagem, tamanho do grid, paredes, portas e luzes → cena pronta com um arraste.
- **Várias cenas** por campanha; GM troca a cena ativa e pode "puxar" todos para ela;
  transição com fade.
- **Câmera**: pan (arrastar com botão do meio / dois dedos), zoom na roda/pinça,
  "focar no meu token", GM pode "centralizar todos aqui".

### 4.4 Névoa de guerra, visão e luz
- **Névoa manual** (sem paredes): o GM pinta/apaga áreas reveladas com pincel ou polígono.
- **Visão dinâmica** (com paredes): para cada token com visão calculamos o **polígono de
  visibilidade** por varredura angular dos segmentos de parede (O(n log n), mesma técnica do
  `visibility-polygon-js`, de domínio público), recortado pelo alcance de visão.
  Portas fechadas bloqueiam; janelas bloqueiam movimento mas não visão.
- **Luz**: cada fonte tem raio claro/penumbra e cor; a área iluminada é a união dos polígonos de
  visibilidade das luzes. O jogador enxerga `visão ∩ (iluminado ∪ visão no escuro)`.
  Animação de tocha (cintilar) por shader. Escuridão ambiente ajustável por cena.
- **Renderização**: polígonos desenhados em render targets (máscara "visível agora" e máscara
  "já explorado" acumulada); um shader final escurece/dessatura o explorado e esconde o resto.
  O GM vê a névoa semitransparente. Cálculo em Web Worker quando houver muitas paredes;
  recalcula apenas quando um token com visão ou uma porta muda.
- **Explorado** é salvo periodicamente como PNG reduzido por jogador/cena.

### 4.5 Dados 3D, chat e registro
- **Bandeja de dados** sempre visível: d4, d6, d8, d10, d100, d12, d20; clicar adiciona ao
  grupo, enter rola. Campo de texto aceita notação (`2d20kh1+7`, `8d6`, `4d6kh3`).
- **Animação 3D**: dados com física (Rapier) caem por cima da mesa em uma camada overlay,
  com cor/material do jogador (metal, cristal, osso); som de impacto. Resultado determinístico
  (seção 2.4). Opção "rolagem rápida" sem animação.
- **Chat** com rolagens embutidas (cartão mostrando cada dado, críticos destacados),
  sussurros (`/w nome`), emotes (`/me`), rolagens secretas do GM (`/gr`).
- **Log de rolagens** filtrável por personagem.

### 4.6 Combate
- **Rastreador de iniciativa**: "Rolar iniciativa para todos/selecionados", ordem arrastável,
  turno atual destacado no mapa (anel pulsante) e câmera centraliza no token da vez.
- Dano/cura rápido: selecionar tokens → digitar `-12` ou `+5`; número flutuante animado.
- Condições com duração em rodadas, avisadas no início do turno.
- Monstros/NPCs do **SRD 5.2** como compêndio pesquisável → arrastar para o mapa.

### 4.7 Efeitos e "cenários"
- **Modo teatro** (cena `kind = 'theater'`): ilustração de fundo em tela cheia, retratos/sprites
  dos personagens que estão na cena "em pé" na parte de baixo (estilo visual novel),
  falas do chat aparecem em balões. Ideal para tavernas, diálogos e narração.
- **Modo 2.5D**: botão inclina a câmera (até ~35°), tokens viram miniaturas em pé (billboards)
  com sombra, paredes ganham altura baixa. A interação continua no plano do chão.
- **Clima por cena**: chuva, neve, neblina, cinzas, folhas — partículas GPU com intensidade ajustável.
- **Magias/ataques**: biblioteca de efeitos (bola de fogo, raio, cura, escuridão, flecha, corte)
  disparados por ação da ficha ou área de efeito; tremor de câmera em críticos.
- **Som**: playlists por cena com crossfade, ambiente em loop, mesa de sons (soundboard) do GM;
  estado sincronizado (faixa + posição + volume) e volume local por jogador.
- **Handouts**: GM arrasta uma imagem/carta e "mostra" para todos ou para um jogador.

### 4.8 Intuitividade (princípios de UX)
- Interface 100% em português, termos de RPG já conhecidos.
- **Três telas**: Lobby → Mesa → (painéis laterais recolhíveis: Fichas, Chat/Dados, Combate, Cenas, Biblioteca).
- **Visão do jogador ≠ visão do GM**: jogador vê só o que usa; ferramentas de GM ficam ocultas.
- Arrastar e soltar em tudo; clique direito sempre abre um menu útil; `?` mostra atalhos.
- **Desfazer/Refazer** (Ctrl+Z) para o GM em edições de cena (padrão Command).
- **Tour de boas-vindas** e uma **campanha de exemplo** (mapa, 4 personagens prontos, 1 encontro)
  para jogar nos primeiros 5 minutos.
- **Celular**: jogador consegue ver o mapa, mover seu token, abrir a ficha e rolar dados.
  Edição de cena é pensada para desktop.
- Estados vazios explicativos, toasts para erros de conexão, indicador "reconectando…".
- Acessibilidade: foco por teclado nos painéis, contraste AA, `prefers-reduced-motion`
  desliga tremores/partículas pesadas.

---

## 5. Estrutura do repositório

```
mesa-arcana/
├─ docs/                      PLANO.md, decisões, guia de setup
├─ public/                    dados (texturas), sons padrão, tokens/mapa de exemplo (CC0)
├─ src/
│  ├─ app/                    rotas, layout, providers
│  ├─ components/ui/          shadcn/ui
│  ├─ features/
│  │  ├─ auth/  campaigns/  characters/  sheet-systems/
│  │  ├─ table/               canvas R3F: câmera, camadas, tokens, ferramentas
│  │  ├─ fog/                 visibilidade, luz, shaders de névoa
│  │  ├─ dice/                bandeja, física, animação
│  │  ├─ chat/  combat/  audio/  theater/  vfx/  handouts/
│  ├─ engine/                 TS puro e testável: grid, geometria, visibilidade, dados, protocolo de sync
│  ├─ sync/                   canais Realtime, throttle, interpolação, reconexão
│  ├─ lib/                    supabase client, upload/compressão, utilitários
│  └─ types/database.ts       gerado pelo `supabase gen types`
├─ supabase/
│  ├─ config.toml
│  ├─ migrations/             SQL versionado (schema, RLS, triggers, buckets)
│  ├─ functions/              Edge Functions (ex.: `roll` no modo justo, `import-uvtt`)
│  ├─ seed.sql                campanha de exemplo
│  └─ tests/                  testes pgTAP de RLS
├─ e2e/                       Playwright (GM + jogador em contextos separados)
└─ .github/workflows/ci.yml   lint, typecheck, testes, build
```

---

## 6. Supabase em outra conta (como conectar)

O banco ficará em **uma conta Supabase sua, separada**. Nada é criado automaticamente nela; o
schema vive no repositório e você aplica:

1. Criar o projeto no painel da outra conta (região mais próxima, ex.: São Paulo `sa-east-1`).
2. `npx supabase login` (com a conta certa) → `npx supabase link --project-ref <ref>`.
3. `npx supabase db push` aplica `supabase/migrations/*`. (Alternativa sem CLI: colar os SQLs
   na ordem no SQL Editor.)
4. Em Authentication: habilitar e-mail (link mágico) e Discord; configurar URLs de redirect
   (`http://localhost:5173`, domínio de produção).
5. Copiar **Project URL** e **Publishable key** para `.env.local`:
   ```
   VITE_SUPABASE_URL=https://<ref>.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   ```
   A chave secreta/service role **nunca** vai para o front nem para o repositório.
6. Para desenvolver localmente sem tocar no projeto real: `npx supabase start` (Docker) sobe
   uma cópia local com as mesmas migrations.

---

## 7. Roadmap por fases

Cada fase termina com algo **jogável e testado**. MVP jogável = fim da Fase 5.

| Fase | Entrega | Inclui | Critério de pronto |
|---|---|---|---|
| **0. Fundação** | Projeto rodando | Vite/React/TS, Tailwind+shadcn, ESLint/Prettier, Vitest, CI, cliente Supabase, deploy de preview, migrations iniciais | Build e CI verdes; página de login conecta no Supabase |
| **1. Contas e campanhas** | Lobby funcional | Auth (link mágico + Discord), perfis, criar campanha, convites por link, papéis, Presence "online" | Dois navegadores entram na mesma campanha e se veem online |
| **2. Fichas + sprites** | Ficha bonita e clicável | Renderizador de ficha por schema, sistema Genérico + D&D 5e SRD, upload/recorte/token, sprite sheet com predefinição LPC, cartão 3D, rolagem simples (sem 3D ainda) | Criar personagem com sprite animado; clicar em perícia gera rolagem no chat |
| **3. Mesa base** | Mapa compartilhado | Canvas R3F, cenas, upload de mapa, calibração de grid, tokens, arrastar com sync (throttle+interpolação), camadas, ping, régua, zoom/pan, menu radial | GM e 4 jogadores movem tokens sem travar; reconexão restaura estado |
| **4. Dados 3D + chat** | Rolagens completas | Bandeja de dados, notação, física Rapier determinística, materiais por jogador, sussurros, rolagens secretas, log | Todos veem a mesma animação e o mesmo resultado |
| **5. Combate** ✅ *MVP* | Sessão de combate completa | Iniciativa, turnos, dano/cura, condições, áreas de efeito, compêndio de monstros SRD, campanha de exemplo | Jogar um encontro inteiro do começo ao fim sem sair do app |
| **6. Névoa e luz** | Exploração de masmorra | Névoa manual, paredes/portas, visibilidade, luzes, explorado, importação `.dd2vtt`, worker | Jogador só vê o que o token dele vê; portas abrem e revelam a sala |
| **7. Efeitos e cenários** | "Uau" visual | Modo teatro, modo 2.5D, clima, VFX de magias, números flutuantes, som/playlists/soundboard, handouts, transições | Sessão narrativa com cenário, música e magia sem ferramentas externas |
| **8. Polimento** | Pronto para o grupo | Celular/PWA, tour, atalhos, desfazer, acessibilidade, otimização (texturas, workers), testes E2E completos, guia de uso | Rodar uma sessão real de 3 h com o grupo e corrigir o feedback |

**Fora do escopo inicial** (podem virar fases futuras): voz/vídeo embutidos (usar Discord em
paralelo; futuramente LiveKit), automação completa de regras (ataque → dano automático em todos
os casos), editor de mapas próprio, marketplace/módulos de terceiros, "modo justo" de dados no servidor.

---

## 8. Riscos e mitigação

| Risco | Impacto | Mitigação |
|---|---|---|
| Limite de 100 msg/s do Realtime no plano grátis | Desconexões em mesas cheias | Throttle 10 Hz, efêmero só durante arrasto, lotes, sem cursores contínuos; medir no Inspector do Realtime |
| Storage de 1 GB | Não caber mapas/sons | WebP, limite 4096 px, áudio Opus, painel de uso de espaço por campanha, opção de URL externa para música |
| Projeto Free pausa após 7 dias | Mesa fora do ar no dia do jogo | Avisar no README; reativar no painel; plano Pro se virar rotina |
| Desempenho em celular (WebGL) | Travamentos | Modo "efeitos baixos" automático, `dpr` limitado, partículas desligáveis, texturas ≤ 4096 |
| Vazar informação oculta | Spoilers | RLS no `select` + canal `:gm`; testes pgTAP específicos |
| Complexidade da visão/luz | Atraso da fase 6 | Lógica em `engine/` com testes unitários; névoa manual já entregue antes |
| Licenças de arte/regras | Problemas legais | Só SRD 5.2 (CC-BY-4.0, com atribuição) e assets CC0/CC-BY com créditos; nada de conteúdo fora do SRD |

---

## 9. Qualidade e testes

- **Unitários (Vitest)** em `engine/`: parser/rolagem de dados, matemática de grid (quadrado/hex,
  distância, snap), polígono de visibilidade, interpolação, conversão `.dd2vtt`.
- **RLS (pgTAP)**: jogador não lê token oculto, não edita ficha alheia, não entra em canal `:gm`.
- **E2E (Playwright)**: dois contextos (GM e jogador) — criar campanha, convidar, mover token e
  ver no outro, rolar dado e ver no chat, ocultar token e confirmar que some para o jogador.
- **CI** no GitHub Actions: lint, typecheck, unit, build em cada push; E2E contra Supabase local.
- **Metas de desempenho**: 60 fps no desktop com 50 tokens e 200 paredes; 30 fps em celular médio;
  carregamento da mesa < 3 s em 4G com mapa já em cache.

---

## 10. Perguntas em aberto (preciso das suas respostas antes da Fase 2)

1. **Qual sistema vocês jogam?** (D&D 5e, Tormenta20, Ordem Paranormal, Pathfinder, sistema
   próprio…). O plano parte de D&D 5e SRD + Genérico; sistemas comerciais sem licença aberta
   (como Tormenta20) entram como ficha "Genérica" configurada por vocês, sem copiar texto dos livros.
2. **Quantas pessoas por mesa** normalmente? (afeta o orçamento de mensagens do plano grátis)
3. **Estilo visual dos sprites**: pixel art (LPC, 32/64 px) ou ilustrado/pintado? Ou ambos?
4. **Voz**: usar Discord ao lado do app está ok, ou querem voz dentro da mesa?
5. **Dispositivos**: alguém vai jogar principalmente pelo celular/tablet?
6. **Plano Supabase**: Free ou Pro na outra conta?

---

## Fontes consultadas

- Supabase — Realtime Limits: https://supabase.com/docs/guides/realtime/limits
- Supabase — Broadcast / Authorization: https://supabase.com/docs/guides/realtime/broadcast
- Limites do plano grátis (terceiros): https://www.jetadmin.io/blog/supabase-pricing-2026-guide-to-plans-limits-and-real-world-costs/
- Comparativo de VTTs: https://www.czepeku.com/blog/choosing-your-ideal-virtual-tabletop
- Konva × PixiJS: https://konvajs.org/docs/faq.html , https://pixijs.com/blog/pixi-v8-launches
- Dados 3D: https://fantasticdice.games/docs/intro , https://tympanus.net/codrops/2023/01/25/crafting-a-dice-roller-with-three-js-and-cannon-es/
- Visibilidade 2D: https://godotengine.org/asset-library/asset/5331 (porte de visibility-polygon-js)
- SRD 5.2 (CC-BY-4.0): https://www.dndbeyond.com/posts/1949-you-can-now-publish-your-own-creations-using-the
- Sprites LPC: https://github.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator ,
  CC0: https://opengameart.org/content/32x32-rpg-character-sprites
