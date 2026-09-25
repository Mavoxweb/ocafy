import { admin } from "@ocafy/api";

/**
 * Cria o PRIMEIRO proprietário do painel (só funciona enquanto a equipe está vazia).
 * Uso:  pnpm --filter @ocafy/admin bootstrap voce@exemplo.com
 * A pessoa precisa já ter conta no Ocafy (o mesmo e-mail). O segredo do autenticador aparece
 * uma única vez: cadastre no Google Authenticator/Authy.
 * Variáveis: DATABASE_URL, ADMIN_SECRET_KEY (32 bytes em hex) — em apps/admin/.env.local.
 */
async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error(
      "Informe o e-mail: pnpm --filter @ocafy/admin bootstrap voce@exemplo.com",
    );
    process.exit(1);
  }
  try {
    const { secret, uri, staff } = await admin.bootstrapOwner(email);
    console.log(`\nProprietário criado: ${staff.email}`);
    console.log(
      `\nSegredo do autenticador (guarde agora, não será mostrado de novo):\n  ${secret}`,
    );
    console.log(`\nOu abra este endereço no app autenticador:\n  ${uri}\n`);
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  }
  // Sai depois de fechar as conexões (evita falha de saída no Windows).
  setTimeout(() => process.exit(0), 200);
}

void main();
