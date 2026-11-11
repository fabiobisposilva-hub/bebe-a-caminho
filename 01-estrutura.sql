-- =====================================================================
-- BeBê a CaMinHo – estrutura do banco de dados (Supabase)
-- Rodar UMA vez: Supabase → SQL Editor → New query → colar tudo → Run
-- Desenvolvido por Fabio Bispo · novembro de 2026
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 1) Quem é da família (pode registrar, editar e autorizar visitantes)
-- ---------------------------------------------------------------------
create table if not exists public.familia_emails (
  email      text primary key,
  criado_em  timestamptz not null default now()
);
insert into public.familia_emails (email) values ('fabiobisposilva@gmail.com')
  on conflict do nothing;

-- ---------------------------------------------------------------------
-- 2) Cadastro de cada pessoa (família ou visitante)
-- ---------------------------------------------------------------------
create table if not exists public.perfis (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text not null,
  nome          text not null default '',
  nasc          date,
  papel         text not null default '',          -- parentesco: Mãe, Avó, Tio…
  papel_app     text not null default 'visitante' check (papel_app in ('familia','visitante')),
  status        text not null default 'pendente'  check (status in ('pendente','aprovado','recusado')),
  vinculo       text not null default '',          -- e-mail de quem deve autorizar
  capa_path     text,                              -- foto de capa da pessoa
  criado_em     timestamptz not null default now(),
  decidido_por  uuid references auth.users(id),
  decidido_em   timestamptz
);

-- Funções de permissão (rodam com privilégio próprio para não entrar em laço)
create or replace function public.eh_familia() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfis where id = auth.uid() and papel_app = 'familia');
$$;
create or replace function public.eh_visitante_ok() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfis where id = auth.uid() and papel_app = 'visitante' and status = 'aprovado');
$$;
create or replace function public.pode_ver() returns boolean
language sql stable security definer set search_path = public as $$
  select public.eh_familia() or public.eh_visitante_ok();
$$;

-- Ao criar uma conta: família (se o e-mail estiver na lista) ou visitante pendente
create or replace function public.novo_usuario() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  fam boolean;
begin
  fam := exists (select 1 from public.familia_emails where lower(email) = lower(new.email));
  insert into public.perfis (id, email, nome, nasc, papel, vinculo, papel_app, status)
  values (
    new.id,
    lower(new.email),
    coalesce(new.raw_user_meta_data->>'nome', ''),
    nullif(new.raw_user_meta_data->>'nasc', '')::date,
    coalesce(new.raw_user_meta_data->>'papel', ''),
    lower(coalesce(new.raw_user_meta_data->>'vinculo', '')),
    case when fam then 'familia' else 'visitante' end,
    case when fam then 'aprovado' else 'pendente' end
  )
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists ao_criar_usuario on auth.users;
create trigger ao_criar_usuario after insert on auth.users
  for each row execute function public.novo_usuario();

-- E-mail adicionado à família depois: a pessoa vira família na hora
create or replace function public.virou_familia() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.perfis set papel_app = 'familia', status = 'aprovado'
   where lower(email) = lower(new.email);
  return new;
end $$;
drop trigger if exists ao_incluir_familia on public.familia_emails;
create trigger ao_incluir_familia after insert on public.familia_emails
  for each row execute function public.virou_familia();

-- Ninguém de fora da família pode se promover ou se autorizar sozinho
create or replace function public.protege_perfil() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.eh_familia() and (
       new.papel_app    is distinct from old.papel_app
    or new.status       is distinct from old.status
    or new.email        is distinct from old.email
    or new.decidido_por is distinct from old.decidido_por
    or new.decidido_em  is distinct from old.decidido_em
  ) then
    raise exception 'Somente a família pode mudar permissões.';
  end if;
  return new;
end $$;
drop trigger if exists protege_perfil on public.perfis;
create trigger protege_perfil before update on public.perfis
  for each row execute function public.protege_perfil();

-- ---------------------------------------------------------------------
-- 3) Bebês
-- ---------------------------------------------------------------------
create table if not exists public.bebes (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null default '',
  dpp        date,                                  -- data provável do parto
  nasc       date,                                  -- data de nascimento
  sexo       text not null default '' check (sexo in ('', 'F', 'M')),
  foto_path  text,
  ordem      int  not null default 0,
  criado_em  timestamptz not null default now()
);
insert into public.bebes (nome, dpp, sexo)
  select 'Maria Bispo Mendonça', date '2027-01-28', 'F'
  where not exists (select 1 from public.bebes);

-- ---------------------------------------------------------------------
-- 4) Diário (momentos, marcos, medidas, consultas, vacinas, dentes…)
-- ---------------------------------------------------------------------
create table if not exists public.registros (
  id         uuid primary key default gen_random_uuid(),
  bebe_id    uuid not null references public.bebes(id) on delete cascade,
  tipo       text not null,
  data       date not null,
  texto      text not null default '',
  dados      jsonb not null default '{}'::jsonb,    -- peso, vacinas, lote, marco…
  foto_path  text,
  visivel    boolean not null default false,        -- mostrar para visitantes
  autor      uuid default auth.uid() references auth.users(id),
  criado_em  timestamptz not null default now()
);
create index if not exists registros_bebe_data on public.registros (bebe_id, data desc);

-- ---------------------------------------------------------------------
-- 5) Álbuns de fotos
-- ---------------------------------------------------------------------
create table if not exists public.albuns (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null,
  autor      uuid default auth.uid() references auth.users(id),
  criado_em  timestamptz not null default now()
);
create table if not exists public.album_fotos (
  id         uuid primary key default gen_random_uuid(),
  album_id   uuid not null references public.albuns(id) on delete cascade,
  foto_path  text not null,
  data       date,                                  -- data da foto (câmera)
  autor      uuid default auth.uid() references auth.users(id),
  criado_em  timestamptz not null default now()
);
create index if not exists album_fotos_album on public.album_fotos (album_id, data);

-- ---------------------------------------------------------------------
-- 6) Rotina (mamadas, sono, fraldas, saúde) – só a família vê
-- ---------------------------------------------------------------------
create table if not exists public.rotina (
  id         uuid primary key default gen_random_uuid(),
  bebe_id    uuid not null references public.bebes(id) on delete cascade,
  tipo       text not null,
  inicio     timestamptz not null,
  fim        timestamptz,
  dados      jsonb not null default '{}'::jsonb,
  autor      uuid default auth.uid() references auth.users(id),
  criado_em  timestamptz not null default now()
);
create index if not exists rotina_bebe_inicio on public.rotina (bebe_id, inicio desc);

-- ---------------------------------------------------------------------
-- 7) Regras de acesso (Row Level Security)
-- ---------------------------------------------------------------------
alter table public.familia_emails enable row level security;
alter table public.perfis         enable row level security;
alter table public.bebes          enable row level security;
alter table public.registros      enable row level security;
alter table public.albuns         enable row level security;
alter table public.album_fotos    enable row level security;
alter table public.rotina         enable row level security;

-- família
drop policy if exists familia_emails_familia on public.familia_emails;
create policy familia_emails_familia on public.familia_emails
  for all to authenticated using (public.eh_familia()) with check (public.eh_familia());

-- perfis: cada um vê e edita o seu; a família vê todos e autoriza
drop policy if exists perfis_ver on public.perfis;
create policy perfis_ver on public.perfis
  for select to authenticated using (id = auth.uid() or public.eh_familia());
drop policy if exists perfis_editar on public.perfis;
create policy perfis_editar on public.perfis
  for update to authenticated using (id = auth.uid() or public.eh_familia())
  with check (id = auth.uid() or public.eh_familia());
drop policy if exists perfis_apagar on public.perfis;
create policy perfis_apagar on public.perfis
  for delete to authenticated using (public.eh_familia() and id <> auth.uid());

-- bebês: família edita; visitante autorizado só vê
drop policy if exists bebes_ver on public.bebes;
create policy bebes_ver on public.bebes for select to authenticated using (public.pode_ver());
drop policy if exists bebes_familia on public.bebes;
create policy bebes_familia on public.bebes
  for all to authenticated using (public.eh_familia()) with check (public.eh_familia());

-- diário: visitante autorizado vê só o que foi marcado "visível"
drop policy if exists registros_ver on public.registros;
create policy registros_ver on public.registros for select to authenticated
  using (public.eh_familia() or (public.eh_visitante_ok() and visivel));
drop policy if exists registros_familia on public.registros;
create policy registros_familia on public.registros
  for all to authenticated using (public.eh_familia()) with check (public.eh_familia());

-- álbuns: visitante autorizado vê todos
drop policy if exists albuns_ver on public.albuns;
create policy albuns_ver on public.albuns for select to authenticated using (public.pode_ver());
drop policy if exists albuns_familia on public.albuns;
create policy albuns_familia on public.albuns
  for all to authenticated using (public.eh_familia()) with check (public.eh_familia());
drop policy if exists album_fotos_ver on public.album_fotos;
create policy album_fotos_ver on public.album_fotos for select to authenticated using (public.pode_ver());
drop policy if exists album_fotos_familia on public.album_fotos;
create policy album_fotos_familia on public.album_fotos
  for all to authenticated using (public.eh_familia()) with check (public.eh_familia());

-- rotina: só família
drop policy if exists rotina_familia on public.rotina;
create policy rotina_familia on public.rotina
  for all to authenticated using (public.eh_familia()) with check (public.eh_familia());

-- Acesso pela API: só para quem entrou (nunca anônimo)
grant usage on schema public to authenticated;
grant select, insert, update, delete on
  public.familia_emails, public.perfis, public.bebes, public.registros,
  public.albuns, public.album_fotos, public.rotina
  to authenticated;
revoke all on
  public.familia_emails, public.perfis, public.bebes, public.registros,
  public.albuns, public.album_fotos, public.rotina
  from anon;
grant execute on function public.eh_familia(), public.eh_visitante_ok(), public.pode_ver() to authenticated;

-- ---------------------------------------------------------------------
-- 8) Fotos (Storage): pasta privada "fotos"
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists fotos_familia on storage.objects;
create policy fotos_familia on storage.objects
  for all to authenticated
  using (bucket_id = 'fotos' and public.eh_familia())
  with check (bucket_id = 'fotos' and public.eh_familia());

-- visitante autorizado vê só fotos de postagens liberadas, dos álbuns e a do bebê
drop policy if exists fotos_visitante on storage.objects;
create policy fotos_visitante on storage.objects
  for select to authenticated
  using (
    bucket_id = 'fotos' and public.eh_visitante_ok() and (
         exists (select 1 from public.registros r   where r.foto_path = objects.name and r.visivel)
      or exists (select 1 from public.album_fotos a where a.foto_path = objects.name)
      or exists (select 1 from public.bebes b       where b.foto_path = objects.name)
    )
  );

-- ---------------------------------------------------------------------
-- 9) E-mail da Thaís (tire os dois traços do começo da linha e troque o e-mail)
-- ---------------------------------------------------------------------
-- insert into public.familia_emails (email) values ('email-da-thais@gmail.com') on conflict do nothing;

-- Pronto! Deve aparecer "Success. No rows returned".
