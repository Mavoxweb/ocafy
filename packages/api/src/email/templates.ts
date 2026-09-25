/** Modelos de e-mail com a marca do Ocafy (HTML simples, compatível com clientes de e-mail). */

const ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ENTITIES[c] as string);

function layout(
  title: string,
  bodyHtml: string,
  cta?: { label: string; url: string },
): string {
  const button = cta
    ? `<p style="margin:24px 0"><a href="${esc(cta.url)}" style="background:#FFB7C5;color:#4A2330;font-weight:700;text-decoration:none;padding:13px 22px;border-radius:14px;display:inline-block">${esc(cta.label)}</a></p>
       <p style="font-size:12px;color:#8A8286">Se o botão não abrir, copie este endereço no navegador:<br>${esc(cta.url)}</p>`
    : "";
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#F6F4F5;font-family:Arial,Helvetica,sans-serif;color:#2B2226">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:28px 12px">
   <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;background:#fff;border-radius:22px;padding:28px">
    <tr><td><div style="font-size:22px;font-weight:800;letter-spacing:-.04em">ocafy</div>
     <div style="font-size:12px;color:#8A8286;margin-bottom:18px">Deixa a casa ok.</div>
     <h1 style="font-size:20px;margin:0 0 10px">${esc(title)}</h1>
     ${bodyHtml}${button}
    </td></tr>
   </table>
   <p style="font-size:11px;color:#8A8286;margin-top:14px">Você recebeu este e-mail porque tem (ou foi convidado para) uma conta no Ocafy.</p>
  </td></tr></table></body></html>`;
}

export function inviteEmail(opts: {
  inviterName: string;
  houseName: string;
  url: string;
  code: string;
}) {
  return {
    subject: `${opts.inviterName} convidou você para a casa “${opts.houseName}” no Ocafy`,
    html: layout(
      "Você foi convidado(a)!",
      `<p style="line-height:1.5"><b>${esc(opts.inviterName)}</b> quer dividir a rotina da casa <b>${esc(opts.houseName)}</b> com você no Ocafy.</p>
       <p style="line-height:1.5">Crie sua conta e o código <b style="letter-spacing:.08em">${esc(opts.code)}</b> será usado automaticamente. O convite vale por 7 dias.</p>`,
      { label: "Aceitar convite", url: opts.url },
    ),
    text: `${opts.inviterName} convidou você para a casa "${opts.houseName}" no Ocafy. Abra ${opts.url} (código ${opts.code}, vale 7 dias).`,
  };
}

export function welcomeEmail(opts: { name: string; url: string }) {
  return {
    subject: "Bem-vindo(a) ao Ocafy",
    html: layout(
      `Oi, ${opts.name}! Bem-vindo(a)`,
      `<p style="line-height:1.5">Sua casa está pronta. Comece marcando a rotina da manhã e convide quem mora com você para dividir as tarefas.</p>`,
      { label: "Abrir o Ocafy", url: opts.url },
    ),
    text: `Oi, ${opts.name}! Sua casa no Ocafy está pronta: ${opts.url}`,
  };
}

/** Reserva: hoje o e-mail de redefinição de senha sai pelo Neon Auth (SMTP do Resend). */
export function passwordResetEmail(opts: { name: string; url: string }) {
  return {
    subject: "Redefinir sua senha do Ocafy",
    html: layout(
      "Redefinir senha",
      `<p style="line-height:1.5">Oi, ${esc(opts.name)}. Recebemos um pedido para redefinir a senha. O link vale por pouco tempo. Se não foi você, ignore este e-mail.</p>`,
      { label: "Escolher nova senha", url: opts.url },
    ),
    text: `Redefina sua senha do Ocafy: ${opts.url}`,
  };
}

export function paymentFailedEmail(opts: {
  houseName: string;
  daysLeft: number;
  step: number;
  url: string;
}) {
  const last = opts.step >= 3;
  return {
    subject: last
      ? `Último aviso: o Plus da casa “${opts.houseName}” termina amanhã`
      : `Não conseguimos cobrar sua assinatura do Ocafy`,
    html: layout(
      last ? "Seu Plus termina amanhã" : "Pagamento não realizado",
      `<p style="line-height:1.5">Não conseguimos processar o pagamento da assinatura Plus da casa <b>${esc(opts.houseName)}</b>.</p>
       <p style="line-height:1.5">O Plus continua ativo por mais <b>${opts.daysLeft} ${opts.daysLeft === 1 ? "dia" : "dias"}</b>. Depois disso a casa volta ao plano Grátis — <b>nada do que vocês registraram é apagado</b>, apenas deixa de ser possível adicionar além dos limites do plano.</p>`,
      { label: "Atualizar pagamento", url: opts.url },
    ),
    text: `Não conseguimos cobrar a assinatura Plus da casa "${opts.houseName}". O Plus segue ativo por ${opts.daysLeft} dia(s). Atualize o pagamento: ${opts.url}`,
  };
}
