# Implantação: lembretes, assinatura, painel admin e LGPD (R2 + R3)

Tudo aqui foi construído para **funcionar sem as chaves** (o app segue normal) e ligar quando você
configurar. Nada abaixo mexe em dados de usuários.

## 1. App principal (Vercel — projeto `ocafy`)

Variáveis de ambiente (Settings → Environment Variables). Os valores de desenvolvimento estão em
`apps/web/.env.local`; **gere valores novos para produção**.

| Variável | Para quê | Como obter |
| --- | --- | --- |
| `RESEND_API_KEY`, `EMAIL_FROM`, `APP_URL` | e-mails (convite, cobrança) | Resend; `EMAIL_FROM=Ocafy <nao-responda@mintral.com.br>`; `APP_URL=https://ocafy.vercel.app` |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | avisos push | `npx web-push generate-vapid-keys`; subject `mailto:seu@email` |
| `CRON_SECRET` | protege `/api/cron/notify` | `openssl rand -hex 32` |
| `CAKTO_WEBHOOK_SECRET` | autentica o webhook da Cakto | você define e cadastra na Cakto |
| `CAKTO_CHECKOUT_QUARTERLY_URL`, `CAKTO_CHECKOUT_YEARLY_URL` | botões "Assinar" | links de checkout dos produtos na Cakto |
| `REVENUECAT_WEBHOOK_AUTH` | webhook do Google Play (RevenueCat) | você define e cadastra no RevenueCat |

### Agendador de lembretes (GitHub Actions)

O workflow `.github/workflows/notify-cron.yml` chama `/api/cron/notify` a cada 5 minutos.
Em GitHub → Settings → Secrets and variables → Actions, crie os **secrets** `APP_URL`
(ex.: `https://ocafy.vercel.app`) e `CRON_SECRET` (o mesmo valor da Vercel). Sem eles o job não faz nada.
A mesma chamada encerra carências vencidas e envia os avisos de cobrança.

## 2. Assinatura web (Cakto) — estrutura pronta, integração depois

- Webhook: **`POST https://SEU-APP/api/webhooks/cakto`**. Envie o segredo em `x-cakto-secret`,
  `Authorization: Bearer …` ou no campo `secret` do corpo.
- O link de pagamento recebe `?ref=<id da casa>` automaticamente (o app monta o link).
  A Cakto precisa devolver esse `ref` no webhook (campos `ref`, `refId`, `sck`, `src`, `utm_*` ou
  `metadata`). **Valide com um webhook de teste real**: o formato foi montado pela documentação
  pública e o adaptador (`packages/core/src/billing.ts → parseCaktoEvent`) é tolerante, mas confirme
  os nomes de evento e campos.
- Eventos tratados: compra aprovada / assinatura criada → Plus; renovada → estende; renovação
  recusada → **carência de 7 dias** (avisos por e-mail e push nos dias 0, 3 e 6); cancelada → vale
  até o fim do período pago; reembolso/chargeback → encerra na hora.
- Cada evento é guardado cru (sem segredos) em `billing_events` e processado **uma vez**.
  Eventos de uma casa desconhecida aparecem em **Saúde** no painel para conciliar manualmente.
- Preços/limites: `packages/core/src/plans.ts` (R$ 24,90 trimestral, R$ 79,90 anual, 14 dias de
  teste; Grátis: Solo/Casal, 1 pet, 1 projeto). Casas criadas antes dos planos ganharam
  cortesia "fundadora" sem prazo; o painel pode revogar.

## 3. Google Play (RevenueCat)

- Webhook: **`POST https://SEU-APP/api/webhooks/revenuecat`** com o cabeçalho
  `Authorization` igual a `REVENUECAT_WEBHOOK_AUTH`.
- No app Android, configure o `app_user_id` do RevenueCat como o **id da casa**.
- Publicação na Play Store (TWA/Bubblewrap), conta de desenvolvedor, política de privacidade e
  assinatura no Play Console: veja `docs/PLAY-STORE.md`.

## 4. Painel administrativo (`apps/admin`) — projeto separado na Vercel

1. Vercel → Add New Project → mesmo repositório → **Root Directory `apps/admin`**.
2. Domínio próprio (ex.: `admin.seudominio.com.br`) e, no Neon Auth, adicione esse domínio em
   *Trusted domains*.
3. Variáveis: as mesmas do app principal (`DATABASE_URL`, `DATABASE_URL_UNPOOLED`,
   `NEON_AUTH_BASE_URL`, `NEON_AUTH_JWKS_URL`, `NEON_AUTH_COOKIE_SECRET`, `RESEND_API_KEY`,
   `EMAIL_FROM`, `APP_URL`) **mais**:
   - `ADMIN_SECRET_KEY` — 32 bytes em hex (`openssl rand -hex 32`); cifra os segredos do 2º fator.
   - `ADMIN_SESSION_SECRET` — 32+ caracteres aleatórios; assina o cookie do painel.
4. **Primeiro proprietário** (uma vez, na sua máquina, com `apps/admin/.env.local` apontando para o
   banco de produção): `pnpm --filter @ocafy/admin bootstrap seu@email.com`. A conta precisa já
   existir no Ocafy. O comando mostra o segredo do autenticador **uma única vez** — cadastre no
   Google Authenticator/Authy. Depois, novas pessoas são convidadas em **Equipe**.
5. Papéis: proprietário (tudo), administrador (tudo menos equipe), suporte (leitura, notas e
   exportações LGPD), financeiro (planos e assinaturas), leitura.
6. Toda ação exige **justificativa** e vai para a auditoria **imutável** (o banco bloqueia
   UPDATE/DELETE/TRUNCATE), inclusive tentativas negadas e falhas.
7. **Chaves globais** (`maintenance`, `signups_open`, `push_enabled`) valem em até 15 s sem deploy.

## 5. LGPD

- No app: Ajustes → *Privacidade e dados* → **Baixar meus dados** (imediato) e **Excluir minha conta**
  (abre pedido com prazo de 15 dias).
- No painel: **LGPD** lista os pedidos com prazo; suporte gera a exportação; administrador executa
  a exclusão (apaga membro/casa e a conta do Neon Auth; a evidência fica no pedido e na auditoria).
- Perfis de criança não têm login: são criados e controlados por um adulto responsável. Revise o
  texto da política de privacidade com um(a) advogado(a) antes do lançamento público.

## 6. Verificação rápida depois do deploy

1. `https://SEU-APP/api/cron/notify` sem token deve responder `401`.
2. `POST /api/webhooks/cakto` sem segredo → `401`; com segredo e evento de teste → `200`.
3. No painel: Visão geral carrega; **Saúde** mostra as chaves como `ok`.
4. Em `/lembretes` no app, ative os avisos e use *Enviar aviso de teste*.

## 7. Termos de Uso, Política de Privacidade e aceite (LGPD)

- Páginas públicas: `/termos` e `/privacidade`. Texto-fonte: `packages/core/src/legal.ts`;
  arquivos `docs/legal/*.md` são gerados (`pnpm --filter @ocafy/core legal:export`).
- **Antes de divulgar o app:** preencher `LEGAL_CONTROLLER_NAME`, `LEGAL_CNPJ`, `LEGAL_ADDRESS`,
  `LEGAL_CONTACT_EMAIL`, `LEGAL_DPO_NAME`, `LEGAL_DPO_EMAIL` na Vercel e enviar `docs/legal/` para revisão
  de um(a) advogado(a) (`docs/legal/REVISAO-JURIDICA.md`).
- Contas novas **sempre** aceitam no onboarding (o servidor exige). Para exigir novo aceite de quem já
  usa, ligue a chave **`legal_gate`** no painel (vem desligada) — só depois da revisão jurídica.
