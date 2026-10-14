# Mesa Arcana

Mesa virtual (VTT) para jogar RPG online com os amigos, no navegador, em português.

- **Fichas com sprites animados**: cada personagem ganha um sprite em pixel art, gerado na hora ou enviado por você (folhas LPC ou personalizadas). O sprite fica parado, anda, ataca, conjura, sofre dano e cai. Na ficha ele aparece num cartão 3D que inclina com o mouse.
- **Mapas vivos**: grid quadrado ou hexagonal, tokens que encaixam no grid, régua e áreas de efeito (círculo, cone, linha e cubo).
- **Névoa e luz**: névoa manual, paredes, portas e janelas, luzes e visão dinâmica de cada herói, inclusive visão no escuro. As áreas já exploradas ficam na penumbra.
- **Dados 3D com física**, com o mesmo resultado na tela de todos. Também dá para rolar com notação, como `4d6kh3`, `1d20+5 vantagem` ou `3d6!`.
- **Combate**: iniciativa automática, turnos com a câmera acompanhando, dano e cura rápidos e condições.
- **Cenários**: modo teatro (ilustração de fundo com os personagens no palco e balões de fala), modo 2.5D (miniaturas em pé), clima (chuva, neve, neblina, brasas, folhas), efeitos de magia e trilha sonora por cena.
- **Construtor de mapas**: pinte salas, pisos, paredes, água e lava, e coloque mais de 60 objetos (portas, tochas, baús, móveis, natureza, masmorra), tudo em pixel art. Paredes, portas e tochas viram automaticamente paredes, portas e luzes da visão dinâmica.
- **Saguão da campanha**: o mestre prepara tudo antes (descrição, mapas, NPCs, convites) e depois inicia a sessão. Os jogadores entram pelo link e criam a ficha num assistente passo a passo.
- **Turnos**: barra de iniciativa no topo da mesa; o jogador da vez encerra o próprio turno.
- **Importação do Dungeondraft** (`.dd2vtt` / `.uvtt`): mapa, paredes, portas e luzes chegam prontos.
- **Sistemas de ficha**: **Tormenta20** (padrão: 29 perícias, PV/PM por classe, Defesa, poderes com custo em PM), D&D 5e (SRD 5.2, com bestiário) e uma ficha **Genérica**, que serve para qualquer jogo.
- **Aventura de exemplo** pronta: taverna, masmorra com névoa e luzes, 4 heróis e monstros.

O plano completo e as decisões de arquitetura estão em [`docs/PLANO.md`](docs/PLANO.md).

---

## Testar agora (sem servidor)

```bash
npm install
npm run dev
```

Abra http://localhost:5173. Sem Supabase configurado, o app roda no **modo demonstração**: tudo fica salvo no navegador, e as abas abertas jogam juntas.

1. Entre como convidado, por exemplo "Mestre", e crie uma campanha marcando **Incluir aventura de exemplo**.
2. Copie o código de convite que aparece no topo.
3. Abra **outra aba** com `http://localhost:5173/convite/CÓDIGO` e entre como jogador.

## Jogar online com os amigos (Supabase em outra conta)

O banco fica num projeto Supabase seu. Nada é criado automaticamente: o schema está em `supabase/migrations` e você o aplica no projeto.

1. **Crie o projeto** no painel do Supabase. A região mais próxima é São Paulo, `sa-east-1`.
2. **Aplique o schema** de um destes jeitos:
   - Pela CLI:
     ```bash
     npx supabase login                         # entre com a conta onde está o projeto
     npx supabase link --project-ref SEU_REF    # o REF aparece na URL do painel
     npx supabase db push
     ```
   - Ou cole no **SQL Editor**, nesta ordem, o conteúdo de `supabase/migrations/20261014000000_schema.sql` e de `supabase/migrations/20261015000000_turns.sql` e `supabase/migrations/20261016000000_max_players.sql`, e execute.
3. **Configure a autenticação** em *Authentication*:
   - em *Sign In / Providers*, ative **Email** (link mágico) e **Anonymous sign-ins** (para o "Entrar como convidado");
   - para entrar com Discord, ative o provedor **Discord**, com o Client ID e o Secret criados no [Discord Developer Portal](https://discord.com/developers/applications);
   - em *URL Configuration*, coloque a URL do site (por exemplo `https://mesa-arcana.vercel.app`) e `http://localhost:5173` nas Redirect URLs.
4. **Configure o Realtime** em *Realtime → Settings*: deixe **desmarcada** a opção que permite acesso público a canais. O app usa canais privados autorizados por RLS.
5. **Variáveis de ambiente.** Se você conectou o Supabase pela integração da Vercel, as variáveis `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_ANON_KEY` já servem: o app as reconhece e expõe ao navegador **só** a URL e a chave pública. Faça um novo deploy depois de conectar. Se o saguão mostrar o aviso "Modo demonstração", as variáveis não chegaram ao build e os convites só funcionarão no mesmo navegador. Para rodar localmente, crie o `.env.local` a partir do `.env.example`, com os dados de *Project Settings → API*:
   ```
   VITE_SUPABASE_URL=https://SEU_REF.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   ```
   Use só a chave **publishable** (ou a `anon`). **Nunca** coloque a `service_role` ou a secret key no front nem no repositório.
6. **Publique o site**. Vercel, Netlify e Cloudflare Pages funcionam no plano grátis. Build: `npm run build`, pasta `dist`. Cadastre as duas variáveis acima no painel da hospedagem. Os arquivos `vercel.json` e `public/_redirects` já cuidam das rotas da SPA.

### Limites do plano grátis do Supabase

| Recurso | Limite | Como o app lida |
|---|---|---|
| Mensagens Realtime | 100/s por projeto | Arrastar tokens envia no máximo 10 posições/s, sem cursores contínuos |
| Storage | 1 GB | Imagens convertidas para WebP; mapas com até 4096 px; áudio de até 15 MB |
| Inatividade | Projeto pausa após 7 dias sem uso | Reative no painel (o plano Pro não pausa) |

## Como jogar

| Ação | Como |
|---|---|
| Mover a câmera | Arrastar num espaço vazio, botão direito ou dois dedos |
| Zoom | Roda do mouse ou pinça |
| Mover token | Arrastar (encaixa no grid; jogadores não atravessam paredes) |
| Ficha | Duplo clique no token, ou clique na lista **Fichas** |
| Menu do token | Botão direito: vida, condições, ocultar, luz, visão… |
| Apontar (ping) | Alt+clique |
| Ferramentas | `V` selecionar · `R` régua · `A` área · `E` magia · `P` ping · `B` construir mapa · `W` paredes · `F` névoa · `L` luz |
| Chat | `2d6+3` rola · `/gr d20` rolagem secreta · `/w Nome msg` sussurro · `/me ri` |
| Mapa / token | Arraste uma imagem ou um `.dd2vtt` para a mesa |
| Token de personagem | Arraste o personagem da lista para o mapa |

## Desenvolvimento

```bash
npm run dev        # servidor local
npm run typecheck  # TypeScript
npm test           # testes do motor (dados, grid, visão, importação)
npm run test:e2e   # Playwright: mestre + jogador jogando em duas abas
npm run build      # build de produção
```

Para testar o schema e as regras de RLS num Postgres local:

```bash
docker run -d --name mesa-pg -e POSTGRES_PASSWORD=postgres -p 55432:5432 supabase/postgres:17.11.0.004
npm run test:db
```

### Estrutura

```
src/
  engine/      lógica pura e testada: dados, grid/visão, sprites, importação .dd2vtt, mapa de exemplo
  data/        backend Supabase e backend local (modo demonstração), com a mesma interface
  store/       estado do jogo (Zustand) e sincronização
  table/       mesa em three.js (React Three Fiber): mapa, tokens, névoa, efeitos, ferramentas
  dice/        dados 3D com física (Rapier), simulados antes de mostrar
  characters/  ficha, cartão 3D, editor de sprites
  panels/      chat, fichas, combate, cenas
  systems/     D&D 5e (SRD 5.2) e Genérico, bestiário
supabase/
  migrations/  schema, RLS, gatilhos de Realtime, bucket de arquivos
  tests/       testes de RLS em SQL
e2e/           testes ponta a ponta
```

## Licenças e créditos

- Regras e criaturas de D&D: este conteúdo usa material do System Reference Document 5.2 ("SRD 5.2") da Wizards of the Coast LLC, disponível em https://www.dndbeyond.com/srd, licenciado sob CC-BY-4.0.
- Os sprites gerados pelo app são originais. Folhas do gerador **Universal LPC** são CC-BY-SA 3.0 / GPL 3.0: preencha os créditos dos artistas ao usá-las.
