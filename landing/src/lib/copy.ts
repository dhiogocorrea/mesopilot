import { headers } from "next/headers";

/**
 * Marketing copy, and the two-line locale detection that picks between the
 * versions of it.
 *
 * The app decides language from the athlete's own setting, stored against their
 * account. Nobody here has an account, and the app's locale cookie is scoped to
 * `app.meso505.com`, so this page cannot read it even though the domains are
 * related. `Accept-Language` is what is actually available, and for a choice
 * between two languages on a page with no state it is enough.
 *
 * `Record<Locale, Copy>` keeps the compile-time guarantee the app's flat-key
 * dictionaries were built for: a string added to one language and not the other
 * is a type error, not a missing paragraph in production.
 */

export const LOCALES = ["en", "pt"] as const;
export type Locale = (typeof LOCALES)[number];

export async function detectLocale(): Promise<Locale> {
  const header = (await headers()).get("accept-language") ?? "";
  // Portuguese only when it is the *first* preference. A browser that lists it
  // third is a browser whose owner would rather read English.
  return header.trim().toLowerCase().startsWith("pt") ? "pt" : "en";
}

export type Copy = {
  navSignIn: string;
  navStart: string;
  eyebrow: string;
  headline: [string, string];
  sub: string;
  ctaPrimary: string;
  ctaSecondary: string;
  ctaNote: string;
  howLabel: string;
  howTitle: string;
  steps: [string, string, string][];
  featuresLabel: string;
  featuresTitle: string;
  features: [string, string][];
  programsLabel: string;
  programsTitle: string;
  programsBody: string;
  programsStats: [string, string][];
  programsPoints: [string, string][];
  coachLabel: string;
  coachTitle: string;
  coachBody: string;
  coachPoints: [string, string][];
  coachDemoExercise: string;
  coachDemoEngine: string;
  coachDemoNote: string;
  coachDemoEngineLabel: string;
  coachDemoCoachLabel: string;
  coachDemoDelta: string;
  showcaseLabel: string;
  showcaseTitle: string;
  showcaseBody: string;
  socialLabel: string;
  socialTitle: string;
  socialBody: string;
  bandLabel: string;
  bandTitle: string;
  bandBody: string;
  photoPressAlt: string;
  photoDeadliftAlt: string;
  photoBandAlt: string;
  photoRoomAlt: string;
  closeTitle: string;
  closeBody: string;
  footerNote: string;
};

/**
 * Nothing here claims a user count, a testimonial or a rating. Every figure is
 * a fact about the product that can be checked in the app's repository. Don't
 * add social proof that isn't real.
 */
export const COPY: Record<Locale, Copy> = {
  en: {
    navSignIn: "Sign in",
    navStart: "Get started",
    eyebrow: "Adaptive hypertrophy programming",
    headline: ["Next week is written", "by last week."],
    sub: "Meso505 runs the Renaissance Periodization autoregulation method over the sets you actually logged. Volume climbs when you recover, and backs off when you don't — before the week that would have buried you.",
    ctaPrimary: "Start training",
    ctaSecondary: "I have an account",
    ctaNote: "Free. No card. Your training data is yours.",
    howLabel: "How it works",
    howTitle: "Three things, every session.",
    steps: [
      [
        "Log the set",
        "Weight, reps, reps-in-reserve.",
        "One tap per set, numbers pre-filled from last time so there is always a figure to beat.",
      ],
      [
        "Answer for the muscle",
        "Four questions, once per muscle group.",
        "Soreness, pump, workload, joint pain — asked when you finish that muscle's last set, not after every exercise.",
      ],
      [
        "Get next week",
        "Written the moment you finish.",
        "Sets, loads and effort targets for the same day next week, with the reason for every change in plain words.",
      ],
    ],
    featuresLabel: "What it does",
    featuresTitle: "A coach that shows its working.",
    features: [
      [
        "A real engine, not a rep counter",
        "MEV, MAV and MRV per muscle group. Volume is managed inside your landmarks and effort ramps by dropping reps-in-reserve across the block.",
      ],
      [
        "Deloads you didn't have to plan",
        "The last week of every block comes down on its own, and the engine will call one early when the feedback says you need it.",
      ],
      [
        "Every lift has a demonstration",
        "A curated video where there is one, and a search built from the movement's own name where there is not — which is the one thing that cannot point you at the wrong exercise.",
      ],
      [
        "Mistyped a session? Reopen it",
        "Fix the number and finish again; the week it produced is thrown away and rewritten. Medals you already earned stay earned.",
      ],
      [
        "Swap a lift mid-workout",
        "Rack taken? Substitute inside the muscle group and say whether it is just today or from now on.",
      ],
      [
        "Numbers built for a gym floor",
        "Dark, one-handed, tabular figures that never reflow mid-set. No cheerful illustrations between you and the bar.",
      ],
    ],
    programsLabel: "Where you start",
    programsTitle: "Forty programs, none of them a blank page.",
    programsBody:
      "Answer eight questions about your training and Meso505 ranks the whole library against them — your days per week, the time you have, the equipment you can reach. Pick one and week one is written before you leave the screen.",
    programsStats: [
      ["40", "programs"],
      ["4", "tracks"],
      ["81", "exercises"],
      ["2–6", "days a week"],
    ],
    programsPoints: [
      [
        "Tracks, not just blocks",
        "A track is several mesocycles in order, each changing one thing — volume, frequency or intent. Finish one and the next is offered, already built.",
      ],
      [
        "Every block starts near your MEV",
        "Stock programs open conservatively on purpose. The engine adds volume from there on evidence, which is a better first week than somebody else's guess at your capacity.",
      ],
      [
        "Or build your own",
        "Days, exercises, sets, rep ranges, rest. It then autoregulates exactly like the stock ones, because the engine does not care where the block came from.",
      ],
    ],
    coachLabel: "The coach",
    coachTitle: "An AI that reviews the algorithm, and cannot overrule it.",
    coachBody:
      "Most of what an AI could get wrong about training, it gets wrong quietly. So the coach here runs last: the deterministic engine writes next week from your logged sets, and only then does a language model read the session and argue with it — inside limits it cannot exceed.",
    coachPoints: [
      [
        "Clamped to ±1 set and ±10% load",
        "That is the whole authority it has. A hallucinated number cannot produce an unsafe session, because there is no number it can produce that is far from the engine's.",
      ],
      [
        "It has to explain itself",
        "One sentence, to you, in your language, next to the rule the engine applied. If the two disagree you can see it and decide.",
      ],
      [
        "Optional, and never in the way",
        "With no model configured the app is complete on the engine alone. If the coach fails it is swallowed — a medal or a note arriving late is a non-event next to a session that failed to save.",
      ],
    ],
    coachDemoExercise: "Barbell Bench Press",
    coachDemoEngineLabel: "Engine",
    coachDemoCoachLabel: "Coach",
    coachDemoDelta: "4 → 5 sets",
    coachDemoEngine: "Pump was low and you are under MEV for chest — adding a set.",
    coachDemoNote:
      "Your bench has stalled at 80kg for three weeks while incline kept climbing; take the extra set here rather than on the flyes.",
    showcaseLabel: "The logger",
    showcaseTitle: "Built for the ninety seconds between sets.",
    showcaseBody:
      "Everything you need mid-workout is one thumb away, and everything you don't is somewhere else. The rest timer starts itself, last week's numbers sit under this week's, and the feedback sheet opens the moment a muscle is done.",
    socialLabel: "Friends",
    socialTitle: "Training is easier when someone is watching.",
    socialBody:
      "Add a friend and you each see the other's finished sessions and medals — and nothing else. Bodyweight, injuries, sleep, stress and nutrition never leave your account. Standings rank you and your friends by points, this month or all time.",
    bandLabel: "The method",
    bandTitle: "Hard sets, managed.",
    bandBody:
      "Every muscle has a volume it needs to grow and a volume it cannot recover from. Meso505 keeps you between the two, week after week, using the only evidence that matters — what you actually did and how it actually felt.",
    photoPressAlt: "An athlete under a loaded barbell",
    photoDeadliftAlt: "An athlete curling a barbell",
    photoBandAlt: "An athlete at the bottom of a deadlift",
    photoRoomAlt: "A weights room before anyone arrives",
    closeTitle: "Stop guessing what to do next week.",
    closeBody: "Set up a block in two minutes and let the first session decide the second.",
    footerNote:
      "Meso505 implements the Renaissance Periodization method. It is not affiliated with, or endorsed by, Renaissance Periodization.",
  },
  pt: {
    navSignIn: "Entrar",
    navStart: "Começar",
    eyebrow: "Programação de hipertrofia adaptativa",
    headline: ["A próxima semana vem", "da semana passada."],
    sub: "O Meso505 aplica o método de autorregulação da Renaissance Periodization às séries que você realmente registrou. O volume sobe quando você recupera e recua quando não — antes da semana que ia te enterrar.",
    ctaPrimary: "Começar a treinar",
    ctaSecondary: "Já tenho conta",
    ctaNote: "Grátis. Sem cartão. Seus dados de treino são seus.",
    howLabel: "Como funciona",
    howTitle: "Três coisas, todo treino.",
    steps: [
      [
        "Registre a série",
        "Carga, repetições, RIR.",
        "Um toque por série, com os números da última vez já preenchidos — sempre há uma marca para bater.",
      ],
      [
        "Responda pelo músculo",
        "Quatro perguntas, uma vez por grupo muscular.",
        "Dor, pump, carga de trabalho e dor articular — perguntadas quando você termina a última série daquele músculo, não a cada exercício.",
      ],
      [
        "Receba a próxima semana",
        "Escrita no instante em que você conclui.",
        "Séries, cargas e alvos de esforço para o mesmo dia na semana seguinte, com o motivo de cada mudança em palavras claras.",
      ],
    ],
    featuresLabel: "O que ele faz",
    featuresTitle: "Um treinador que mostra a conta.",
    features: [
      [
        "Um motor de verdade, não um contador",
        "MEV, MAV e MRV por grupo muscular. O volume é gerido dentro dos seus marcos e o esforço sobe reduzindo o RIR ao longo do bloco.",
      ],
      [
        "Deloads que você não precisou planejar",
        "A última semana de cada bloco desce sozinha, e o motor antecipa uma quando o feedback pede.",
      ],
      [
        "Todo exercício tem demonstração",
        "Um vídeo escolhido a dedo quando existe, e uma busca montada com o nome do próprio movimento quando não — que é a única coisa incapaz de te mostrar o exercício errado.",
      ],
      [
        "Errou um número? Reabra o treino",
        "Corrija e conclua de novo; a semana que ele gerou é descartada e reescrita. As medalhas que você já ganhou continuam suas.",
      ],
      [
        "Troque um exercício no meio do treino",
        "Rack ocupado? Substitua dentro do mesmo grupo muscular e diga se é só hoje ou daqui em diante.",
      ],
      [
        "Números feitos para a academia",
        "Escuro, de uma mão só, com algarismos tabulares que não pulam no meio da série. Sem ilustrações fofas entre você e a barra.",
      ],
    ],
    programsLabel: "Por onde começar",
    programsTitle: "Quarenta programas, nenhum deles uma folha em branco.",
    programsBody:
      "Responda oito perguntas sobre o seu treino e o Meso505 ordena a biblioteca inteira em relação a elas — seus dias por semana, o tempo que você tem, os equipamentos que alcança. Escolha um e a primeira semana já está escrita antes de você sair da tela.",
    programsStats: [
      ["40", "programas"],
      ["4", "trilhas"],
      ["81", "exercícios"],
      ["2–6", "dias por semana"],
    ],
    programsPoints: [
      [
        "Trilhas, não só blocos",
        "Uma trilha é uma sequência de mesociclos, cada um mudando uma coisa — volume, frequência ou intenção. Terminou um, o próximo aparece pronto.",
      ],
      [
        "Todo bloco começa perto do seu MEV",
        "Os programas prontos abrem conservadores de propósito. O motor sobe o volume a partir daí com base em evidência, o que é uma primeira semana melhor do que o chute de outra pessoa sobre a sua capacidade.",
      ],
      [
        "Ou monte o seu",
        "Dias, exercícios, séries, faixas de repetição, descanso. Depois ele autorregula igual aos prontos, porque o motor não liga para a origem do bloco.",
      ],
    ],
    coachLabel: "O treinador",
    coachTitle: "Uma IA que revisa o algoritmo e não pode passar por cima dele.",
    coachBody:
      "Quase tudo o que uma IA erraria sobre treino, ela erra em silêncio. Então o treinador aqui roda por último: o motor determinístico escreve a próxima semana a partir das suas séries e só então um modelo de linguagem lê o treino e discorda dele — dentro de limites que não consegue ultrapassar.",
    coachPoints: [
      [
        "Limitado a ±1 série e ±10% de carga",
        "É toda a autoridade que ele tem. Um número alucinado não consegue gerar um treino inseguro, porque não existe número que ele possa gerar longe do que o motor decidiu.",
      ],
      [
        "Ele precisa se explicar",
        "Uma frase, para você, no seu idioma, ao lado da regra que o motor aplicou. Se os dois discordarem, você vê e decide.",
      ],
      [
        "Opcional, e nunca no caminho",
        "Sem nenhum modelo configurado o app funciona inteiro só com o motor. Se o treinador falhar, a falha é engolida — uma medalha ou uma observação atrasada não é nada perto de um treino que não salvou.",
      ],
    ],
    coachDemoExercise: "Supino reto com barra",
    coachDemoEngineLabel: "Motor",
    coachDemoCoachLabel: "Treinador",
    coachDemoDelta: "4 → 5 séries",
    coachDemoEngine: "O pump foi fraco e você está abaixo do MEV de peito — somando uma série.",
    coachDemoNote:
      "Seu supino travou em 80kg por três semanas enquanto o inclinado seguiu subindo; ponha a série extra aqui, não no crucifixo.",
    showcaseLabel: "O registro",
    showcaseTitle: "Feito para os noventa segundos entre as séries.",
    showcaseBody:
      "Tudo o que você precisa no meio do treino está a um polegar de distância, e tudo o que não precisa está em outro lugar. O cronômetro começa sozinho, os números da semana passada ficam abaixo dos de hoje, e o feedback abre assim que o músculo termina.",
    socialLabel: "Amigos",
    socialTitle: "Treinar é mais fácil quando alguém está olhando.",
    socialBody:
      "Adicione um amigo e vocês veem os treinos concluídos e as medalhas um do outro — e nada mais. Peso, lesões, sono, estresse e nutrição nunca saem da sua conta. A classificação ordena você e seus amigos por pontos, no mês ou no geral.",
    bandLabel: "O método",
    bandTitle: "Séries duras, sob controle.",
    bandBody:
      "Todo músculo tem um volume de que precisa para crescer e um volume do qual não consegue se recuperar. O Meso505 mantém você entre os dois, semana após semana, usando a única evidência que importa — o que você fez de verdade e como aquilo realmente foi.",
    photoPressAlt: "Uma atleta com a barra apoiada nas costas",
    photoDeadliftAlt: "Um atleta fazendo rosca com barra",
    photoBandAlt: "Uma atleta na descida do levantamento terra",
    photoRoomAlt: "Uma sala de musculação antes de alguém chegar",
    closeTitle: "Pare de adivinhar o que fazer na próxima semana.",
    closeBody: "Monte um bloco em dois minutos e deixe o primeiro treino decidir o segundo.",
    footerNote:
      "O Meso505 implementa o método da Renaissance Periodization. Não é afiliado nem endossado pela Renaissance Periodization.",
  },
};
