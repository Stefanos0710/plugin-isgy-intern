-- Accounts (with the encrypted isgy-intern login) and the extension's notes/to-dos.
-- Tables live in schema `private`, which the Supabase Data API does not expose. The MCP server reaches them only
-- through the security-definer functions below, which require the server's API secret (its SHA-256 is stored in
-- private.config). So the publishable key alone gives no access to anything.
-- After applying: insert into private.config values ('api_secret_sha256', '<hex sha256 of SUPABASE_API_SECRET>');

create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table private.config (key text primary key, value text not null);

create table private.accounts (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(email) and length(email) <= 200),
  pw_hash text not null,
  cred text,                 -- portal login, AES-GCM-encrypted by the server (never readable here)
  cred_kind text check (cred_kind in ('pw', 's')),
  cred_updated timestamptz,
  token_version int not null default 1,  -- bumping it signs out every AI assistant and extension
  ext_seen timestamptz,
  created_at timestamptz not null default now()
);

create table private.notes (
  account_id uuid not null references private.accounts (id) on delete cascade,
  id bigint not null,
  type text not null default 'todo' check (type in ('todo', 'note')),
  text text not null default '' check (length(text) <= 5000),
  date date,
  done boolean not null default false,
  deleted boolean not null default false,  -- tombstone, so deletions sync to every device
  updated bigint not null default 0,       -- ms timestamp; the newer version wins
  source text,
  primary key (account_id, id)
);

alter table private.config enable row level security;
alter table private.accounts enable row level security;
alter table private.notes enable row level security;

create function private.check_secret(p_secret text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_secret is null or not exists (
    select 1 from private.config
    where key = 'api_secret_sha256' and value = encode(extensions.digest(p_secret, 'sha256'), 'hex')
  ) then
    raise exception 'unauthorized' using errcode = '28000';
  end if;
end $$;

create function public.api_account_create(p_secret text, p_email text, p_pw_hash text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  perform private.check_secret(p_secret);
  insert into private.accounts (email, pw_hash) values (lower(trim(p_email)), p_pw_hash) returning id into v_id;
  return v_id;
exception when unique_violation then
  raise exception 'email_taken' using errcode = '23505';
end $$;

create function public.api_account_by_email(p_secret text, p_email text)
returns table (id uuid, pw_hash text, token_version int)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
begin
  perform private.check_secret(p_secret);
  return query select a.id, a.pw_hash, a.token_version from private.accounts a where a.email = lower(trim(p_email));
end $$;

create function public.api_account_get(p_secret text, p_id uuid)
returns table (id uuid, email text, cred text, cred_kind text, cred_updated timestamptz, token_version int,
               ext_seen timestamptz, created_at timestamptz, todos_open int, notes_total int)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
begin
  perform private.check_secret(p_secret);
  return query
    select a.id, a.email, a.cred, a.cred_kind, a.cred_updated, a.token_version, a.ext_seen, a.created_at,
      (select count(*)::int from private.notes n where n.account_id = a.id and not n.deleted and n.type = 'todo' and not n.done),
      (select count(*)::int from private.notes n where n.account_id = a.id and not n.deleted)
    from private.accounts a where a.id = p_id;
end $$;

-- Patch keys: cred + cred_kind (stores the login), pw_hash, bump (sign out everywhere), ext_seen (extension synced).
create function public.api_account_update(p_secret text, p_id uuid, p_patch jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.check_secret(p_secret);
  update private.accounts a set
    cred = case when p_patch ? 'cred' then p_patch ->> 'cred' else a.cred end,
    cred_kind = case when p_patch ? 'cred' then p_patch ->> 'cred_kind' else a.cred_kind end,
    cred_updated = case when p_patch ? 'cred' then now() else a.cred_updated end,
    pw_hash = coalesce(p_patch ->> 'pw_hash', a.pw_hash),
    token_version = case when p_patch ? 'bump' then a.token_version + 1 else a.token_version end,
    ext_seen = case when p_patch ? 'ext_seen' then now() else a.ext_seen end
  where a.id = p_id;
end $$;

create function public.api_account_delete(p_secret text, p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.check_secret(p_secret);
  delete from private.accounts where id = p_id;
end $$;

create function public.api_notes_list(p_secret text, p_id uuid)
returns table (id bigint, type text, text text, date date, done boolean, updated bigint, source text)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
begin
  perform private.check_secret(p_secret);
  return query select n.id, n.type, n.text, n.date, n.done, n.updated, n.source
    from private.notes n where n.account_id = p_id and not n.deleted order by n.id;
end $$;

-- Merge notes (incl. tombstones with "deleted": true): a row only changes if the incoming version is newer.
create function public.api_notes_upsert(p_secret text, p_id uuid, p_notes jsonb)
returns table (id bigint, type text, text text, date date, done boolean, updated bigint, source text)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
begin
  perform private.check_secret(p_secret);
  if jsonb_typeof(p_notes) <> 'array' or jsonb_array_length(p_notes) > 1000 then
    raise exception 'bad_notes' using errcode = '22023';
  end if;
  insert into private.notes as t (account_id, id, type, text, date, done, deleted, updated, source)
  select p_id, (n ->> 'id')::bigint,
    case when n ->> 'type' = 'note' then 'note' else 'todo' end,
    left(coalesce(n ->> 'text', ''), 5000),
    case when coalesce(n ->> 'date', '') ~ '^\d{4}-\d{2}-\d{2}$' then (n ->> 'date')::date end,
    coalesce((n ->> 'done')::boolean, false),
    coalesce((n ->> 'deleted')::boolean, false),
    coalesce((n ->> 'updated')::bigint, 0),
    left(n ->> 'source', 20)
  from jsonb_array_elements(p_notes) n
  where (n ->> 'id') ~ '^\d{1,18}$'
  on conflict (account_id, id) do update set
    type = excluded.type, text = excluded.text, date = excluded.date, done = excluded.done,
    deleted = excluded.deleted, updated = excluded.updated, source = coalesce(excluded.source, t.source)
  where excluded.updated > t.updated;
  return query select n.id, n.type, n.text, n.date, n.done, n.updated, n.source
    from private.notes n where n.account_id = p_id and not n.deleted order by n.id;
end $$;

revoke all on all functions in schema public from public, anon, authenticated;
revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function
  public.api_account_create(text, text, text), public.api_account_by_email(text, text), public.api_account_get(text, uuid),
  public.api_account_update(text, uuid, jsonb), public.api_account_delete(text, uuid),
  public.api_notes_list(text, uuid), public.api_notes_upsert(text, uuid, jsonb)
to anon, service_role;
