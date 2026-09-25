/**
 * Documentos legais do Ocafy: Termos de Uso e Política de Privacidade.
 *
 * FONTE ÚNICA: as páginas /termos e /privacidade do app e os arquivos docs/legal/*.md são gerados
 * daqui (`pnpm --filter @ocafy/core legal:export`). Não edite os .md à mão.
 *
 * REGRAS DESTE TEXTO
 *  - Só afirma o que o sistema realmente faz (conferido no código) ou o que a lei diz.
 *  - Dados da empresa (razão social, CNPJ, encarregado…) NÃO são inventados: vêm de variáveis de
 *    ambiente e, se faltarem, aparecem como "[a preencher]" (veja `missingControllerFields`).
 *  - Escolhas que dependem de decisão jurídica estão em docs/legal/REVISAO-JURIDICA.md.
 *  - Ao alterar o texto, mude LEGAL_VERSION: quem já aceitou precisará aceitar de novo.
 *
 * ESTE TEXTO É UMA MINUTA. Não substitui a revisão de um(a) advogado(a) brasileiro(a).
 */

export const LEGAL_VERSION = "2026-09-25";

export type LegalDocId = "terms" | "privacy";

export interface LegalSection {
  id: string;
  title: string;
  paragraphs?: string[];
  items?: string[];
}

export interface LegalDoc {
  id: LegalDocId;
  title: string;
  intro: string;
  sections: LegalSection[];
}

/** Identificação do controlador (art. 9º, III, e art. 41 da LGPD). Preenchida por variáveis de ambiente. */
export interface ControllerInfo {
  name: string;
  cnpj: string;
  address: string;
  contactEmail: string;
  dpoName: string;
  dpoEmail: string;
}

export const CONTROLLER_ENV: Record<keyof ControllerInfo, string> = {
  name: "LEGAL_CONTROLLER_NAME",
  cnpj: "LEGAL_CNPJ",
  address: "LEGAL_ADDRESS",
  contactEmail: "LEGAL_CONTACT_EMAIL",
  dpoName: "LEGAL_DPO_NAME",
  dpoEmail: "LEGAL_DPO_EMAIL",
};

export const MISSING = "[a preencher]";

/** Lê os dados do controlador de um objeto de ambiente (process.env). */
export function controllerFromEnv(
  env: Record<string, string | undefined>,
): ControllerInfo {
  const get = (k: keyof ControllerInfo) =>
    (env[CONTROLLER_ENV[k]] ?? "").trim() || MISSING;
  return {
    name: get("name"),
    cnpj: get("cnpj"),
    address: get("address"),
    contactEmail: get("contactEmail"),
    dpoName: get("dpoName"),
    dpoEmail: get("dpoEmail"),
  };
}

/** Campos do controlador que ainda não foram informados (o documento não deve ir a público assim). */
export const missingControllerFields = (c: ControllerInfo): string[] =>
  (Object.keys(c) as (keyof ControllerInfo)[])
    .filter((k) => c[k] === MISSING)
    .map((k) => CONTROLLER_ENV[k]);

/** Troca {{marcadores}} pelos dados do controlador e pela versão. */
export function fillLegal(text: string, c: ControllerInfo): string {
  return text
    .replaceAll("{{controller}}", c.name)
    .replaceAll("{{cnpj}}", c.cnpj)
    .replaceAll("{{address}}", c.address)
    .replaceAll("{{contactEmail}}", c.contactEmail)
    .replaceAll("{{dpoName}}", c.dpoName)
    .replaceAll("{{dpoEmail}}", c.dpoEmail)
    .replaceAll("{{version}}", LEGAL_VERSION);
}

/* ============================================================================================ */
/*  TERMOS DE USO                                                                               */
/* ============================================================================================ */

export const TERMS: LegalDoc = {
  id: "terms",
  title: "Termos de Uso do Ocafy",
  intro:
    "Estes Termos regulam o uso do aplicativo Ocafy. Leia com atenção: ao criar sua conta ou entrar em uma casa e marcar a caixa de aceite, você declara que leu e concorda com eles. Versão {{version}}.",
  sections: [
    {
      id: "quem-somos",
      title: "1. Quem oferece o Ocafy",
      paragraphs: [
        "O Ocafy é oferecido por {{controller}}, CNPJ {{cnpj}}, com endereço em {{address}}. Contato: {{contactEmail}}.",
      ],
    },
    {
      id: "o-que-e",
      title: "2. O que é o Ocafy",
      paragraphs: [
        "O Ocafy é um aplicativo para organizar a rotina de uma casa. Ele monta uma lista de tarefas a partir das informações que você fornece (moradia, cômodos, pets, pessoas), registra o que foi feito, calcula pontos, mantém uma lista de compras e um cardápio, e envia lembretes quando você os ativa.",
        "As sugestões de frequência de tarefas, de cuidados com pets e de organização são orientativas. Elas não substituem a orientação de profissionais (por exemplo, médico-veterinário) nem as instruções de fabricantes.",
      ],
    },
    {
      id: "conta",
      title: "3. Conta e idade mínima",
      items: [
        "A conta é destinada a pessoas maiores de 18 anos ou legalmente capazes.",
        "Você deve informar dados verdadeiros e manter sua senha em sigilo. As ações feitas com sua conta são de sua responsabilidade.",
        "Você pode encerrar sua conta a qualquer momento em Ajustes → Privacidade e dados, ou pedir a exclusão pelos canais indicados na Política de Privacidade.",
      ],
    },
    {
      id: "casas",
      title: "4. Casas, modos e convites",
      items: [
        "Uma casa reúne as pessoas que dividem a rotina. Quem cria a casa é o(a) dono(a). Os modos são Solo, Casal e Família.",
        "Outras pessoas entram por um código de convite, válido por 7 dias. Ao entrar, a pessoa passa a ver os dados compartilhados da casa: tarefas, pontos, lista de compras, cardápio, pets e nomes dos integrantes.",
        "Sua agenda pessoal (dias fora de casa, horários e ausências) e suas preferências de aviso são visíveis somente para você.",
        "Convide apenas pessoas que você conhece e que concordam em participar.",
      ],
    },
    {
      id: "criancas",
      title: "5. Perfis de criança",
      paragraphs: [
        "Crianças e adolescentes não têm conta no Ocafy. No modo Família, um adulto pode criar perfis de criança (nome ou apelido e faixa etária) para atribuir tarefas e registrar pontos.",
      ],
      items: [
        "Ao criar um perfil de criança, você declara ser pai, mãe ou responsável legal e consente com o tratamento dos dados desse perfil, nos termos do art. 14, § 1º, da LGPD, conforme descrito na Política de Privacidade.",
        "Você pode excluir o perfil a qualquer momento; o histórico do perfil é excluído junto com ele.",
        "Use apenas o nome ou apelido e a faixa etária; não informe outros dados da criança.",
      ],
    },
    {
      id: "planos",
      title: "6. Planos, teste e pagamento",
      items: [
        "Há um plano Grátis e um plano Plus. Os recursos e limites de cada plano são exibidos no aplicativo, na página Meu plano.",
        "Casas novas podem receber um período de teste do plano Plus. Ao fim do teste, a casa passa ao plano Grátis, a menos que haja assinatura.",
        "A assinatura do plano Plus vale para a casa toda. Preço, periodicidade e forma de pagamento são informados antes da contratação e o pagamento é processado pelo provedor de pagamento ou pela loja de aplicativos usada na compra.",
        "Se uma cobrança falhar, o plano Plus continua ativo por um período de carência (7 dias) enquanto avisamos você. Depois disso a casa volta ao plano Grátis.",
        "Mudar de plano ou passar do limite do plano não apaga seus dados: apenas deixa de ser possível adicionar itens além do limite do plano em uso.",
        "Nas contratações feitas fora de estabelecimento comercial (como pela internet), aplica-se o direito de arrependimento de 7 dias previsto no art. 49 do Código de Defesa do Consumidor, nos termos da lei.",
      ],
    },
    {
      id: "regras",
      title: "7. Regras de uso",
      paragraphs: ["Ao usar o Ocafy, você concorda em não:"],
      items: [
        "usar o aplicativo para fins ilícitos ou para violar direitos de terceiros;",
        "inserir dados pessoais de terceiros sem autorização, ou dados pessoais sensíveis (como saúde ou religião) em campos de texto livre, como apelidos, notas e nomes de itens;",
        "tentar acessar dados de outras casas, contornar limites de plano ou burlar mecanismos de segurança;",
        "sobrecarregar o serviço, copiá-lo de forma automatizada ou tentar obter seu código-fonte.",
      ],
    },
    {
      id: "propriedade",
      title: "8. Propriedade intelectual e seus dados",
      items: [
        "O software, a marca e o conteúdo do Ocafy pertencem a {{controller}} ou a seus licenciantes.",
        "Os dados que você insere continuam sendo seus. Você nos autoriza a tratá-los na medida necessária para prestar o serviço, conforme a Política de Privacidade.",
      ],
    },
    {
      id: "disponibilidade",
      title: "9. Disponibilidade e mudanças",
      items: [
        "Fazemos o possível para manter o serviço disponível, mas podem ocorrer interrupções para manutenção ou por fatores fora do nosso controle.",
        "Podemos alterar o aplicativo e estes Termos. Quando a mudança for relevante, avisaremos e, quando necessário, pediremos que você aceite a nova versão para continuar usando.",
      ],
    },
    {
      id: "suspensao",
      title: "10. Suspensão e encerramento",
      items: [
        "Podemos suspender uma casa em caso de violação destes Termos ou de risco à segurança do serviço. A suspensão é registrada com justificativa e bloqueia novas alterações; seus dados continuam guardados.",
        "Você pode excluir sua casa ou sua conta a qualquer momento. Depois da exclusão, os dados são apagados conforme a Política de Privacidade.",
      ],
    },
    {
      id: "responsabilidade",
      title: "11. Responsabilidade",
      paragraphs: [
        "Na medida permitida pela legislação brasileira, incluindo o Código de Defesa do Consumidor, o Ocafy é oferecido conforme descrito nestes Termos. Nada nestes Termos exclui direitos que a lei assegura a você.",
      ],
    },
    {
      id: "privacidade",
      title: "12. Privacidade e proteção de dados",
      paragraphs: [
        "O tratamento de dados pessoais é regido pela Política de Privacidade, que faz parte destes Termos, e pela Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018).",
      ],
    },
    {
      id: "comunicacoes",
      title: "13. Comunicações",
      items: [
        "Enviamos e-mails necessários ao serviço, como convites, avisos de cobrança e redefinição de senha.",
        "Avisos no celular (push) só são enviados se você os ativar, e você pode desligá-los quando quiser em Lembretes.",
      ],
    },
    {
      id: "lei",
      title: "14. Lei aplicável e foro",
      paragraphs: [
        "Estes Termos são regidos pela legislação brasileira. Nas relações de consumo, fica assegurado o foro do domicílio do consumidor.",
      ],
    },
    {
      id: "contato",
      title: "15. Contato",
      paragraphs: [
        "Dúvidas sobre estes Termos: {{contactEmail}}. Sobre dados pessoais: {{dpoEmail}}.",
      ],
    },
  ],
};

/* ============================================================================================ */
/*  POLÍTICA DE PRIVACIDADE                                                                     */
/* ============================================================================================ */

export const PRIVACY: LegalDoc = {
  id: "privacy",
  title: "Política de Privacidade do Ocafy",
  intro:
    "Esta Política explica, em linguagem simples, quais dados pessoais o Ocafy trata, para quê, com quem compartilha e quais são os seus direitos, conforme a Lei Geral de Proteção de Dados Pessoais (LGPD, Lei nº 13.709/2018). Versão {{version}}.",
  sections: [
    {
      id: "controlador",
      title: "1. Quem é o controlador dos seus dados",
      paragraphs: [
        "O controlador é {{controller}}, CNPJ {{cnpj}}, com endereço em {{address}}. Contato geral: {{contactEmail}}.",
        "Encarregado(a) pelo tratamento de dados pessoais (art. 41 da LGPD): {{dpoName}}, e-mail {{dpoEmail}}.",
      ],
    },
    {
      id: "dados",
      title: "2. Quais dados tratamos",
      paragraphs: ["Tratamos os dados abaixo, conforme você usa o aplicativo:"],
      items: [
        "Conta: nome, e-mail e senha (armazenada de forma protegida pelo serviço de autenticação; não temos acesso à senha em texto). O serviço de autenticação também registra sessões, com endereço IP e navegador.",
        "Perfil na casa: nome de exibição, cor e, se você quiser, foto de perfil.",
        "Casa: nome da casa, modo (Solo, Casal ou Família), tipo e tamanho da moradia, cômodos e apelidos, ritmo escolhido e preferências (por exemplo, se há máquina de lavar, plantas ou carro).",
        "Pets: nome, espécie e, quando aplicável, porte, pelagem, acesso ao quintal e tipo de areia.",
        "Perfis de criança: nome ou apelido e faixa etária, informados pelo adulto responsável.",
        "Uso do aplicativo: tarefas concluídas (com data, hora e pontos), trocas de tarefa, reações, resgates na lojinha, cardápio, lista de compras e projeto de escritório.",
        "Agenda pessoal: dias da semana em casa ou fora, horários de saída e volta, ausências e o motivo opcional que você escrever. Esses dados podem indicar quando você não está em casa; são visíveis somente para você e usados só para decidir o horário dos lembretes.",
        "Avisos: suas preferências e, se você ativar avisos, os dados técnicos do aparelho necessários ao envio (endereço do serviço de push do navegador, chaves de criptografia do envio e tipo de navegador) e o histórico de envio.",
        "Plano e cobrança: plano da casa, situação da assinatura e, quando informado pelo provedor de pagamento, o e-mail do pagador e os eventos de cobrança. Não armazenamos dados de cartão de crédito.",
        "Pedidos de privacidade: seus pedidos de cópia ou exclusão e o registro do atendimento.",
        "Registros técnicos e de segurança: etapas concluídas do cadastro (para entendermos onde as pessoas têm dificuldade), registro de ações administrativas feitas por nossa equipe e registros do aceite destes documentos (versão e data).",
      ],
    },
    {
      id: "sensiveis",
      title: "3. Dados pessoais sensíveis",
      paragraphs: [
        "Não solicitamos dados pessoais sensíveis (art. 5º, II, da LGPD), como saúde, religião ou origem racial. Pedimos que você também não os escreva em campos de texto livre (apelidos, notas, motivos e nomes de itens).",
      ],
    },
    {
      id: "finalidades",
      title: "4. Para que usamos os dados e em que base legal",
      items: [
        "Prestar o serviço — criar sua conta e sua casa, montar a rotina, registrar tarefas, pontos, compras e cardápio, compartilhar a casa com quem você convidou. Base legal: execução de contrato (art. 7º, V).",
        "Cobrar e gerenciar planos, e evitar duplicidade de eventos de pagamento. Base legal: execução de contrato (art. 7º, V).",
        "Enviar e-mails necessários ao serviço (convite, cobrança, redefinição de senha). Base legal: execução de contrato (art. 7º, V).",
        "Enviar lembretes no celular, respeitando sua agenda e horário de silêncio. Base legal: consentimento (art. 7º, I), que você dá ao ativar os avisos e pode retirar a qualquer momento em Lembretes.",
        "Tratar dados de perfis de criança. Base legal: consentimento específico e em destaque de pelo menos um dos pais ou responsável legal (art. 14, § 1º), dado no momento da criação do perfil.",
        "Manter a segurança do serviço, prevenir abusos e fraudes, registrar as ações da nossa equipe e entender onde o cadastro precisa melhorar. Base legal: legítimo interesse (art. 7º, IX), respeitados seus direitos e expectativas.",
        "Atender pedidos dos titulares, guardar registros exigidos por lei e nos defender em processos. Bases legais: cumprimento de obrigação legal ou regulatória (art. 7º, II) e exercício regular de direitos (art. 7º, VI).",
      ],
    },
    {
      id: "criancas",
      title: "5. Dados de crianças e adolescentes",
      paragraphs: [
        "O Ocafy é voltado a adultos. Não há contas para crianças ou adolescentes. No modo Família, o adulto responsável pode criar perfis de criança, tratando apenas nome ou apelido e faixa etária, além do histórico de tarefas e pontos do perfil.",
        "Esse tratamento é feito no melhor interesse da criança e depende do consentimento específico e em destaque de pelo menos um dos pais ou responsável legal (art. 14 da LGPD). O responsável pode excluir o perfil a qualquer momento, o que apaga o histórico dele, e pode pedir informações sobre os dados tratados.",
      ],
    },
    {
      id: "compartilhamento",
      title: "6. Com quem compartilhamos",
      paragraphs: [
        "Não vendemos seus dados pessoais. Compartilhamos dados somente nas situações abaixo:",
      ],
      items: [
        "Pessoas da mesma casa: veem os dados compartilhados da casa descritos nos Termos de Uso. Sua agenda pessoal e suas preferências de aviso não são compartilhadas.",
        "Fornecedores que tratam dados em nosso nome (operadores): hospedagem do aplicativo (Vercel), banco de dados e autenticação (Neon) e e-mail transacional (Resend).",
        "Serviços de push dos navegadores (Google, Mozilla, Apple e Microsoft), somente se você ativar avisos.",
        "Provedor de pagamento ou loja de aplicativos (como Google Play), somente se você assinar.",
        "Autoridades públicas, quando houver obrigação legal ou ordem judicial.",
      ],
    },
    {
      id: "internacional",
      title: "7. Transferência internacional",
      paragraphs: [
        "O banco de dados e as funções do servidor do Ocafy estão configurados em região do Brasil (São Paulo). Alguns fornecedores citados acima, como os de e-mail, push e pagamento, podem tratar dados fora do Brasil. Nesses casos, a transferência ocorre nas hipóteses do art. 33 da LGPD.",
      ],
    },
    {
      id: "prazo",
      title: "8. Por quanto tempo guardamos os dados",
      items: [
        "Guardamos os dados enquanto sua conta e sua casa existirem.",
        "Ao excluir a casa ou a conta, os dados são apagados. Pedidos feitos à nossa equipe são atendidos no prazo da lei (a LGPD prevê resposta completa em até 15 dias, art. 19, II).",
        "Podemos manter dados pelo tempo necessário para cumprir obrigação legal ou regulatória e para o exercício regular de direitos (arts. 7º, VI, e 16, I, da LGPD).",
        "Cópias de segurança mantidas pelos nossos fornecedores podem conter dados por um período limitado, até serem substituídas.",
      ],
    },
    {
      id: "direitos",
      title: "9. Seus direitos",
      paragraphs: [
        "Nos termos do art. 18 da LGPD, você pode, a qualquer momento e mediante requisição:",
      ],
      items: [
        "confirmar que tratamos seus dados e ter acesso a eles;",
        "corrigir dados incompletos, inexatos ou desatualizados;",
        "pedir anonimização, bloqueio ou eliminação de dados desnecessários, excessivos ou tratados em desconformidade com a lei;",
        "pedir a portabilidade dos dados;",
        "pedir a eliminação dos dados tratados com base no seu consentimento;",
        "saber com quais entidades compartilhamos seus dados;",
        "ser informado(a) sobre a possibilidade de não consentir e sobre as consequências;",
        "revogar o consentimento;",
        "opor-se a tratamento realizado com fundamento em outra base legal, em caso de descumprimento da lei.",
        "Como exercer: em Ajustes → Privacidade e dados você baixa uma cópia dos seus dados e pede a exclusão da conta; ou escreva ao encarregado em {{dpoEmail}}.",
        "Você também pode peticionar contra o controlador perante a Autoridade Nacional de Proteção de Dados (ANPD).",
      ],
    },
    {
      id: "seguranca",
      title: "10. Segurança",
      paragraphs: [
        "Adotamos medidas técnicas e administrativas para proteger os dados (art. 46 da LGPD), como conexão criptografada (HTTPS), isolamento dos dados de cada casa, senhas protegidas pelo serviço de autenticação e painel administrativo com segundo fator de autenticação, controle por papéis e registro que não pode ser alterado das ações da equipe.",
        "Em caso de incidente de segurança que possa acarretar risco ou dano relevante, comunicaremos a ANPD e os titulares, conforme o art. 48 da LGPD.",
      ],
    },
    {
      id: "cookies",
      title: "11. Cookies e armazenamento no aparelho",
      items: [
        "Cookie de sessão do serviço de autenticação, necessário para manter você conectado(a).",
        "Armazenamento local do navegador para lembrar o tema (claro ou escuro) e se você dispensou o convite para ativar lembretes.",
        "Service worker, usado para receber avisos push quando você os ativa.",
        "Não usamos cookies de publicidade nem ferramentas de análise de terceiros.",
      ],
    },
    {
      id: "alteracoes",
      title: "12. Mudanças nesta Política",
      paragraphs: [
        "Podemos atualizar esta Política. A versão vigente está sempre identificada no topo. Quando a mudança for relevante, avisaremos e, quando necessário, pediremos um novo aceite.",
      ],
    },
    {
      id: "contato",
      title: "13. Contato",
      paragraphs: [
        "Encarregado(a): {{dpoName}} — {{dpoEmail}}. Contato geral: {{contactEmail}}.",
      ],
    },
  ],
};

export const LEGAL_DOCS: Record<LegalDocId, LegalDoc> = {
  terms: TERMS,
  privacy: PRIVACY,
};

/** Declaração do adulto responsável (art. 14, § 1º) — texto exibido ao criar perfil de criança. */
export const GUARDIAN_DECLARATION =
  "Declaro que sou pai, mãe ou responsável legal pela(s) criança(s) deste perfil e consinto, de forma específica, com o tratamento do nome ou apelido, da faixa etária e do histórico de tarefas e pontos do perfil, para os fins descritos na Política de Privacidade (art. 14, § 1º, da LGPD). Posso revogar o consentimento a qualquer momento excluindo o perfil.";

/** Texto da caixa de aceite do cadastro. */
export const ACCEPT_LABEL =
  "Li e aceito os Termos de Uso e declaro ter lido a Política de Privacidade.";

export type ConsentContext = "onboarding" | "join" | "update" | "guardian";

/** Renderiza um documento como Markdown (usado para gerar docs/legal/*.md). */
export function legalToMarkdown(doc: LegalDoc, c?: ControllerInfo): string {
  const fill = (s: string) => (c ? fillLegal(s, c) : s);
  const out: string[] = [`# ${doc.title}`, "", fill(doc.intro), ""];
  for (const s of doc.sections) {
    out.push(`## ${s.title}`, "");
    for (const p of s.paragraphs ?? []) out.push(fill(p), "");
    for (const i of s.items ?? []) out.push(`- ${fill(i)}`);
    if (s.items?.length) out.push("");
  }
  return `${out.join("\n").trimEnd()}\n`;
}
