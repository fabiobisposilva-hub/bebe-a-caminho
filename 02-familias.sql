-- =====================================================================
-- BeBê a CaMinHo – versão 2: várias famílias, com convites e autorização
-- Rodar UMA vez: Supabase → SQL Editor → New query → colar tudo → Run
-- (pode aparecer o aviso de operação "destrutiva": é por causa dos
--  "drop policy if exists", que só recriam regras; nenhum dado é apagado)
-- Desenvolvido por Fabio Bispo · novembro de 2026
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Famílias, membros e convites
-- ---------------------------------------------------------------------
create table if not exists public.familias (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null default '',
  criado_por  uuid default auth.uid() references auth.users(id) on delete set null,
  criado_em   timestamptz not null default now()
);

create table if not exists public.membros (
  familia_id    uuid not null references public.familias(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  papel         text not null check (papel in ('responsavel','visitante')),
  status        text not null default 'pendente' check (status in ('pendente','aprovado','recusado')),
  convidado_por uuid references auth.users(id) on delete set null,
  decidido_por  uuid references auth.users(id) on delete set null,
  decidido_em   timestamptz,
  criado_em     timestamptz not null default now(),
  primary key (familia_id, user_id)
);
create index if not exists membros_user on public.membros (user_id);

create table if not exists public.convites (
  codigo      text primary key,
  familia_id  uuid not null references public.familias(id) on delete cascade,
  papel       text not null check (papel in ('responsavel','visitante')),
  criado_por  uuid default auth.uid() references auth.users(id) on delete set null,
  expira_em   timestamptz not null,
  usos        int not null default 0,
  max_usos    int not null default 1,
  criado_em   timestamptz not null default now()
);

alter table public.bebes          add column if not exists familia_id uuid references public.familias(id) on delete cascade;
alter table public.albuns         add column if not exists familia_id uuid references public.familias(id) on delete cascade;
alter table public.familia_emails add column if not exists familia_id uuid references public.familias(id) on delete cascade;
alter table public.perfis         add column if not exists aceite_privacidade timestamptz;

-- ---------------------------------------------------------------------
-- 2) Migração: o que já existe vira a "Família Bispo Mendonça"
-- ---------------------------------------------------------------------
do $$
declare
  fid  uuid;
  dono uuid;
begin
  if exists (select 1 from public.bebes where familia_id is null)
     or exists (select 1 from public.albuns where familia_id is null)
     or exists (select 1 from public.familia_emails where familia_id is null) then
    select id into dono from public.perfis where email = 'fabiobisposilva@gmail.com';
    select id into fid from public.familias where nome = 'Família Bispo Mendonça' limit 1;
    if fid is null then
      insert into public.familias (nome, criado_por) values ('Família Bispo Mendonça', dono) returning id into fid;
    end if;
    update public.bebes          set familia_id = fid where familia_id is null;
    update public.albuns         set familia_id = fid where familia_id is null;
    update public.familia_emails set familia_id = fid where familia_id is null;
    insert into public.membros (familia_id, user_id, papel, status, decidido_em)
      select fid, p.id,
             case when p.papel_app = 'familia' then 'responsavel' else 'visitante' end,
             p.status, now()
        from public.perfis p
      on conflict do nothing;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 3) Funções de permissão (privilégio próprio, para não entrar em laço)
-- ---------------------------------------------------------------------
create or replace function public.eh_resp(fid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.membros
                  where familia_id = fid and user_id = auth.uid() and papel = 'responsavel' and status = 'aprovado');
$$;
create or replace function public.eh_resp_txt(fid text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.membros
                  where familia_id::text = fid and user_id = auth.uid() and papel = 'responsavel' and status = 'aprovado');
$$;
create or replace function public.ve_fam(fid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.membros
                  where familia_id = fid and user_id = auth.uid() and status = 'aprovado');
$$;
create or replace function public.eh_membro(fid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.membros where familia_id = fid and user_id = auth.uid());
$$;
create or replace function public.fam_bebe(bid uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select familia_id from public.bebes where id = bid;
$$;
create or replace function public.fam_album(aid uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select familia_id from public.albuns where id = aid;
$$;
-- o responsável vê o cadastro de quem pertence às famílias dele
create or replace function public.ve_perfil(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.membros eu join public.membros outro on outro.familia_id = eu.familia_id
                  where eu.user_id = auth.uid() and eu.papel = 'responsavel' and eu.status = 'aprovado'
                    and outro.user_id = uid);
$$;

-- ---------------------------------------------------------------------
-- 4) Gatilhos
-- ---------------------------------------------------------------------
-- quem cria a família já entra como responsável
create or replace function public.familia_criada() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.criado_por is not null then
    insert into public.membros (familia_id, user_id, papel, status, decidido_em)
    values (new.id, new.criado_por, 'responsavel', 'aprovado', now())
    on conflict do nothing;
  end if;
  return new;
end $$;
drop trigger if exists ao_criar_familia on public.familias;
create trigger ao_criar_familia after insert on public.familias
  for each row execute function public.familia_criada();

-- conta nova: cria o cadastro, guarda o aceite da política e, se o e-mail
-- já estava autorizado por uma família (ex.: a Thaís), entra como responsável
create or replace function public.novo_usuario() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  fam boolean;
begin
  fam := exists (select 1 from public.familia_emails where lower(email) = lower(new.email));
  insert into public.perfis (id, email, nome, nasc, papel, vinculo, papel_app, status, aceite_privacidade)
  values (
    new.id,
    lower(new.email),
    coalesce(new.raw_user_meta_data->>'nome', ''),
    nullif(new.raw_user_meta_data->>'nasc', '')::date,
    coalesce(new.raw_user_meta_data->>'papel', ''),
    '',
    case when fam then 'familia' else 'visitante' end,
    case when fam then 'aprovado' else 'pendente' end,
    nullif(new.raw_user_meta_data->>'aceite', '')::timestamptz
  )
  on conflict (id) do nothing;
  insert into public.membros (familia_id, user_id, papel, status, decidido_em)
    select fe.familia_id, new.id, 'responsavel', 'aprovado', now()
      from public.familia_emails fe
     where lower(fe.email) = lower(new.email) and fe.familia_id is not null
  on conflict do nothing;
  return new;
end $$;

create or replace function public.virou_familia() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.perfis set papel_app = 'familia', status = 'aprovado' where lower(email) = lower(new.email);
  if new.familia_id is not null then
    insert into public.membros (familia_id, user_id, papel, status, decidido_em)
      select new.familia_id, p.id, 'responsavel', 'aprovado', now()
        from public.perfis p where lower(p.email) = lower(new.email)
    on conflict (familia_id, user_id) do update set papel = 'responsavel', status = 'aprovado', decidido_em = now();
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------
-- 5) Convites: ver de quem é (antes de entrar) e usar (depois de entrar)
-- ---------------------------------------------------------------------
create or replace function public.info_convite(cod text)
returns table (familia text, papel text, convidado_por text, valido boolean)
language sql stable security definer set search_path = public as $$
  select f.nome, c.papel, coalesce(nullif(split_part(p.nome, ' ', 1), ''), 'a família'),
         (c.expira_em > now() and c.usos < c.max_usos)
    from public.convites c
    join public.familias f on f.id = c.familia_id
    left join public.perfis p on p.id = c.criado_por
   where c.codigo = upper(trim(cod));
$$;

create or replace function public.usar_convite(cod text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  c public.convites%rowtype;
begin
  if auth.uid() is null then raise exception 'Entre na sua conta primeiro.'; end if;
  select * into c from public.convites where codigo = upper(trim(cod)) for update;
  if not found then raise exception 'Convite não encontrado. Confira o código.'; end if;
  if exists (select 1 from public.membros where familia_id = c.familia_id and user_id = auth.uid()) then
    return c.familia_id;
  end if;
  if c.expira_em < now() or c.usos >= c.max_usos then
    raise exception 'Este convite expirou ou já foi usado. Peça um novo.';
  end if;
  insert into public.membros (familia_id, user_id, papel, status, convidado_por)
  values (c.familia_id, auth.uid(), c.papel, 'pendente', c.criado_por);
  update public.convites set usos = usos + 1 where codigo = c.codigo;
  return c.familia_id;
end $$;

-- ---------------------------------------------------------------------
-- 6) Regras de acesso, agora por família
-- ---------------------------------------------------------------------
alter table public.familias enable row level security;
alter table public.membros  enable row level security;
alter table public.convites enable row level security;

drop policy if exists familias_ver on public.familias;
create policy familias_ver on public.familias for select to authenticated
  using (public.eh_membro(id) or criado_por = auth.uid());
drop policy if exists familias_criar on public.familias;
create policy familias_criar on public.familias for insert to authenticated
  with check (criado_por = auth.uid());
drop policy if exists familias_editar on public.familias;
create policy familias_editar on public.familias for update to authenticated
  using (public.eh_resp(id)) with check (public.eh_resp(id));

drop policy if exists membros_ver on public.membros;
create policy membros_ver on public.membros for select to authenticated
  using (user_id = auth.uid() or public.eh_resp(familia_id));
drop policy if exists membros_decidir on public.membros;
create policy membros_decidir on public.membros for update to authenticated
  using (public.eh_resp(familia_id)) with check (public.eh_resp(familia_id));
drop policy if exists membros_sair on public.membros;
create policy membros_sair on public.membros for delete to authenticated
  using (public.eh_resp(familia_id) or user_id = auth.uid());

drop policy if exists convites_resp on public.convites;
create policy convites_resp on public.convites for all to authenticated
  using (public.eh_resp(familia_id)) with check (public.eh_resp(familia_id));

drop policy if exists familia_emails_familia on public.familia_emails;
create policy familia_emails_familia on public.familia_emails for all to authenticated
  using (public.eh_resp(familia_id)) with check (public.eh_resp(familia_id));

drop policy if exists perfis_ver on public.perfis;
create policy perfis_ver on public.perfis for select to authenticated
  using (id = auth.uid() or public.ve_perfil(id));
drop policy if exists perfis_editar on public.perfis;
create policy perfis_editar on public.perfis for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
drop policy if exists perfis_apagar on public.perfis;

drop policy if exists bebes_ver on public.bebes;
create policy bebes_ver on public.bebes for select to authenticated using (public.ve_fam(familia_id));
drop policy if exists bebes_familia on public.bebes;
create policy bebes_familia on public.bebes for all to authenticated
  using (public.eh_resp(familia_id)) with check (public.eh_resp(familia_id));

drop policy if exists registros_ver on public.registros;
create policy registros_ver on public.registros for select to authenticated
  using (public.eh_resp(public.fam_bebe(bebe_id)) or (visivel and public.ve_fam(public.fam_bebe(bebe_id))));
drop policy if exists registros_familia on public.registros;
create policy registros_familia on public.registros for all to authenticated
  using (public.eh_resp(public.fam_bebe(bebe_id))) with check (public.eh_resp(public.fam_bebe(bebe_id)));

drop policy if exists albuns_ver on public.albuns;
create policy albuns_ver on public.albuns for select to authenticated using (public.ve_fam(familia_id));
drop policy if exists albuns_familia on public.albuns;
create policy albuns_familia on public.albuns for all to authenticated
  using (public.eh_resp(familia_id)) with check (public.eh_resp(familia_id));

drop policy if exists album_fotos_ver on public.album_fotos;
create policy album_fotos_ver on public.album_fotos for select to authenticated
  using (public.ve_fam(public.fam_album(album_id)));
drop policy if exists album_fotos_familia on public.album_fotos;
create policy album_fotos_familia on public.album_fotos for all to authenticated
  using (public.eh_resp(public.fam_album(album_id))) with check (public.eh_resp(public.fam_album(album_id)));

drop policy if exists rotina_familia on public.rotina;
create policy rotina_familia on public.rotina for all to authenticated
  using (public.eh_resp(public.fam_bebe(bebe_id))) with check (public.eh_resp(public.fam_bebe(bebe_id)));

grant select, insert, update, delete on public.familias, public.membros, public.convites to authenticated;
revoke all on public.familias, public.membros, public.convites from anon;
grant execute on function public.eh_resp(uuid), public.eh_resp_txt(text), public.ve_fam(uuid), public.eh_membro(uuid),
  public.fam_bebe(uuid), public.fam_album(uuid), public.ve_perfil(uuid), public.usar_convite(text) to authenticated;
grant execute on function public.info_convite(text) to anon, authenticated;
revoke execute on function public.usar_convite(text) from anon;

-- ---------------------------------------------------------------------
-- 7) Fotos: cada família na sua pasta; visitante vê só o liberado
-- ---------------------------------------------------------------------
drop policy if exists fotos_familia   on storage.objects;
drop policy if exists fotos_visitante on storage.objects;

-- responsável: tudo dentro da pasta da família (<id da família>/…)
drop policy if exists fotos_resp on storage.objects;
create policy fotos_resp on storage.objects for all to authenticated
  using (bucket_id = 'fotos' and public.eh_resp_txt(split_part(name, '/', 1)))
  with check (bucket_id = 'fotos' and public.eh_resp_txt(split_part(name, '/', 1)));

-- foto de capa: cada pessoa só a sua (capas/<id da pessoa>/…)
drop policy if exists fotos_capa on storage.objects;
create policy fotos_capa on storage.objects for all to authenticated
  using (bucket_id = 'fotos' and split_part(name, '/', 1) = 'capas' and split_part(name, '/', 2) = auth.uid()::text)
  with check (bucket_id = 'fotos' and split_part(name, '/', 1) = 'capas' and split_part(name, '/', 2) = auth.uid()::text);

-- ver: fotos ligadas a registros, álbuns ou bebês que a pessoa pode ver (vale também para as fotos antigas)
drop policy if exists fotos_ler on storage.objects;
create policy fotos_ler on storage.objects for select to authenticated
  using (
    bucket_id = 'fotos' and (
         exists (select 1 from public.registros r   where r.foto_path = objects.name)
      or exists (select 1 from public.album_fotos a where a.foto_path = objects.name)
      or exists (select 1 from public.bebes b       where b.foto_path = objects.name)
      or exists (select 1 from public.perfis p      where p.capa_path = objects.name and p.id = auth.uid())
    )
  );

-- Pronto! Deve aparecer "Success. No rows returned".
