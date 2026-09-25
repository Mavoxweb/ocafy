# Ocafy — Material-base para apresentação a investidores

> **Como usar:** este documento é a matéria-prima para montar os slides. Cada seção `##` vira 1 a 3
> slides. Tudo que é **fato do produto** foi conferido no código. Tudo que é **número de mercado,
> preço ou valuation** está marcado como **hipótese a validar** — não invente cifras nos slides:
> troque as hipóteses por dados reais (pesquisa, pilotos, métricas do painel) antes de apresentar.

---

## 1. Resumo em uma frase

**Ocafy é o app que transforma a rotina da casa em um jogo compartilhado: ele monta a rotina certa
para cada lar (cômodos, pets, crianças, ritmo), lembra na hora certa e divide o trabalho de forma
justa entre as pessoas.**

Slogan: *"Deixa a casa ok."*

## 2. O problema

- A carga mental e a divisão desigual do trabalho doméstico são fonte comum de atrito em casais e
  famílias — e ninguém tem uma ferramenta que mostre **quem faz o quê** de forma objetiva.
- Apps de tarefas genéricos (to-do) não entendem casa: não sabem que banheiro pede uma coisa e
  cachorro grande pede outra, nem que aspirar tem uma "janela" ideal de dias.
- Listas de compras, cardápio, lembretes e tarefas vivem em apps separados.
- Famílias com crianças não têm um jeito simples de dar responsabilidades por idade.

*(Slide sugerido: 3 dores + uma frase de cliente real dos testadores — colete depoimentos.)*

## 3. A solução (o que o app faz hoje)

### 3.1 Casa sob medida — o "motor de rotinas"
- **Perfil da casa:** modo **Solo, Casal ou Família**, tipo de moradia (apartamento, casa, sobrado,
  kitnet), tamanho, ritmo (leve / padrão / completo) e o que vale para a casa (cozinha em casa,
  congelados, máquina de lavar, plantas, carro, projeto de escritório).
- **Cômodos com quantidade e apelido:** 11 tipos (quartos, banheiros, lavabo, sala, cozinha, área de
  serviço, varanda, quintal, garagem, escritório, piscina). Cada banheiro e cada quarto ganha as
  próprias tarefas.
- **Pets:** cães por porte e pelagem, gatos (caixa de areia), aves, peixes, roedores, répteis e
  outros — cada um gera cuidados próprios (passeio, banho, ração, areia…).
- **Biblioteca de tarefas orientada a regras:** o plano da casa é **calculado** a partir do perfil.
  Uma casa grande com cão e plantas gera dezenas de tarefas; um apartamento pequeno gera bem menos.
  A mesma regra roda no servidor e no app, e o servidor recusa tarefas que não pertencem àquela casa.
- **Onboarding em etapas com modelos prontos** ("Família com criança e cão", "Moro sozinho(a) em
  apartamento"…), prévia da rotina antes de começar e a área permanente **"Minha casa"**, que mostra o
  que **entra e sai** das tarefas antes de você salvar (o histórico nunca é apagado).

### 3.2 Rotina no dia a dia
- **Rotina da manhã e reset da noite** (checklists) e **tarefas recorrentes com janela de dias** (a
  tarefa fica "em dia", "pode fazer" ou "atrasada"); registro retroativo ("fiz ontem").
- **Frequência ajustável e pausa** por tarefa, cards por cômodo com progresso e "saúde da casa".
- **Trocas de tarefa:** pedir ajuda a outro adulto, com aceite/recusa.

### 3.3 Gamificação (retenção)
- **XP, níveis, sequência de dias (streak), conquistas** e bônus por fazer no prazo.
- **Placar:** duelo semanal entre duas pessoas ou ranking da família; meta conjunta da semana.
- **Lojinha de prêmios:** moedas ganhas com a rotina; resgate exige **aprovação da outra pessoa**.
- **Feed da casa** com reações e **relatório de divisão do trabalho** (medido em minutos estimados,
  não em número de tarefas): quem fez o quê, onde a rotina falha, o que está atrasado.

### 3.4 Família
- **Perfis de criança sem login** (4–6, 7–9, 10–12, 13–17 anos), controlados por um adulto
  responsável — simplifica privacidade/LGPD.
- **Tarefas por idade** (guardar brinquedos, arrumar a mochila, arrumar o quarto…) e **atribuição**
  de quem cuida de cada tarefa; o XP vai para o perfil da criança.
- Até **4 adultos** e 6 perfis de criança por casa.

### 3.5 Cozinha, compras e pets
- **Cardápio** com proteínas e **alerta de descongelar** no horário certo.
- **Lista de compras compartilhada** em tempo real: urgência (urgente / próxima ida / quando der),
  categorias automáticas, **modo mercado** (telas grandes, por corredor), botão "terminei as
  compras" e **hábito de compra** (semanal / quinzenal / mensal, com sugestão automática pelo
  histórico e lembrete no dia).
- **Caixa de areia e estoque** para quem tem gatos.

### 3.6 Lembretes que respeitam a vida real
- **Agenda pessoal:** cada dia da semana como "em casa", "fora o dia todo" ou "sai e volta" (com
  horários) + **ausências longas** (viagem, plantão).
- **Push no celular (opt-in):** rotina da manhã *antes de sair de casa*, reset da noite *depois que
  volta*, resumo de tarefas, hora de tirar a proteína do congelador, pedidos do parceiro, itens
  urgentes, dia de compras.
- **Nunca avisa quando a pessoa está fora**, respeita horário de silêncio e o fuso da casa, e não
  envia o mesmo aviso duas vezes.
- **PWA instalável** (funciona como app no celular) com service worker.

### 3.7 Negócio e confiança (já construído)
- **Planos Grátis e Plus**, com limites **aplicados só no servidor** (o app apenas reflete): quem
  passa do limite não perde nada — só não consegue adicionar mais.
- **Teste de 14 dias** do Plus em casa nova; **cortesia "fundadora"** para as casas iniciais.
- **Assinatura ponta a ponta (estrutura):** webhooks para **Cakto** (web) e **Google Play via
  RevenueCat** (Android), máquina de estados com **falha de pagamento tratada** (carência de 7 dias,
  avisos por e-mail e push nos dias 0/3/6, cancelamento vale até o fim do período, reembolso encerra).
- **Painel administrativo** em app separado: indicadores (crescimento, opt-in, receita estimada,
  funil do onboarding), busca de casas, planos e assinaturas, fila LGPD, chaves globais
  (manutenção, cadastros, push), saúde da cobrança e equipe.
- **Segurança do painel:** login + **segundo fator (TOTP)**, papéis (proprietário, administrador,
  suporte, financeiro, leitura), **justificativa obrigatória em toda ação** e **auditoria imutável**
  (o próprio banco impede alterar/apagar registros; tentativas negadas também ficam registradas).
- **LGPD:** o titular baixa uma cópia dos dados e pede a exclusão da conta no app; a equipe atende
  pela fila com prazo de 15 dias e evidência registrada.

## 4. Diferenciais competitivos

1. **Rotina gerada por regras, não lista em branco** — o valor aparece no primeiro minuto.
2. **Justiça mensurável:** divisão por minutos estimados, relatório de quem faz o quê.
3. **Vida real:** lembretes que sabem quando a pessoa está em casa.
4. **Casa completa num app só:** tarefas + cardápio + compras + pets + crianças + lembretes.
5. **Arquitetura pronta para escalar e operar:** planos no servidor, painel com auditoria e LGPD
   desde o início (reduz risco em due diligence).
6. **Biblioteca em dados**, editável sem novo deploy no futuro (base para IA e para parcerias).

## 5. Estado atual e maturidade (seja transparente com investidores)

| Item | Situação |
| --- | --- |
| Produto web (PWA) | Em produção; **3 casas reais** de teste hoje |
| Qualidade | Mais de 150 testes automáticos (regras de negócio e integração com o banco), CI no GitHub |
| Painel admin | Pronto; **falta publicar** o projeto e criar o primeiro proprietário |
| Cobrança Cakto | **Estrutura de webhook pronta; integração real pendente** (validar formato com evento real) |
| Google Play | Checklist pronto (TWA + RevenueCat); **app ainda não publicado** |
| Lembretes push | Funcionam (testado com push real); **precisam de chaves e agendador configurados em produção** |
| Base de usuários / receita | **Ainda sem tração comercial** — o próximo marco é o piloto |
| Revisão jurídica (LGPD, termos, crianças) | **Pendente** — recomendada antes do lançamento público |

> Para investidores, isso é uma vantagem se bem contada: o produto e a infraestrutura de negócio
> estão prontos; o dinheiro entra para **aquisição e validação**, não para "construir".

## 6. Mercado (estrutura — preencher com dados reais)

> **Não usei números de mercado aqui de propósito.** Busque fontes (IBGE, pesquisas de domicílios,
> relatórios de apps/consumo) e preencha:

- **Público:** casais e famílias urbanos, smartphone, com rotina corrida; forte fit com casais que
  dividem a casa, famílias com crianças e donos de pets.
- **TAM/SAM/SOM (a preencher):** nº de domicílios urbanos no Brasil → % com smartphone e renda para
  assinar → % realistamente alcançável em 3 anos.
- **Expansão:** LATAM em espanhol (tradução + moeda), depois outros mercados. O app está em
  português; a internacionalização exige revisar textos, moeda e regras de privacidade locais.
- **Concorrência (mapear e comparar em uma tabela):** apps de tarefas domésticas/gamificação
  (internacionais), apps de lista de compras, calendários familiares. Posicione o Ocafy no eixo
  *"gera a rotina sozinho" × "casa inteira num app"*.

## 7. Modelo de negócio e monetização

### 7.1 Já implementado: freemium
| | Grátis | Plus |
| --- | --- | --- |
| Modos | Solo e Casal | + **Família** (crianças, até 4 adultos) |
| Pets / projetos | 1 / 1 | ilimitados |
| Rotinas, compras, lembretes, placar, lojinha | ✔ | ✔ |

- **Preço (hipótese a validar):** R$ 24,90 por trimestre ou R$ 79,90 por ano; **14 dias de teste**.
- **Princípio:** o Grátis é útil de verdade (cria o hábito e o convite ao(à) parceiro(a)); o Plus
  cobra por *poder* (família, escala).
- **Assinatura por casa:** qualquer adulto assina e vale para todos.

### 7.2 Métricas a acompanhar (o painel já mostra parte delas)
Ativação (casas que completam o onboarding), casas ativas em 7 dias, **opt-in de lembretes (> 50%
dos ativos)**, conversão teste→pago, retenção D30, MRR, churn e inadimplência recuperada.

### 7.3 Receitas adicionais (roadmap — nada disso está construído ainda)
1. **Assistente de IA (R4):** monta o plano da casa e o cardápio a partir de uma frase, gera a lista
   de compras — cobrado como camada premium com cota por casa.
2. **Afiliados e parcerias de compras:** a lista de compras é um ponto natural para
   supermercados/delivery (enviar a lista para o carrinho, cashback, cupons). Receita por comissão.
3. **Produtos para pets:** cães e gatos já são cadastrados por porte/pelagem — recomendação e
   afiliação de ração, areia, banho e veterinário (opt-in do usuário).
4. **Marketplace de serviços:** diarista, dedetização, manutenção, lavanderia — comissão por
   contratação, ligado às tarefas "grandes" que o app já sugere (vidros, estofados, caixa d'água).
5. **B2B2C — condomínios e imobiliárias/construtoras:** o app como benefício para o morador
   (onboarding de casa nova, "guia de manutenção do imóvel").
6. **Seguros residenciais e pet:** parceria para oferta contextual e prevenção (manutenção
   preventiva reduz sinistro).
7. **Benefício corporativo (wellbeing):** licença por colaborador; pauta de equilíbrio vida-trabalho e
   divisão justa do trabalho doméstico.
8. **Licenciamento / white-label** do motor de rotinas e da lista de compras para varejistas,
   bancos ou operadoras que queiram "casa" no próprio app.
9. **Conteúdo e templates premium:** planos prontos (recém-nascido, mudança, reforma, home office).
10. **Dados agregados e anonimizados** para pesquisa de consumo doméstico — **só com base legal,
    anonimização real e consentimento** (risco regulatório alto; tratar com cautela e apoio jurídico).

> Priorização sugerida: **freemium → IA → lista de compras com afiliados → pets → B2B2C.**

## 8. Estratégia de crescimento (go-to-market)

- **Loop viral nativo:** o app funciona melhor a dois → cada casa convida pelo menos 1 pessoa
  (código/link/e-mail de convite já existem).
- **Conteúdo e comunidade:** "divisão justa da casa", rotinas para casal, família e pets (redes
  sociais e criadores de nicho); modelos prontos compartilháveis.
- **Play Store (TWA)** como canal de aquisição orgânica e de assinatura recorrente.
- **Parcerias de distribuição:** condomínios, imobiliárias, pet shops, marcas de limpeza.
- **Piloto pago pequeno** antes de escalar: 50–100 casas com métricas de ativação/retenção.

## 9. Como uma grande empresa/player poderia comprar ou se associar

> Estes cenários são **ilustrativos**. Não houve contato com nenhuma empresa citada e não há
> indicação de interesse.

### 9.1 Quem teria interesse estratégico (categorias e exemplos)
| Categoria | Por que compraria | Exemplos de tipo de empresa |
| --- | --- | --- |
| **Varejo e delivery de supermercado** | A lista de compras e o hábito de compra alimentam recorrência de pedido | grandes redes, apps de delivery/mercado |
| **Marketplaces e super-apps** | Casa/família como vertical de engajamento; lista → carrinho | marketplaces e carteiras digitais |
| **Bancos e fintechs** | Engajamento diário + assinatura familiar + mesada das crianças (roadmap) | bancos digitais, cartões |
| **Seguradoras** (residencial, pet) | Manutenção preventiva e relacionamento contínuo com o cliente | seguradoras e assistência 24h |
| **Serviços domésticos** | Demanda qualificada de serviços a partir das tarefas | plataformas de diaristas/manutenção |
| **Pet e saúde animal** | Base segmentada por porte/espécie | redes de pet shop e rações |
| **Construtoras e imobiliárias** | Pós-venda e "manual da casa" | incorporadoras, administradoras |
| **Big techs de produtividade/família** | Vertical doméstico dentro de calendário/assistente | plataformas de calendário e assistente |

### 9.2 Formatos de transação
1. **Aquisição total (M&A):** compra da empresa/IP (código, marca, base de usuários, dados de uso).
2. **Acqui-hire:** interesse principal na equipe e na tecnologia (motor de rotinas, arquitetura).
3. **Licenciamento/white-label:** o player usa o motor de rotinas no próprio produto, com
   *revenue share*.
4. **Parceria estratégica com investimento minoritário** (corporate venture): aporte + distribuição.
5. **Rodada de captação** (pré-seed/seed) para provar tração e só então buscar aquisição.

### 9.3 Como aumentar o valor de venda (preparação)
1. **Tração comprovada:** ativos semanais, retenção D30, conversão teste→pago e MRR. Compradores
   pagam por *usuários engajados e receita recorrente*, não por funcionalidades.
2. **Dados organizados e conformes:** LGPD implementada (exportação, exclusão, auditoria imutável)
   reduz risco na *due diligence* — já é um diferencial.
3. **Propriedade intelectual limpa:** registrar a marca "Ocafy" no INPI, ter CNPJ, contratos de
   cessão de código/cores se houver terceiros, licenças de dependências revisadas.
4. **Código documentado e testado:** monorepo com testes, CI, documentação de implantação — já existe.
5. **Contratos e governança:** termos de uso, política de privacidade e DPO/encarregado definidos.
6. **Métricas em painel próprio:** o painel admin já entrega o que o comprador vai pedir.
7. **Casos de uso B2B2C documentados** (um piloto com condomínio/varejista vale mais que 10 slides).

### 9.4 Faixas de valor
> **Não estimei valuation.** Ele depende de tração, receita e do comprador. Em geral, produtos
> sem receita são avaliados por equipe/tecnologia; com MRR crescente, por múltiplo de receita
> recorrente e retenção. Busque referências de aquisições comparáveis e converse com um(a)
> assessor(a) de M&A/venture antes de fixar um número.

### 9.5 Roteiro sugerido
1. Publicar o painel, configurar lembretes e cobrança (tarefas já mapeadas em `IMPLANTACAO-R2-R3.md`).
2. Piloto de 50–100 casas + coleta de depoimentos e métricas.
3. Publicar na Play Store; primeiras assinaturas.
4. Registrar marca, revisar jurídico (termos, privacidade, crianças).
5. Captar pré-seed com a tração do piloto **ou** abrir conversas com 3–5 parceiros estratégicos
   (varejo/pet/seguro) para um piloto B2B2C.
6. Só depois discutir aquisição, com dados na mão.

## 10. Roadmap

| Etapa | Foco | Situação |
| --- | --- | --- |
| R0/R1 | Onboarding, casa sob medida, motor de rotinas, pets | ✔ entregue |
| R2 | Família, compras, agenda e lembretes push | ✔ entregue |
| R3 | Planos, assinatura (estrutura), painel admin, LGPD | ✔ entregue (integrações reais pendentes) |
| R4 | **Assistente de IA** (propõe → usuário aprova → aplica, reversível), CMS de biblioteca no admin, comunicação e suporte, widgets/calendário | planejado |
| Depois | Lista de compras com afiliados, pets premium, B2B2C, LATAM | ideias |

## 11. Riscos e mitigação (mostre que você já pensou)

- **Retenção de apps domésticos é difícil** → gamificação, lembretes contextuais, convite ao(à)
  parceiro(a), metas semanais.
- **Dependência de push no iPhone** (exige app instalado) → foco em Android/Play e e-mail como reserva.
- **Crianças e privacidade** → perfis sem login, gerenciados por adulto; produto voltado a adultos;
  revisão jurídica.
- **Conversão em assinatura** → Grátis útil + teste de 14 dias + preço testado em piloto.
- **Custo de IA** → cota por casa, camada premium, monitoramento no painel.
- **Integração com a Cakto ainda não validada** → estrutura pronta, testes com eventos reais antes
  de ligar.

## 12. Estrutura sugerida dos slides (12–14)

1. Capa (nome, slogan, uma frase)
2. Problema
3. Solução (uma tela do app)
4. Demonstração — onboarding → rotina gerada (3 prints)
5. Como funciona (motor de rotinas: perfil → regras → plano)
6. Retenção: gamificação e placar justo
7. Família, compras e lembretes (o "app da casa")
8. Diferenciais
9. Mercado (TAM/SAM/SOM com dados reais)
10. Modelo de negócio (freemium + receitas futuras)
11. Tração e métricas (piloto)
12. Go-to-market
13. Roadmap (R4 IA)
14. Equipe, necessidade de capital e uso dos recursos

## 13. Anexos que valem a pena preparar

- Prints e vídeo curto (60–90 s) do fluxo: onboarding → hoje → placar → compras → lembrete.
- Painel admin (visão geral) mostrando métricas.
- Diagrama de arquitetura (web, API, banco, cobrança, painel).
- Tabela comparativa com concorrentes.
- Data room básico: contrato social/CNPJ, marca, política de privacidade, termos, repositório e
  documentação técnica (`docs/`).

---
*Fatos de produto extraídos do código do repositório `ocafy` em 25/09/2026. Cifras de mercado,
preços e valuation são intencionalmente deixados como hipóteses a validar.*
