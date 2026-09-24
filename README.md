<p align="center"><img src="assets/ocafy-logo-horizontal.svg" alt="Ocafy" width="360"></p>

<p align="center"><strong>Deixa a casa ok.</strong></p>

Ocafy é um web app de gestão doméstica gamificada para casais: rotinas da casa com método, divisão justa das tarefas e progresso visível.

## Funcionalidades

- **Hoje:** anel de progresso da rotina, sequência de dias, nível e XP de cada pessoa, carrossel de cômodos e prioridades do dia.
- **Rotinas:** mais de 35 tarefas com janela de frequência (mínimo e máximo de dias), técnica explicada e plano da semana.
- **Cozinha:** planejamento de refeições com alertas para tirar a proteína do congelador.
- **Gatos:** controle da troca de areia, consumo por mês e estoque de sacos.
- **Projeto Escritório:** trilha de 9 semanas com um objetivo por semana e inventário de itens.
- **Placar:** desafio semanal do casal, níveis e 13 conquistas.
- Modo claro e escuro, dois usuários e desfazer em qualquer registro.

## Tecnologia

Um único arquivo `index.html`: HTML, CSS e JavaScript puro, sem framework e sem etapa de build.

- **Dados:** quando publicado como Claude Artifact, sincroniza entre os dois usuários pelo banco de dados do runtime. Aberto fora do Claude, salva no `localStorage` do navegador.
- **Fontes:** Manrope (Google Fonts).

## Rodar localmente

Abra o `index.html` no navegador ou sirva a pasta:

```bash
npx serve .
```

## App web (Next.js + tRPC + Neon)

Monorepo pnpm/Turborepo: `apps/web` (Next.js 16), `apps/mobile` (Expo), `packages/core` (regras e catálogo),
`packages/db` (Drizzle + Neon), `packages/api` (tRPC v11) e `packages/ui` (tokens).

```bash
pnpm install
cp .env.example apps/web/.env.local     # preencha com uma branch de desenvolvimento do Neon
pnpm --filter @ocafy/db db:migrate      # cria as tabelas no banco apontado por DATABASE_URL_UNPOOLED
pnpm --filter @ocafy/web dev            # http://localhost:3000
```

- **Login:** Neon Auth (e-mail e senha) via `@neondatabase/auth`. As rotas do app ficam protegidas em `src/proxy.ts`.
- **Casa de casal:** cada pessoa tem a própria conta; a segunda entra por código/link de convite (`/entrar?convite=CODIGO`).
- **Dados:** o app mantém um cache do snapshot da casa (`household.snapshot`), atualiza a tela na hora (otimista),
  grava pelo tRPC e sincroniza a cada 15 s / ao voltar para a aba.
- **Segurança:** a casa e o membro vêm sempre da sessão no servidor (`memberProcedure`), nunca de parâmetros do cliente.
- **Testes:** `pnpm test` roda o `core` e, se houver `DATABASE_URL` de uma branch que não seja `production`,
  os testes de integração da API contra o Neon (sem a variável, eles são pulados).
- **Migrations:** `pnpm --filter @ocafy/db db:generate` gera o SQL em `packages/db/drizzle/` a partir de `schema.ts`.

O protótipo `index.html` continua como referência visual.

## Marca

| Arquivo | Uso |
|---|---|
| `assets/ocafy-simbolo.svg` | Símbolo (a oca com o coração) |
| `assets/ocafy-icone.svg` | Ícone do app |
| `assets/ocafy-logo-horizontal.svg` | Logotipo principal |
| `assets/ocafy-logo-negativo.svg` | Logotipo para fundo escuro |

Cores: Rosa Ocafy `#FFB7C5` · Rosa Profundo `#C24B68` · Menta `#D5F3D8` · Verde Feito `#9ADBA9` · Blush `#F2C7C7` · Tinta `#2B2226`.

## Próximos passos

- [x] Autenticação e banco próprio (Neon Auth + Postgres)
- [ ] PWA instalável com notificações push (alertas do congelador e da rotina)
- [x] Migração para Next.js mantendo a lógica atual (`apps/web`, Fase 4)
- [x] `apps/web` ligado ao tRPC/Neon (Fase 5)
- [ ] Aplicar as migrations e o Auth na branch `production` do Neon e publicar (domínio confiável no Neon Auth)
