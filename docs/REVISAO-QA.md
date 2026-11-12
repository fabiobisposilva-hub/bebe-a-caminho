# Revisão de qualidade, celular e publicação (12/11/2026)

Revisão feita em três papéis: **QA** (testes e qualidade), **Desenvolvedor mobile** (Android, PWA, telas pequenas)
e **Release** (publicação, lojas, custos e regras para vender). Objetivo do Fabio: testar com a família agora
e, depois, publicar e comercializar.

## Resumo

- **Para testar com a família, o app está pronto.** 43 testes automáticos passam (mais 3 de datas). Num Chromium
  de verdade, com tela de 360 px, nenhuma aba rola para os lados e não houve erro de JavaScript.
- **Para vender, ainda não.** Faltam itens de lei (LGPD), de conta (planos pagos do Supabase), de loja
  (Google Play) e de suporte. Estão na lista "Antes de comercializar", abaixo.

## O que foi feito nesta rodada

| Mudança | Como confere |
|---|---|
| Pré-natal desligado: some a aba, o atalho no Diário, os exames da mãe na agenda e a opção "Mãe · pré-natal" no laudo. Nada foi apagado do banco | Abrir o app: as abas começam em Diário, Rotina, Marcos… sem Pré-natal |
| Capa do álbum: dentro do álbum, "Escolher capa" e tocar na foto. Dá para trocar quantas vezes quiser | Álbuns → abrir um álbum → Escolher capa → tocar numa foto → voltar: a capa mudou |
| Biblioteca do Supabase com versão fixa (2.119.0). Antes vinha sempre a mais nova e podia quebrar o app sozinha | Nada muda para quem usa |

Para religar o Pré-natal no futuro: em `app/index.html`, trocar `const PRENATAL = false;` por `true`.

## Achados, por gravidade

### 🔴 Antes de comercializar (não impede o teste em família)

1. **LGPD: dados de saúde e de criança.** O app guarda dados de saúde (laudos, vacinas, consultas) e de
   bebês. Para a LGPD esses são dados sensíveis (art. 11) e dados de criança (art. 14). A Política de Privacidade
   do app já existe e diz que é uma versão inicial. Antes de vender:
   - revisão por advogado;
   - Termos de Uso;
   - um encarregado de dados (DPO) com e-mail de contato;
   - registro das operações de tratamento.
2. **Excluir conta só por pedido.** A política promete apagar os dados em até 30 dias, mas não existe botão,
   então hoje a exclusão é manual. A Google Play exige um caminho de exclusão de conta, dentro do app e na web.
3. **Supabase grátis não serve para clientes pagantes:**
   - o projeto **pausa depois de 7 dias sem uso**;
   - os limites são pequenos (500 MB de banco, 1 GB de fotos);
   - **não tem backup automático**. Fotos de bebê perdidas não voltam.

   Para vender, o plano Pro (cerca de US$ 25 por mês) tem backup diário. Conferir os valores atuais no site do Supabase.
4. **Repositório público.** Qualquer pessoa vê e pode copiar o código. Não há senhas nele (conferido), mas para
   um produto comercial o certo é deixar privado: GitHub → Settings → Danger Zone → Change visibility.
5. **Marca.** Registrar "BeBê a CaMinHo" no INPI antes de divulgar.
6. **Lojas de aplicativos:**
   - **Google Play:** dá para publicar o PWA como app ("Trusted Web Activity", por exemplo com o PWABuilder).
     É preciso:
     - um arquivo `.well-known/assetlinks.json` no site;
     - a conta de desenvolvedor (US$ 25, paga uma vez);
     - preencher o formulário "Segurança dos dados";
     - o link da Política de Privacidade.

     Se vender assinatura dentro do app, a Google exige o sistema de pagamento dela.
   - **Apple (iPhone):** a App Store costuma recusar apps que são só um site embrulhado. No iPhone, o caminho
     inicial é usar pelo Safari → Compartilhar → Adicionar à Tela de Início. O bom dia por notificação só funciona
     assim e com iOS 16.4 ou mais novo. **"Compartilhar → BeBê a CaMinHo" não existe no iPhone.**
7. **Suporte e monitoramento.** Hoje, se o app der erro no celular de alguém, ninguém fica sabendo. Antes de vender,
   colocar um serviço de registro de erros (por exemplo, o Sentry, que tem plano grátis) e um canal de suporte.

### 🟡 Importante (bom resolver durante o teste em família)

8. **Botões pequenos para o dedo.** Na tela de 360 px, botões como "Registrar", "Editar", "Mudar data",
   "Escolher capa" e "‹ Álbuns" têm menos de 32 px de altura. O Android recomenda 48 px. Funciona, mas quem tem
   dedo grande ou pouca visão (avós) erra o toque. Ajuste só no CSS da classe `.mini` e `.del`.
9. **"Visitante não baixa" tem limite.** A marca-d'água e o bloqueio do toque longo impedem o caminho fácil,
   mas **print de tela sempre funciona**, em qualquer app. Na venda, prometer "dificulta cópias", nunca
   "impede cópias".
10. **Senha de 6 caracteres.** Para produto pago, subir para 8. No Supabase, em **Authentication →
    Sign In / Providers → Email**, ligar **"Confirm email"** e a proteção contra senhas vazadas, se estiver
    disponível no plano.
11. **Bibliotecas da internet sem "integrity" (SRI).** As versões estão fixas (agora todas), mas se o
    jsdelivr fosse invadido, o app carregaria o código alterado. Dá para pôr o código de conferência
    (`integrity="sha384-…"`) nas tags de script.
12. **Sem internet, o app só mostra um aviso.** É de propósito, porque o sw.js não guarda cache. Mas numa
    maternidade com sinal fraco não dá para nem olhar o diário. Avaliar um cache só de leitura no futuro.

### 🟢 Melhorias de processo

13. **Testes rodam só quando alguém lembra.** Sugestão: ligar o GitHub Actions para rodar o `npm test` em todo
    pedido de mudança (pull request). Assim o GitHub mostra ✅ ou ❌ antes do merge.
14. **Testes simulam o navegador (jsdom), não um celular.** Cobrem bem a lógica: login, famílias, visitantes,
    datas das fotos, laudos, bom dia, botão Voltar. Não cobrem: câmera, galeria do Samsung, notificação de
    verdade, instalação do PWA e internet ruim. Isso só se testa no celular, com o roteiro abaixo.
15. **Arquivo único de 370 KB.** Está bem para a família. Para crescer com outros desenvolvedores, vai pesar.
    Não mexer agora (regra do projeto).

## Roteiro de teste em família (celular de verdade)

Cada pessoa marca ✅ ou ❌ e manda print do que deu errado (com modelo do celular e horário).

**Instalação (Fabio e Thaís, Samsung, pelo Chrome)**
- [ ] Abrir https://bb-a-caminho.netlify.app no **Chrome**, menu ⋮ → Instalar app. O ícone aparece na tela.
- [ ] Abrir pelo ícone: sem barra de endereço, nome e ícone certos.
- [ ] Na galeria, segurar uma foto → Compartilhar: aparece **BeBê a CaMinHo**.

**Fotos (o coração do app)**
- [ ] Mandar 3 fotos pela galeria (Compartilhar): a data certa aparece em "Confira as datas".
- [ ] Mandar uma foto que veio do WhatsApp: a data vem do nome (IMG-2026…-WA…).
- [ ] Foto do iPhone (HEIC), se alguém tiver: sobe sem erro.
- [ ] Criar álbum, pôr fotos, **Escolher capa**, trocar a capa de novo, sair e voltar: a capa ficou.
- [ ] Apagar a foto que era a capa: a capa vira a primeira foto.
- [ ] Mandar 10 fotos com internet fraca (4G ruim): termina ou avisa claramente.

**Navegação no Android**
- [ ] Botão Voltar: fecha a janela, depois a foto, depois o álbum, volta ao Diário e só sai no segundo toque.
- [ ] Puxar a tela para baixo atualiza.
- [ ] Nenhuma tela corta texto ou botão (celular pequeno e fonte grande do sistema).
- [ ] O selo do Netlify não cobre nenhum botão.

**Família e privacidade (pedir ajuda a um avô ou avó)**
- [ ] Convite de visitante: a pessoa entra, fica aguardando, o Fabio autoriza.
- [ ] Visitante: vê só o que foi liberado, com marca-d'água, sem Baixar, sem Ajustes, sem Pré-natal.
- [ ] Visitante tenta segurar o dedo na foto: não aparece "Salvar imagem".

**Bom dia (Thaís)**
- [ ] Às 9h chega a notificação. Tocar nela abre o app.
- [ ] Desativar o bom dia: no dia seguinte não chega.

**Segurança**
- [ ] Depois de 30 minutos sem usar, pede senha ou digital.
- [ ] Sair da conta e entrar de novo.

## Checklist de publicação (cada versão nova)

1. `npm test` com tudo passando (o GitHub Actions faria isso sozinho, ver item 13).
2. Se houver SQL novo em `supabase/sql/`, rodar no Supabase **antes** do merge. Nesta versão: **05-capa-album.sql**.
3. Fazer o merge do pedido no GitHub. O Netlify publica em cerca de 1 minuto.
4. Netlify → Deploys: a última publicação aparece como **Published**.
5. No celular: fechar e abrir o app, ou puxar para baixo. Conferir o que mudou.
6. Se der problema: Netlify → Deploys → clicar na publicação anterior → **Publish deploy** volta a versão antiga
   em segundos.
