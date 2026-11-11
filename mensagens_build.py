#!/usr/bin/env python3
"""Monta o calendário de mensagens do BeBê a CaMinHo:
   gestação (dia 0 a 294 desde a DUM) e pós-parto (dia 0 a 90 desde o nascimento).
   Cada mensagem tem categoria e janela (semanas na gestação, dias no pós-parto).
   O agendador escolhe, para cada dia, a categoria do padrão e, dentro dela,
   a mensagem cuja janela acaba primeiro (assim as dicas saem na semana certa)."""
import json, re, sys

ex = json.load(open(sys.argv[1], encoding="utf-8"))
OUT = sys.argv[2]

FONTES = {
  "cad": "Caderneta Brasileira da Gestante 2026 (Ministério da Saúde)",
  "vac": "Calendário de Vacinação da Gestante (Ministério da Saúde, 2026)",
  "crianca": "Caderneta da Criança, 6ª edição (Ministério da Saúde)",
  "vacc": "Calendário Nacional de Vacinação 2026 – Criança (Ministério da Saúde)",
  "cab33": "Cadernos de Atenção Básica nº 33 – Saúde da criança (Ministério da Saúde)",
}

G = []  # gestação: dict(t, k, w=(semana_min, semana_max), f)
def g(t, k, w=(0, 42), f=None): G.append({"t": t, "k": k, "w": w, "f": f})

# ---------------------------------------------------------------- frases e versos que já existiam
LATE = re.compile(r"chut|pezinho|mexid|dan[cç]ando|solu[cç]o|virada|barriga redonda|barriga pesa|p[eé]s inchados|m[aã]o na barriga|dance devagar com a barriga")
FINAL = re.compile(r"reta final|faltam poucos|sonho mais perto|antes de conhecer o seu rosto|perto do abra[cç]o|dia a menos para o abra[cç]o|abra[cç]o mais esperado")
for t in ex["frases"]:
    low = t.lower()
    w = (30, 42) if FINAL.search(low) else (18, 42) if LATE.search(low) else (0, 42)
    g(t, "verso" if "\n" in t else "frase", w)

# dicas que já existiam: janelas pela semana em que fazem sentido
JAN = [
  (r"movimentos do beb", (20, 42)), (r"VSR", (30, 36)), (r"entre 28 e 36 semanas", (27, 35)), (r"a partir de 36 semanas", (34, 40)),
  (r"acompanhante|ao seu lado durante todo o parto", (28, 42)), (r"plano de parto", (28, 40)), (r"dificuldade para dormir", (27, 42)),
  (r"amamenta|plantas passam para o leite|intervalos para amamentar", (30, 42)), (r"licen[cç]a-maternidade", (24, 42)),
  (r"no m[ií]nimo 7 consultas", (4, 30)), (r"press[aã]o mais alta|inchaço repentino|vis[aã]o|est[oô]mago", (16, 42)),
]
for d in ex["dicas"]:
    w = (4, 42)
    for rx, jw in JAN:
        if re.search(rx, d["t"], re.I): w = jw; break
    g(d["t"], "dica", w, d["f"])

# ---------------------------------------------------------------- novas dicas na semana certa
g("Quanto antes começar o pré-natal, melhor. Os primeiros exames incluem hemograma, tipagem sanguínea, glicemia, testes de sífilis, HIV e hepatites, toxoplasmose e urina.", "dica", (4, 10), "cad")
g("O primeiro ultrassom obstétrico é feito, de preferência, entre 7 e 12 semanas.", "dica", (6, 12), "cad")
g("A partir de 20 semanas já pode tomar a dTpa (difteria, tétano e coqueluche): uma dose a cada gestação.", "dica", (20, 26), "vac")
g("Entre 24 e 28 semanas é a hora da curva glicêmica (TOTG 75 g). Converse com a equipe para marcar.", "dica", (22, 28), "cad")
g("A partir de 28 semanas já pode tomar a vacina do VSR, que protege o bebê desde o comecinho da vida. Uma dose por gestação.", "dica", (28, 32), "vac")
g("No 3º trimestre os exames se repetem: hemograma, glicemia, sífilis, HIV, urina e urocultura.", "dica", (28, 36), "cad")

# ---------------------------------------------------------------- 1º trimestre
for t in [
  "A notícia chegou e o mundo mudou de cor. Bem-vinda a essa nova fase, mamãe.",
  "O comecinho é cheio de dúvidas, e tudo bem. Ninguém começa sabendo.",
  "Por fora, quase nada mudou. Por dentro, começou o maior milagre.",
  "Uma vida pequenininha, um amor do tamanho do mundo.",
  "Guarde este comecinho: um dia você vai lembrar dele com saudade.",
  "Seu coração já aprendeu a bater por dois.",
  "A espera começou, e com ela a mãe que existe em você.",
  "Não tem pressa: cada semana vai mostrar um pouquinho mais desse amor.",
  "Primeiro trimestre: tempo de descobertas, de sonhos e do primeiro ultrassom.",
  "Se o cansaço apertar nestas primeiras semanas, descanse sem culpa: o seu corpo está trabalhando dobrado.",
]: g(t, "frase", (4, 13))

# ---------------------------------------------------------------- voz do bebê na gestação ([a|o] = menina|menino)
VOZ_G = [
  ((4,13), "Mamãe, eu ainda sou do tamanho de um grãozinho, mas já ocupo o seu coração inteiro."),
  ((4,13), "Mamãe, se hoje bater o cansaço, descansa comigo. Eu cresço melhor quando você está bem."),
  ((4,13), "Mamãe, eu ainda sou bem pequenininh[a|o], mas já sei que tenho a melhor casa do mundo: você."),
  ((4,13), "Mamãe, você ainda não me sente, mas eu já estou aqui, crescendo um pouquinho a cada dia."),
  ((5,14), "Mamãe, sei que o enjoo não é fácil. Obrigad[a|o] por aguentar tudo isso por mim."),
  ((5,13), "Mamãe, meu coraçãozinho começou a bater pertinho do seu. Que lugar bom de morar!"),
  ((4,13), "Mamãe, quando você pensa em mim, eu acho que sinto. Pensa mais vezes?"),
  ((4,14), "Mamãe, não precisa ter todas as respostas agora. A gente vai aprendendo junt[as|os]."),
  ((4,13), "Mamãe, hoje eu ganhei mais um pedacinho de mim. Estou me formando com todo o carinho."),
  ((5,14), "Mamãe, pode contar a novidade para quem você ama. Eu quero que o mundo inteiro saiba que estou chegando."),
  ((5,12), "Mamãe, o primeiro ultrassom vai ser o nosso primeiro encontro. Já estou me arrumando!"),
  ((4,14), "Mamãe, se der medo, coloca a mão na barriga: eu estou aqui com você."),
  ((4,14), "Mamãe, cada copo d'água, cada refeição, cada descanso: eu agradeço daqui."),
  ((4,14), "Mamãe, eu já sou muito amad[a|o], e ainda nem tenho rostinho. Imagina quando eu chegar!"),
  ((4,14), "Mamãe, você está fazendo um trabalho enorme e invisível. Eu sei de tudo, e te agradeço."),
  ((4,14), "Mamãe, deixa quem te ama cuidar de você hoje. Eu peço por nós."),
  ((4,14), "Mamãe, tem dias que você vai se sentir diferente. Tudo bem: o seu corpo está fazendo espaço para mim."),
  ((4,14), "Mamãe, eu ainda nem sei o meu nome, mas já sei de cor a batida do seu coração."),
  ((4,14), "Mamãe, hoje eu cresci um pouquinho. Você cresceu também: em coragem."),
  ((4,14), "Mamãe, tira um tempinho só pra você hoje. Eu fico quietinh[a|o] aqui esperando."),
  ((4,14), "Mamãe, o nosso amor começou antes de eu ter mãozinhas para te abraçar."),
  ((4,14), "Mamãe, eu já tenho um lugar especial no mundo: dentro de você."),
  ((4,14), "Mamãe, obrigad[a|o] por me esperar e por me cuidar desde agora."),
  ((4,14), "Mamãe, ainda estou no comecinho, mas já tenho certeza: você vai ser a melhor mãe pra mim."),
  ((11,14), "Mamãe, o primeiro trimestre está quase acabando. A gente já passou pela primeira fase junt[as|os]!"),
  ((18,27), "Mamãe, estou muito feliz por estar sendo gerad[a|o] por você. Aquele chutinho de hoje foi um oi!"),
  ((18,40), "Mamãe, eu já escuto a sua voz. Conversa comigo? É o meu som preferido."),
  ((18,30), "Mamãe, você sentiu? Fui eu, dando uma cambalhota de felicidade."),
  ((14,22), "Mamãe, a barriga apareceu! É o mundo inteiro vendo que eu estou chegando."),
  ((16,30), "Mamãe, hoje eu treinei abrir e fechar as mãozinhas. Estou ensaiando pra segurar o seu dedo."),
  ((18,23), "Mamãe, no ultrassom eu vou estar fazendo pose pra você. Capricha no sorriso também!"),
  ((18,40), "Mamãe, quando você canta, eu fico quietinh[a|o] ouvindo. Canta mais uma?"),
  ((14,40), "Mamãe, eu sinto quando você está calma. Respira fundo comigo agora."),
  ((18,26), "Mamãe, estou crescendo tanto que já dá pra você me sentir. Chegou a melhor fase!"),
  ((20,40), "Mamãe, hoje eu dei um soluço. Ficou engraçado? Estou só treinando pra respirar um dia."),
  ((20,40), "Mamãe, cada mexidinha minha é um jeito de dizer: estou bem, estou aqui, te amo."),
  ((20,40), "Mamãe, quando você coloca a mão na barriga, eu chego pertinho dela. Percebeu?"),
  ((20,40), "Mamãe, eu já reconheço as vozes que conversam com a gente todo dia. Diz pra eles que eu também já gosto deles."),
  ((19,21), "Mamãe, metade do caminho já foi! E eu estou adorando cada dia aqui com você."),
  ((14,30), "Mamãe, o seu corpo está mudando por minha causa. Obrigad[a|o] por me dar tanto espaço."),
  ((14,40), "Mamãe, não liga para os palpites. Ninguém me conhece como você."),
  ((18,40), "Mamãe, hoje faça algo que você ama. Quando você está feliz, eu danço aqui dentro."),
  ((14,40), "Mamãe, eu sou pequenininh[a|o], mas já tenho um amor gigante por você."),
  ((18,40), "Mamãe, a gente já se entende sem palavras. Que dupla!"),
  ((18,40), "Mamãe, eu adoro quando você ri. A barriga balança e eu fico feliz."),
  ((16,40), "Mamãe, você está linda. Eu sei porque todo mundo fala, e eu escuto tudo daqui."),
  ((14,40), "Mamãe, vai com calma hoje. Eu não tenho pressa: tenho você."),
  ((14,40), "Mamãe, sabe aquele dia difícil? Eu estava aqui o tempo todo, torcendo por você."),
  ((14,40), "Mamãe, você está me ensinando a primeira lição: amar antes de ver."),
  ((22,40), "Mamãe, aguenta firme as costas cansadas. Daqui a pouco eu vou te dar o abraço mais gostoso do mundo."),
  ((25,28), "Mamãe, o segundo trimestre está acabando e eu estou ficando forte. Graças a você."),
  ((16,40), "Mamãe, eu já sou um pedacinho de você flutuando por aí."),
  ((14,40), "Mamãe, quando chove lá fora, aqui dentro é sempre dia de sol."),
  ((14,40), "Mamãe, eu já gosto de tudo que você gosta. Coloca aquela música hoje?"),
  ((16,40), "Mamãe, enquanto você dorme, eu fico aqui sonhando com o dia de te ver."),
  ((30,42), "Mamãe, não vejo a hora de te conhecer. Falta pouquinho para o nosso abraço."),
  ((28,42), "Mamãe, você é uma guerreira. Eu sinto a sua força daqui de dentro."),
  ((28,42), "Mamãe, eu vou ser o seu maior amor do mundo, e você já é o meu."),
  ((30,42), "Mamãe, não vejo a hora de você me ensinar tudo o que sabe. Mas antes, eu quero só o seu colo."),
  ((30,42), "Mamãe, está ficando apertadinho aqui, mas é o lugar mais gostoso do mundo."),
  ((28,42), "Mamãe, eu já estou treinando abrir os olhinhos. O primeiro rosto que eu quero ver é o seu."),
  ((32,40), "Mamãe, a mala está pronta? Eu já estou ficando ansios[a|o] também!"),
  ((28,42), "Mamãe, quando eu chegar, vou reconhecer a sua voz no meio de todo mundo."),
  ((28,42), "Mamãe, descansa os pés hoje. Eu peço com carinho."),
  ((28,42), "Mamãe, cada noite mal dormida vai virar uma manhã com o meu sorriso."),
  ((36,42), "Mamãe, eu não sei quando vou chegar, mas sei que vou chegar direto pro seu coração."),
  ((32,40), "Mamãe, falta tão pouco! Já estou me ajeitando aqui dentro pra te encontrar."),
  ((34,42), "Mamãe, você foi tão forte até aqui. Agora é só mais um pouquinho."),
  ((34,42), "Mamãe, o primeiro choro que você ouvir vai ser o meu jeito de dizer: cheguei!"),
  ((30,42), "Mamãe, tenho tanta coisa pra te mostrar: meu cheirinho, minhas mãozinhas, meu jeitinho."),
  ((30,42), "Mamãe, quero dormir no seu peito ouvindo o mesmo coração que eu ouço agora."),
  ((32,42), "Mamãe, pode ter medo, tá? Eu também tenho um pouquinho. Mas junt[as|os] vai dar tudo certo."),
  ((36,42), "Mamãe, a gente vai se conhecer no dia certo. O meu relógio é o seu coração."),
  ((34,42), "Mamãe, obrigad[a|o] por todos esses meses de cuidado. Já já eu retribuo com muitos beijos babados."),
  ((34,42), "Mamãe, aproveita esses últimos dias de barriga. Eu também estou aproveitando o seu abraço por dentro."),
  ((28,42), "Mamãe, eu já estou com saudade de um rosto que eu nunca vi: o seu."),
  ((32,42), "Mamãe, você vai me reconhecer na hora. E eu vou te reconhecer pelo cheiro."),
  ((30,40), "Mamãe, o seu corpo está se preparando para me receber. Que corpo incrível!"),
  ((28,40), "Mamãe, eu estou fazendo a minha parte aqui dentro: crescendo, engordando e sonhando com você."),
  ((34,42), "Mamãe, não precisa ser perfeita no dia do parto. Só precisa ser você, e eu vou estar lá."),
  ((28,40), "Mamãe, cada semana que passa é um passo a menos até o seu colo."),
  ((32,42), "Mamãe, lá fora todo mundo está me esperando, mas quem eu mais quero é você."),
  ((28,42), "Mamãe, dorme quando der, come quando tiver fome e pede ajuda sempre. Eu agradeço daqui."),
  ((30,42), "Mamãe, eu já sei a música que você canta. Vai cantar pra mim quando eu chegar?"),
  ((38,42), "Mamãe, pode ser qualquer dia agora. E qualquer dia com você vai ser o mais lindo da minha vida."),
  ((36,42), "Mamãe, quando eu chegar, me segura pertinho: eu vou estar com saudade do seu coração."),
  ((28,42), "Mamãe, você já é a minha pessoa preferida, e eu ainda nem te vi."),
]
for w, t in VOZ_G: g(t, "voz", w)

# ---------------------------------------------------------------- pós-parto (dias 0 a 90)
P = []
def pp(t, k, w=(0, 90), f=None): P.append({"t": t, "k": k, "w": w, "f": f})
for t in [
  "Você conseguiu. Trouxe uma vida ao mundo. Nada vai ser maior do que isso.",
  "Por tantos meses você foi casa. Agora você é colo, e continua sendo tudo.",
  "Seu corpo carregou, protegeu e trouxe ao mundo um amor inteiro. Respeite o tempo dele.",
  "Mãe recém-nascida também precisa de cuidado. Hoje, deixe cuidarem de você.",
  "Não existe manual. Existe você, aprendendo um dia de cada vez, e isso basta.",
  "Cada mamada, cada noite, cada colo: você está fazendo algo enorme.",
  "Você não precisa dar conta da casa. Precisa dar conta de você e do bebê. O resto espera.",
  "A sua força nesses meses inspirou todo mundo à sua volta.",
  "Tudo bem chorar de cansaço e de amor no mesmo dia. Os dois são de verdade.",
  "Você é a pessoa mais importante do mundo para alguém muito pequenininho.",
  "Olhe para o seu bebê e lembre: foi você que fez isso.",
  "Que a sua recuperação seja leve e cercada de carinho.",
  "Mãe também nasce no parto. Seja paciente com essa recém-nascida aí: você.",
  "Seus braços cansados são o lugar preferido do seu bebê.",
  "O que você viveu na gestação merece ser lembrado com orgulho.",
  "Peça ajuda, aceite ajuda, agradeça a ajuda. E descanse.",
  "Não se compare com mães de foto. A sua história é real, e é linda.",
  "Cada dia que passa, você conhece melhor o seu bebê, e o bebê conhece melhor você.",
  "Você foi corajosa antes, durante e depois. E continua sendo, todos os dias.",
  "Durma quando der. Coma quando der. Ria quando der. Um dia de cada vez.",
  "Não existe jeito certo de se sentir agora. Existe o seu jeito, e ele merece acolhimento.",
  "O amor que você deu na barriga agora tem rosto, cheiro e nome.",
  "Toda mãe precisa ouvir: você está indo muito bem.",
  "A casa pode estar bagunçada; o seu coração está cheio. É isso que importa.",
  "Você não está sozinha. Chame quem te faz bem para perto.",
  "Seu bebê não precisa de uma mãe perfeita. Precisa de uma mãe amada e cuidada. Cuide disso também.",
  "Que orgulho de você: dos meses de espera e de cada dia desde que vocês se conheceram.",
]: pp(t, "honra")
pp("Três meses de colo, de noites e de descobertas. Você está construindo o começo de uma vida inteira.", "honra", (80, 90))
for w, t in [((0,90), "Os primeiros meses passam rápido. Guarde um minuto hoje só para olhar o seu bebê e respirar."),
             ((30,90), "Você aprendeu tanto em tão pouco tempo. Que mãe incrível você está se tornando."),
             ((0,90), "Hoje, comemore: vocês viveram mais um dia lindo e cansativo, juntos."),
             ((0,90), "O seu colo virou o lugar preferido de alguém para sempre."),
             ((0,90), "Que você também tenha colo hoje. Mãe merece ser abraçada."),
             ((30,90), "Daqui a pouco as noites ficam mais leves. Até lá, cuide-se com carinho.")]: pp(t, "honra", w)

VOZ_P = [
  ((0,10), "Mamãe, obrigad[a|o] por me carregar com tanto amor por todos aqueles meses. Agora é a minha vez de ficar no seu colo."),
  ((0,90), "Mamãe, não vejo a hora de você me ensinar tudo o que sabe. Mas hoje, descansa: eu fico aqui pertinho."),
  ((0,20), "Mamãe, você foi incrível. Cada semana de espera valeu a pena para chegar até aqui."),
  ((0,90), "Mamãe, eu conheço o seu cheiro, a sua voz e o seu coração. Você é o meu lugar seguro."),
  ((7,90), "Mamãe, quando eu choro, não é birra: é o meu jeito de te chamar. Obrigad[a|o] por sempre vir."),
  ((0,35), "Mamãe, eu ainda não sei sorrir de propósito, mas o meu coração já sorri pra você."),
  ((14,90), "Mamãe, hoje eu te olhei bem nos olhos. Viu? Eu já sei quem você é."),
  ((0,90), "Mamãe, o seu colo é melhor que qualquer berço do mundo."),
  ((5,90), "Mamãe, eu sei que você está cansada. Eu prometo crescer bem forte pra te dar muitos abraços."),
  ((0,90), "Mamãe, cada mamada é um abraço que me alimenta."),
  ((3,60), "Mamãe, desculpa as noites acordadas. Eu ainda estou aprendendo que o mundo aqui fora é seguro."),
  ((28,60), "Mamãe, o meu primeiro sorriso de verdade vai ser pra você. Fica de olho!"),
  ((0,60), "Mamãe, quando você canta pra mim, eu reconheço a música da barriga."),
  ((29,31), "Mamãe, hoje eu completei um mês! Obrigad[a|o] por cada minutinho desse primeiro mês."),
  ((59,61), "Mamãe, dois meses de mundo, e o meu mundo inteiro é você."),
  ((88,90), "Mamãe, três meses! Eu cresci, você cresceu, a gente cresceu junt[as|os]."),
  ((10,90), "Mamãe, eu adoro quando você conversa comigo. Continua, que eu estou aprendendo tudo."),
  ((5,90), "Mamãe, deixa outra pessoa me dar colo um pouquinho enquanto você descansa. Eu vou ficar bem."),
  ((3,60), "Mamãe, você não precisa saber de tudo. Eu também estou aprendendo a ser bebê."),
  ((0,60), "Mamãe, segura a minha mãozinha? Eu adoro apertar o seu dedo."),
  ((20,90), "Mamãe, cada dia eu fico um pouquinho mais acordad[a|o] pra te conhecer melhor."),
  ((0,90), "Mamãe, o meu primeiro amor é você, e vai ser pra sempre."),
  ((60,90), "Mamãe, estou descobrindo as minhas mãos. Elas são quase tão interessantes quanto o seu rosto!"),
  ((40,90), "Mamãe, quando você sorri pra mim, eu tento sorrir de volta. É o nosso jogo preferido."),
  ((0,90), "Mamãe, obrigad[a|o] por me esperar, me trazer e me cuidar. Eu tenho a mãe mais linda do mundo."),
  ((60,90), "Mamãe, a gente forma o melhor time. E isso é só o começo."),
  ((30,90), "Mamãe, eu já reconheço o seu jeito de me pegar no colo. É o melhor do mundo."),
  ((45,90), "Mamãe, cada dia eu aprendo uma coisa nova. Hoje aprendi que você é o meu sol."),
  ((30,90), "Mamãe, obrigad[a|o] por ter paciência comigo. Eu estou crescendo graças a você."),
  ((0,90), "Mamãe, quando você me olha, eu me sinto o bebê mais amado do mundo."),
]
for w, t in VOZ_P: pp(t, "voz", w)

DB = [  # cuidados com o bebê, pela idade em dias
  ((0,6), "Nos primeiros dias, o bebê mama de 8 a 12 vezes por dia. Não é preciso fixar horários.", "crianca"),
  ((0,12), "Pega boa: o queixo do bebê encosta na mama e os lábios ficam virados para fora. O bebê fica de frente para você, junto ao corpo, bem apoiado e com os braços livres.", "crianca"),
  ((1,5), "Primeiros dias: confira na caderneta as vacinas do nascimento (BCG e hepatite B) e os testes do pezinho, do olhinho, da orelhinha e do coraçãozinho. O do pezinho é entre o 3º e o 5º dia.", "crianca"),
  ((3,8), "Na primeira semana tem consulta para você e para o bebê: avalia a saúde dos dois e a amamentação.", "crianca"),
  ((0,10), "Coto umbilical: depois do banho, seque e passe só álcool 70%, sem faixas, moedas ou outras coisas. Ele costuma cair até o fim da 2ª semana. Vermelhidão em volta, pus ou mau cheiro: leve o bebê ao serviço de saúde.", "crianca"),
  ((0,10), "Sono seguro: bebê de barriga para cima, sem travesseiro e sem cobertor, com a boca e o nariz livres.", "crianca"),
  ((40,60), "Lembrete de sono seguro: sempre de barriga para cima. Nos primeiros meses, o berço pode ficar ao lado da cama dos pais.", "crianca"),
  ((2,20), "Banho: água morna (teste com a sua mão antes), pouco sabonete neutro, e seque bem as dobrinhas e o umbigo.", "crianca"),
  ((4,40), "Troque as fraldas molhadas ou sujas e limpe, de preferência, com água. Não use talco.", "crianca"),
  ((1,8), "Pele amarelada nas primeiras 24 horas, muito forte, espalhada pelo corpo ou que dura mais de duas semanas: o bebê precisa de avaliação urgente.", "crianca"),
  ((6,30), "Fezes muito claras, que não escurecem, são motivo para procurar o serviço de saúde rapidamente.", "crianca"),
  ((5,20), "Bebê com menos de 2 meses: procure o serviço de saúde na hora se estiver muito molinho, muito sonolento e difícil de acordar, ou se não conseguir mamar.", "crianca"),
  ((15,30), "Bebê com menos de 2 meses com febre (37,5 °C ou mais) ou temperatura baixa (35,5 °C ou menos): procure o serviço de saúde na hora.", "crianca"),
  ((25,45), "Procure atendimento na hora se o bebê tiver dificuldade para respirar ou respiração muito rápida, convulsão, ou manchas avermelhadas ou arroxeadas na pele.", "crianca"),
  ((8,60), "Não conseguiu levar o bebê à urgência? Ligue 192, o Samu.", "crianca"),
  ((8,40), "O choro é um comportamento normal dos bebês, e em geral eles se acalmam no colo. Evite deixar o bebê chorando sozinho.", "crianca"),
  ((2,30), "Bicos, chupetas, protetores de mamilo e mamadeiras podem atrapalhar a amamentação. Na dúvida, converse com a equipe.", "crianca"),
  ((10,50), "Até os 6 meses, o leite materno é o único alimento: não precisa de água, chá ou outro leite.", "crianca"),
  ((0,45), "Aproxime o rosto e converse com o bebê: desde o nascimento, ele reconhece a voz da família e se acalma com ela.", "crianca"),
  ((20,60), "Olhe nos olhos e cante para o bebê: é assim que ele começa a conhecer o mundo e você.", "crianca"),
  ((30,90), "Mostre objetos coloridos a uns 30 cm dos olhos do bebê, mexendo devagar para os lados, para cima e para baixo.", "crianca"),
  ((35,90), "Deite o bebê de barriga para baixo por pouco tempo, sempre com alguém olhando: isso fortalece o pescoço.", "crianca"),
  ((40,90), "Leia e conte histórias para o bebê, mesmo pequenininho. A sua voz é o melhor estímulo.", "crianca"),
  ((26,31), "Chegando 1 mês: hora da consulta de rotina. Leve a caderneta para anotar peso, comprimento e perímetro cefálico.", "cab33"),
  ((52,60), "Aos 2 meses tem vacina: Penta, VIP (poliomielite), rotavírus e pneumocócica. E tem consulta de rotina também.", "vacc"),
  ((50,70), "Na hora da vacina, se puder, amamente: ajuda a acalmar o bebê.", "crianca"),
  ((80,90), "Aos 3 meses tem a vacina meningocócica C. Confira a caderneta.", "vacc"),
]
for w, t, f in DB: pp(t, "dicab", w, f)

DM = [  # cuidados com a mãe no pós-parto
  ((2,7), "São pelo menos duas consultas suas depois do parto: uma na primeira semana após sair da maternidade e outra em torno de 30 dias.", "cad"),
  ((22,30), "Lembrete: a consulta de pós-parto de cerca de 30 dias é para você. Não deixe de ir.", "cad"),
  ((3,40), "A pressão arterial também deve ser medida no pós-parto, mesmo quando você se sente bem.", "cad"),
  ((3,40), "Se não tomou a vacina da gripe ou a dTpa na gestação, elas podem ser aplicadas até 45 dias depois do parto.", "vac"),
  ((5,90), "Tristeza intensa ou que não melhora merece uma conversa com a equipe de saúde. Pedir ajuda é parte do cuidado.", "cad"),
  ((0,30), "O direito a acompanhante também vale no pós-parto, enquanto vocês estiverem na maternidade.", "cad"),
  ((10,90), "A licença-maternidade é de, no mínimo, 120 dias, e há estabilidade no emprego até 5 meses depois do parto.", "cad"),
  ((60,90), "Voltando ao trabalho: até o bebê completar 6 meses, há direito a dois descansos de meia hora (ou um de uma hora) para amamentar.", "cad"),
  ((3,60), "Se usa remédio contínuo, inclusive para a saúde mental, não interrompa por conta própria no pós-parto. Converse com a equipe.", "cad"),
  ((5,90), "Deixe a sua rede de apoio cuidar da casa e de você nos momentos de cansaço. Você não precisa dar conta de tudo sozinha.", "cad"),
  ((10,90), "Algumas plantas passam para o leite: chás e fitoterápicos, só com orientação da equipe.", "cad"),
  ((5,90), "Dúvidas sobre amamentação? A equipe de saúde da UBS pode ajudar. Você não precisa enfrentar isso sozinha.", "cad"),
]
for w, t, f in DM: pp(t, "dicam", w, f)

# ---------------------------------------------------------------- agendador
def schedule(items, ndays, unit_of_day, pattern, narrow):
    """1) dicas com prazo curto: cada uma ganha o primeiro dia livre dentro da sua janela (ordem do prazo);
       2) os demais dias seguem o padrão de categorias, escolhendo a mensagem cujo prazo acaba primeiro."""
    used = [False] * len(items)
    day = [None] * ndays
    TIPS = ("dica", "dicab", "dicam")
    urg = sorted([i for i, m in enumerate(items) if m["k"] in TIPS and narrow(m["w"])], key=lambda i: (items[i]["w"][1], items[i]["w"][0], i))
    for i in urg:
        lo, hi = items[i]["w"]
        free = [d for d in range(ndays) if day[d] is None and lo <= unit_of_day(d) <= hi]
        assert free, ("dica sem dia livre", items[i]["t"])
        day[free[0]] = i; used[i] = True
    for d in range(ndays):
        if day[d] is not None: continue
        u = unit_of_day(d)
        pat = pattern(d) if callable(pattern) else pattern
        want = pat[d % len(pat)]
        def cands(cat):
            return [i for i, m in enumerate(items) if not used[i] and m["w"][0] <= u <= m["w"][1] and (cat is None or m["k"] == cat)]
        c = cands(want) or [i for i in cands(None) if items[i]["k"] not in TIPS] or cands(None)
        assert c, ("faltou mensagem no dia", d)
        i = min(c, key=lambda i: (items[i]["w"][1], i))
        used[i] = True; day[d] = i
    out = [{"t": items[i]["t"], "k": items[i]["k"], **({"f": items[i]["f"]} if items[i].get("f") else {})} for i in day]
    return out, sum(1 for x in used if not x)

gest, sobra_g = schedule(G, 295, lambda d: d // 7, ["verso", "voz", "frase", "dica", "voz", "frase"], lambda w: w[1] - w[0] <= 12)
pos, sobra_p = schedule(P, 91, lambda d: d, lambda d: ["honra", "dicab", "voz", "honra", "dicam", "voz"] if d <= 25 else ["honra", "dicab", "voz", "dicab", "honra", "dicam", "voz"], lambda w: w[1] - w[0] <= 20)
nao_usadas = [m["t"][:70] for m in P if m["k"] in ("dicab", "dicam") and m["t"] not in {x["t"] for x in pos}]
print("dicas do pós-parto que não couberam:", len(nao_usadas)); [print("   -", x) for x in nao_usadas]

# nos primeiros dias depois do parto, cada dica abre com um carinho curto para a mãe
PRE = ["Você conseguiu, mamãe. Que orgulho! 💚", "Primeiros dias: devagar e com muito carinho com você.", "Você está indo muito bem.",
       "Descanse sempre que o bebê descansar.", "Cada mamada é amor. Você é incrível.", "Peça ajuda: hoje e todos os dias.",
       "Seu corpo fez algo enorme. Respeite o tempo dele.", "Mãe recém-nascida também precisa de colo.", "Um dia de cada vez. Você não está sozinha.",
       "Que orgulho de você e dessa nova família.", "Respire fundo: vocês estão aprendendo juntos.", "Hoje, coma bem, beba água e aceite ajuda.",
       "Você é exatamente a mãe que esse bebê precisa."]
n = 0
for d in range(14):
    if pos[d]["k"] in ("dicab", "dicam") and n < len(PRE): pos[d]["pre"] = PRE[n]; n += 1
# checagens: dicas com janela não podem sair fora dela; nada repetido
def check(items, sched, unit):
    seen = set()
    for d, m in enumerate(sched):
        assert m["t"] not in seen, ("repetida", m["t"]); seen.add(m["t"])
        src = next(x for x in items if x["t"] == m["t"])
        u = unit(d); assert src["w"][0] <= u <= src["w"][1], ("fora da janela", d, m["t"])
check(G, gest, lambda d: d // 7); check(P, pos, lambda d: d)

json.dump({"v": 1, "fontes": FONTES, "gest": gest, "pos": pos}, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
from collections import Counter
print("gestação:", len(G), "mensagens,", len(gest), "dias, sobraram", sobra_g, Counter(m["k"] for m in gest))
print("pós-parto:", len(P), "mensagens,", len(pos), "dias, sobraram", sobra_p, Counter(m["k"] for m in pos))
print("voz gestação escritas:", sum(1 for m in G if m["k"] == "voz"), "| pós:", sum(1 for m in P if m["k"] == "voz"))
for d in [0, 30, 60, 100, 133, 140, 150, 160, 170, 196, 200, 210, 230, 260, 280]:
    print(f"  dia {d:3d} (sem {d//7:2d}) [{gest[d]['k']}] {gest[d]['t'][:90]}")
for d in [0, 3, 5, 10, 29, 30, 55, 60, 89, 90]:
    print(f"  pós {d:2d} [{pos[d]['k']}] {pos[d]['t'][:90]}")
