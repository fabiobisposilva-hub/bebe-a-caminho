# BeBê a CaMinHo — instruções para o Claude

O diário da Maria (DPP 28/01/2027, menina), feito para o Fabio (pai) e a Thaís (mãe, pediatra).
O dono do projeto **não é programador**: explique tudo em português do Brasil, simples, passo a passo,
e diga exatamente onde clicar quando ele precisar fazer algo fora do código (Supabase, Cloudflare, GitHub).

Leia também `docs/CONTEXTO.md`, que conta o que já foi feito, as decisões tomadas e os pontos em aberto.

## Como o app funciona

- **Um app só, sem build.** Tudo fica em `app/index.html` (HTML + CSS + JS num arquivo, cerca de 370 KB).
  Não troque por React, Vite, TypeScript nem outro framework, e não divida o arquivo sem que o Fabio peça.
- **PWA:** `app/manifest.webmanifest` (ícones e o "Compartilhar → BeBê a CaMinHo", via `share_target`)
  e `app/sw.js` (aviso sem internet, recebe fotos compartilhadas, notificação do bom dia). O sw.js não guarda cache.
- **Bibliotecas por CDN** (jsdelivr, com versão fixa): supabase-js v2, pdf.js 3.11.174, tesseract.js 5.1.1, heic2any 0.0.4.
- **Supabase** (projeto `bzauxpdymyegjsmvjjmb`): Postgres com RLS, login por e-mail e senha,
  Storage no bucket `fotos` (`<familia_id>/<pasta>/<uuid>.jpg|pdf`), Edge Function `bom-dia`, pg_cron às 12:00 UTC (9h em Brasília).
  A chave publishable no index.html é pública por natureza; segredos nunca vão para o código.
- **Cloudflare Pages:** publica a pasta `app/` sozinho a cada merge na `main` (sem build). Site: https://bebe-a-caminho.pages.dev
  (Até 11/2026 era o Netlify, em https://bb-a-caminho.netlify.app; saiu porque os créditos grátis acabavam.)

## Pastas

| Pasta | O que tem |
|---|---|
| `app/` | o site publicado: index.html, sw.js, manifest, ícones, mensagens.json, _redirects |
| `supabase/sql/` | estrutura do banco, numerada (01 a 04). Já foram rodadas no Supabase, nessa ordem |
| `supabase/functions/bom-dia/` | Edge Function (Deno) que manda o bom dia das 9h para a mãe |
| `scripts/` | `mensagens_build.py` gera `app/mensagens.json` a partir de `scripts/dados/mensagens-base.json` |
| `tests/` | testes automáticos com jsdom e um Supabase simulado (`smoke.js`, `smoke-datas.js`) |
| `tests/fixtures/privado/` | laudos reais da família. **Fora do Git**; o teste pula quando o arquivo não está lá |
| `docs/` | contexto, passo a passo e o prompt inicial |

## Regras de trabalho

1. **Rode `npm test` antes e depois de cada mudança.** Toda função nova ou bug corrigido ganha um teste em `tests/smoke.js`
   (use os helpers `run`, `btn`, `pickFiles`, `unlock`, `login`, o banco simulado `makeDB` e os modelos de teste existentes).
   Só diga que terminou com todos os testes passando.
2. **Mudanças pequenas e certeiras** no `index.html`: procure a função (por exemplo `renderPrenatal`, `parseLaudo`,
   `openLightbox`, `confirmDates`, `storyFor`, `backStep`) e altere só o necessário. Não reformate o arquivo.
3. **Banco de dados:** nunca altere os arquivos SQL já rodados. Mudança no banco vira um arquivo novo
   (`supabase/sql/05-....sql`) que dá para rodar de novo sem quebrar (`if not exists`, `drop policy if exists`),
   e o Fabio roda à mão no **Supabase → SQL Editor → New query → colar → Run**. Explique isso quando acontecer.
4. **Privacidade é regra de negócio:**
   - Visitantes só veem. Não baixam, não imprimem e não editam, e as fotos levam marca-d'água.
   - Ninguém vê outra família. Toda tabela nova precisa de RLS, usando `eh_resp`, `eh_membro`, `ve_fam` e as funções parecidas.
   - O bom dia vai só para quem tem papel "Mãe" e é responsável aprovada.
5. **Saúde:** dicas, exames e vacinas só com fonte oficial e citada (Caderneta da Gestante e da Criança do Ministério da Saúde,
   SBP, SBIm, calendário do SUS). Nada de achismo. O app não dá orientação médica.
6. **Texto do app** em português do Brasil, carinhoso e curto. Mensagens usam `[a|o]` para o gênero do bebê.
7. **Datas das fotos** são o coração do diário. Elas vêm do EXIF/XMP ou do nome do arquivo
   (`IMG-20260817-WA0001.jpg`, `20260817_143522.jpg`). Nunca use a data do upload sem perguntar (`confirmDates`).
8. **Segredos** (VAPID privada, CRON_SECRET, senha do banco) nunca entram no repositório. Veja `.env.example`.
9. **Celular primeiro:** a família usa Android (Samsung) com o app instalado. Pense no botão Voltar, no puxar para atualizar,
   em telas de 360 px e em internet fraca.
10. **Entrega:** faça commits pequenos com mensagem em português. No fim, explique em poucas linhas o que mudou
    e como o Fabio confere no celular.

## Comandos

```bash
npm install          # uma vez
npm test             # todos os testes (uns 5 minutos)
npm run test:rapido  # só os testes de datas
npm run mensagens    # refaz app/mensagens.json
npm run servir       # abre o app em http://localhost:5173 (usa o Supabase de verdade!)
```
