# Passo a passo: o BeBê a CaMinHo no Claude Code

**Como funciona:** o código fica guardado no **GitHub**, um site que guarda projetos e o histórico de cada mudança.
O **Claude Code** abre o projeto de lá, faz as mudanças e roda os testes. Você revisa e aprova.
Se o Netlify estiver ligado ao GitHub, o site atualiza sozinho e você não precisa mais arrastar o zip.

Você precisa de um plano Pro, Max, Team ou Enterprise do Claude.

## Parte 1: criar o repositório no GitHub (uma vez)

1. Entre em **github.com** e crie uma conta grátis (ou entre na sua).
2. Clique em **+** (no alto, à direita) → **New repository**.
3. Preencha assim:
   - **Repository name:** `bebe-a-caminho`
   - Marque **Private**. É muito importante: tem dados da família.
   - Marque **Add a README file**.
   - Clique em **Create repository**.
4. Descompacte o arquivo **bebe-a-caminho-projeto.zip** no seu computador.
5. No repositório, clique em **Add file** → **Upload files**.
6. Abra a pasta descompactada `bebe-a-caminho`, selecione **tudo o que tem dentro dela** e arraste para a página do GitHub.
   Entram as pastas `app`, `docs`, `scripts`, `supabase` e `tests` e os arquivos `CLAUDE.md`, `package.json`, `.gitignore` e os outros.
   Se o README perguntar, pode substituir.
7. Embaixo, clique em **Commit changes**.

> Não suba o `segredos-bom-dia.txt` nem laudos e fotos da família. O laudo do Sabin fica só no seu computador,
> na pasta `tests/fixtures/privado` (essa pasta já está fora do GitHub).

## Parte 2: ligar o Claude Code ao GitHub (uma vez)

1. Entre em **claude.ai/code** com a sua conta do Claude.
2. Quando ele pedir, clique para conectar o GitHub e **autorize**.
3. Como o repositório é privado, instale o **Claude GitHub App**: quando o Claude Code oferecer, aceite,
   ou abra **github.com/apps/claude/installations/new**. Escolha **Only select repositories** → `bebe-a-caminho` → **Install**.
4. O ambiente **Default** é criado sozinho. Deixe como está, porque ele já permite o `npm install`.

## Parte 3: primeira sessão

1. Em **claude.ai/code**, embaixo da caixa de texto, escolha o repositório **bebe-a-caminho** (branch `main`).
2. No modo, escolha **Plan** para ele mostrar o plano antes de mexer, ou **Accept edits** para tarefas simples.
3. Abra o arquivo `docs/PROMPT-INICIAL.md`, copie o texto entre as linhas, troque a tarefa entre colchetes e cole.
4. Envie. O Claude lê o `CLAUDE.md` (as regras do projeto) e o `docs/CONTEXTO.md` (a história do projeto), roda os testes e trabalha.

## Parte 4: aprovar e publicar

1. Quando ele terminar, clique no indicador de mudanças (algo como `+42 -18`) para ver o que mudou.
   Se quiser algum ajuste, escreva na conversa.
2. Clique em **Create PR** e depois, no GitHub, em **Merge pull request** → **Confirm merge**.
3. Publique, de um destes dois jeitos:
   - **Automático (recomendado):** ligue o Netlify ao GitHub uma vez, como na Parte 5. Depois disso, todo merge publica sozinho em cerca de 1 minuto.
   - **Como hoje:** baixe a pasta `app` do GitHub (**Code** → **Download ZIP**, e use só o que está dentro de `app`), compacte e arraste em **Deploys** no Netlify.
4. No celular, puxe a tela para baixo ou feche e abra o app.

## Parte 5: Netlify publicando sozinho (uma vez, opcional)

1. Em **app.netlify.com**, abra o site **bb-a-caminho**.
2. Vá em **Project configuration** → **Build & deploy** → **Continuous deployment** → **Link repository** (ou **Link to Git**).
3. Escolha **GitHub**, autorize e selecione `bebe-a-caminho`.
4. Branch: `main`. Build command: **deixe vazio**. Publish directory: `app`. O arquivo `netlify.toml` já diz isso.
5. Salve. A partir de agora, cada merge na `main` vira uma nova versão do site.

## O que levar de contexto em cada tarefa

| Situação | O que anexar ou dizer |
|---|---|
| Erro no celular | Print da tela, o modelo do celular, o que você tocou e o que esperava |
| Laudo que não foi lido | O PDF ou a foto. Para virar teste, coloque em `tests/fixtures/privado/` no seu computador (no Claude Code na nuvem, só anexe na conversa) |
| Foto com data errada | O nome do arquivo da foto e de onde ela veio (galeria, WhatsApp, câmera) |
| Recurso novo | O que você quer, quem pode ver (pai, mãe, visitante) e um exemplo |
| Saúde | De onde vem a informação: Caderneta do Ministério da Saúde, SBP ou SBIm |

O resto (como o app funciona, o que já foi decidido e o que não pode quebrar) já está no `CLAUDE.md` e no `docs/CONTEXTO.md`.
Quando algo importante for decidido, peça: "atualize o docs/CONTEXTO.md com isso".
