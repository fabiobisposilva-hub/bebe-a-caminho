-- BeBê a CaMinHo · 06 · lista de presentes de cada família
-- Pode rodar mais de uma vez sem problema.
-- Onde: Supabase → SQL Editor → New query → colar tudo → Run.

-- o link da lista de presentes (Amazon, loja, etc.); vazio = não mostra o cartão
alter table public.familias add column if not exists lista_presentes text;

-- só aceita link seguro (https://), para ninguém colocar um link estranho
alter table public.familias drop constraint if exists familias_lista_presentes_https;
alter table public.familias add constraint familias_lista_presentes_https
  check (lista_presentes is null or lista_presentes ~ '^https://');

-- Nada muda nas permissões: todos da família (responsáveis e visitantes) já leem
-- a família (política familias_ver) e só os responsáveis aprovados alteram (familias_editar).

-- Pronto! Deve aparecer "Success. No rows returned".
