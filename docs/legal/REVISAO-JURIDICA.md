# Ocafy — Pacote para revisão jurídica (LGPD e legislação brasileira)

> **Leia primeiro.** Este pacote foi preparado por engenharia. **Não é parecer jurídico** e nada aqui
> foi "aprovado" por advogado(a). O objetivo é entregar a quem revisa: (1) o texto-minuta dos
> documentos, (2) o inventário fiel do que o sistema faz com dados pessoais e (3) a lista de pontos
> que dependem de decisão ou validação jurídica.
>
> **Regra de redação seguida:** os documentos só afirmam (a) o que o sistema realmente faz (conferido
> no código e no banco) e (b) o que a lei diz. Dados da empresa **não foram inventados**: vêm de
> variáveis de ambiente e aparecem como `[a preencher]` enquanto faltarem.
> Referências legais devem ser conferidas pelo(a) advogado(a) — indico "verificar" onde há
> regulamento que pode ter mudado.

Documentos-minuta (gerados de `packages/core/src/legal.ts`):
- [`TERMOS-DE-USO.md`](TERMOS-DE-USO.md)
- [`POLITICA-DE-PRIVACIDADE.md`](POLITICA-DE-PRIVACIDADE.md)

Versão vigente: `LEGAL_VERSION` em `packages/core/src/legal.ts` (formato `AAAA-MM-DD`).

---

## 1. O que está implementado no sistema

| Requisito | Como o sistema atende |
| --- | --- |
| Informação clara e acessível (LGPD art. 9º; art. 14, § 6º) | Páginas públicas `/termos` e `/privacidade` (sem login), links no cadastro/login, no aceite do onboarding e em Ajustes |
| Aceite dos Termos como ato da pessoa | Caixa **desmarcada por padrão** no início do onboarding (criar casa **e** entrar por convite); os botões ficam bloqueados até marcar |
| Prova do aceite (art. 8º, § 2º) | Tabela `legal_acceptances`: usuário, documento, **versão**, **hash SHA-256 do texto exato**, contexto e data/hora. Não é apagada ao mudar de versão |
| Servidor decide | `household.create` e `household.join` **recusam** se a versão enviada não for a vigente (`LEGAL_VERSION_MISMATCH`); o aceite é gravado no servidor |
| Consentimento parental (art. 14, § 1º) | Ao criar perfil de criança, o adulto marca a **declaração de responsável legal** (texto específico). O servidor exige (`guardianDeclaration: true`) e grava o aceite com o id do perfil |
| Nova versão dos documentos | Chave `legal_gate` no painel: quando ligada, quem já usa o app vê uma tela que bloqueia o uso até aceitar a nova versão |
| Direitos do titular (art. 18) | Ajustes → *Privacidade e dados*: **baixar meus dados** (JSON, inclui histórico de aceites) e **pedir exclusão da conta**; no painel, fila LGPD com prazo de 15 dias e evidência do atendimento |
| Consentimento para avisos push (art. 7º, I) | Só depois de a pessoa ativar em *Lembretes* (e conceder a permissão do navegador); revogável a qualquer momento |
| Segurança (art. 46) | HTTPS, dados isolados por casa, painel admin com 2º fator, papéis, justificativa obrigatória e **auditoria imutável** (triggers no banco) |
| Minimização | Perfil de criança guarda só nome/apelido e faixa etária; sem geolocalização, contatos ou câmera |

**Ainda não há:** verificação de idade; registro de acesso a aplicações (ver 4.1); RIPD; política de retenção
com prazos; contratos com operadores (ver seção 4).

---

## 2. Inventário de dados (ponto de partida para o registro das operações — art. 37)

| Dado | De quem | Finalidade | Base legal adotada na minuta | Operador/onde |
| --- | --- | --- | --- | --- |
| Nome, e-mail, senha (protegida), sessões (IP e navegador) | Adulto | Conta e login | Contrato (art. 7º, V) | Neon Auth (autenticação) |
| Nome de exibição, cor, foto opcional | Adulto | Perfil na casa | Contrato (V) | Neon (banco, São Paulo) |
| Casa: nome, modo, moradia, tamanho, cômodos, ritmo, preferências | Adulto | Montar a rotina | Contrato (V) | Neon |
| Pets: nome, espécie, porte, pelagem, quintal, areia | Adulto | Rotina de cuidados | Contrato (V) | Neon |
| **Perfil de criança:** nome/apelido, faixa etária, histórico de tarefas e pontos | Responsável | Atribuir tarefas por idade | **Consentimento parental** (art. 14, § 1º) | Neon |
| Tarefas concluídas, trocas, reações, resgates, cardápio, lista de compras, projeto | Adulto | Prestar o serviço | Contrato (V) | Neon |
| **Agenda pessoal** (dias/horários fora de casa, ausências, motivo opcional) | Adulto | Horário dos lembretes | Consentimento (I) ao ativar lembretes* | Neon (visível só à própria pessoa) |
| Preferências de aviso; endpoint/chaves do push; tipo de navegador; histórico de envio | Adulto | Enviar push | Consentimento (I) | Neon; serviços de push (Google, Mozilla, Apple, Microsoft) |
| Plano, assinatura, e-mail do pagador, eventos de cobrança (sem dados de cartão) | Adulto | Cobrança | Contrato (V) | Neon; provedor de pagamento / Google Play (futuro) |
| Etapas do cadastro (`onboarding_events`) | Adulto | Medir abandono | Legítimo interesse (IX)** | Neon |
| Registro de ações da equipe (auditoria) | Equipe | Segurança/prestação de contas | Legítimo interesse (IX)** | Neon |
| Pedidos LGPD | Titular | Atender direitos | Obrigação legal (II) | Neon |
| E-mails transacionais (convite, cobrança, senha) | Adulto/convidado | Prestar o serviço | Contrato (V) | Resend |

\* A agenda é dado que revela ausência da residência; a minuta a trata como parte do recurso de lembretes.
\*\* Exige teste de legítimo interesse (LIA) — ver 3.4.

**Não são coletados:** geolocalização, contatos, câmera/microfone, dados de cartão, cookies de
publicidade, ferramentas de análise de terceiros (verificado no código).

---

## 3. Pontos que precisam de decisão ou validação do(a) advogado(a)

### 3.1 Identificação e governança
1. **Controlador:** razão social, CNPJ, endereço e e-mail de contato (variáveis `LEGAL_*`).
2. **Encarregado (art. 41):** quem será nomeado e o e-mail público. Verificar se o enquadramento como
   *agente de tratamento de pequeno porte* (Resolução CD/ANPD nº 2/2022 — **verificar**) dispensa ou
   simplifica obrigações, considerando que há tratamento de dados de crianças.

### 3.2 Crianças e adolescentes
3. **Consentimento parental (art. 14, § 1º):** o texto da declaração (`GUARDIAN_DECLARATION`) é adequado?
   O art. 14, § 5º, pede esforços razoáveis para verificar que o consentimento foi dado pelo responsável —
   hoje é uma **autodeclaração** do adulto logado. Suficiente?
4. **Adolescentes (13–17):** o perfil de adolescente segue o mesmo fluxo. Verificar o entendimento da ANPD
   sobre bases legais aplicáveis a crianças **e** adolescentes (Enunciado CD/ANPD nº 1/2023 — **verificar**).
5. **Legislação recente de proteção de crianças e adolescentes em ambientes digitais** (conhecida como
   "ECA Digital") — **verificar se e como se aplica** ao produto (perfis de criança geridos por adulto, sem
   conta própria).
6. **Idade mínima da conta:** os Termos dizem "maiores de 18 anos ou legalmente capazes" (decisão de
   produto). **Não há verificação de idade** no cadastro. Aceitável? Precisa de ajuste?

### 3.3 Bases legais e consentimento
7. **Contrato vs. consentimento:** a minuta usa *contrato* (art. 7º, V) para o núcleo do serviço e
   *consentimento* apenas para push/agenda e perfis de criança. Confirmar. O aceite dos Termos é
   **contratual**; a Política é **informativa** (a caixa diz "declaro ter lido").
8. **Agenda pessoal:** tratada como parte do consentimento de lembretes. Confirmar a base e se a
   informação de que "revela quando a pessoa não está em casa" está suficientemente destacada.

### 3.4 Legítimo interesse
9. Usos apoiados em legítimo interesse: etapas do cadastro (medir abandono) e auditoria/segurança.
   Elaborar o **teste de legítimo interesse (LIA)** e confirmar a base.

### 3.5 Transferência internacional (art. 33)
10. O banco (Neon, região São Paulo) e as funções (Vercel, região gru1) estão no Brasil, **mas** há
    fornecedores que podem tratar dados fora (e-mail — Resend; serviços de push; pagamento).
    A minuta diz apenas que a transferência "ocorre nas hipóteses do art. 33". **Definir o mecanismo
    real** (cláusulas contratuais, adequação etc.) e ajustar o texto.

### 3.6 Operadores e contratos
11. Formalizar contratos/aditivos de tratamento de dados (DPA) com Vercel, Neon, Resend e, quando
    integrados, provedor de pagamento (Cakto), Google Play e RevenueCat. **Nenhum foi conferido por
    engenharia.** A lista de "operadores" na Política precisa refletir os contratos reais.

### 3.7 Retenção e exclusão
12. **Prazos:** a minuta diz "enquanto a conta existir; apaga ao excluir; guarda legal quando exigida" e
    **não fixa prazos**. Definir prazos por categoria (art. 16 e 9º, II).
13. **Cópias de segurança:** a Política diz que backups do fornecedor podem conter dados por período
    limitado. Confirmar a janela real de retenção com o fornecedor (Neon) e ajustar.
14. **Registros de aceite** (`legal_acceptances`) **permanecem** após a exclusão da conta, como prova
    (art. 7º, VI / art. 16, I). Confirmar essa retenção e se deve constar expressamente na Política.
15. **Prazo de atendimento:** o sistema usa 15 dias corridos como prazo dos pedidos (art. 19, II). Confirmar.

### 3.8 Consumidor e contrato
16. **Direito de arrependimento** (CDC art. 49) — a minuta o menciona. Definir como será operado com Cakto
    e com a Google Play (regras próprias de reembolso).
17. **Limitação de responsabilidade** (Termos, seção 11): redação propositalmente neutra. Conferir contra
    o CDC (art. 51) e adaptar.
18. **Foro:** minuta assegura o foro do domicílio do consumidor em relações de consumo. Confirmar/definir foro
    para relações não consumeristas.
19. **Preços e renovação:** os Termos remetem à página *Meu plano* (não fixam valores). Confirmar se o
    dever de informação (CDC) exige mais detalhes no momento da contratação.

### 3.9 Comunicação de incidentes e segurança
20. Existe o compromisso de comunicar a ANPD e titulares (art. 48), mas **não há plano de resposta a
    incidentes** escrito. Elaborar (e conferir o regulamento vigente da ANPD sobre prazos e conteúdo).

---

## 4. Lacunas conhecidas (transparência)

1. **Marco Civil da Internet (Lei nº 12.965/2014), art. 15:** provedor de aplicações constituído como
   pessoa jurídica que exerce a atividade de forma organizada, profissional e com fins econômicos deve
   manter os **registros de acesso a aplicações por 6 meses**. **O sistema hoje não mantém uma tabela de
   registros de acesso** (o serviço de autenticação guarda IP/navegador das sessões enquanto existirem).
   Confirmar a obrigação e, se aplicável, implementar (tarefa de engenharia).
2. **RIPD (art. 38)** e **registro das operações (art. 37):** o inventário da seção 2 é o ponto de partida;
   falta formalizar.
3. **Política de retenção com prazos** e rotina automática de descarte (hoje a exclusão é sob demanda).
4. **Direito de correção:** o titular edita nome, foto e dados da casa no app; correção de outros dados é
   por pedido ao encarregado.
5. **Portabilidade:** a exportação é um arquivo JSON legível; o formato "interoperável" a definir com a ANPD
   quando regulamentado.
6. **Página web de exclusão de conta** para a Google Play (URL pública): hoje a exclusão é feita
   dentro do app; criar página pública com o mesmo fluxo/contato.

---

## 5. Como operar

1. **Preencher os dados da empresa** (variáveis de ambiente na Vercel — projeto do app):
   `LEGAL_CONTROLLER_NAME`, `LEGAL_CNPJ`, `LEGAL_ADDRESS`, `LEGAL_CONTACT_EMAIL`, `LEGAL_DPO_NAME`,
   `LEGAL_DPO_EMAIL`. Enquanto faltarem, as páginas mostram "[a preencher]" e um aviso.
2. **Revisão:** o(a) advogado(a) ajusta o texto em `packages/core/src/legal.ts` (ou indica as mudanças).
3. **Publicar mudança de texto:** altere `LEGAL_VERSION`, rode `pnpm --filter @ocafy/core legal:export`
   (atualiza os `.md`) e faça o deploy. Quem já usa o app só será obrigado a aceitar a nova versão
   quando a chave **`legal_gate`** estiver **ligada** no painel (Chaves). **Ela vem desligada**: ligue
   somente depois da revisão jurídica e de preencher os dados da empresa.
4. **Contas novas** sempre precisam aceitar (o servidor exige), independentemente da chave.
5. **Evidência de aceite:** `legal_acceptances` (e a exportação de dados do titular). O hash permite
   provar que o texto aceito é o daquela versão (`sha256(JSON.stringify(documento))`, ver
   `packages/api/src/legal.ts`). Guarde uma cópia dos `.md` de cada versão publicada.

## 6. Perguntas úteis para o(a) advogado(a)

- Podemos publicar com os Termos como *contrato de adesão* e a Política como aviso (sem "consentir com a Política")?
- A autodeclaração do responsável cumpre o art. 14, § 5º, ou exige outro mecanismo?
- Precisamos de encarregado nomeado desde já? Qual o canal público mínimo?
- Quais cláusulas de transferência internacional devemos formalizar com cada fornecedor?
- Qual o prazo de guarda dos registros de aceite e dos registros de acesso?
- Como tratar dados de adolescentes de 13 a 17 anos em perfis geridos pelos pais?
- O texto de arrependimento/reembolso está compatível com a operação via Cakto e Google Play?
