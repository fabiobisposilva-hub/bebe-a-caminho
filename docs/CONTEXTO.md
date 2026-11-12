# Contexto do projeto (até 10/11/2026)

## Quem usa

- **Fabio** (pai, responsável, dono da conta) e **Thaís** (mãe, pediatra, responsável).
- **Bebê:** Maria Bispo Mendonça, menina, data provável do parto 28/01/2027.
- **Família e visitantes:** avós, tios e amigos entram como **visitantes** por convite e precisam ser aprovados.
  Uma pessoa pode estar em mais de uma família (troca pelo seletor).
- **Outros casais** podem criar a própria família e nunca enxergam a dos Bispo.

## O que o app faz hoje

| Aba ou recurso | Resumo |
|---|---|
| Diário | Linha do tempo por mês de gestação e, depois do nascimento, por mês de vida. Botões Editar, Mudar data e Remover em cada registro |
| Histórias | No fim de cada mês, um cartão 📖 conta a história do mês com marcos, consultas, vacinas e fotos. Também há a história da gestação e a de cada ano de vida, e dá para enviar pelo WhatsApp |
| Fotos e álbuns | Fotos soltas e álbuns; a data vem do EXIF/XMP ou do nome do arquivo, sempre confirmada em "Confira as datas". Dá para mudar a data de uma foto ou de todas e apagar o álbum |
| Compartilhar | Na galeria ou no WhatsApp: Compartilhar → BeBê a CaMinHo. Assim chega o nome original da foto, que traz a data |
| Pré-natal | Exames e consultas com anexo (PDF ou foto), guia por trimestre, agenda e lembretes |
| Ler laudo | Lê PDFs com pdf.js (até 60 páginas) e imagens com OCR (tesseract, "por"). Reconhece o formato do Sabin, um exame por bloco. Atualiza o exame marcado em vez de duplicar |
| Rotina, Marcos, Crescimento, Vacinas, Caderneta, Guia | Herdados da primeira versão. Marcos e dentes podem ser editados e apagados |
| Bom dia da mãe | Mensagem às 9h, só para a Thaís, da gestação inteira até 3 meses depois do parto. Tem versos, frases, a "voz" da bebê e dicas com fonte. A primeira aparece no login, depois o app pede permissão, e ela pode cancelar quando quiser |
| Calendário | Depois do nascimento, vacinas e consultas viram arquivo .ics com alarme (e links para o Google Agenda) |
| Segurança | Senha ou digital ao abrir, mas fica destravado por 30 minutos de uso. O botão Voltar fecha a janela, a foto ou o álbum e volta ao Diário; só sai do app no segundo toque |
| Visitantes | Só veem: sem baixar, com marca-d'água, sem Pré-natal |

## Decisões tomadas (não desfazer sem o Fabio pedir)

- Hospedagem e banco **grátis** (Netlify + Supabase); o app não depende do Claude para funcionar.
- No rodapé: "Desenvolvido por Fabio Bispo" e a data de criação.
- Removida a opção "Pelos arquivos" na escolha de fotos.
- **Sem** data por cima das miniaturas dos álbuns (o Fabio não gostou); a data aparece ao abrir a foto.
- **Sem** o ✕ no canto da foto aberta; o Fechar fica embaixo, acima do selo do Netlify.
- O texto não fala mais em "Google Drive" (era da versão antiga, dentro do Claude).
- **Pré-natal desligado** (11/2026), para a versão de teste em família e a comercial: `const PRENATAL = false` no index.html. Os registros antigos continuam no banco.
- **Capa do álbum** escolhida pela família ("Escolher capa" dentro do álbum); sem escolha, é a primeira foto.
- Selo "Powered by Netlify": o Fabio pode desligar em Project configuration → General → Powered by Netlify badge.

## Problemas que já apareceram (para não voltarem)

- **Fotos sem data:** o seletor de fotos do Android troca o nome do arquivo (ex.: `1000012345.jpg`) e tira a data, e o WhatsApp não guarda EXIF.
  Soluções: o Compartilhar, a leitura do nome do arquivo e a confirmação obrigatória da data.
- **Upload que falhava:**
  - "[object Event]" → converter HEIC, com plano B se a conversão falhar.
  - "sem conexão" → tentar de novo 3 vezes.
  - "could not be read" → copiar o arquivo logo depois de escolher.
- **Samsung "não pode instalar":** as tags do manifest estavam fora do `<head>`.
- **Leitura de laudo:**
  - O app lia só 15 páginas.
  - Nomes em maiúsculas com espaçamento quebrado não eram reconhecidos.
  - Depois de ler, o Guia do pré-natal se fechava e parecia que a lista tinha sumido.
- **Bom dia:** quando um envio falhava, o registro de "já enviado" travava as próximas tentativas. Agora ele é apagado quando falha.

## Em aberto ou não testado em celular de verdade

- **Rodar o SQL 05** (`supabase/sql/05-capa-album.sql`) no Supabase, para a capa do álbum funcionar.
- Revisão de QA, celular e publicação em `docs/REVISAO-QA.md`, com o roteiro de teste em família e o que falta para vender.

- "Compartilhar → BeBê a CaMinHo" só aparece se o app for instalado pelo **Chrome**. Pode ser preciso remover e reinstalar o ícone.
  Não foi testado num Samsung de verdade.
- **Bom dia:** é preciso confirmar com o Fabio se ele terminou a configuração:
  1. Criar a função `bom-dia` e os segredos dela.
  2. Rodar o SQL 04, trocando `COLE_AQUI_O_CRON_SECRET` pelo valor que está guardado com ele.
  3. A Thaís ativar o bom dia no celular dela.
- Laudos de outros laboratórios ainda não foram testados (só o Sabin e modelos de teste).
- **Ideia futura do Fabio:** cada família poder guardar as fotos no próprio Google Drive.

## Como publicar uma versão nova

- **Com o repositório ligado ao Netlify:** basta juntar (merge) na branch `main`. O Netlify publica sozinho em cerca de 1 minuto.
- **Sem ligar:** compacte o **conteúdo** da pasta `app/` em .zip e arraste o arquivo no site **bb-a-caminho**, em **Deploys**, no Netlify.
- **Depois de publicar:** no celular, puxe a tela para baixo ou feche e abra o app.
