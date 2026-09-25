# Plano de desenvolvimento — API pública e integrações do Ocafy

> **Status:** plano (nada da API pública foi implementado ainda). A base de privacidade e
> consentimento que ela exige **já existe** (ver `docs/legal/`). Prazos são estimativas de um(a)
> desenvolvedor(a) pleno(a) já familiarizado(a) com o projeto.

## 1. Objetivo

Permitir que **outros apps usem dados do Ocafy** (com autorização da pessoa) e que o **Ocafy receba
informações de outros apps** ("vice-versa"), sem abrir mão de segurança, LGPD e controle do usuário.

Casos de uso priorizados:

| Direção | Caso | Valor |
| --- | --- | --- |
| Saída | Lista de compras → app de supermercado/delivery (carrinho) | Recorrência de compra; receita de afiliados |
| Saída | Tarefa concluída / item urgente → Zapier, Make, n8n, Home Assistant, assistentes | Automação sem código |
| Saída | Painel do parceiro (varejo, banco) lendo hábito de compra agregado do próprio cliente | B2B2C |
| Entrada | Calendário (Google/Outlook, arquivo ICS) → ausências e dias fora de casa | Lembretes mais certeiros |
| Entrada | Apps de compras/delivery → marcar itens como comprados | Lista sempre atualizada |
| Entrada | Casa inteligente/assistentes → registrar tarefa feita por voz | Conveniência |

## 2. Princípios (inegociáveis)

1. **O usuário manda:** nenhum terceiro lê ou escreve sem **autorização explícita e revogável** da pessoa
   (escopos claros, tela de consentimento, revogação a qualquer momento).
2. **Mínimo necessário:** escopos pequenos. **Nunca expor:** perfis de criança, agenda/ausências,
   e-mails de outras pessoas, dados de cobrança, foto de perfil.
3. **Servidor é a autoridade:** mesmas regras e limites de plano que o app usa (o app já aplica tudo no
   servidor; a API reaproveita).
4. **Tudo auditável:** cada chamada por chave/app fica registrada (quem, o quê, quando, resultado).
5. **Estável e versionada:** `/api/v1` não quebra contrato; mudanças incompatíveis vão para `/v2`.
6. **Seguro por padrão:** chaves guardadas com hash, limites de uso, tokens curtos, segredos de webhook
   por endpoint.

## 3. Arquitetura proposta

```
Parceiro ──HTTPS──> /api/v1/*  ──> autenticação (chave/token) ──> escopo ──> serviços já existentes
                                      │                                  (packages/api, core)
Ocafy ──eventos──> fila de entrega ──> Webhooks de saída (assinados) ──> Parceiro
```

- Reaproveitar `packages/api` (regras, validação, planos) e expor uma camada **REST** fina em
  `apps/web/src/app/api/v1/`. O tRPC atual continua interno ao app.
- **Sem novo serviço** no início: rotas na própria aplicação (Vercel), banco atual (Neon).
- **Documentação viva:** especificação **OpenAPI 3** versionada no repositório (`docs/openapi/v1.yaml`),
  página `/desenvolvedores` com a referência e exemplos (curl e JavaScript).

## 4. Autenticação e autorização

### Fase 1 — Chaves de API pessoais (por casa)
- O(a) **dono(a) da casa** cria a chave em *Ajustes → Integrações* (recurso do **plano Plus**),
  escolhe **escopos** e um nome ("Zapier"). A chave aparece **uma única vez**.
- Formato: `ocf_live_<prefixo>_<segredo>`; guardamos só **SHA-256 do segredo** + prefixo (para
  identificar), data de criação, último uso e escopos. Revogação imediata.
- Cabeçalho: `Authorization: Bearer ocf_live_…`. Limite por chave (ex.: 60 req/min — ajustável).

### Fase 3 — OAuth 2.0 (apps de terceiros)
- Fluxo *authorization code + PKCE*; tela de consentimento listando **quem** é o app e **o que** ele
  poderá fazer; tokens de acesso curtos e *refresh token* rotativo; painel do usuário para revogar.
- Só quando houver um parceiro real pedindo (evitar complexidade prematura).

### Escopos (v1)
| Escopo | Permite |
| --- | --- |
| `tasks:read` | Ler o plano de tarefas e o histórico recente (sem dados de crianças) |
| `tasks:write` | Registrar tarefa concluída (crédito ao dono da chave) |
| `shopping:read` | Ler a lista de compras |
| `shopping:write` | Adicionar/editar/marcar itens da lista |
| `meals:read` | Ler o cardápio |
| `house:read` | Ler nome da casa, modo, cômodos e pets (sem dados pessoais de terceiros) |
| `webhooks:manage` | Criar/remover endpoints de webhook |

## 5. Endpoints da v1 (proposta)

Base: `https://<app>/api/v1`. JSON, datas ISO 8601, erros no formato `{ "error": { "code", "message" } }`.

| Método e caminho | Escopo | Descrição |
| --- | --- | --- |
| `GET /house` | `house:read` | Resumo da casa |
| `GET /tasks` | `tasks:read` | Plano de tarefas com situação (em dia / na janela / atrasada) |
| `POST /tasks/{key}/complete` | `tasks:write` | Registra conclusão (aceita `Idempotency-Key`) |
| `GET /shopping/items` | `shopping:read` | Itens abertos, por urgência |
| `POST /shopping/items` | `shopping:write` | Adiciona item |
| `PATCH /shopping/items/{id}` | `shopping:write` | Edita item / urgência |
| `POST /shopping/items/{id}/bought` | `shopping:write` | Marca comprado |
| `GET /meals` | `meals:read` | Cardápio da semana |
| `GET/POST/DELETE /webhooks` | `webhooks:manage` | Gerencia endpoints de saída |

Convenções: paginação por cursor, `Idempotency-Key` em escritas, `429` com `Retry-After`, `401/403`
distintos, `X-Request-Id` em toda resposta, `Cache-Control: private, no-store`.

## 6. Webhooks de saída

- **Eventos (v1):** `task.completed`, `shopping.item_added`, `shopping.item_urgent`,
  `shopping.trip_finished`, `reward.redeemed`. Nunca eventos de crianças/agenda.
- **Envelope:** `{ id, type, created_at, house_id, data }`.
- **Assinatura:** cabeçalho `X-Ocafy-Signature: t=<timestamp>,v1=<HMAC-SHA256(segredo, t + "." + corpo)>`;
  o parceiro rejeita timestamps antigos (anti-replay).
- **Entrega:** fila com **retentativas exponenciais** (ex.: 1 min, 5 min, 30 min, 2 h, 12 h), registro de
  cada tentativa e **desativação automática** após falhas prolongadas (com aviso ao dono).
- **Segurança:** só `https`, bloqueio de endereços internos/privados (**anti-SSRF**, como já feito no push).
- **Idempotência:** `id` do evento único; o receptor deduplica.

## 7. Integrações de entrada (Ocafy consumindo outros apps)

1. **Calendário → ausências (somente leitura):** importar por **arquivo/URL ICS** primeiro (sem OAuth);
   depois Google Calendar/Outlook via OAuth com escopo mínimo de leitura. Só cria "ausências"; nunca
   grava no calendário do usuário.
2. **Retorno de compras:** parceiro chama `POST /shopping/items/{id}/bought` (chave com escopo).
3. **Assistentes/voz e casa inteligente:** via automação (Zapier/Make/Home Assistant) usando a API v1.
4. Cada conexão é **uma autorização do usuário**, listada e revogável em *Integrações*.

## 8. Privacidade, LGPD e termos (pré-requisito e continuidade)

Já existe: aceite versionado com prova, declaração do responsável, exportação e exclusão, auditoria imutável.
Para a API, **acrescentar**:

1. **Tela de consentimento por integração** (escopos em linguagem simples) e **registro do consentimento**
   (mesma tabela de aceites, novo tipo `integration`, com escopos e hash do texto).
2. **Termos do Desenvolvedor** (documento próprio, fonte única em `core/legal.ts`): deveres do parceiro,
   proibição de revender dados, finalidade limitada, deletar dados ao ser desconectado, notificar incidentes.
   **Revisão jurídica obrigatória** antes de abrir a API a terceiros.
3. **Papéis na LGPD:** ao receber dados via API, o parceiro atua como **controlador próprio**; o Ocafy é
   controlador ao disponibilizar. Ajustar a Política de Privacidade (seção "Com quem compartilhamos") e
   incluir a lista de integrações autorizadas pela pessoa.
4. **Direitos do titular:** exportação inclui as integrações conectadas e o histórico de uso das chaves;
   exclusão da conta revoga todas as chaves e webhooks.
5. **Crianças:** dados de perfis de criança e agenda **fora de todos os escopos** por decisão de projeto.

## 9. Operação, limites e monetização

- **Plano:** API e webhooks no **Plus** (limite de chaves e de eventos por casa); Grátis sem API
  (ou somente leitura com limite baixo — decisão do dono).
- **Limites:** por chave e por casa; cotas mensais de webhooks; alertas ao atingir 80%.
- **Painel admin:** listar chaves/integrações por casa, revogar, ver falhas de webhook, chave global
  `api_enabled` para desligar tudo (mesmo mecanismo das outras chaves).
- **Parcerias (B2B):** chaves "de parceiro" com escopos e cotas maiores, contrato próprio e (futuro)
  receita por comissão/afiliação — ver `docs/APRESENTACAO-INVESTIDORES.md`.

## 10. Banco de dados (novas tabelas, aditivas)

- `api_keys` — `id`, `household_id`, `created_by`, `name`, `prefix`, `secret_hash`, `scopes[]`, `created_at`,
  `last_used_at`, `revoked_at`.
- `api_request_log` — `key_id`, `method`, `path`, `status`, `ip`, `created_at` (retenção curta, ex.: 90 dias — decidir).
- `webhook_endpoints` — `id`, `household_id`, `url`, `secret` (cifrado), `events[]`, `active`, `failure_count`.
- `webhook_deliveries` — `id`, `endpoint_id`, `event_id`, `attempt`, `status`, `response_code`, `next_attempt_at`.
- `integration_grants` (Fase 3) — `household_id`, `app_id`, `scopes[]`, `consent_version`, `granted_by`, `revoked_at`.

## 11. Plano de entrega

| Fase | Entrega | Estimativa |
| --- | --- | --- |
| **0. Pré-requisitos** | Termos/Política com aceite versionado, declaração do responsável, exportação/exclusão (**feito**); revisão jurídica dos documentos (pendente); Termos do Desenvolvedor | 2–3 d (só o texto dos Termos do Desenvolvedor) |
| **1. Chaves + leitura** | Tabelas, criação/revogação de chaves em *Integrações*, autenticação por Bearer, limites, `GET /house`, `/tasks`, `/shopping/items`, `/meals`, OpenAPI v1, página `/desenvolvedores`, testes | 8–12 d |
| **2. Escrita + webhooks** | `POST` de tarefas e compras com idempotência, webhooks assinados com fila/retentativas, painel admin (chaves, falhas), chave global | 8–12 d |
| **3. OAuth** | Autorização com PKCE, tela de consentimento, tokens/rotação, revogação, `integration_grants` | 10–15 d |
| **4. Ecossistema** | SDK JavaScript, ICS/Google Calendar (entrada), conectores Zapier/Make, ambiente de testes (sandbox) | 10–15 d |

Critérios de aceite por fase: testes automáticos de escopo (cada endpoint **recusa** escopo faltante),
isolamento entre casas, anti-SSRF, limites de taxa, idempotência, auditoria e revogação imediata.

## 12. Riscos e mitigação

| Risco | Mitigação |
| --- | --- |
| Vazamento de chave | Hash no banco, exibição única, revogação imediata, prefixo para rastrear, alertas de uso anormal |
| Abuso/raspagem | Limites por chave e por IP, cotas, detecção no painel |
| Quebra de contrato com parceiros | `/v1` estável, política de descontinuação (aviso mínimo, ex.: 6 meses) |
| Exposição indevida de dados pessoais | Escopos mínimos, sem crianças/agenda, revisão jurídica, consentimento registrado |
| SSRF em webhooks | Somente https, bloqueio de IPs privados/loopback/metadados, resolução DNS conferida |
| Custo de manter | Começar com chaves + webhooks; OAuth só com demanda real |

## 13. Decisões para o dono do produto

1. API só no **Plus** ou uma versão limitada no Grátis?
2. Quais **eventos e escopos** entram na v1 (a proposta acima é o mínimo)?
3. Haverá **programa de parceiros** com contrato próprio e cotas maiores?
4. **Primeiro parceiro-alvo** (define a prioridade entre saída/entrada e OAuth).
5. Retenção do log de chamadas da API (proposta: 90 dias).
