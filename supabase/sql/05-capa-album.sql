-- BeBê a CaMinHo · 05 · foto de capa de cada álbum
-- Pode rodar mais de uma vez sem problema.
-- Onde: Supabase → SQL Editor → New query → colar tudo → Run.

-- guarda qual foto do álbum é a capa (vazio = a primeira foto, como antes)
alter table public.albuns add column if not exists capa_path text;

-- Nada muda nas permissões: a política albuns_familia (SQL 02) já deixa só os
-- responsáveis aprovados da família alterarem o álbum, e a foto da capa é uma
-- foto do próprio álbum, que a família já pode ver (política fotos_ler).

-- Pronto! Deve aparecer "Success. No rows returned".
