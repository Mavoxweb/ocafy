import { RECURRING_TASKS, ROUTINE_TASKS } from "./catalog";
import type {
  AgeBand,
  DogSize,
  Dwelling,
  HouseMode,
  HouseSize,
  PetSpecies,
  RoomKind,
} from "./profile";
import type { TaskCategory } from "./types";

/**
 * Biblioteca de modelos de tarefa. É DADO (não lógica): cada modelo diz quando se aplica
 * (`when`), quantas vezes aparece (`scope`), quanto tempo leva e qual a janela de dias.
 * O planner (planner.ts) cruza a biblioteca com o perfil da casa.
 */

export type TaskLevel = "core" | "standard" | "extra";
export type TaskScope = "household" | "room" | "pet";

export type HouseFlag =
  | "cooksAtHome"
  | "usesFrozen"
  | "hasWasher"
  | "hasPlants"
  | "hasCar"
  | "officeProject";

export interface Condition {
  all?: Condition[];
  any?: Condition[];
  not?: Condition;
  dwelling?: Dwelling[];
  mode?: HouseMode[];
  hasRoom?: RoomKind;
  hasPet?: PetSpecies;
  /** Há ao menos uma criança com esta faixa etária ou mais. */
  kidMin?: AgeBand;
  flag?: HouseFlag;
  /** Avaliado sobre o pet da instância (escopo "pet"). */
  petSize?: DogSize[];
  petCoat?: "short" | "long";
  petOutdoor?: boolean;
}

export interface TaskTemplate {
  id: string;
  kind: "routine" | "recurring";
  block?: "manha" | "noite";
  title: string;
  /** Título alternativo por modo da casa. */
  titles?: Partial<Record<HouseMode, string>>;
  cat: TaskCategory;
  mins: number;
  minsBySize?: Record<HouseSize, number>;
  minsByPet?: Partial<Record<DogSize, number>>;
  min: number;
  max: number;
  windowByPet?: Partial<Record<DogSize, [number, number]>>;
  day?: number;
  how: string;
  scope: TaskScope;
  roomKind?: RoomKind;
  /** Em quais cômodos do tipo: todos, só o 1º ou só os demais. */
  instances?: "all" | "primary" | "extra";
  species?: PetSpecies;
  /** Grupo de exibição das tarefas de escopo "casa" (padrão: casa toda). */
  group?: "casa" | "pets";
  when?: Condition;
  level: TaskLevel;
  /** Faixa etária a partir da qual uma criança pode fazer a tarefa (ajuda a sugerir quem faz). */
  suitableFrom?: AgeBand;
}

type Meta = Partial<
  Pick<
    TaskTemplate,
    | "scope"
    | "roomKind"
    | "instances"
    | "when"
    | "level"
    | "group"
    | "titles"
    | "minsBySize"
  >
>;

const CAT: Condition = { hasPet: "cat" };
const room = (
  roomKind: RoomKind,
  instances: "all" | "primary" | "extra" = "primary",
  level: TaskLevel = "core",
  when?: Condition,
): Meta => ({
  scope: "room",
  roomKind,
  instances,
  level,
  when,
});
const house = (
  level: TaskLevel = "core",
  when?: Condition,
  extra: Meta = {},
): Meta => ({
  scope: "household",
  level,
  when,
  ...extra,
});

/** Como cada tarefa do catálogo original se comporta no novo modelo (ids e textos preservados). */
const LEGACY: Record<string, Meta> = {
  // rotinas
  m_cama: room("quarto", "primary"),
  m_areia: house("core", CAT, { group: "pets" }),
  m_gatos: house("core", CAT, { group: "pets" }),
  m_louca: room("cozinha"),
  m_congelador: room("cozinha", "primary", "core", { flag: "usesFrozen" }),
  n_louca: room("cozinha"),
  n_bancada: room("cozinha"),
  n_areia: house("core", CAT, { group: "pets" }),
  n_reset: house("core"),
  n_roupas: room("quarto", "primary"),
  n_amanha: room("cozinha", "primary", "core", { flag: "usesFrozen" }),
  // recorrentes
  lixo: house("core"),
  potes_gatos: house("core", CAT, { group: "pets" }),
  aspirar: house("core", undefined, { minsBySize: { s: 15, m: 20, l: 30 } }),
  banheiro_rapido: room("banheiro", "all"),
  roupa_a: house(
    "core",
    { flag: "hasWasher" },
    {
      titles: { solo: "Lavar as roupas", family: "Lavar as roupas da casa" },
    },
  ),
  roupa_b: house("core", {
    all: [{ flag: "hasWasher" }, { mode: ["couple", "family"] }],
  }),
  toalhas: house("core", { flag: "hasWasher" }),
  cama: room("quarto", "all"),
  pano: house("core", undefined, { minsBySize: { s: 15, m: 20, l: 30 } }),
  po: {
    ...room("sala", "primary", "standard"),
    minsBySize: { s: 10, m: 15, l: 20 },
  },
  banheiro: room("banheiro", "all"),
  esponja: room("cozinha"),
  geladeira_rev: room("cozinha", "primary", "standard", {
    flag: "cooksAtHome",
  }),
  cardapio: house("core", { flag: "cooksAtHome" }),
  compras: house("core"),
  mealprep: house("standard", { flag: "cooksAtHome" }),
  lixeiras: room("cozinha", "primary", "standard"),
  fogao: room("cozinha", "primary", "standard"),
  ralos: room("banheiro", "primary", "standard"),
  estofados: room("sala", "primary", "standard"),
  organizar: house("standard"),
  papeis: house("standard"),
  geladeira: room("cozinha", "primary", "standard"),
  teto: house("extra"),
  vidros: house("extra", undefined, { minsBySize: { s: 15, m: 25, l: 40 } }),
  rejunte: room("banheiro", "primary", "extra"),
  ar: room("quarto", "primary", "standard"),
  maquina: house("standard", { flag: "hasWasher" }),
  tapetes: house("extra"),
  manut: house("standard"),
  q2_ventilar: room("quarto", "extra", "standard"),
  escovar_gatos: house("standard", CAT, { group: "pets" }),
  area_troca: house("core", CAT, { group: "pets" }),
  estofados_lav: room("sala", "primary", "extra"),
  travesseiros: room("quarto", "primary", "extra"),
  colchao: room("quarto", "primary", "extra"),
};

const fromLegacy = (): TaskTemplate[] => {
  const out: TaskTemplate[] = [];
  for (const t of ROUTINE_TASKS) {
    const m = LEGACY[t.id];
    out.push({
      id: t.id,
      kind: "routine",
      block: t.r,
      title: t.t,
      cat: t.cat,
      mins: t.mins,
      min: 1,
      max: 1,
      how: t.how,
      scope: "household",
      level: "core",
      ...m,
    });
  }
  for (const t of RECURRING_TASKS) {
    const m = LEGACY[t.id];
    out.push({
      id: t.id,
      kind: "recurring",
      title: t.t,
      cat: t.cat,
      mins: t.mins,
      min: t.min,
      max: t.max,
      ...(t.day != null ? { day: t.day } : {}),
      how: t.how,
      scope: "household",
      level: "standard",
      ...m,
    });
  }
  return out;
};

const DOG: Condition = { hasPet: "dog" };
const walkMins: Partial<Record<DogSize, number>> = {
  mini: 15,
  small: 20,
  medium: 30,
  large: 40,
  giant: 45,
};

/** Tarefas novas: cuidados por pet, tipos de moradia e itens opcionais. */
const NEW_TEMPLATES: TaskTemplate[] = [
  // ---------- cães (por pet) ----------
  {
    id: "dog_walk_am",
    kind: "routine",
    block: "manha",
    title: "Passear com {pet} (manhã)",
    cat: "pets",
    mins: 20,
    minsByPet: walkMins,
    min: 1,
    max: 1,
    scope: "pet",
    species: "dog",
    level: "core",
    how: "Cães precisam gastar energia todo dia. Passeio de manhã reduz destruição e latidos. Leve água e sacolinha.",
  },
  {
    id: "dog_walk_pm",
    kind: "routine",
    block: "noite",
    title: "Passear com {pet} (fim do dia)",
    cat: "pets",
    mins: 20,
    minsByPet: walkMins,
    min: 1,
    max: 1,
    scope: "pet",
    species: "dog",
    level: "core",
    how: "O passeio do fim do dia ajuda o cão a dormir melhor. Porte maior pede passeios mais longos.",
  },
  {
    id: "dog_play",
    kind: "routine",
    block: "noite",
    title: "Brincar com {pet} (gastar energia)",
    cat: "pets",
    mins: 15,
    min: 1,
    max: 1,
    scope: "pet",
    species: "dog",
    when: { petSize: ["large", "giant"] },
    level: "standard",
    how: "Cães grandes têm muita energia: 15 minutos de bolinha, cabo de guerra ou farejar petiscos complementam o passeio.",
  },
  {
    id: "dog_feed_am",
    kind: "routine",
    block: "manha",
    title: "Ração e água fresca para {pet}",
    cat: "pets",
    mins: 3,
    min: 1,
    max: 1,
    scope: "pet",
    species: "dog",
    level: "core",
    how: "Troque a água todo dia e ofereça a ração nos horários combinados com o veterinário.",
  },
  {
    id: "dog_feed_pm",
    kind: "routine",
    block: "noite",
    title: "Jantar do {pet}",
    cat: "pets",
    mins: 2,
    min: 1,
    max: 1,
    scope: "pet",
    species: "dog",
    level: "standard",
    how: "Se ele come duas vezes ao dia, mantenha os horários regulares.",
  },
  {
    id: "dog_poop",
    kind: "recurring",
    title: "Recolher o cocô de {pet} no quintal",
    cat: "pets",
    mins: 5,
    min: 1,
    max: 2,
    scope: "pet",
    species: "dog",
    when: { all: [DOG, { hasRoom: "quintal" }] },
    level: "core",
    how: "Quanto mais rápido recolher, menos cheiro e menos moscas. Lave o local de vez em quando.",
  },
  {
    id: "dog_bowls",
    kind: "recurring",
    title: "Lavar os potes de {pet}",
    cat: "pets",
    mins: 5,
    min: 2,
    max: 3,
    scope: "pet",
    species: "dog",
    level: "standard",
    how: "Potes de ração e água acumulam película de bactérias. Inox ou cerâmica são mais fáceis de manter limpos.",
  },
  {
    id: "dog_bath",
    kind: "recurring",
    title: "Banho em {pet}",
    cat: "pets",
    mins: 30,
    minsByPet: { mini: 20, small: 25, medium: 30, large: 45, giant: 60 },
    min: 14,
    max: 28,
    windowByPet: {
      mini: [21, 28],
      small: [21, 28],
      medium: [14, 28],
      large: [14, 21],
      giant: [14, 21],
    },
    scope: "pet",
    species: "dog",
    level: "standard",
    how: "Use shampoo próprio para cães e seque bem, principalmente as dobrinhas e orelhas. Cães de pelo longo ou que vivem no quintal podem precisar de banho mais frequente.",
  },
  {
    id: "dog_brush",
    kind: "recurring",
    title: "Escovar {pet}",
    cat: "pets",
    mins: 8,
    min: 5,
    max: 8,
    scope: "pet",
    species: "dog",
    when: { petCoat: "short" },
    level: "standard",
    how: "Escovar tira o pelo solto (menos pelo pela casa) e ajuda a notar feridas ou carrapatos.",
  },
  {
    id: "dog_brush_long",
    kind: "recurring",
    title: "Escovar {pet} (pelo longo)",
    cat: "pets",
    mins: 15,
    min: 1,
    max: 2,
    scope: "pet",
    species: "dog",
    when: { petCoat: "long" },
    level: "core",
    how: "Pelo longo embola rápido: escove quase todo dia, do fundo para a ponta, para evitar nós.",
  },
  {
    id: "dog_nails",
    kind: "recurring",
    title: "Cortar as unhas de {pet}",
    cat: "pets",
    mins: 10,
    min: 21,
    max: 35,
    scope: "pet",
    species: "dog",
    level: "standard",
    how: 'Unhas longas atrapalham o andar. Corte só a ponta, longe do "vivo" (parte rosada). Se tiver dúvida, peça ao veterinário.',
  },
  {
    id: "dog_antipulgas",
    kind: "recurring",
    title: "Antipulgas e carrapatos de {pet}",
    cat: "pets",
    mins: 5,
    min: 26,
    max: 35,
    scope: "pet",
    species: "dog",
    level: "standard",
    how: "A frequência depende do produto (mensal, trimestral). Confirme com o veterinário e ajuste a janela.",
  },
  {
    id: "dog_vermifugo",
    kind: "recurring",
    title: "Vermífugo de {pet}",
    cat: "pets",
    mins: 5,
    min: 80,
    max: 100,
    scope: "pet",
    species: "dog",
    level: "standard",
    how: "Em geral a cada 3 meses para adultos; filhotes seguem outro esquema. Confirme com o veterinário.",
  },
  {
    id: "dog_vacina",
    kind: "recurring",
    title: "Vacina anual de {pet}",
    cat: "pets",
    mins: 30,
    min: 330,
    max: 380,
    scope: "pet",
    species: "dog",
    level: "standard",
    how: "Mantenha a carteirinha de vacinação em dia (V10/V8 e antirrábica, conforme o veterinário).",
  },

  // ---------- gatos (casa toda; mantém as chaves antigas) ----------
  {
    id: "cat_nails",
    kind: "recurring",
    title: "Cortar as unhas dos gatos",
    cat: "pets",
    mins: 10,
    min: 14,
    max: 28,
    scope: "household",
    group: "pets",
    when: CAT,
    level: "extra",
    how: "Corte só a pontinha e faça com calma, de preferência depois de brincar.",
  },
  {
    id: "cat_vermifugo",
    kind: "recurring",
    title: "Vermífugo dos gatos",
    cat: "pets",
    mins: 5,
    min: 80,
    max: 100,
    scope: "household",
    group: "pets",
    when: CAT,
    level: "standard",
    how: "Em geral a cada 3 meses para adultos. Confirme com o veterinário.",
  },
  {
    id: "cat_vacina",
    kind: "recurring",
    title: "Vacina anual dos gatos",
    cat: "pets",
    mins: 30,
    min: 330,
    max: 380,
    scope: "household",
    group: "pets",
    when: CAT,
    level: "standard",
    how: "Mantenha a carteirinha em dia (V4/V5 e antirrábica, conforme o veterinário).",
  },

  // ---------- outros pets (por pet) ----------
  {
    id: "bird_feed",
    kind: "routine",
    block: "manha",
    title: "Água e comida para {pet}",
    cat: "pets",
    mins: 3,
    min: 1,
    max: 1,
    scope: "pet",
    species: "bird",
    level: "core",
    how: "Troque a água e retire as sobras de ração e frutas do dia anterior.",
  },
  {
    id: "bird_cage",
    kind: "recurring",
    title: "Limpar a gaiola de {pet}",
    cat: "pets",
    mins: 15,
    min: 2,
    max: 3,
    scope: "pet",
    species: "bird",
    level: "core",
    how: "Troque o forro e limpe poleiros. Uma vez por semana, lave tudo com água e sabão neutro e seque bem.",
  },
  {
    id: "fish_feed",
    kind: "routine",
    block: "manha",
    title: "Alimentar {pet}",
    cat: "pets",
    mins: 2,
    min: 1,
    max: 1,
    scope: "pet",
    species: "fish",
    level: "core",
    how: "Pouca ração, o que comem em ~2 minutos. Excesso suja a água.",
  },
  {
    id: "fish_water",
    kind: "recurring",
    title: "Troca parcial de água do aquário de {pet}",
    cat: "pets",
    mins: 30,
    min: 6,
    max: 8,
    scope: "pet",
    species: "fish",
    level: "core",
    how: "Troque cerca de 20–30% da água com água tratada, sem tirar os peixes.",
  },
  {
    id: "fish_filter",
    kind: "recurring",
    title: "Limpar o filtro do aquário de {pet}",
    cat: "pets",
    mins: 20,
    min: 25,
    max: 35,
    scope: "pet",
    species: "fish",
    level: "standard",
    how: "Enxágue o material filtrante na água do próprio aquário (nunca da torneira) para não matar as bactérias boas.",
  },
  {
    id: "rodent_feed",
    kind: "routine",
    block: "manha",
    title: "Ração, feno e água para {pet}",
    cat: "pets",
    mins: 3,
    min: 1,
    max: 1,
    scope: "pet",
    species: "rodent",
    level: "core",
    how: "Roedores e coelhos precisam de água fresca e, no caso de coelhos, feno à vontade.",
  },
  {
    id: "rodent_bedding",
    kind: "recurring",
    title: "Trocar o forro/maravalha de {pet}",
    cat: "pets",
    mins: 15,
    min: 3,
    max: 5,
    scope: "pet",
    species: "rodent",
    level: "core",
    how: "Forro úmido causa mau cheiro e doenças respiratórias. Retire os cantinhos sujos todo dia.",
  },
  {
    id: "reptile_feed",
    kind: "routine",
    block: "manha",
    title: "Alimentar e checar {pet}",
    cat: "pets",
    mins: 5,
    min: 1,
    max: 1,
    scope: "pet",
    species: "reptile",
    level: "core",
    how: "Confira temperatura, água e alimentação conforme a espécie.",
  },
  {
    id: "reptile_clean",
    kind: "recurring",
    title: "Limpar o terrário de {pet}",
    cat: "pets",
    mins: 25,
    min: 6,
    max: 8,
    scope: "pet",
    species: "reptile",
    level: "core",
    how: "Retire fezes e restos diariamente; faça a limpeza completa toda semana.",
  },
  {
    id: "pet_other_care",
    kind: "routine",
    block: "manha",
    title: "Cuidar de {pet}",
    cat: "pets",
    mins: 5,
    min: 1,
    max: 1,
    scope: "pet",
    species: "other",
    level: "core",
    how: "Alimentação, água e higiene conforme a orientação do veterinário.",
  },

  // ---------- cômodos e tipos de moradia ----------
  {
    id: "lavabo_rapido",
    kind: "recurring",
    title: "Lavabo rápido: vaso, pia e espelho",
    cat: "limpeza",
    mins: 5,
    min: 2,
    max: 4,
    scope: "room",
    roomKind: "lavabo",
    instances: "all",
    level: "core",
    how: "Como é a sala de visitas do banheiro, vale manter sempre apresentável.",
  },
  {
    id: "varanda_limpar",
    kind: "recurring",
    title: "Limpar a varanda",
    cat: "limpeza",
    mins: 15,
    min: 6,
    max: 8,
    scope: "room",
    roomKind: "varanda",
    instances: "all",
    level: "standard",
    how: "Varra, passe pano e confira se o ralo está livre para não empoçar água.",
  },
  {
    id: "quintal_varrer",
    kind: "recurring",
    title: "Varrer o quintal",
    cat: "limpeza",
    mins: 25,
    min: 5,
    max: 7,
    scope: "room",
    roomKind: "quintal",
    instances: "primary",
    level: "standard",
    how: "Folhas acumuladas retêm umidade e atraem insetos.",
  },
  {
    id: "quintal_jardim",
    kind: "recurring",
    title: "Cuidar do jardim",
    cat: "manutencao",
    mins: 20,
    min: 6,
    max: 10,
    scope: "room",
    roomKind: "quintal",
    instances: "primary",
    level: "extra",
    how: "Regue, retire ervas daninhas e pode o que estiver invadindo o caminho.",
  },
  {
    id: "garagem_limpar",
    kind: "recurring",
    title: "Varrer e organizar a garagem",
    cat: "limpeza",
    mins: 20,
    min: 25,
    max: 35,
    scope: "room",
    roomKind: "garagem",
    instances: "primary",
    level: "extra",
    how: "Varra, retire o que não é da garagem e cheque vazamentos de óleo.",
  },
  {
    id: "calcada",
    kind: "recurring",
    title: "Lavar a calçada",
    cat: "limpeza",
    mins: 20,
    min: 12,
    max: 16,
    scope: "household",
    when: { dwelling: ["house", "townhouse"] },
    level: "extra",
    how: "Use pouca água: varrer primeiro e lavar só quando precisar.",
  },
  {
    id: "caixa_dagua",
    kind: "recurring",
    title: "Limpar a caixa d'água",
    cat: "manutencao",
    mins: 60,
    min: 150,
    max: 190,
    scope: "household",
    when: { dwelling: ["house", "townhouse"] },
    level: "standard",
    how: "Recomenda-se a limpeza a cada 6 meses (ou contrate uma empresa especializada). Feche o registro antes.",
  },
  {
    id: "calhas",
    kind: "recurring",
    title: "Limpar calhas e telhado",
    cat: "manutencao",
    mins: 40,
    min: 80,
    max: 100,
    scope: "household",
    when: { dwelling: ["house", "townhouse"] },
    level: "extra",
    how: "Calhas entupidas causam infiltração. Faça com segurança (escada firme, sem chuva) ou contrate.",
  },
  {
    id: "piscina_limpar",
    kind: "recurring",
    title: "Limpar a piscina (peneirar e aspirar)",
    cat: "limpeza",
    mins: 15,
    min: 2,
    max: 4,
    scope: "room",
    roomKind: "piscina",
    instances: "primary",
    level: "core",
    how: "Retire folhas e insetos com a peneira e escove as bordas.",
  },
  {
    id: "piscina_quimica",
    kind: "recurring",
    title: "Conferir pH e cloro da piscina",
    cat: "manutencao",
    mins: 15,
    min: 6,
    max: 8,
    scope: "room",
    roomKind: "piscina",
    instances: "primary",
    level: "standard",
    how: "Meça o pH e o cloro e ajuste conforme o kit. Água desequilibrada favorece algas.",
  },
  {
    id: "escritorio_mesa",
    kind: "recurring",
    title: "Organizar a mesa do escritório",
    cat: "organizacao",
    mins: 10,
    min: 6,
    max: 8,
    scope: "room",
    roomKind: "escritorio",
    instances: "all",
    level: "standard",
    how: "Devolva cada coisa ao lugar e descarte papéis. Ao fim do dia, 2 minutos já bastam.",
  },
  {
    id: "escritorio_po",
    kind: "recurring",
    title: "Tirar o pó do escritório e dos aparelhos",
    cat: "limpeza",
    mins: 10,
    min: 10,
    max: 14,
    scope: "room",
    roomKind: "escritorio",
    instances: "all",
    level: "extra",
    how: "Use microfibra levemente úmida e desligue os aparelhos antes.",
  },
  {
    id: "roupa_lavanderia",
    kind: "recurring",
    title: "Levar e buscar roupas na lavanderia",
    cat: "roupa",
    mins: 40,
    min: 6,
    max: 8,
    scope: "household",
    when: { not: { flag: "hasWasher" } },
    level: "core",
    how: "Combine um dia fixo da semana para não acumular.",
  },
  {
    id: "plants_water",
    kind: "recurring",
    title: "Regar as plantas",
    cat: "manutencao",
    mins: 8,
    min: 2,
    max: 4,
    scope: "household",
    when: { flag: "hasPlants" },
    level: "core",
    how: "Cada planta tem seu ritmo: toque a terra antes de regar. Excesso de água mata mais que falta.",
  },
  {
    id: "plants_care",
    kind: "recurring",
    title: "Adubar e podar as plantas",
    cat: "manutencao",
    mins: 20,
    min: 25,
    max: 35,
    scope: "household",
    when: { flag: "hasPlants" },
    level: "extra",
    how: "Retire folhas secas e adube conforme a espécie.",
  },
  {
    id: "car_wash",
    kind: "recurring",
    title: "Lavar o carro",
    cat: "manutencao",
    mins: 30,
    min: 12,
    max: 16,
    scope: "household",
    when: { flag: "hasCar" },
    level: "extra",
    how: "Lave à sombra e com pouca água; comece pelo teto.",
  },
  {
    id: "car_tires",
    kind: "recurring",
    title: "Calibrar os pneus e conferir o óleo",
    cat: "manutencao",
    mins: 15,
    min: 25,
    max: 35,
    scope: "household",
    when: { flag: "hasCar" },
    level: "standard",
    how: "Calibre com os pneus frios e siga a pressão do manual.",
  },
];

/** Tarefas para crianças: só entram quando a casa tem perfis de criança. */
const KID_TEMPLATES: TaskTemplate[] = [
  {
    id: "kid_brinquedos",
    kind: "routine",
    block: "noite",
    title: "Guardar os brinquedos",
    cat: "organizacao",
    mins: 5,
    min: 1,
    max: 1,
    scope: "household",
    when: { kidMin: "child_4_6" },
    level: "core",
    suitableFrom: "child_4_6",
    how: "Uma caixa para cada tipo de brinquedo ajuda os pequenos a se organizarem sozinhos.",
  },
  {
    id: "kid_cesto",
    kind: "routine",
    block: "noite",
    title: "Colocar a roupa suja no cesto",
    cat: "roupa",
    mins: 2,
    min: 1,
    max: 1,
    scope: "household",
    when: { kidMin: "child_4_6" },
    level: "core",
    suitableFrom: "child_4_6",
    how: "Deixe o cesto no quarto, na altura da criança.",
  },
  {
    id: "kid_mochila",
    kind: "routine",
    block: "noite",
    title: "Arrumar a mochila para o dia seguinte",
    cat: "organizacao",
    mins: 5,
    min: 1,
    max: 1,
    scope: "household",
    when: { kidMin: "child_7_9" },
    level: "standard",
    suitableFrom: "child_7_9",
    how: "Um checklist colado na porta do quarto evita esquecimentos.",
  },
  {
    id: "kid_mesa",
    kind: "routine",
    block: "noite",
    title: "Ajudar a pôr e tirar a mesa",
    cat: "cozinha",
    mins: 6,
    min: 1,
    max: 1,
    scope: "household",
    when: { kidMin: "child_7_9" },
    level: "standard",
    suitableFrom: "child_7_9",
    how: "Comece pelos itens que não quebram e vá aumentando a responsabilidade.",
  },
  {
    id: "kid_quarto",
    kind: "recurring",
    title: "Arrumar o próprio quarto",
    cat: "organizacao",
    mins: 20,
    min: 3,
    max: 7,
    scope: "household",
    when: { kidMin: "child_10_12" },
    level: "standard",
    suitableFrom: "child_10_12",
    how: "Guardar o que está fora do lugar, arrumar a cama e separar o que precisa ir para a lavanderia.",
  },
  {
    id: "kid_banheiro",
    kind: "recurring",
    title: "Limpar a pia e o espelho do banheiro",
    cat: "limpeza",
    mins: 10,
    min: 7,
    max: 10,
    scope: "household",
    when: { kidMin: "teen_13_17" },
    level: "standard",
    suitableFrom: "teen_13_17",
    how: "Use produto suave e pano limpo; luvas ajudam.",
  },
];

/** A partir de qual faixa uma criança pode fazer cada tarefa já existente. */
const SUITABLE: Record<string, AgeBand> = {
  m_cama: "child_4_6",
  n_roupas: "child_4_6",
  plants_water: "child_4_6",
  m_gatos: "child_7_9",
  potes_gatos: "child_7_9",
  lixo: "child_7_9",
  dog_feed_am: "child_7_9",
  dog_feed_pm: "child_7_9",
  dog_bowls: "child_7_9",
  m_louca: "child_10_12",
  n_louca: "child_10_12",
  n_bancada: "child_10_12",
  n_reset: "child_10_12",
  aspirar: "child_10_12",
  m_areia: "child_10_12",
  n_areia: "child_10_12",
  dog_play: "child_7_9",
  dog_walk_am: "teen_13_17",
  dog_walk_pm: "teen_13_17",
  banheiro_rapido: "teen_13_17",
  toalhas: "teen_13_17",
};

export const LIBRARY: TaskTemplate[] = [
  ...fromLegacy(),
  ...NEW_TEMPLATES,
  ...KID_TEMPLATES,
].map((t) =>
  SUITABLE[t.id] && !t.suitableFrom
    ? { ...t, suitableFrom: SUITABLE[t.id] }
    : t,
);

export const LIBRARY_BY_ID: Record<string, TaskTemplate> = Object.fromEntries(
  LIBRARY.map((t) => [t.id, t]),
);
