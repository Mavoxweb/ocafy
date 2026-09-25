# Ocafy na Google Play

O app web já é um PWA (manifest, ícones 192/512/maskable, service worker com push). O caminho mais
curto para a Play Store é uma **Trusted Web Activity (TWA)** que abre o Ocafy em tela cheia.

> Estas etapas dependem de contas e chaves suas (Play Console, RevenueCat, Firebase). Nada disso
> foi feito automaticamente.

## Checklist

1. **Conta de desenvolvedor** Google Play (taxa única) e organização/identidade verificada.
2. **Domínio próprio com HTTPS** (ex.: `app.seudominio.com.br`) — a TWA valida o domínio.
3. **Digital Asset Links**: publique `https://SEU-DOMINIO/.well-known/assetlinks.json` com o
   fingerprint SHA-256 da chave de assinatura do app (o Play Console mostra em *Integridade do app*).
   Coloque o arquivo em `apps/web/public/.well-known/assetlinks.json`.
4. **Gerar o pacote**: `npx @bubblewrap/cli init --manifest https://SEU-DOMINIO/manifest.json`
   e `bubblewrap build` (gera `.aab`). Ícones e cores vêm do `manifest.json`.
5. **Política de privacidade** pública (URL) descrevendo dados, perfis de criança sem login,
   LGPD e como pedir exportação/exclusão (Ajustes → Privacidade). A **exclusão de conta** precisa
   estar acessível dentro do app *e* por uma página web (a Play exige a URL).
6. **Formulário de segurança de dados** do Play Console: coleta e-mail, nome, uso do app; não
   vende dados; dados criptografados em trânsito; exclusão disponível.
7. **Público-alvo**: o Ocafy é para adultos e famílias (não é app para crianças). Mantenha essa
   classificação: perfis de criança são geridos por um responsável.
8. **Assinaturas**: crie o produto *Plus* (trimestral e anual) no Play Console e conecte ao
   **RevenueCat**; configure o webhook (`docs/IMPLANTACAO-R2-R3.md`, seção 3) e use o id da casa
   como `app_user_id`. Em apps na Play, a compra de assinatura digital deve usar o Google Play Billing.
9. **Push**: no Android, o Web Push funciona dentro da TWA (Chrome). Para FCM nativo seria
   necessário um app nativo; não é preciso para o MVP.
10. **Teste fechado** (mín. exigido pela Play para contas novas) antes da produção.

## Observações

- iPhone: notificações push exigem o PWA instalado na tela inicial (o app avisa isso em
  *Lembretes*).
- Preços na Play podem diferir do web (taxas da loja); ajuste em `packages/core/src/plans.ts`
  apenas para exibição — o valor cobrado é o cadastrado em cada loja.
