# Prompt para a primeira sessão no Claude Code

Copie o texto abaixo (entre as linhas) e cole na primeira mensagem da sessão do Claude Code com este repositório.

---

Olá! Este é o projeto **BeBê a CaMinHo**, o diário da minha filha Maria. Eu não sou programador.

Antes de mudar qualquer coisa:
1. Leia o `CLAUDE.md` e o `docs/CONTEXTO.md` inteiros.
2. Rode `npm install` e `npm test` e me diga quantos testes passaram.
3. Me explique em até 10 linhas, em português simples, como o app está organizado e o que você entendeu que está em aberto.

Depois, trabalhe assim em todas as tarefas que eu pedir:
- Faça mudanças pequenas no `app/index.html`, sem trocar a tecnologia nem reformatar o arquivo.
- Para cada correção ou recurso novo, crie um teste em `tests/smoke.js` e rode `npm test` até tudo passar.
- Se precisar mudar o banco, crie um arquivo SQL novo em `supabase/sql/` e me passe o passo a passo para rodar no Supabase.
- Nunca coloque senhas ou chaves secretas no código.
- No fim, me diga em poucas linhas o que mudou e como eu confiro no celular, e faça o commit com mensagem em português.

Minha primeira tarefa é: **[escreva aqui o que você quer, por exemplo: "quando leio o laudo do laboratório X, o exame Y não aparece; segue o PDF em anexo"]**

---

## Exemplos de tarefas para colar no lugar do texto entre colchetes

- "O laudo do Lab X não foi lido. Coloquei o PDF em `tests/fixtures/privado/labx.pdf`. Ajuste a leitura e crie o teste."
- "No Samsung, o Compartilhar → BeBê a CaMinHo não aparece. Revise o manifest e o service worker e me diga o que testar no celular."
- "Quero que o visitante possa curtir uma foto com ❤️. Planeje primeiro (banco, tela e privacidade) e me mostre antes de fazer."
- "Revise o app inteiro procurando erros que podem fazer a gente perder fotos ou datas, e me passe a lista antes de corrigir."
