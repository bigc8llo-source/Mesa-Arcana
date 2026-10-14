-- Passar turno: o mestre ou o dono do token da vez avançam a iniciativa.
-- (cenas só podem ser editadas pelo mestre, então o jogador usa esta função)
create or replace function public.end_turn(p_scene uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  sc public.scenes;
  comb jsonb;
  ordered jsonb;
  cur jsonb;
  n int;
  v_turn int;
  v_round int;
  tok public.tokens;
begin
  select * into sc from public.scenes where id = p_scene for update;
  if sc.id is null or not public.is_member(sc.campaign_id) then raise exception 'scene not found'; end if;
  comb := sc.data -> 'combat';
  if not coalesce((comb ->> 'active')::boolean, false) then return; end if;
  select jsonb_agg(t.c order by (t.c ->> 'initiative')::numeric desc, t.i) into ordered
    from jsonb_array_elements(comb -> 'combatants') with ordinality as t(c, i);
  n := coalesce(jsonb_array_length(ordered), 0);
  if n = 0 then return; end if;
  v_turn := least(coalesce((comb ->> 'turn')::int, 0), n - 1);
  v_round := coalesce((comb ->> 'round')::int, 1);
  cur := ordered -> v_turn;
  if not public.is_gm(sc.campaign_id) then
    select * into tok from public.tokens where id = (cur ->> 'token_id')::uuid;
    if tok.id is null or not (auth.uid() = any (tok.owner_ids) or public.owns_character(tok.character_id)) then
      raise exception 'not your turn';
    end if;
  end if;
  v_turn := v_turn + 1;
  if v_turn >= n then
    v_turn := 0;
    v_round := v_round + 1;
  end if;
  update public.scenes
    set data = jsonb_set(jsonb_set(data, '{combat,turn}', to_jsonb(v_turn)), '{combat,round}', to_jsonb(v_round))
    where id = p_scene;
end;
$$;

grant execute on function public.end_turn(uuid) to authenticated;
