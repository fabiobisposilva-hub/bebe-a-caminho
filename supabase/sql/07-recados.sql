-- BeBê a CaMinHo · 07 · mural de recados para o bebê
-- Pode rodar mais de uma vez sem problema.
-- Onde: Supabase → SQL Editor → New query → colar tudo → Run.

create table if not exists public.recados (
  id          uuid primary key default gen_random_uuid(),
  familia_id  uuid not null references public.familias(id) on delete cascade,
  texto       text not null check (char_length(btrim(texto)) between 1 and 1000),
  nome        text,                                  -- preenchido pelo banco (cadastro de quem escreveu)
  papel       text,                                  -- parentesco de quem escreveu (Avó, Tia…)
  autor       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  criado_em   timestamptz not null default now()
);
create index if not exists recados_familia on public.recados (familia_id, criado_em desc);

-- o nome e o parentesco vêm sempre do cadastro de quem escreve: ninguém escreve em nome de outra pessoa
create or replace function public.recados_autor() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.autor := auth.uid();
  select p.nome, p.papel into new.nome, new.papel from public.perfis p where p.id = auth.uid();
  new.criado_em := now();
  return new;
end $$;
drop trigger if exists recados_autor on public.recados;
create trigger recados_autor before insert on public.recados
  for each row execute function public.recados_autor();

alter table public.recados enable row level security;

-- ler: quem é aprovado na família (responsáveis e visitantes)
drop policy if exists recados_ver on public.recados;
create policy recados_ver on public.recados for select to authenticated
  using (public.ve_fam(familia_id));

-- escrever: quem é aprovado na família, sempre em nome próprio
drop policy if exists recados_escrever on public.recados;
create policy recados_escrever on public.recados for insert to authenticated
  with check (public.ve_fam(familia_id) and autor = auth.uid());

-- apagar: o próprio recado, ou qualquer um se for responsável (moderação)
drop policy if exists recados_apagar on public.recados;
create policy recados_apagar on public.recados for delete to authenticated
  using (autor = auth.uid() or public.eh_resp(familia_id));

-- sem "update": para corrigir, apaga e escreve de novo
grant select, insert, delete on public.recados to authenticated;
revoke all on public.recados from anon;

-- Pronto! Deve aparecer "Success. No rows returned".
