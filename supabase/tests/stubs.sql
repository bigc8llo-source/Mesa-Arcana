-- Stubs mínimos dos serviços Realtime/Storage para testar as migrations num Postgres puro
-- (imagem supabase/postgres sem os demais contêineres). NÃO aplicar em produção.
create table if not exists realtime.messages (id bigserial primary key, topic text, extension text, payload jsonb, event text, private boolean);
create table if not exists realtime.sent (topic text, event text, payload jsonb);
create or replace function realtime.topic() returns text language sql stable as $$ select current_setting('realtime.topic', true) $$;
create or replace function realtime.send(payload jsonb, event text, topic text, private boolean default true) returns void
language sql security definer as $$ insert into realtime.sent values (topic, event, payload) $$;
alter table realtime.messages enable row level security;
grant usage on schema realtime to authenticated;
grant select, insert on realtime.messages to authenticated;

create table if not exists storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table if not exists storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
create or replace function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
alter table storage.objects enable row level security;
