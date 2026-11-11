-- =====================================================================
-- Troque COLE_AQUI_O_CRON_SECRET pelo CRON_SECRET guardado no arquivo segredos-bom-dia.txt antes de rodar.
-- BeBê a CaMinHo – versão 4: bom dia das 9h para a mãe (notificações)
-- Rodar UMA vez: Supabase → SQL Editor → New query → colar tudo → Run
-- (antes, crie a função "bom-dia" e os segredos, como no passo a passo)
-- Desenvolvido por Fabio Bispo · novembro de 2026
-- =====================================================================

-- 1) Celulares que aceitaram receber o bom dia (um por aparelho)
create table if not exists public.push_subs (
  endpoint    text primary key,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  familia_id  uuid not null references public.familias(id) on delete cascade,
  p256dh      text not null,
  auth        text not null,
  ativo       boolean not null default true,
  criado_em   timestamptz not null default now()
);
alter table public.push_subs enable row level security;

drop policy if exists push_ver on public.push_subs;
create policy push_ver on public.push_subs for select to authenticated using (user_id = auth.uid());
drop policy if exists push_criar on public.push_subs;
create policy push_criar on public.push_subs for insert to authenticated
  with check (user_id = auth.uid() and public.eh_resp(familia_id));
drop policy if exists push_editar on public.push_subs;
create policy push_editar on public.push_subs for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.eh_resp(familia_id));
drop policy if exists push_apagar on public.push_subs;
create policy push_apagar on public.push_subs for delete to authenticated using (user_id = auth.uid());
grant select, insert, update, delete on public.push_subs to authenticated;
revoke all on public.push_subs from anon;

-- 2) Controle para não mandar duas vezes no mesmo dia (só o servidor usa)
create table if not exists public.bomdia_envios (
  endpoint    text not null,
  dia         date not null,
  enviado_em  timestamptz not null default now(),
  primary key (endpoint, dia)
);
alter table public.bomdia_envios enable row level security;
revoke all on public.bomdia_envios from anon, authenticated;

-- 3) Agendador: todo dia às 12:00 UTC = 9h em Brasília
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;

-- senha do agendador, guardada no cofre do banco (a mesma do segredo CRON_SECRET da função)
select vault.create_secret('COLE_AQUI_O_CRON_SECRET', 'bomdia_cron_secret')
 where not exists (select 1 from vault.secrets where name = 'bomdia_cron_secret');

select cron.unschedule('bom-dia-9h') where exists (select 1 from cron.job where jobname = 'bom-dia-9h');
select cron.schedule('bom-dia-9h', '0 12 * * *', $cron$
  select net.http_post(
    url     := 'https://bzauxpdymyegjsmvjjmb.supabase.co/functions/v1/bom-dia',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'bomdia_cron_secret')),
    body    := '{}'::jsonb
  );
$cron$);

-- Pronto! Para conferir o agendamento:  select jobname, schedule from cron.job;
