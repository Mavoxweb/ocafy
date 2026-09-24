import {
  RECURRING_TASKS,
  ROUTINE_TASKS,
  type RecurringTask,
  type RoomId,
  type RoutineTask,
  type TaskCategory,
} from "@ocafy/core";

export const CATEGORY_NAMES: Record<TaskCategory, string> = {
  limpeza: "Limpeza",
  roupa: "Roupas",
  gatos: "Gatos",
  cozinha: "Cozinha",
  organizacao: "Organização",
  manutencao: "Manutenção",
};

export const ROOM_ORDER: RoomId[] = [
  "quarto1",
  "quarto2",
  "sala",
  "cozinha",
  "banheiro",
  "servico",
  "gatos",
  "casa",
];

/** Tarefas geradas por ações do app (não aparecem nas listas de rotina). */
export interface PseudoTask {
  id: string;
  t: string;
  room: RoomId;
  cat: TaskCategory;
  mins: number;
}

export const PSEUDO_TASKS: PseudoTask[] = [
  {
    id: "desc",
    t: "Retirar proteína do congelador",
    room: "cozinha",
    cat: "cozinha",
    mins: 1,
  },
  {
    id: "cozinhar",
    t: "Preparar refeição",
    room: "cozinha",
    cat: "cozinha",
    mins: 30,
  },
  {
    id: "escritorio",
    t: "Objetivo do escritório",
    room: "quarto2",
    cat: "organizacao",
    mins: 75,
  },
];

export type AnyTask = RoutineTask | RecurringTask | PseudoTask;

export const TASK_MAP: Record<string, AnyTask> = Object.fromEntries(
  [...ROUTINE_TASKS, ...RECURRING_TASKS, ...PSEUDO_TASKS].map((t) => [t.id, t]),
);

export const SLOT_INFO = {
  almoco: { name: "Almoço", label: "Almoço (12h)" },
  jantar: { name: "Jantar", label: "Jantar (19h30)" },
} as const;

/* ---------- Projeto Escritório ---------- */
export interface OfficeGoal {
  id: string;
  short: string;
  t: string;
  why: string;
  steps: string[];
}

export const OFFICE_GOALS: OfficeGoal[] = [
  {
    id: "o1",
    short: "Abrir caminho",
    t: "Abrir caminho e separar tudo por categoria",
    why: "Antes de decidir qualquer coisa, é preciso enxergar o que existe. Só agrupar, sem abrir caixa ainda.",
    steps: [
      "Liberar a passagem da porta até a janela",
      "Agrupar as caixas por tipo: documentos, eletrônicos, roupas, cozinha, diversos",
      "Escrever com caneta o conteúdo por fora de cada caixa",
      "Montar 4 estações no chão: Fica, Doar, Vender, Lixo",
    ],
  },
  {
    id: "o2",
    short: "Caixas — parte 1",
    t: "Abrir e esvaziar metade das caixas fechadas",
    why: "Regra do toque único: cada item que sai da caixa recebe um destino na hora. Nada volta para a caixa “para ver depois”.",
    steps: [
      "Começar pelas caixas menores (vitórias rápidas dão ritmo)",
      "Cada item vai direto para uma das 4 estações",
      "Cadastrar no inventário o que for ficar",
      "Levar o lixo embora no mesmo dia",
    ],
  },
  {
    id: "o3",
    short: "Caixas — parte 2",
    t: "Esvaziar o restante das caixas",
    why: "Terminar a triagem tira o peso visual do cômodo — a partir daqui, ele deixa de ser depósito.",
    steps: [
      "Abrir todas as caixas que sobraram",
      "Separar o que pertence a outros cômodos e levar para o lugar certo",
      "Desmontar e descartar as caixas vazias (guardar no máximo 2)",
      "Cadastrar no inventário o que for ficar",
    ],
  },
  {
    id: "o4",
    short: "Catalogar",
    t: "Catalogar os itens que ficam",
    why: "Saber o que você tem evita comprar repetido e mostra de quanto espaço de armazenamento o escritório vai precisar.",
    steps: [
      "Revisar o inventário e completar o que faltou",
      "Conferir a categoria de cada item",
      "Guardar documentos importantes numa pasta única",
      "Anotar o que falta para o escritório (gaveteiro, prateleira, luminária)",
    ],
  },
  {
    id: "o5",
    short: "Desapegar",
    t: "Desfazer-se de itens inúteis",
    why: "Item que saiu da caixa mas não saiu de casa volta a virar bagunça. Dê prazo: o que não vender em 2 semanas vai para doação.",
    steps: [
      "Levar as doações a um ponto de coleta ou instituição",
      "Anunciar os itens de venda (fotos no mesmo dia)",
      "Levar eletrônicos e pilhas a um ponto de descarte correto",
      "Ver se algo marcado como “fica” pode sair também",
    ],
  },
  {
    id: "o6",
    short: "Limpeza pesada",
    t: "Limpeza profunda do quarto vazio",
    why: "É a única vez que o cômodo vai estar vazio. Limpe de cima para baixo, seco antes do molhado.",
    steps: [
      "Tirar teias e pó do teto, cantos e luminária",
      "Verificar e tratar mofo nas paredes e atrás de onde ficavam as caixas",
      "Limpar janela, rodapés e tomadas",
      "Aspirar e lavar o chão",
    ],
  },
  {
    id: "o7",
    short: "Montar o escritório",
    t: "Posicionar mesa, cadeira e iluminação",
    why: "Mesa perto da janela com a luz vindo de lado reduz reflexo na tela e cansaço visual. A tela fica na altura dos olhos, a um braço de distância.",
    steps: [
      "Posicionar a mesa com a luz natural de lado",
      "Ajustar cadeira e altura da tela",
      "Organizar os cabos (fita, canaleta ou abraçadeiras)",
      "Garantir luz de trabalho para a noite",
    ],
  },
  {
    id: "o8",
    short: "Arrumar a mesa",
    t: "Arrumar a mesa e o armazenamento",
    why: "Na mesa fica só o que você usa todo dia. O resto ganha um lugar fixo e com etiqueta.",
    steps: [
      "Deixar na mesa só o essencial do dia a dia",
      "Montar o sistema de papéis: Entrada, Ação, Arquivo",
      "Distribuir os itens do inventário em gavetas e prateleiras",
      "Etiquetar caixas organizadoras e gavetas",
    ],
  },
  {
    id: "o9",
    short: "Toque final",
    t: "Toque final e regra de manutenção",
    why: "Um cômodo organizado só continua assim com uma regra simples: nada entra sem ter um lugar.",
    steps: [
      "Colocar os toques pessoais (planta, quadro, tapete)",
      "Combinar a regra: nada entra no escritório sem lugar definido",
      "Fazer um reset de 2 minutos na mesa ao fim do dia",
      "Tirar uma foto de “antes e depois”",
    ],
  },
];

export const OFFICE_GOAL_XP = 80; // 5 + 75 min do pseudo-tarefa "escritorio"

export const INVENTORY_DEST = {
  fica: "Fica no escritório",
  outro: "Outro cômodo",
  doar: "Doar",
  vender: "Vender",
  lixo: "Descartar",
} as const;
export type InventoryDest = keyof typeof INVENTORY_DEST;

export const INVENTORY_CATEGORIES = [
  "Documentos",
  "Eletrônicos",
  "Cabos e acessórios",
  "Livros e papelaria",
  "Ferramentas",
  "Decoração",
  "Roupas e tecidos",
  "Cozinha",
  "Diversos",
];

/* ---------- Social & Loja ---------- */
export const REACTIONS = {
  celebrar: { emoji: "🎉", label: "Celebrar" },
  fogo: { emoji: "🔥", label: "Mandou bem" },
  coracao: { emoji: "❤️", label: "Amei" },
  palmas: { emoji: "👏", label: "Palmas" },
} as const;
export type ReactionKey = keyof typeof REACTIONS;

/** 1 moeda da casa a cada 10 XP; a meta semanal da dupla rende bônus para cada um. */
export const XP_PER_COIN = 10;

export const DEFAULT_REWARDS = [
  { title: "Escolher o filme da noite", costCoins: 30, icon: "🎬" },
  { title: "Café da manhã na cama", costCoins: 60, icon: "☕" },
  { title: "Folga da louça (1 dia)", costCoins: 80, icon: "🍽️" },
  { title: "Massagem de 15 minutos", costCoins: 120, icon: "💆" },
  { title: "Escolher o jantar fora", costCoins: 200, icon: "🍝" },
  { title: "Uma manhã de sono até tarde", costCoins: 150, icon: "😴" },
];
