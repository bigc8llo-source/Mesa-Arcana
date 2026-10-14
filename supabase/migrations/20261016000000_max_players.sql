-- Limite de jogadores por campanha (data.max_players). Sem limite quando ausente.
create or replace function public.join_campaign(p_code text, p_display_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare cid uuid; n int; lim int;
  colors text[] := array['#e11d48','#2563eb','#16a34a','#d97706','#0891b2','#db2777','#65a30d'];
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select id, nullif(data ->> 'max_players', '')::int into cid, lim from public.campaigns where invite_code = upper(p_code);
  if cid is null then raise exception 'invalid invite code'; end if;
  if exists (select 1 from public.campaign_members where campaign_id = cid and user_id = auth.uid()) then return cid; end if;
  select count(*) into n from public.campaign_members where campaign_id = cid and role = 'player';
  if lim is not null and n >= lim then raise exception 'campaign full'; end if;
  insert into public.campaign_members (campaign_id, user_id, role, display_name, color)
  values (cid, auth.uid(), 'player', coalesce(nullif(p_display_name, ''), 'Aventureiro'), colors[(n % 7) + 1]);
  return cid;
end;
$$;
