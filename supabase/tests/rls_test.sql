-- Testes de RLS/realtime. Rode com: npm run test:db (requer Postgres da imagem supabase/postgres)
\set ON_ERROR_STOP 1
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'mestre@x'),
  ('00000000-0000-0000-0000-00000000000b', 'jogador@x'),
  ('00000000-0000-0000-0000-00000000000c', 'intruso@x');

create or replace function pg_temp.login(uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uid, true);
  execute 'set local role authenticated';
end $$;
create or replace function pg_temp.fails(q text) returns boolean language plpgsql as $$
begin
  execute q;
  return false;
exception when others then
  return true;
end $$;
create or replace function pg_temp.check(ok boolean, msg text) returns void language plpgsql as $$
begin
  if not ok then raise exception 'FALHOU: %', msg; end if;
  raise notice 'ok - %', msg;
end $$;

-- mestre cria campanha
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select id from public.create_campaign('11111111-1111-1111-1111-111111111111', 'Teste', 'dnd5e', 'Mestre', 'ABC123');
insert into public.scenes (id, campaign_id, data) values ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', '{"name":"Cena"}');
insert into public.tokens (id, campaign_id, scene_id, hidden, data) values
  ('33333333-3333-3333-3333-333333333331', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', false, '{"name":"visivel"}'),
  ('33333333-3333-3333-3333-333333333332', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', true, '{"name":"oculto"}');
reset role;

-- jogador entra pelo convite
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select public.join_campaign('abc123', 'Jogador');
select pg_temp.check((select count(*) from public.campaigns) = 1, 'jogador vê a campanha');
select pg_temp.check((select count(*) from public.tokens) = 1, 'jogador não vê token oculto');
select pg_temp.check((select role from public.campaign_members where user_id = auth.uid()) = 'player', 'entrou como jogador');

-- jogador não pode se promover a mestre
select pg_temp.check(pg_temp.fails($q$update public.campaign_members set role = 'gm' where user_id = auth.uid()$q$), 'promoção bloqueada');
reset role;
select pg_temp.check((select role from public.campaign_members where user_id = '00000000-0000-0000-0000-00000000000b') = 'player', 'jogador não se promove');

select pg_temp.login('00000000-0000-0000-0000-00000000000b');
-- jogador não edita cena
update public.scenes set data = '{"name":"hack"}';
select pg_temp.check((select data->>'name' from public.scenes) = 'Cena', 'jogador não edita cena');
-- jogador cria o próprio personagem e o token dele
insert into public.characters (id, campaign_id, owner_id, kind, data) values ('44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', auth.uid(), 'pc', '{"name":"Heroi"}');
insert into public.tokens (id, campaign_id, scene_id, owner_ids, data) values ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', array[auth.uid()], '{"x":1}');
update public.tokens set data = '{"x":2}' where id = '33333333-3333-3333-3333-333333333333';
select pg_temp.check((select data->>'x' from public.tokens where id = '33333333-3333-3333-3333-333333333333') = '2', 'jogador move o próprio token');
update public.tokens set data = '{"x":9}' where id = '33333333-3333-3333-3333-333333333331';
select pg_temp.check((select data->>'x' from public.tokens where id = '33333333-3333-3333-3333-333333333331') is null, 'jogador não move token alheio');

-- jogador assume personagem sem dono e passa a mover o token dele
reset role;
insert into public.characters (id, campaign_id, owner_id, kind, data) values ('66666666-6666-6666-6666-666666666666', '11111111-1111-1111-1111-111111111111', null, 'pc', '{}');
insert into public.tokens (id, campaign_id, scene_id, character_id, data) values ('77777777-7777-7777-7777-777777777777', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '66666666-6666-6666-6666-666666666666', '{}');
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
update public.characters set owner_id = auth.uid() where id = '66666666-6666-6666-6666-666666666666';
update public.tokens set data = '{"x":5}' where id = '77777777-7777-7777-7777-777777777777';
select pg_temp.check((select data->>'x' from public.tokens where id = '77777777-7777-7777-7777-777777777777') = '5', 'jogador assume personagem e move o token');
select pg_temp.check(pg_temp.fails($q$update public.characters set owner_id = '00000000-0000-0000-0000-00000000000c' where id = '44444444-4444-4444-4444-444444444444'$q$) or (select owner_id from public.characters where id = '44444444-4444-4444-4444-444444444444') = auth.uid(), 'não transfere personagem para outro');

-- chat: sussurro para o mestre não aparece para terceiros
insert into public.chat_messages (id, campaign_id, author_id, visibility, whisper_to, data) values
  ('55555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111', auth.uid(), 'whisper', array['00000000-0000-0000-0000-00000000000a'::uuid], '{"content":"psiu"}');

-- jogador não altera a campanha; o mestre altera
update public.campaigns set name = 'hack';
reset role;
select pg_temp.check((select name from public.campaigns) = 'Teste', 'jogador não altera a campanha');
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
update public.campaigns set active_scene_id = '22222222-2222-2222-2222-222222222222';
reset role;
select pg_temp.check((select active_scene_id from public.campaigns) = '22222222-2222-2222-2222-222222222222', 'mestre troca a cena ativa');
select pg_temp.login('00000000-0000-0000-0000-00000000000b');

-- realtime: jogador pode o tópico geral e o próprio, não o do mestre
select pg_temp.check(public.can_access_topic('campaign:11111111-1111-1111-1111-111111111111'), 'jogador acessa tópico da mesa');
select pg_temp.check(not public.can_access_topic('campaign:11111111-1111-1111-1111-111111111111:gm'), 'jogador não acessa tópico do mestre');
select pg_temp.check(public.can_access_topic('campaign:11111111-1111-1111-1111-111111111111:user:00000000-0000-0000-0000-00000000000b'), 'jogador acessa tópico pessoal');
select pg_temp.check(not public.can_access_topic('campaign:11111111-1111-1111-1111-111111111111:user:00000000-0000-0000-0000-00000000000a'), 'jogador não acessa tópico pessoal alheio');
reset role;

-- intruso não vê nada
select pg_temp.login('00000000-0000-0000-0000-00000000000c');
select pg_temp.check((select count(*) from public.campaigns) = 0, 'intruso não vê campanhas');
select pg_temp.check((select count(*) from public.tokens) = 0, 'intruso não vê tokens');
select pg_temp.check(not public.can_access_topic('campaign:11111111-1111-1111-1111-111111111111'), 'intruso não entra no canal');
reset role;

-- gatilhos de broadcast
select pg_temp.check(exists (select 1 from realtime.sent where topic = 'campaign:11111111-1111-1111-1111-111111111111:gm' and payload->'row'->>'id' = '33333333-3333-3333-3333-333333333332'), 'token oculto vai só para o tópico do mestre');
select pg_temp.check(not exists (select 1 from realtime.sent where topic = 'campaign:11111111-1111-1111-1111-111111111111' and payload->'row'->>'id' = '33333333-3333-3333-3333-333333333332'), 'token oculto não vaza no tópico geral');
select pg_temp.check(exists (select 1 from realtime.sent where topic = 'campaign:11111111-1111-1111-1111-111111111111:user:00000000-0000-0000-0000-00000000000a' and payload->'row'->>'id' = '55555555-5555-5555-5555-555555555555'), 'sussurro chega ao destinatário');
select pg_temp.check(not exists (select 1 from realtime.sent where topic = 'campaign:11111111-1111-1111-1111-111111111111' and payload->'row'->>'id' = '55555555-5555-5555-5555-555555555555'), 'sussurro não vaza no tópico geral');

-- ocultar token visível notifica a remoção para os jogadores
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
update public.tokens set hidden = true where id = '33333333-3333-3333-3333-333333333331';
reset role;
select pg_temp.check(exists (select 1 from realtime.sent where topic = 'campaign:11111111-1111-1111-1111-111111111111' and payload->>'hide' = 'true' and payload->'row'->>'id' = '33333333-3333-3333-3333-333333333331'), 'ocultar envia remoção aos jogadores');

-- cena enorme vira aviso "refresh" em vez de estourar o limite do Broadcast
update public.scenes set data = jsonb_build_object('fog', (select jsonb_agg(g) from generate_series(1, 40000) g)) where id = '22222222-2222-2222-2222-222222222222';
select pg_temp.check((select payload->>'op' from realtime.sent where payload->'row'->>'id' = '22222222-2222-2222-2222-222222222222' order by ctid desc limit 1) = 'refresh', 'linha grande vira aviso refresh');

-- passar turno: só o dono do token da vez (ou o mestre)
update public.scenes set data = jsonb_build_object('combat', jsonb_build_object('active', true, 'round', 1, 'turn', 0, 'combatants', jsonb_build_array(
  jsonb_build_object('id', 'a', 'token_id', '77777777-7777-7777-7777-777777777777', 'initiative', 20),
  jsonb_build_object('id', 'b', 'token_id', '33333333-3333-3333-3333-333333333331', 'initiative', 10))))
  where id = '22222222-2222-2222-2222-222222222222';
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select public.end_turn('22222222-2222-2222-2222-222222222222');
reset role;
select pg_temp.check((select (data->'combat'->>'turn')::int from public.scenes where id = '22222222-2222-2222-2222-222222222222') = 1, 'jogador encerra o próprio turno');
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select pg_temp.check(pg_temp.fails($q$select public.end_turn('22222222-2222-2222-2222-222222222222')$q$), 'jogador não encerra turno alheio');
reset role;
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select public.end_turn('22222222-2222-2222-2222-222222222222');
reset role;
select pg_temp.check((select (data->'combat'->>'round')::int from public.scenes where id = '22222222-2222-2222-2222-222222222222') = 2, 'mestre passa turno e começa nova rodada');

-- limite de jogadores
reset role;
update public.campaigns set data = data || '{"max_players": 1}';
select pg_temp.login('00000000-0000-0000-0000-00000000000c');
select pg_temp.check(pg_temp.fails($q$select public.join_campaign('ABC123', 'Terceiro')$q$), 'campanha cheia recusa novo jogador');
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select pg_temp.check(public.join_campaign('ABC123', 'Jogador') = '11111111-1111-1111-1111-111111111111', 'quem já está entra de novo mesmo cheia');
reset role;

rollback;
