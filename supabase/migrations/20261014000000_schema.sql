-- Mesa Arcana — schema inicial
-- Cada tabela tem colunas-chave (usadas por RLS/filtros/gatilhos) e `data jsonb` com o resto.

-- ============================================================ Tabelas

create table public.campaigns (
  id uuid primary key,
  name text not null check (char_length(name) between 1 and 120),
  system_id text not null default 'dnd5e',
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  invite_code text not null unique,
  active_scene_id uuid,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.campaign_members (
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'player' check (role in ('gm', 'player')),
  display_name text not null default 'Aventureiro',
  color text not null default '#2563eb',
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (campaign_id, user_id)
);
create index on public.campaign_members (user_id);

create table public.characters (
  id uuid primary key,
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  owner_id uuid references auth.users (id) on delete set null,
  kind text not null default 'pc' check (kind in ('pc', 'npc', 'monster')),
  hidden boolean not null default false,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.characters (campaign_id);

create table public.scenes (
  id uuid primary key,
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.scenes (campaign_id);

create table public.tokens (
  id uuid primary key,
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  scene_id uuid not null references public.scenes (id) on delete cascade,
  character_id uuid references public.characters (id) on delete set null,
  hidden boolean not null default false,
  layer text not null default 'token' check (layer in ('token', 'object', 'gm')),
  owner_ids uuid[] not null default '{}',
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.tokens (campaign_id);
create index on public.tokens (scene_id);

create table public.chat_messages (
  id uuid primary key,
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  author_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  visibility text not null default 'public' check (visibility in ('public', 'gm', 'whisper')),
  whisper_to uuid[] not null default '{}',
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.chat_messages (campaign_id, created_at desc);

-- ============================================================ Funções auxiliares (security definer evita recursão de RLS)

create or replace function public.is_member(cid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.campaign_members m where m.campaign_id = cid and m.user_id = auth.uid());
$$;

create or replace function public.is_gm(cid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.campaign_members m where m.campaign_id = cid and m.user_id = auth.uid() and m.role = 'gm');
$$;

create or replace function public.owns_character(chid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select chid is not null and exists (select 1 from public.characters c where c.id = chid and c.owner_id = auth.uid());
$$;

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['campaigns','campaign_members','characters','scenes','tokens','chat_messages'] loop
    execute format('create trigger touch before update on public.%I for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;

-- ============================================================ RPCs

create or replace function public.create_campaign(p_id uuid, p_name text, p_system_id text, p_display_name text, p_invite_code text)
returns public.campaigns language plpgsql security definer set search_path = '' as $$
declare c public.campaigns;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  insert into public.campaigns (id, name, system_id, owner_id, invite_code)
  values (p_id, p_name, p_system_id, auth.uid(), p_invite_code)
  returning * into c;
  insert into public.campaign_members (campaign_id, user_id, role, display_name, color)
  values (c.id, auth.uid(), 'gm', coalesce(nullif(p_display_name, ''), 'Mestre'), '#a855f7');
  return c;
end;
$$;

create or replace function public.join_campaign(p_code text, p_display_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare cid uuid; n int;
  colors text[] := array['#e11d48','#2563eb','#16a34a','#d97706','#0891b2','#db2777','#65a30d'];
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select id into cid from public.campaigns where invite_code = upper(p_code);
  if cid is null then raise exception 'invalid invite code'; end if;
  select count(*) into n from public.campaign_members where campaign_id = cid;
  insert into public.campaign_members (campaign_id, user_id, role, display_name, color)
  values (cid, auth.uid(), 'player', coalesce(nullif(p_display_name, ''), 'Aventureiro'), colors[(n % 7) + 1])
  on conflict (campaign_id, user_id) do nothing;
  return cid;
end;
$$;

grant execute on function public.create_campaign(uuid, text, text, text, text) to authenticated;
grant execute on function public.join_campaign(text, text) to authenticated;

-- ============================================================ RLS

alter table public.campaigns enable row level security;
alter table public.campaign_members enable row level security;
alter table public.characters enable row level security;
alter table public.scenes enable row level security;
alter table public.tokens enable row level security;
alter table public.chat_messages enable row level security;

-- campanhas (criação apenas via RPC create_campaign)
create policy "campaigns: membros leem" on public.campaigns for select to authenticated using (public.is_member(id));
create policy "campaigns: mestre edita" on public.campaigns for update to authenticated using (public.is_gm(id)) with check (public.is_gm(id));
create policy "campaigns: dono apaga" on public.campaigns for delete to authenticated using (owner_id = auth.uid());

-- membros (entrada apenas via RPC join_campaign)
create policy "members: membros leem" on public.campaign_members for select to authenticated using (public.is_member(campaign_id));
create policy "members: editar a si ou mestre" on public.campaign_members for update to authenticated
  using (user_id = auth.uid() or public.is_gm(campaign_id))
  with check (public.is_gm(campaign_id) or role = 'player');
create policy "members: sair ou mestre remove" on public.campaign_members for delete to authenticated
  using (user_id = auth.uid() or public.is_gm(campaign_id));

-- personagens: ocultos só para o mestre e o dono
create policy "characters: leitura" on public.characters for select to authenticated
  using (public.is_member(campaign_id) and (not hidden or owner_id = auth.uid() or public.is_gm(campaign_id)));
create policy "characters: criar" on public.characters for insert to authenticated
  with check (public.is_gm(campaign_id) or (public.is_member(campaign_id) and owner_id = auth.uid() and not hidden));
-- jogadores podem "assumir" um personagem jogador sem dono (campanha de exemplo)
create policy "characters: editar" on public.characters for update to authenticated
  using (public.is_gm(campaign_id) or owner_id = auth.uid() or (owner_id is null and kind = 'pc' and not hidden and public.is_member(campaign_id)))
  with check (public.is_gm(campaign_id) or owner_id = auth.uid());
create policy "characters: apagar" on public.characters for delete to authenticated
  using (public.is_gm(campaign_id) or owner_id = auth.uid());

-- cenas: todos leem, mestre escreve
create policy "scenes: leitura" on public.scenes for select to authenticated using (public.is_member(campaign_id));
create policy "scenes: mestre escreve" on public.scenes for all to authenticated
  using (public.is_gm(campaign_id)) with check (public.is_gm(campaign_id));

-- tokens: ocultos só para o mestre; jogadores movem os próprios
create policy "tokens: leitura" on public.tokens for select to authenticated
  using (public.is_member(campaign_id) and (not hidden or public.is_gm(campaign_id)));
create policy "tokens: criar" on public.tokens for insert to authenticated
  with check (public.is_gm(campaign_id) or (public.is_member(campaign_id) and auth.uid() = any (owner_ids) and not hidden));
create policy "tokens: editar" on public.tokens for update to authenticated
  using (public.is_gm(campaign_id) or auth.uid() = any (owner_ids) or public.owns_character(character_id))
  with check (public.is_gm(campaign_id) or ((auth.uid() = any (owner_ids) or public.owns_character(character_id)) and not hidden));
create policy "tokens: apagar" on public.tokens for delete to authenticated using (public.is_gm(campaign_id));

-- chat: sussurros e rolagens secretas
create policy "chat: leitura" on public.chat_messages for select to authenticated
  using (public.is_member(campaign_id) and (
    visibility = 'public' or author_id = auth.uid() or auth.uid() = any (whisper_to) or public.is_gm(campaign_id)));
create policy "chat: enviar" on public.chat_messages for insert to authenticated
  with check (public.is_member(campaign_id) and author_id = auth.uid());
create policy "chat: apagar" on public.chat_messages for delete to authenticated
  using (author_id = auth.uid() or public.is_gm(campaign_id));

-- ============================================================ Realtime (Broadcast a partir do banco)
-- Tópicos privados: campaign:<id> (todos), campaign:<id>:gm (mestre), campaign:<id>:user:<uid> (pessoal)

create or replace function public.broadcast_row()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  r jsonb;
  op text;
  tbl text := tg_table_name;
  cid uuid;
  base text;
  payload jsonb;
  w uuid;
begin
  if tg_op = 'DELETE' then r := to_jsonb(old); op := 'delete'; else r := to_jsonb(new); op := 'upsert'; end if;
  cid := case when tbl = 'campaigns' then (r ->> 'id')::uuid else (r ->> 'campaign_id')::uuid end;
  base := 'campaign:' || cid::text;
  payload := jsonb_build_object('table', tbl, 'op', op, 'row', r);

  if tbl in ('tokens', 'characters') and coalesce((r ->> 'hidden')::boolean, false) then
    perform realtime.send(payload, 'db', base || ':gm', true);
    if tbl = 'characters' and r ->> 'owner_id' is not null then
      perform realtime.send(payload, 'db', base || ':user:' || (r ->> 'owner_id'), true);
    end if;
    -- some para quem não deve ver (o cliente do mestre/dono ignora por causa de "hide")
    if tg_op = 'UPDATE' then
      perform realtime.send(
        jsonb_build_object('table', tbl, 'op', 'delete', 'hide', true,
          'row', jsonb_build_object('id', r -> 'id', 'campaign_id', r -> 'campaign_id', 'owner_id', r -> 'owner_id')),
        'db', base, true);
    end if;
  elsif tbl = 'chat_messages' and r ->> 'visibility' <> 'public' then
    perform realtime.send(payload, 'db', base || ':gm', true);
    perform realtime.send(payload, 'db', base || ':user:' || (r ->> 'author_id'), true);
    for w in select jsonb_array_elements_text(r -> 'whisper_to')::uuid loop
      perform realtime.send(payload, 'db', base || ':user:' || w::text, true);
    end loop;
  else
    perform realtime.send(payload, 'db', base, true);
  end if;
  return null;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['campaigns','campaign_members','characters','scenes','tokens','chat_messages'] loop
    execute format('create trigger broadcast after insert or update or delete on public.%I for each row execute function public.broadcast_row()', t);
  end loop;
end $$;

create or replace function public.can_access_topic(topic text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare cid uuid;
begin
  if topic !~ '^campaign:[0-9a-f-]{36}(:gm|:user:[0-9a-f-]{36})?$' then return false; end if;
  cid := substring(topic from 10 for 36)::uuid;
  if topic like '%:gm' then return public.is_gm(cid); end if;
  if topic like '%:user:%' then
    return public.is_member(cid) and (right(topic, 36)::uuid = auth.uid() or public.is_gm(cid));
  end if;
  return public.is_member(cid);
end;
$$;

create policy "realtime: membros recebem" on realtime.messages for select to authenticated
  using (public.can_access_topic(realtime.topic()));
create policy "realtime: membros enviam na mesa" on realtime.messages for insert to authenticated
  with check (realtime.topic() ~ '^campaign:[0-9a-f-]{36}$' and public.can_access_topic(realtime.topic()));

-- ============================================================ Storage

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('assets', 'assets', true, 20971520,
  array['image/png','image/jpeg','image/webp','image/gif','audio/mpeg','audio/ogg','audio/wav','audio/webm','audio/mp4'])
on conflict (id) do nothing;

create policy "assets: membros enviam" on storage.objects for insert to authenticated
  with check (bucket_id = 'assets' and public.is_member(((storage.foldername(name))[1])::uuid));
create policy "assets: mestre apaga" on storage.objects for delete to authenticated
  using (bucket_id = 'assets' and public.is_gm(((storage.foldername(name))[1])::uuid));

-- ============================================================ Permissões (RLS continua filtrando as linhas)

grant usage on schema public to authenticated;
grant select, insert, update, delete on
  public.campaigns, public.campaign_members, public.characters, public.scenes, public.tokens, public.chat_messages
  to authenticated;
revoke all on function public.broadcast_row() from public, anon, authenticated;
